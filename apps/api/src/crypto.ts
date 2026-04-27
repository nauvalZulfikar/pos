/**
 * AES-256-GCM at-rest encryption for PII (phone numbers, NPWP).
 *
 * Format of encrypted output: `v1:<iv-hex>:<tag-hex>:<ciphertext-hex>`.
 * If PII_ENCRYPTION_KEY_HEX is not set we fall back to plaintext storage with
 * a one-time warning at startup so dev still works without a key.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from './env.js';
import { logger } from './logger.js';

const ALG = 'aes-256-gcm';
const PREFIX = 'v1:';
let warnedNoKey = false;

function getKey(): Buffer | null {
  const hex = env().PII_ENCRYPTION_KEY_HEX;
  if (!hex) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      logger.warn(
        'PII_ENCRYPTION_KEY_HEX not set — phone numbers stored as plaintext. Generate with: openssl rand -hex 32',
      );
    }
    return null;
  }
  return Buffer.from(hex, 'hex');
}

export function encryptPii(plain: string | null | undefined): string | null {
  if (plain == null || plain === '') return null;
  const key = getKey();
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptPii(stored: string | null | undefined): string | null {
  if (stored == null || stored === '') return null;
  if (!stored.startsWith(PREFIX)) return stored; // plaintext fallback
  const key = getKey();
  if (!key) return null;
  const [, ivHex, tagHex, ctHex] = stored.split(':');
  if (!ivHex || !tagHex || !ctHex) return null;
  try {
    const decipher = createDecipheriv(ALG, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(ctHex, 'hex')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch {
    return null;
  }
}
