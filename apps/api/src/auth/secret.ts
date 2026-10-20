import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * `SESSION_SECRET` from env, else a random one kept in a git-ignored file so local sessions
 * survive restarts without setup (NFR-8: never sent to the browser).
 */
export function loadSessionSecret(envSecret: string | undefined, file: string): string {
  if (envSecret) return envSecret;
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  const secret = randomBytes(32).toString('hex');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}
