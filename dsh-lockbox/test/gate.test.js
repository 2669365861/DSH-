import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { apply } from '../index.js';

const SMTP = {
  host: 'smtp.example.com',
  port: 465,
  security: 'ssl',
  user: 'sender@example.com',
  from: 'sender@example.com',
  password: 'smtp-secret-pass',
};

function fakeResponse() {
  const res = {
    statusCode: 0,
    headers: {},
    headersSent: false,
    writableEnded: false,
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(status, headers) {
      this.statusCode = status;
      if (headers) for (const [key, value] of Object.entries(headers)) this.setHeader(key, value);
      this.headersSent = true;
    },
    end(chunk) {
      if (chunk !== undefined) this.body += String(chunk);
      this.writableEnded = true;
      this.resolveEnd?.();
    },
  };
  res.done = new Promise((resolve) => {
    res.resolveEnd = resolve;
  });
  return res;
}

function fakeRequest(url, method = 'GET', body) {
  const payload = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const req = Readable.from(payload);
  req.url = url;
  req.method = method;
  req.headers = body === undefined ? {} : { 'content-type': 'application/json' };
  return req;
}

/** Mount the plugin against a stub host and return its gate and JSON route. */
function mount(dir) {
  process.env.DSH_HOME = dir;
  let gate = null;
  let route = null;
  const ctx = {
    effect(factory) {
      const dispose = factory();
      return typeof dispose === 'function' ? dispose : () => {};
    },
    on(event, handler) {
      assert.equal(event, 'connection/request');
      gate = handler;
      return () => {};
    },
    webServer: {
      register(registration) {
        assert.equal(registration.kind, 'prefix');
        assert.equal(registration.path, '/dsh-lockbox-7347');
        route = registration.handler;
        return () => {};
      },
    },
  };
  apply(ctx);
  assert.ok(gate, 'the /api gate must be registered');
  assert.ok(route, 'the JSON route must be registered');
  return { gate, route };
}

async function call(route, url, method, body) {
  const res = fakeResponse();
  await route(fakeRequest(url, method, body), res);
  await res.done;
  const json = res.body ? JSON.parse(res.body) : null;
  return { status: res.statusCode, json };
}

async function hitsGate(gate, url) {
  const res = fakeResponse();
  let passed = false;
  await gate(fakeRequest(url), res, () => {
    passed = true;
  });
  return { passed, status: res.statusCode, json: res.body ? JSON.parse(res.body) : null };
}

test('the host /api gate is open by default so the client can boot', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lockbox-gate-'));
  t.after(() => {
    delete process.env.DSH_HOME;
    rmSync(dir, { recursive: true, force: true });
  });
  const { gate, route } = mount(dir);

  const assets = await hitsGate(gate, '/assets/app.js');
  assert.equal(assets.passed, true, 'static assets are never gated');

  const apiWhileUnconfigured = await hitsGate(gate, '/api/rpc');
  assert.equal(apiWhileUnconfigured.passed, true, 'booting plugins must reach the host API');

  const status = await call(route, '/dsh-lockbox-7347/status', 'GET');
  assert.equal(status.status, 200);
  assert.equal(status.json.configured, false);
  assert.equal(status.json.locked, true);

  const setup = await call(route, '/dsh-lockbox-7347/setup', 'POST', {
    password: 'correct horse',
    email: 'owner@example.com',
    smtp: SMTP,
  });
  assert.equal(setup.status, 200, JSON.stringify(setup.json));
  assert.match(setup.json.token, /^[0-9a-f]{64}$/);

  const locked = await call(route, '/dsh-lockbox-7347/lock', 'POST');
  assert.equal(locked.json.status.locked, true);
  assert.equal((await hitsGate(gate, '/api?x=1')).passed, true, 'the default gate never locks the API');

  const wrong = await call(route, '/dsh-lockbox-7347/unlock', 'POST', { password: 'nope nope' });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.json.code, 'INVALID_PASSWORD');

  const unlocked = await call(route, '/dsh-lockbox-7347/unlock', 'POST', { password: 'correct horse' });
  assert.equal(unlocked.status, 200);
  assert.match(unlocked.json.token, /^[0-9a-f]{64}$/);
});

test('enforceApi turns the host gate into a 423 wall while locked', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lockbox-gate-'));
  process.env.DSH_LOCKBOX_ENFORCE_API = '1';
  t.after(() => {
    delete process.env.DSH_HOME;
    delete process.env.DSH_LOCKBOX_ENFORCE_API;
    rmSync(dir, { recursive: true, force: true });
  });
  const { gate, route } = mount(dir);

  const blockedBeforeSetup = await hitsGate(gate, '/api/rpc');
  assert.equal(blockedBeforeSetup.passed, false);
  assert.equal(blockedBeforeSetup.status, 423);
  assert.equal(blockedBeforeSetup.json.code, 'LOCKED');

  const assets = await hitsGate(gate, '/assets/app.js');
  assert.equal(assets.passed, true, 'static assets are still exempt');

  await call(route, '/dsh-lockbox-7347/setup', 'POST', {
    password: 'correct horse',
    email: 'owner@example.com',
    smtp: SMTP,
  });
  assert.equal((await hitsGate(gate, '/api/rpc')).passed, true, 'setup opens one live session');

  await call(route, '/dsh-lockbox-7347/lock', 'POST');
  assert.equal((await hitsGate(gate, '/api?x=1')).status, 423);
  assert.equal((await hitsGate(gate, '/dsh-lockbox-7347/status')).passed, true, 'the lockbox route is never gated');

  await call(route, '/dsh-lockbox-7347/unlock', 'POST', { password: 'correct horse' });
  assert.equal((await hitsGate(gate, '/api/rpc')).passed, true);
});

test('settings routes reject a request without a session token', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-lockbox-settings-'));
  t.after(() => {
    delete process.env.DSH_HOME;
    rmSync(dir, { recursive: true, force: true });
  });
  const { route } = mount(dir);
  await call(route, '/dsh-lockbox-7347/setup', 'POST', {
    password: 'correct horse',
    email: 'owner@example.com',
    smtp: SMTP,
  });

  const res = fakeResponse();
  const req = fakeRequest('/dsh-lockbox-7347/settings', 'GET');
  req.headers['x-lockbox-token'] = 'f'.repeat(64);
  await route(req, res);
  await res.done;
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).code, 'UNAUTHORIZED');
});
