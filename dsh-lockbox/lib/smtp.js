/**
 * A very small SMTP client for dsh-lockbox.
 *
 * It deliberately avoids nodemailer and any other dependency: the plugin only
 * needs to deliver a six-digit code to one pre-configured address. Supported
 * transports are implicit TLS (465), STARTTLS (587), and plaintext (25).
 * Authentication supports AUTH PLAIN and AUTH LOGIN.
 */
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import os from 'node:os';
import tls from 'node:tls';

const DEFAULT_TIMEOUT_MS = 25_000;
const MAX_RESPONSE_LINES = 200;
const MAX_HEADER_LENGTH = 900;

export class SmtpError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{cause?: unknown, responseCode?: number, responseText?: string, command?: string}} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'SmtpError';
    this.code = code;
    Object.assign(this, extra);
  }
}

/**
 * Send one plain-text UTF-8 message.
 *
 * @param {{host:string,port:number,security?:'ssl'|'starttls'|'none',user?:string,password?:string,from:string}} smtp
 * @param {{to:string,subject:string,text:string}} message
 * @param {{timeoutMs?:number}} [options]
 * @returns {Promise<{ok:true,response:string}>}
 */
export async function sendMail(smtp, message, options = {}) {
  const config = normalizeConfig(smtp);
  const envelope = buildMessage(config, message);
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  let socket = null;
  let session = null;
  try {
    socket = await openSocket(config, deadline);
    session = new SmtpSession(socket, deadline);

    expect(await session.readResponse(), [220], 'greeting');

    let capabilities = parseCapabilities(
      expect(await command(session, socket, `EHLO ${clientName()}`, [250]), [250], 'EHLO'),
    );

    if (config.security === 'starttls') {
      if (!capabilities.starttls) {
        throw new SmtpError('SMTP_STARTTLS_UNAVAILABLE', 'The SMTP server does not advertise STARTTLS.');
      }
      expect(await command(session, socket, 'STARTTLS', [220]), [220], 'STARTTLS');
      session.detach();
      socket = await upgradeToTls(socket, config.host, deadline);
      session = new SmtpSession(socket, deadline);
      capabilities = parseCapabilities(
        expect(await command(session, socket, `EHLO ${clientName()}`, [250]), [250], 'EHLO after STARTTLS'),
      );
    }

    await authenticate(session, socket, config, capabilities);

    expect(
      await command(session, socket, `MAIL FROM:<${envelope.fromAddress}>`, [250]),
      [250],
      'MAIL FROM',
    );
    expect(
      await command(session, socket, `RCPT TO:<${envelope.toAddress}>`, [250, 251]),
      [250, 251],
      'RCPT TO',
    );
    expect(await command(session, socket, 'DATA', [354]), [354], 'DATA');

    socket.write(dotStuff(envelope.data) + '.\r\n');
    const accepted = expect(await session.readResponse(), [250], 'message body');

    try {
      expect(await command(session, socket, 'QUIT', [221]), [221], 'QUIT');
    } catch {
      // The server may close the connection immediately after accepting DATA.
      // QUIT is a courtesy; delivery already succeeded.
    }

    return { ok: true, response: accepted.text };
  } catch (error) {
    if (error instanceof SmtpError) throw error;
    throw new SmtpError('SMTP_FAILED', error instanceof Error ? error.message : String(error), { cause: error });
  } finally {
    session?.detach();
    socket?.destroy();
  }
}

function normalizeConfig(smtp) {
  if (!smtp || typeof smtp !== 'object') {
    throw new SmtpError('SMTP_INVALID', 'SMTP settings are missing.');
  }
  const host = String(smtp.host ?? '').trim();
  if (!host || /[\r\n]/.test(host)) throw new SmtpError('SMTP_INVALID', 'SMTP host is invalid.');
  const security = String(smtp.security ?? 'starttls').toLowerCase();
  if (!['ssl', 'starttls', 'none'].includes(security)) {
    throw new SmtpError('SMTP_INVALID', 'SMTP security must be ssl, starttls, or none.');
  }
  const fallbackPort = security === 'ssl' ? 465 : security === 'starttls' ? 587 : 25;
  const port = Number(smtp.port ?? fallbackPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new SmtpError('SMTP_INVALID', 'SMTP port is invalid.');
  }
  const from = String(smtp.from ?? '').trim();
  if (!from || /[\r\n]/.test(from)) throw new SmtpError('SMTP_INVALID', 'Sender address is missing.');
  return {
    host,
    port,
    security,
    user: String(smtp.user ?? '').trim(),
    password: String(smtp.password ?? ''),
    from,
  };
}

function buildMessage(smtp, message) {
  if (!message || typeof message !== 'object') throw new SmtpError('SMTP_INVALID', 'Message is missing.');
  const to = String(message.to ?? '').trim();
  if (!to || /[\r\n]/.test(to)) throw new SmtpError('SMTP_INVALID', 'Recipient address is invalid.');
  const fromAddress = envelopeAddress(smtp.from);
  const toAddress = envelopeAddress(to);
  const domain = (fromAddress.split('@')[1] || 'localhost').replace(/[^A-Za-z0-9.-]/g, '') || 'localhost';
  const messageId = `<${Date.now().toString(36)}.${randomBytes(8).toString('hex')}@${domain}>`;
  const subject = encodeHeader(message.subject ?? '');
  const body = Buffer.from(String(message.text ?? ''), 'utf8').toString('base64');
  const bodyLines = body.match(/.{1,76}/g) ?? [''];

  const headers = [
    `From: ${sanitizeHeader(smtp.from)}`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    'X-Mailer: dsh-lockbox',
  ].map((line) => truncateHeader(line));

  return {
    fromAddress,
    toAddress,
    data: headers.join('\r\n') + '\r\n\r\n' + bodyLines.join('\r\n') + '\r\n',
  };
}

function envelopeAddress(value) {
  const raw = String(value ?? '').trim();
  const angle = /<([^<>]+)>\s*$/.exec(raw);
  const address = (angle ? angle[1] : raw).trim();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)) {
    throw new SmtpError('SMTP_INVALID', 'Email address is invalid.');
  }
  return address;
}

function sanitizeHeader(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
}

function encodeHeader(value) {
  const clean = sanitizeHeader(value);
  if (!clean) return '';
  if (/^[\x20-\x7E]+$/.test(clean) && clean.length <= MAX_HEADER_LENGTH) return clean;

  const chunks = [];
  let current = '';
  let currentBytes = 0;
  for (const char of clean) {
    const bytes = Buffer.byteLength(char, 'utf8');
    if (currentBytes + bytes > 45 && current.length > 0) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks.map((chunk) => `=?UTF-8?B?${Buffer.from(chunk, 'utf8').toString('base64')}?=`).join('\r\n ');
}

function truncateHeader(line) {
  return line.length > MAX_HEADER_LENGTH ? line.slice(0, MAX_HEADER_LENGTH - 1) + '…' : line;
}

function dotStuff(data) {
  return data.replace(/\r\n\./g, '\r\n..').replace(/^\./, '..');
}

function clientName() {
  const host = os.hostname().replace(/[^A-Za-z0-9.-]/g, '');
  return host || 'localhost';
}

function tlsServername(host) {
  return net.isIP(host) ? undefined : host;
}

function remaining(deadline) {
  return deadline - Date.now();
}

function timeoutError() {
  return new SmtpError('SMTP_TIMEOUT', 'The SMTP server did not respond in time.');
}

function openSocket(smtp, deadline) {
  return new Promise((resolve, reject) => {
    let socket;
    try {
      socket =
        smtp.security === 'ssl'
          ? tls.connect({
              host: smtp.host,
              port: smtp.port,
              servername: tlsServername(smtp.host),
              rejectUnauthorized: true,
            })
          : net.connect({ host: smtp.host, port: smtp.port });
      socket.setNoDelay?.(true);
    } catch (error) {
      reject(new SmtpError('SMTP_CONNECT_FAILED', `Cannot connect to ${smtp.host}:${smtp.port}.`, { cause: error }));
      return;
    }

    const event = smtp.security === 'ssl' ? 'secureConnect' : 'connect';
    const timer = setTimeout(() => {
      cleanup();
      socket.destroy();
      reject(timeoutError());
    }, Math.max(1, remaining(deadline)));

    function cleanup() {
      clearTimeout(timer);
      socket.removeListener('error', onError);
      socket.removeListener(event, onReady);
    }

    function onError(error) {
      cleanup();
      socket.destroy();
      reject(
        new SmtpError(
          'SMTP_CONNECT_FAILED',
          `Cannot connect to ${smtp.host}:${smtp.port}: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        ),
      );
    }

    function onReady() {
      cleanup();
      resolve(socket);
    }

    socket.once('error', onError);
    socket.once(event, onReady);
  });
}

function upgradeToTls(socket, host, deadline) {
  return new Promise((resolve, reject) => {
    let secure;
    try {
      secure = tls.connect({
        socket,
        servername: tlsServername(host),
        rejectUnauthorized: true,
      });
    } catch (error) {
      reject(new SmtpError('SMTP_TLS_FAILED', 'Could not start TLS.', { cause: error }));
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      secure.destroy();
      reject(timeoutError());
    }, Math.max(1, remaining(deadline)));

    function cleanup() {
      clearTimeout(timer);
      secure.removeListener('secureConnect', onReady);
      secure.removeListener('error', onError);
    }

    function onReady() {
      cleanup();
      resolve(secure);
    }

    function onError(error) {
      cleanup();
      secure.destroy();
      reject(
        new SmtpError(
          'SMTP_TLS_FAILED',
          `TLS negotiation failed: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        ),
      );
    }

    secure.once('secureConnect', onReady);
    secure.once('error', onError);
  });
}

async function command(session, socket, line, expected) {
  socket.write(line + '\r\n');
  return expect(await session.readResponse(), expected, line.split(' ')[0]);
}

function expect(response, codes, label) {
  if (!codes.includes(response.code)) {
    throw new SmtpError('SMTP_REJECTED', `${label} failed (${response.code}): ${response.text}`, {
      responseCode: response.code,
      responseText: response.text,
      command: label,
    });
  }
  return response;
}

function parseCapabilities(response) {
  const auth = new Set();
  let starttls = false;
  for (const line of response.lines) {
    const text = line.slice(4).trim();
    if (/^STARTTLS$/i.test(text)) starttls = true;
    const authMatch = /^AUTH(?:[ =])(.*)$/i.exec(text);
    if (authMatch) {
      for (const mechanism of authMatch[1].split(/\s+/)) {
        if (mechanism) auth.add(mechanism.toUpperCase());
      }
    }
  }
  return { auth, starttls };
}

async function authenticate(session, socket, smtp, capabilities) {
  if (!smtp.user) return;
  const mechanisms = capabilities.auth;

  const tryPlain = async () => {
    const payload = Buffer.from(`\0${smtp.user}\0${smtp.password}`, 'utf8').toString('base64');
    socket.write(`AUTH PLAIN ${payload}\r\n`);
    let response = await session.readResponse();
    if (response.code === 334) {
      socket.write(payload + '\r\n');
      response = await session.readResponse();
    }
    if (response.code === 235) return true;
    if (response.code === 500 || response.code === 504) return false;
    throw authFailed(response);
  };

  const tryLogin = async () => {
    socket.write('AUTH LOGIN\r\n');
    let response = await session.readResponse();
    if (response.code === 500 || response.code === 504) return false;
    if (response.code !== 334) throw authFailed(response);

    socket.write(Buffer.from(smtp.user, 'utf8').toString('base64') + '\r\n');
    response = await session.readResponse();
    if (response.code !== 334) throw authFailed(response);

    socket.write(Buffer.from(smtp.password, 'utf8').toString('base64') + '\r\n');
    response = await session.readResponse();
    if (response.code === 235) return true;
    if (response.code === 500 || response.code === 504) return false;
    throw authFailed(response);
  };

  if (mechanisms.size === 0 || mechanisms.has('PLAIN')) {
    if (await tryPlain()) return;
  }
  if (mechanisms.size === 0 || mechanisms.has('LOGIN')) {
    if (await tryLogin()) return;
  }
  throw new SmtpError('SMTP_AUTH_UNSUPPORTED', 'The SMTP server does not support AUTH PLAIN or AUTH LOGIN.');
}

function authFailed(response) {
  return new SmtpError('SMTP_AUTH_FAILED', `SMTP authentication failed (${response.code}): ${response.text}`, {
    responseCode: response.code,
    responseText: response.text,
  });
}

class SmtpSession {
  constructor(socket, deadline) {
    this.socket = socket;
    this.deadline = deadline;
    this.buffer = '';
    this.lines = [];
    this.waiter = null;
    this.error = null;
    this.detached = false;

    this.onData = (chunk) => {
      if (this.detached) return;
      this.buffer += chunk.toString('utf8');
      this.#drain();
    };
    this.onError = (error) => {
      this.#fail(
        new SmtpError('SMTP_CONNECTION_ERROR', `SMTP connection error: ${error instanceof Error ? error.message : String(error)}`, {
          cause: error,
        }),
      );
    };
    this.onClose = () => {
      this.#fail(new SmtpError('SMTP_CONNECTION_CLOSED', 'The SMTP connection was closed unexpectedly.'));
    };

    socket.on('data', this.onData);
    socket.on('error', this.onError);
    socket.on('close', this.onClose);
  }

  #drain() {
    let index;
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      let line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (this.waiter) {
        const waiter = this.waiter;
        this.waiter = null;
        clearTimeout(waiter.timer);
        waiter.resolve(line);
      } else {
        this.lines.push(line);
        if (this.lines.length > MAX_RESPONSE_LINES) this.lines.shift();
      }
    }
  }

  #fail(error) {
    if (this.detached) return;
    if (!this.error) this.error = error;
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      clearTimeout(waiter.timer);
      waiter.reject(this.error);
    }
  }

  readLine() {
    if (this.lines.length > 0) return Promise.resolve(this.lines.shift());
    if (this.error) return Promise.reject(this.error);
    if (this.detached) return Promise.reject(new SmtpError('SMTP_CONNECTION_CLOSED', 'The SMTP session is closed.'));

    const wait = remaining(this.deadline);
    if (wait <= 0) return Promise.reject(timeoutError());

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.waiter) this.waiter = null;
        reject(timeoutError());
      }, wait);
      this.waiter = { resolve, reject, timer };
    });
  }

  async readResponse() {
    const first = await this.readLine();
    const match = /^(\d{3})([ -])(.*)$/.exec(first);
    if (!match) {
      throw new SmtpError('SMTP_PROTOCOL', `Unexpected SMTP response: ${first}`);
    }
    const code = match[1];
    const lines = [first];
    if (match[2] === '-') {
      for (let i = 0; i < MAX_RESPONSE_LINES; i += 1) {
        const line = await this.readLine();
        lines.push(line);
        if (line.startsWith(code + ' ')) break;
      }
    }
    return { code: Number(code), lines, text: lines.join('\n') };
  }

  detach() {
    if (this.detached) return;
    this.detached = true;
    this.socket.removeListener('data', this.onData);
    this.socket.removeListener('error', this.onError);
    this.socket.removeListener('close', this.onClose);
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      clearTimeout(waiter.timer);
      waiter.reject(new SmtpError('SMTP_CONNECTION_CLOSED', 'The SMTP session was closed.'));
    }
    this.buffer = '';
    this.lines = [];
  }
}
