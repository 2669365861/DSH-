/**
 * dsh-lockbox — host-side credential store.
 *
 * The store owns the only mutable security state of the plugin:
 *   - the scrypt password record (never the password itself),
 *   - the recovery address and SMTP transport (password sealed with AES-GCM),
 *   - in-memory unlock sessions (never persisted; every Host start is locked),
 *   - one pending email reset code (hashed, short-lived, attempt-limited).
 *
 * It intentionally has no dependency on any @deepseek-ai package so the bundle
 * can be installed as a linked checkout without a package manager.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { sendMail } from './smtp.js';

const scrypt = promisify(scryptCallback);

export const DEFAULT_AUTO_LOCK_MINUTES = 30;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 256;
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const MAX_UNLOCK_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_RESEND_MS = 60 * 1000;
const MAX_RESET_SENDS = 5;
const RESET_SEND_WINDOW_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const MAX_TEST_SENDS = 8;
const TEST_SEND_WINDOW_MS = 15 * 60 * 1000;

export class LockboxError extends Error {
  /**
   * @param {string} code stable machine code consumed by the client
   * @param {string} message human-readable fallback (English)
   * @param {Record<string, unknown>} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'LockboxError';
    this.code = code;
    Object.assign(this, extra);
  }
}

/** Resolve the DSH home directory without importing a Harness package. */
export function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME?.trim();
  if (fromEnv) return fromEnv;
  return join(homedir(), '.dsh');
}

export function defaultConfigDir() {
  return join(resolveDshHome(), 'dsh-lockbox');
}

export function maskEmail(email) {
  if (typeof email !== 'string' || email.length === 0) return '';
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(2, Math.min(6, local.length - 1)))}@${domain}`;
}

export function validatePassword(password) {
  if (typeof password !== 'string') {
    throw new LockboxError('PASSWORD_REQUIRED', 'Password is required.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new LockboxError('PASSWORD_TOO_SHORT', `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, {
      minLength: MIN_PASSWORD_LENGTH,
    });
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new LockboxError('PASSWORD_TOO_LONG', `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`, {
      maxLength: MAX_PASSWORD_LENGTH,
    });
  }
}

export function validateEmail(email) {
  if (typeof email !== 'string') throw new LockboxError('EMAIL_INVALID', 'A recovery email is required.');
  const value = email.trim();
  if (value.length === 0 || value.length > 254 || /[\r\n]/.test(value)) {
    throw new LockboxError('EMAIL_INVALID', 'Enter a valid recovery email address.');
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) {
    throw new LockboxError('EMAIL_INVALID', 'Enter a valid recovery email address.');
  }
  return value;
}

/** Pull the addr-spec out of `Name <a@b>` or return the trimmed input. */
export function extractEmail(address) {
  if (typeof address !== 'string') return '';
  const value = address.trim();
  const angle = /<([^<>]+)>\s*$/.exec(value);
  return (angle ? angle[1] : value).trim();
}

export function validateSmtp(smtp) {
  if (!smtp || typeof smtp !== 'object') {
    throw new LockboxError('SMTP_INVALID', 'SMTP settings are required.');
  }
  const host = String(smtp.host ?? '').trim();
  if (!host || host.length > 255 || /[\r\n]/.test(host)) {
    throw new LockboxError('SMTP_INVALID', 'SMTP host is invalid.');
  }
  const port = Number(smtp.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new LockboxError('SMTP_INVALID', 'SMTP port must be between 1 and 65535.');
  }
  const security = String(smtp.security ?? 'starttls').toLowerCase();
  if (!['ssl', 'starttls', 'none'].includes(security)) {
    throw new LockboxError('SMTP_INVALID', 'SMTP security must be ssl, starttls, or none.');
  }
  const user = String(smtp.user ?? '').trim();
  if (user.length > 320 || /[\r\n]/.test(user)) {
    throw new LockboxError('SMTP_INVALID', 'SMTP username is invalid.');
  }
  const fromRaw = String(smtp.from ?? '').trim();
  if (!fromRaw || fromRaw.length > 320 || /[\r\n]/.test(fromRaw)) {
    throw new LockboxError('SMTP_INVALID', 'A sender address is required.');
  }
  const from = extractEmail(fromRaw);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)) {
    throw new LockboxError('SMTP_INVALID', 'Sender address is invalid.');
  }
  return {
    host,
    port,
    security,
    user,
    from: fromRaw,
    ...(typeof smtp.password === 'string' && smtp.password.length > 0 ? { password: smtp.password } : {}),
  };
}

function passwordRecordToString(record) {
  return `scrypt$${record.N}$${record.r}$${record.p}$${record.salt}$${record.hash}`;
}

function parsePasswordRecord(value) {
  if (typeof value !== 'string') return null;
  const parts = value.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [, n, r, p, salt, hash] = parts;
  return { N: Number(n), r: Number(r), p: Number(p), salt, hash };
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 128 * SCRYPT_N * SCRYPT_R * 2,
  });
  return {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    salt: salt.toString('base64'),
    hash: derived.toString('base64'),
  };
}

export async function createPasswordRecord(password) {
  validatePassword(password);
  return passwordRecordToString(await hashPassword(password));
}

async function verifyPassword(password, record) {
  if (!record) return false;
  try {
    const salt = Buffer.from(record.salt, 'base64');
    const expected = Buffer.from(record.hash, 'base64');
    const derived = await scrypt(password, salt, expected.length, {
      N: record.N,
      r: record.r,
      p: record.p,
      maxmem: 128 * record.N * record.r * 2,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function sha256(value) {
  return createHmac('sha256', 'dsh-lockbox-session').update(value).digest('hex');
}

function hmac(secret, value) {
  return createHmac('sha256', secret).update(value).digest();
}

function formatDate(ms) {
  try {
    return new Date(ms).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function clampAutoLock(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_AUTO_LOCK_MINUTES;
  return Math.min(240, Math.max(1, Math.round(n)));
}

export class LockboxStore {
  /**
   * @param {{
   *   dir?: string,
   *   now?: () => number,
   *   logger?: Pick<Console, 'info'|'warn'|'error'>,
   *   mailer?: (smtp: any, message: any) => Promise<any>,
   * }} [options]
   */
  constructor(options = {}) {
    this.dir = options.dir || defaultConfigDir();
    this.configPath = join(this.dir, 'config.json');
    this.keyPath = join(this.dir, 'secret.key');
    this.now = options.now || Date.now;
    this.logger = options.logger || console;
    this.mailer = options.mailer || sendMail;

    this.config = null;
    this.secret = null;
    this.loadError = null;
    this.keyError = null;
    this.locked = true;
    this.sessions = new Map();
    this.failures = [];
    this.resetSends = [];
    this.testSends = [];
    this.resetState = null;
    this.disposed = false;
  }

  loadSync() {
    try {
      mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    } catch (error) {
      this.loadError = `CONFIG_DIR_UNAVAILABLE: ${error instanceof Error ? error.message : String(error)}`;
      this.locked = true;
      return this;
    }

    if (existsSync(this.keyPath)) {
      try {
        const raw = readFileSync(this.keyPath, 'utf8').trim();
        const key = Buffer.from(raw, 'base64');
        if (key.length !== 32) throw new Error('secret.key must contain 32 base64-encoded bytes');
        this.secret = key;
      } catch (error) {
        this.keyError = `SECRET_KEY_INVALID: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    if (!existsSync(this.configPath)) {
      this.locked = true;
      return this;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.configPath, 'utf8'));
      const password = parsePasswordRecord(parsed?.password);
      if (!parsed || typeof parsed !== 'object' || !password) {
        throw new Error('password record is missing or malformed');
      }
      if (!password.N || !password.r || !password.p) throw new Error('scrypt parameters are invalid');
      const email = validateEmail(parsed.email);
      const smtp = parsed.smtp && typeof parsed.smtp === 'object' ? parsed.smtp : {};
      const normalizedSmtp = validateSmtp(smtp);
      this.config = {
        version: 1,
        password: passwordRecordToString(password),
        email,
        smtp: {
          host: normalizedSmtp.host,
          port: normalizedSmtp.port,
          security: normalizedSmtp.security,
          user: normalizedSmtp.user,
          from: normalizedSmtp.from,
          passwordEnc: typeof smtp.passwordEnc === 'string' ? smtp.passwordEnc : '',
        },
        autoLockMinutes: clampAutoLock(parsed.autoLockMinutes),
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : formatDate(this.now()),
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : formatDate(this.now()),
      };
      if (this.config.smtp.passwordEnc && !this.secret) {
        this.keyError = this.keyError || 'SECRET_KEY_MISSING: the SMTP password cannot be decrypted.';
      }
    } catch (error) {
      this.config = null;
      this.loadError = `CONFIG_INVALID: ${error instanceof Error ? error.message : String(error)}`;
    }

    this.locked = true;
    return this;
  }

  dispose() {
    this.disposed = true;
    this.sessions.clear();
    this.resetState = null;
    this.locked = true;
  }

  get configured() {
    return this.config !== null;
  }

  autoLockMs() {
    return clampAutoLock(this.config?.autoLockMinutes) * 60 * 1000;
  }

  isLocked() {
    if (this.disposed || !this.config) return true;
    if (this.locked) return true;
    this.#expireSessions();
    return this.locked;
  }

  status() {
    const locked = this.isLocked();
    return {
      ok: true,
      configured: this.configured,
      corrupt: Boolean(this.loadError),
      keyError: this.keyError ? true : false,
      locked,
      emailMasked: this.config ? maskEmail(this.config.email) : '',
      autoLockMinutes: this.config ? clampAutoLock(this.config.autoLockMinutes) : DEFAULT_AUTO_LOCK_MINUTES,
      smtpConfigured: Boolean(this.config?.smtp?.host && this.config?.smtp?.user),
      configDir: this.dir,
      version: 1,
    };
  }

  #expireSessions() {
    if (!this.config) {
      this.locked = true;
      return;
    }
    const now = this.now();
    const ttl = this.autoLockMs();
    for (const [key, session] of this.sessions) {
      if (now - session.lastSeen > ttl) this.sessions.delete(key);
    }
    if (this.sessions.size === 0) this.locked = true;
  }

  #createSession() {
    const token = randomBytes(32).toString('hex');
    const now = this.now();
    this.sessions.set(sha256(token), { createdAt: now, lastSeen: now });
    this.locked = false;
    return { token, expiresAt: now + this.autoLockMs() };
  }

  authenticate(token) {
    if (!this.config || typeof token !== 'string' || token.length < 32) return false;
    this.#expireSessions();
    if (this.locked) return false;
    const session = this.sessions.get(sha256(token));
    if (!session) return false;
    const now = this.now();
    if (now - session.lastSeen > this.autoLockMs()) {
      this.sessions.delete(sha256(token));
      if (this.sessions.size === 0) this.locked = true;
      return false;
    }
    session.lastSeen = now;
    return true;
  }

  #requireAuth(token) {
    if (!this.authenticate(token)) {
      throw new LockboxError('UNAUTHORIZED', 'Unlock the lockbox first.');
    }
  }

  #lockoutRemaining() {
    const now = this.now();
    this.failures = this.failures.filter((t) => now - t < FAILURE_WINDOW_MS);
    if (this.failures.length < MAX_UNLOCK_FAILURES) return 0;
    const over = this.failures.length - MAX_UNLOCK_FAILURES;
    const wait = Math.min(30 * 60 * 1000, 60 * 1000 * 2 ** over);
    const elapsed = now - this.failures[this.failures.length - 1];
    if (elapsed >= wait) {
      this.failures = [];
      return 0;
    }
    return wait - elapsed;
  }

  async setup({ password, email, smtp }) {
    if (this.loadError) {
      throw new LockboxError('CONFIG_CORRUPT', 'The existing lockbox config is unreadable. Repair or remove it first.', {
        detail: this.loadError,
      });
    }
    if (this.config) throw new LockboxError('CONFIG_EXISTS', 'The lockbox is already configured.');
    validatePassword(password);
    const normalizedEmail = validateEmail(email);
    const normalizedSmtp = validateSmtp(smtp);

    const record = await hashPassword(password);
    const secret = this.#ensureSecret();
    const encrypted = normalizedSmtp.password ? encryptSecret(normalizedSmtp.password, secret) : '';
    const now = formatDate(this.now());
    const next = {
      version: 1,
      password: passwordRecordToString(record),
      email: normalizedEmail,
      smtp: {
        host: normalizedSmtp.host,
        port: normalizedSmtp.port,
        security: normalizedSmtp.security,
        user: normalizedSmtp.user,
        from: normalizedSmtp.from,
        passwordEnc: encrypted,
      },
      autoLockMinutes: DEFAULT_AUTO_LOCK_MINUTES,
      createdAt: now,
      updatedAt: now,
    };

    this.#writeFileAtomic(this.keyPath, secret.toString('base64') + '\n');
    this.#writeConfig(next);
    this.config = next;
    this.secret = secret;
    this.loadError = null;
    this.locked = false;
    const session = this.#createSession();
    this.logger.info?.('[dsh-lockbox] initialized; recovery email configured');
    return { ...session, status: this.status() };
  }

  async unlock(password) {
    if (!this.config) throw new LockboxError('NOT_CONFIGURED', 'The lockbox is not configured yet.');
    const retryAfterMs = this.#lockoutRemaining();
    if (retryAfterMs > 0) {
      throw new LockboxError('TOO_MANY_ATTEMPTS', 'Too many failed attempts. Try again later.', { retryAfterMs });
    }

    const record = parsePasswordRecord(this.config.password);
    const ok = await verifyPassword(String(password ?? ''), record);
    if (!ok) {
      this.failures.push(this.now());
      const retry = this.#lockoutRemaining();
      throw new LockboxError('INVALID_PASSWORD', 'Incorrect password.', {
        remaining: Math.max(0, MAX_UNLOCK_FAILURES - Math.min(MAX_UNLOCK_FAILURES, this.failures.length)),
        ...(retry > 0 ? { retryAfterMs: retry } : {}),
      });
    }

    this.failures = [];
    const session = this.#createSession();
    this.logger.info?.('[dsh-lockbox] unlocked');
    return { ...session, status: this.status() };
  }

  lock() {
    this.locked = true;
    this.sessions.clear();
    this.logger.info?.('[dsh-lockbox] locked');
    return this.status();
  }

  heartbeat(token) {
    this.#requireAuth(token);
    return { ok: true, locked: false };
  }

  async changePassword(token, currentPassword, newPassword) {
    this.#requireAuth(token);
    const record = parsePasswordRecord(this.config.password);
    if (!(await verifyPassword(String(currentPassword ?? ''), record))) {
      throw new LockboxError('INVALID_PASSWORD', 'Current password is incorrect.');
    }
    validatePassword(newPassword);
    const next = structuredClone(this.config);
    next.password = passwordRecordToString(await hashPassword(newPassword));
    next.updatedAt = formatDate(this.now());
    this.#writeConfig(next);
    this.config = next;
    this.lock();
    return { ok: true, locked: true };
  }

  async updateRecoveryEmail(token, currentPassword, email) {
    this.#requireAuth(token);
    const record = parsePasswordRecord(this.config.password);
    if (!(await verifyPassword(String(currentPassword ?? ''), record))) {
      throw new LockboxError('INVALID_PASSWORD', 'Current password is incorrect.');
    }
    const normalized = validateEmail(email);
    const next = structuredClone(this.config);
    next.email = normalized;
    next.updatedAt = formatDate(this.now());
    this.#writeConfig(next);
    this.config = next;
    return this.publicSettings();
  }

  async updateSmtp(token, smtp, options = {}) {
    this.#requireAuth(token);
    const normalized = validateSmtp(smtp);
    const next = structuredClone(this.config);
    next.smtp = {
      host: normalized.host,
      port: normalized.port,
      security: normalized.security,
      user: normalized.user,
      from: normalized.from,
      passwordEnc: next.smtp.passwordEnc,
    };
    if (options.clearPassword === true) {
      next.smtp.passwordEnc = '';
    } else if (typeof smtp.password === 'string' && smtp.password.length > 0) {
      next.smtp.passwordEnc = encryptSecret(smtp.password, this.#ensureSecret());
      this.secret = this.#readSecretKey() || this.secret;
    }
    next.updatedAt = formatDate(this.now());
    this.#writeConfig(next);
    this.config = next;
    return this.publicSettings();
  }

  async updateAutoLock(token, minutes) {
    this.#requireAuth(token);
    const next = structuredClone(this.config);
    next.autoLockMinutes = clampAutoLock(minutes);
    next.updatedAt = formatDate(this.now());
    this.#writeConfig(next);
    this.config = next;
    return this.publicSettings();
  }

  publicSettings() {
    if (!this.config) return null;
    return {
      email: this.config.email,
      emailMasked: maskEmail(this.config.email),
      autoLockMinutes: clampAutoLock(this.config.autoLockMinutes),
      smtp: {
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        security: this.config.smtp.security,
        user: this.config.smtp.user,
        from: this.config.smtp.from,
        hasPassword: Boolean(this.config.smtp.passwordEnc),
      },
      createdAt: this.config.createdAt,
      updatedAt: this.config.updatedAt,
      configDir: this.dir,
    };
  }

  async requestResetCode() {
    if (!this.config) throw new LockboxError('NOT_CONFIGURED', 'The lockbox is not configured yet.');
    const now = this.now();
    this.resetSends = this.resetSends.filter((t) => now - t < RESET_SEND_WINDOW_MS);
    if (this.resetSends.length >= MAX_RESET_SENDS) {
      throw new LockboxError('TOO_MANY_REQUESTS', 'Too many codes requested. Try again later.', {
        retryAfterMs: this.resetSends[0] + RESET_SEND_WINDOW_MS - now,
      });
    }
    if (this.resetState && now - this.resetState.sentAt < CODE_RESEND_MS) {
      throw new LockboxError('COOLDOWN', 'Wait before requesting another code.', {
        retryAfterMs: CODE_RESEND_MS - (now - this.resetState.sentAt),
      });
    }

    const smtp = this.#smtpForSend();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const salt = randomBytes(16).toString('hex');
    const codeHash = hmac(this.#ensureSecret(), `reset:${salt}:${code}`).toString('base64');
    const nextState = {
      salt,
      codeHash,
      sentAt: now,
      expiresAt: now + CODE_TTL_MS,
      attempts: 0,
    };

    try {
      await this.mailer(smtp, {
        to: this.config.email,
        subject: 'DSH 加密锁验证码 / DSH Lockbox verification code',
        text: [
          '你正在重置 DeepSeek Harness 加密锁密码。',
          '',
          `验证码：${code}`,
          '10 分钟内有效。每条验证码最多尝试 5 次。',
          '',
          '如果这不是你本人的操作，请忽略这封邮件；你的密码不会改变。',
          '',
          'You are resetting the DSH Lockbox password.',
          `Verification code: ${code}`,
          'It expires in 10 minutes. If you did not request this, ignore this email.',
        ].join('\n'),
      });
    } catch (error) {
      this.resetState = null;
      throw new LockboxError('EMAIL_SEND_FAILED', 'The verification email could not be sent.', {
        detail: truncate(error instanceof Error ? error.message : String(error), 400),
      });
    }

    this.resetState = nextState;
    this.resetSends.push(now);
    this.logger.info?.('[dsh-lockbox] reset code sent to configured recovery address');
    return {
      ok: true,
      emailMasked: maskEmail(this.config.email),
      expiresAt: nextState.expiresAt,
      retryAfterMs: CODE_RESEND_MS,
    };
  }

  async resetPassword({ code, newPassword }) {
    if (!this.config) throw new LockboxError('NOT_CONFIGURED', 'The lockbox is not configured yet.');
    if (!this.resetState) throw new LockboxError('NO_CODE', 'Request a verification code first.');
    const now = this.now();
    if (now > this.resetState.expiresAt) {
      this.resetState = null;
      throw new LockboxError('CODE_EXPIRED', 'The verification code has expired.');
    }
    if (this.resetState.attempts >= MAX_CODE_ATTEMPTS) {
      throw new LockboxError('TOO_MANY_ATTEMPTS', 'Too many incorrect codes. Request a new one.');
    }
    const value = String(code ?? '').trim();
    if (!/^\d{6}$/.test(value)) {
      this.resetState.attempts += 1;
      throw new LockboxError('INVALID_CODE', 'Enter the 6-digit code.', {
        remaining: Math.max(0, MAX_CODE_ATTEMPTS - this.resetState.attempts),
      });
    }

    const expected = Buffer.from(hmac(this.#ensureSecret(), `reset:${this.resetState.salt}:${value}`).toString('base64'), 'base64');
    const actual = Buffer.from(this.resetState.codeHash, 'base64');
    const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (!matches) {
      this.resetState.attempts += 1;
      throw new LockboxError('INVALID_CODE', 'The verification code is incorrect.', {
        remaining: Math.max(0, MAX_CODE_ATTEMPTS - this.resetState.attempts),
      });
    }

    validatePassword(newPassword);
    const next = structuredClone(this.config);
    next.password = passwordRecordToString(await hashPassword(newPassword));
    next.updatedAt = formatDate(this.now());
    this.#writeConfig(next);
    this.config = next;
    this.resetState = null;
    this.lock();
    this.logger.info?.('[dsh-lockbox] password reset; all sessions invalidated');
    return { ok: true, locked: true };
  }

  async sendTestEmail(token) {
    this.#requireAuth(token);
    if (!this.config) throw new LockboxError('NOT_CONFIGURED', 'The lockbox is not configured yet.');
    const now = this.now();
    this.testSends = this.testSends.filter((t) => now - t < TEST_SEND_WINDOW_MS);
    if (this.testSends.length >= MAX_TEST_SENDS) {
      throw new LockboxError('TOO_MANY_REQUESTS', 'Too many test emails. Try again later.', {
        retryAfterMs: this.testSends[0] + TEST_SEND_WINDOW_MS - now,
      });
    }
    try {
      await this.mailer(this.#smtpForSend(), {
        to: this.config.email,
        subject: 'DSH 加密锁 SMTP 测试 / DSH Lockbox SMTP test',
        text: [
          '这是一封测试邮件。',
          '如果你收到它，说明加密锁的邮件发送配置可用，忘记密码时可以接收验证码。',
          '',
          'This is a test email. If you received it, DSH Lockbox can deliver password-reset codes.',
          `Time: ${new Date(now).toISOString()}`,
        ].join('\n'),
      });
    } catch (error) {
      throw new LockboxError('EMAIL_SEND_FAILED', 'The test email could not be sent.', {
        detail: truncate(error instanceof Error ? error.message : String(error), 400),
      });
    }
    this.testSends.push(now);
    return { ok: true, emailMasked: maskEmail(this.config.email) };
  }

  #smtpForSend() {
    if (!this.config) throw new LockboxError('NOT_CONFIGURED', 'The lockbox is not configured yet.');
    if (!this.config.smtp.host || !this.config.smtp.user) {
      throw new LockboxError('SMTP_NOT_CONFIGURED', 'Configure an SMTP account first.');
    }
    let password = '';
    if (this.config.smtp.passwordEnc) {
      if (!this.secret) {
        throw new LockboxError('SECRET_KEY_MISSING', 'The SMTP password cannot be decrypted because secret.key is missing.');
      }
      try {
        password = decryptSecret(this.config.smtp.passwordEnc, this.secret);
      } catch {
        throw new LockboxError('SECRET_KEY_INVALID', 'The stored SMTP password cannot be decrypted.');
      }
    }
    return { ...this.config.smtp, password };
  }

  #ensureSecret() {
    if (this.secret) return this.secret;
    if (this.keyError) throw new LockboxError('SECRET_KEY_INVALID', 'secret.key is unreadable; repair it before continuing.');
    const key = randomBytes(32);
    this.#writeFileAtomic(this.keyPath, key.toString('base64') + '\n');
    this.secret = key;
    return key;
  }

  #readSecretKey() {
    try {
      const key = Buffer.from(readFileSync(this.keyPath, 'utf8').trim(), 'base64');
      return key.length === 32 ? key : null;
    } catch {
      return null;
    }
  }

  #writeConfig(config) {
    this.#writeFileAtomic(this.configPath, JSON.stringify(config, null, 2) + '\n');
  }

  #writeFileAtomic(file, text) {
    const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
    try {
      writeFileSync(tmp, text, { encoding: 'utf8', mode: 0o600 });
      try {
        renameSync(tmp, file);
      } catch (error) {
        // Windows can refuse to replace an existing file while another handle is
        // open. Remove and retry once, then surface the original failure.
        try {
          rmSync(file, { force: true });
          renameSync(tmp, file);
        } catch {
          throw error;
        }
      }
      try {
        chmodSync(file, 0o600);
      } catch {
        // Windows does not implement POSIX modes; the file still lives under
        // the user's DSH home directory.
      }
    } catch (error) {
      try {
        rmSync(tmp, { force: true });
      } catch {
        // best effort
      }
      throw error;
    }
  }
}

function encryptSecret(plain, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

function decryptSecret(value, key) {
  const parts = String(value).split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('unsupported secret format');
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ciphertext = Buffer.from(parts[3], 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function truncate(value, max) {
  return value.length > max ? value.slice(0, max) + '…' : value;
}
