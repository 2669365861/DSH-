import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LockboxStore, validatePassword } from '../lib/store.js';

const SMTP = {
  host: 'smtp.example.com',
  port: 465,
  security: 'ssl',
  user: 'sender@example.com',
  from: 'sender@example.com',
  password: 'smtp-secret-pass',
};

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'dsh-lockbox-store-'));
}

function codeFrom(message) {
  const match = /验证码：(\d{6})/.exec(message.text);
  assert.ok(match, 'verification mail must contain a 6-digit code');
  return match[1];
}

test('setup writes a sealed config and opens one session', async (t) => {
  const dir = tempDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const store = new LockboxStore({ dir, mailer: async () => {} });
  store.loadSync();
  assert.equal(store.configured, false);
  assert.equal(store.status().locked, true);

  const result = await store.setup({ password: 'correct horse', email: 'owner@example.com', smtp: SMTP });
  assert.match(result.token, /^[0-9a-f]{64}$/);
  assert.equal(result.status.configured, true);
  assert.equal(result.status.locked, false);
  assert.equal(result.status.smtpConfigured, true);
  assert.equal(result.status.emailMasked.includes('@example.com'), true);

  const reloaded = new LockboxStore({ dir }).loadSync();
  assert.equal(reloaded.configured, true);
  assert.equal(reloaded.status().locked, true, 'a new process starts locked');
});

test('unlock rejects a bad password and throttles repeated failures', async (t) => {
  const dir = tempDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const store = new LockboxStore({ dir, mailer: async () => {} }).loadSync();
  await store.setup({ password: 'correct horse', email: 'owner@example.com', smtp: SMTP });
  store.lock();
  assert.equal(store.isLocked(), true);

  await assert.rejects(store.unlock('wrong password'), (error) => error.code === 'INVALID_PASSWORD');
  const good = await store.unlock('correct horse');
  assert.match(good.token, /^[0-9a-f]{64}$/);
  assert.equal(store.isLocked(), false);

  store.lock();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(store.unlock('wrong password'), (error) => error.code === 'INVALID_PASSWORD');
  }
  await assert.rejects(store.unlock('correct horse'), (error) => error.code === 'TOO_MANY_ATTEMPTS');
});

test('heartbeat and settings require a live session', async (t) => {
  const dir = tempDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const store = new LockboxStore({ dir, mailer: async () => {} }).loadSync();
  const { token } = await store.setup({ password: 'correct horse', email: 'owner@example.com', smtp: SMTP });

  assert.deepEqual(store.heartbeat(token), { ok: true, locked: false });
  await assert.rejects(store.changePassword('0'.repeat(64), 'correct horse', 'new password'), (error) => error.code === 'UNAUTHORIZED');

  await store.changePassword(token, 'correct horse', 'new password');
  store.lock();
  await assert.rejects(store.unlock('correct horse'), (error) => error.code === 'INVALID_PASSWORD');
  assert.match((await store.unlock('new password')).token, /^[0-9a-f]{64}$/);
});

test('email code reset rotates the password and drops every session', async (t) => {
  const dir = tempDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const sent = [];
  const store = new LockboxStore({
    dir,
    mailer: async (smtp, message) => {
      sent.push({ smtp, message });
    },
  }).loadSync();
  const { token } = await store.setup({ password: 'correct horse', email: 'owner@example.com', smtp: SMTP });

  const requested = await store.requestResetCode();
  assert.equal(requested.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].message.to, 'owner@example.com');
  assert.equal(sent[0].smtp.password, SMTP.password, 'the SMTP password is decrypted for sending');

  const code = codeFrom(sent[0].message);
  await assert.rejects(store.resetPassword({ code: '000000', newPassword: 'another pass' }), (error) => error.code === 'INVALID_CODE');

  const reset = await store.resetPassword({ code, newPassword: 'another pass' });
  assert.equal(reset.locked, true);
  assert.equal(store.isLocked(), true);
  assert.throws(() => store.heartbeat(token), (error) => error.code === 'UNAUTHORIZED');

  assert.match((await store.unlock('another pass')).token, /^[0-9a-f]{64}$/);
});

test('validation helpers reject weak passwords and malformed mailboxes', () => {
  assert.throws(() => validatePassword('short'), (error) => error.code === 'PASSWORD_TOO_SHORT');
  assert.equal(validatePassword('long enough'), undefined);
});
