#!/usr/bin/env node
/**
 * dsh-lockbox — offline password reset (emergency use).
 *
 * This script rewrites the password hash in `$DSH_HOME/dsh-lockbox/config.json`
 * without contacting a mailbox. It keeps the recovery email, SMTP transport,
 * and the AES key used for the SMTP password. A running DSH process keeps its
 * in-memory config, so restart DSH after a reset.
 *
 * Usage:
 *   node bin/reset.mjs
 *   node bin/reset.mjs --email new-address@example.com
 */
import { chmod, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPasswordRecord,
  defaultConfigDir,
  validateEmail,
  validatePassword,
} from '../lib/store.js';

const USAGE = `dsh-lockbox offline password reset

Usage:
  node bin/reset.mjs [--email <recovery-address>]

Options:
  --email <address>   Replace the saved recovery email as well.
  --help              Show this help.

The DSH process must be restarted after a reset.`;

function parseArgs(argv) {
  const result = { email: undefined, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--email') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error('--email requires an address.');
      result.email = value;
    } else if (arg.startsWith('--email=')) {
      result.email = arg.slice('--email='.length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return result;
}

let pipedLines = null;
let warnedPipe = false;

async function readAllPipedInput() {
  process.stdin.setEncoding('utf8');
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text.split(/\r?\n/);
}

async function readHidden(prompt) {
  const stdin = process.stdin;
  process.stdout.write(prompt);

  if (!stdin.isTTY) {
    if (!warnedPipe) {
      warnedPipe = true;
      process.stdout.write('\n(no TTY: reading passwords from stdin)\n');
    }
    if (pipedLines === null) pipedLines = await readAllPipedInput();
    const answer = pipedLines.shift() ?? '';
    process.stdout.write('\n');
    return answer;
  }

  return new Promise((resolve, reject) => {
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
    };

    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('cancelled'));
          return;
        }
        if (ch === '\u007f' || ch === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (ch >= ' ') {
          value += ch;
          process.stdout.write('*');
        }
      }
    };

    stdin.on('data', onData);
  });
}

async function writeAtomic(file, text) {
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, text, { encoding: 'utf8', mode: 0o600 });
  try {
    await chmod(tmp, 0o600);
  } catch {
    // Windows does not implement POSIX modes.
  }
  try {
    await rename(tmp, file);
  } catch (error) {
    try {
      await rm(file, { force: true });
      await rename(tmp, file);
    } catch {
      await rm(tmp, { force: true }).catch(() => {});
      throw error;
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }

  const dir = defaultConfigDir();
  const configPath = join(dir, 'config.json');
  if (!existsSync(configPath)) {
    throw new Error(`No lockbox configuration found at ${configPath}. Start DSH once and complete the setup first.`);
  }

  let config;
  try {
    config = JSON.parse(await readFile(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse ${configPath}: ${error.message}`);
  }
  if (!config || typeof config !== 'object' || !config.password || !config.email) {
    throw new Error(`Refusing to reset an incomplete configuration at ${configPath}.`);
  }

  const email = args.email === undefined ? undefined : validateEmail(args.email);
  const password = await readHidden('New password: ');
  const confirmation = await readHidden('Confirm new password: ');
  if (password !== confirmation) throw new Error('Passwords do not match.');
  validatePassword(password);

  const next = {
    ...config,
    password: await createPasswordRecord(password),
    ...(email === undefined ? {} : { email }),
    updatedAt: new Date().toISOString(),
  };
  await writeAtomic(configPath, JSON.stringify(next, null, 2) + '\n');

  console.log('');
  console.log(`Password updated: ${configPath}`);
  if (email !== undefined) console.log(`Recovery email updated: ${email}`);
  console.log('Restart DSH to apply the new password. A running process still holds the old state.');
}

main().catch((error) => {
  console.error(`\ndsh-lockbox reset failed: ${error.message}`);
  process.exitCode = 1;
});
