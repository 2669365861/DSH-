/**
 * dsh-lockbox — host half.
 *
 * Responsibilities:
 *   1. Keep the process-local lock state and verify the startup password.
 *   2. Reject every `/api` request with 423 until the lockbox is unlocked.
 *   3. Serve the small same-origin JSON API used by the lock screen and settings.
 *   4. Send password-reset codes through the configured SMTP account.
 *
 * The gate must be registered on the root Cordis context: dsh-client-connection
 * emits `connection/request` through a waterfall that bubbles to the root, and
 * dsh-desktop-host listens to the same event there. The plugin's own routes do
 * not start with `/api`, so they stay reachable while the API is gated.
 */
import {
  LockboxError,
  extractEmail,
  validateEmail,
  validateSmtp,
  LockboxStore,
} from './lib/store.js';
import { sendMail } from './lib/smtp.js';

export const name = 'dsh-lockbox';
export const inject = ['webServer'];

const ROUTE_PREFIX = '/dsh-lockbox-7347';
const MAX_BODY_BYTES = 64 * 1024;
const SETUP_TEST_WINDOW_MS = 15 * 60 * 1000;
const MAX_SETUP_TEST_SENDS = 5;

const STATUS_BY_CODE = {
  UNAUTHORIZED: 401,
  INVALID_PASSWORD: 401,
  TOO_MANY_ATTEMPTS: 429,
  COOLDOWN: 429,
  TOO_MANY_REQUESTS: 429,
  LOCKED: 423,
  EMAIL_SEND_FAILED: 502,
  SMTP_AUTH_FAILED: 502,
  SMTP_CONNECT_FAILED: 502,
  SMTP_TLS_FAILED: 502,
  SMTP_REJECTED: 502,
  SMTP_TIMEOUT: 504,
  BODY_TOO_LARGE: 413,
  INVALID_CONTENT_TYPE: 415,
  CONFIG_EXISTS: 409,
  CONFIG_CORRUPT: 409,
  NOT_CONFIGURED: 409,
  SMTP_NOT_CONFIGURED: 409,
  SECRET_KEY_MISSING: 500,
  SECRET_KEY_INVALID: 500,
};

export function apply(ctx) {
  const store = new LockboxStore().loadSync();
  const setupTestSends = [];

  ctx.effect(() => () => store.dispose(), 'dsh-lockbox: dispose store');

  // Optional hard gate on the host API. OFF by default: the shell and the
  // shipped client plugins read their persisted state over /api while they
  // boot, so answering 423 there aborts the whole client boot graph
  // (dsh-client-locale fails, ~50 plugins stay pending, the desktop window
  // reports "could not start"). The lock itself is the full-screen overlay
  // every client renders; turn this on only if you accept that trade-off,
  // e.g. with {"enforceApi": true} in config.json or DSH_LOCKBOX_ENFORCE_API=1.
  ctx.effect(
    () =>
      ctx.on(
        'connection/request',
        async (req, res, next) => {
          if (store.config?.enforceApi !== true && process.env.DSH_LOCKBOX_ENFORCE_API !== '1') return next();
          if (!isApiRequest(req.url)) return next();
          if (!store.isLocked()) return next();
          if (res.headersSent || res.writableEnded) return next();
          sendJson(res, 423, {
            ok: false,
            code: 'LOCKED',
            message: 'DSH Lockbox is locked. Unlock it to continue.',
          });
        },
        { prepend: true },
      ),
    'dsh-lockbox: /api lock gate',
  );

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: async (req, res) => {
          try {
            await handleRoute(req, res, store, setupTestSends);
          } catch (error) {
            handleError(res, error);
          }
        },
      }),
    'dsh-lockbox: JSON route',
  );
}

async function handleRoute(req, res, store, setupTestSends) {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const path = url.pathname.slice(ROUTE_PREFIX.length) || '/';
  const method = (req.method ?? 'GET').toUpperCase();
  const token = readToken(req);

  if (method === 'GET' && path === '/status') {
    return sendJson(res, 200, { ok: true, ...store.status() });
  }

  if (method === 'POST' && path === '/setup') {
    const body = await readJson(req);
    const result = await store.setup({
      password: body.password,
      email: body.email,
      smtp: body.smtp,
    });
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (method === 'POST' && path === '/setup/test-smtp') {
    if (store.configured) throw new LockboxError('CONFIG_EXISTS', 'The lockbox is already configured.');
    const now = Date.now();
    while (setupTestSends.length > 0 && now - setupTestSends[0] > SETUP_TEST_WINDOW_MS) setupTestSends.shift();
    if (setupTestSends.length >= MAX_SETUP_TEST_SENDS) {
      throw new LockboxError('TOO_MANY_REQUESTS', 'Too many test emails. Try again later.');
    }
    const body = await readJson(req);
    const smtp = validateSmtp(body.smtp);
    const to = body.email ? validateEmail(body.email) : validateEmail(extractEmail(smtp.from));
    await sendMail(smtp, {
      to,
      subject: 'DSH 加密锁 SMTP 测试 / DSH Lockbox SMTP test',
      text: [
        '这是一封测试邮件。',
        '如果你收到它，说明初始化向导里的邮件配置可用。',
        '',
        'This is a test email from the DSH Lockbox setup wizard.',
      ].join('\n'),
    });
    setupTestSends.push(now);
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'POST' && path === '/unlock') {
    const body = await readJson(req);
    const result = await store.unlock(body.password);
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (method === 'POST' && path === '/lock') {
    return sendJson(res, 200, { ok: true, status: store.lock() });
  }

  if (method === 'POST' && path === '/heartbeat') {
    const result = store.heartbeat(token);
    return sendJson(res, 200, result);
  }

  if (method === 'POST' && path === '/forgot') {
    const result = await store.requestResetCode();
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (method === 'POST' && path === '/reset') {
    const body = await readJson(req);
    const result = await store.resetPassword({ code: body.code, newPassword: body.newPassword });
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (method === 'GET' && path === '/settings') {
    requireToken(store, token);
    return sendJson(res, 200, { ok: true, settings: store.publicSettings() });
  }

  if (method === 'PUT' && path === '/settings/password') {
    const body = await readJson(req);
    const result = await store.changePassword(token, body.currentPassword, body.newPassword);
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (method === 'PUT' && path === '/settings/email') {
    const body = await readJson(req);
    const settings = await store.updateRecoveryEmail(token, body.currentPassword, body.email);
    return sendJson(res, 200, { ok: true, settings });
  }

  if (method === 'PUT' && path === '/settings/smtp') {
    const body = await readJson(req);
    const settings = await store.updateSmtp(token, body.smtp, { clearPassword: body.clearPassword === true });
    return sendJson(res, 200, { ok: true, settings });
  }

  if (method === 'PUT' && path === '/settings/auto-lock') {
    const body = await readJson(req);
    const settings = await store.updateAutoLock(token, body.minutes);
    return sendJson(res, 200, { ok: true, settings });
  }

  if (method === 'POST' && path === '/settings/test-email') {
    const result = await store.sendTestEmail(token);
    return sendJson(res, 200, result);
  }

  if (path === '/status') return methodNotAllowed(res, 'GET');
  if (path === '/settings') return methodNotAllowed(res, 'GET');
  return sendJson(res, 404, { ok: false, code: 'NOT_FOUND', message: 'Unknown lockbox route.' });
}

function requireToken(store, token) {
  if (!store.authenticate(token)) throw new LockboxError('UNAUTHORIZED', 'Unlock the lockbox first.');
}

function isApiRequest(rawUrl) {
  if (typeof rawUrl !== 'string') return false;
  return rawUrl === '/api' || rawUrl.startsWith('/api/') || rawUrl.startsWith('/api?');
}

function readToken(req) {
  const headerToken = req.headers['x-lockbox-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) return headerToken.trim();
  const authorization = req.headers.authorization;
  if (typeof authorization === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (match) return match[1].trim();
  }
  return '';
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] ?? '');
    let size = 0;
    const chunks = [];

    const cleanup = () => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      req.off('aborted', onAborted);
    };

    const fail = (error) => {
      cleanup();
      // Drain whatever is left so the response can be flushed cleanly.
      try {
        req.resume();
      } catch {
        // best effort
      }
      reject(error);
    };

    const onData = (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        fail(new LockboxError('BODY_TOO_LARGE', 'Request body is too large.', { maxBytes: MAX_BODY_BYTES }));
        return;
      }
      chunks.push(chunk);
    };

    const onEnd = () => {
      cleanup();
      if (size === 0) {
        resolve({});
        return;
      }
      if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
        reject(new LockboxError('INVALID_CONTENT_TYPE', 'Use application/json.'));
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new LockboxError('INVALID_JSON', 'Request body must be a JSON object.'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new LockboxError('INVALID_JSON', 'Request body is not valid JSON.'));
      }
    };

    const onError = (error) => fail(error);
    const onAborted = () => fail(new LockboxError('REQUEST_ABORTED', 'Request was aborted.'));

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('aborted', onAborted);
  });
}

function handleError(res, error) {
  if (res.headersSent || res.writableEnded || res.destroyed) return;
  const known = error instanceof LockboxError;
  const code = known ? error.code : 'INTERNAL_ERROR';
  const status = STATUS_BY_CODE[code] ?? 400;
  const payload = {
    ok: false,
    code,
    message: known ? error.message : 'The lockbox request failed.',
  };
  for (const key of ['retryAfterMs', 'remaining', 'minLength', 'maxLength', 'detail', 'maxBytes']) {
    if (known && error[key] !== undefined) payload[key] = error[key];
  }
  const headers = {};
  if (typeof payload.retryAfterMs === 'number' && payload.retryAfterMs > 0) {
    headers['Retry-After'] = String(Math.max(1, Math.ceil(payload.retryAfterMs / 1000)));
  }
  if (status >= 500) console.error('[dsh-lockbox] request failed:', error);
  sendJson(res, status, payload, headers);
}

function methodNotAllowed(res, allow) {
  sendJson(
    res,
    405,
    { ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
    { Allow: allow },
  );
}

function sendJson(res, status, value, extraHeaders = {}) {
  if (res.writableEnded || res.destroyed) return;
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  res.end(body);
}
