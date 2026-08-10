import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** AES-256-GCM; blob = base64(iv ‖ tag ‖ ciphertext). */
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export class TenantSecretsKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantSecretsKeyError';
  }
}

/**
 * Resuelve TENANT_SECRETS_KEY (32 bytes) desde hex (64 chars) o base64.
 * Preferir hex en env.example.
 */
export function resolveTenantSecretsKey(
  raw: string | undefined | null = process.env.TENANT_SECRETS_KEY,
): Buffer {
  if (raw == null || String(raw).trim() === '') {
    throw new TenantSecretsKeyError(
      'TENANT_SECRETS_KEY no está configurada en el servidor',
    );
  }
  const trimmed = String(raw).trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }
  try {
    const buf = Buffer.from(trimmed, 'base64');
    if (buf.length === KEY_BYTES) return buf;
  } catch {
    // fall through
  }
  throw new TenantSecretsKeyError(
    'TENANT_SECRETS_KEY inválida: use 64 hex chars o base64 de 32 bytes',
  );
}

/** Cifra plaintext → blob base64 (iv‖tag‖ciphertext). */
export function encryptSecret(
  plaintext: string,
  key: Buffer = resolveTenantSecretsKey(),
): string {
  if (key.length !== KEY_BYTES) {
    throw new TenantSecretsKeyError('Clave de cifrado debe ser de 32 bytes');
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/** Descifra blob base64. Usado en tests 3.2; consumo en envío → Story 3.3. */
export function decryptSecret(
  blob: string,
  key: Buffer = resolveTenantSecretsKey(),
): string {
  if (key.length !== KEY_BYTES) {
    throw new TenantSecretsKeyError('Clave de cifrado debe ser de 32 bytes');
  }
  const buf = Buffer.from(blob, 'base64');
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new TenantSecretsKeyError('Blob cifrado inválido o truncado');
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv, {
    authTagLength: TAG_BYTES,
  });
  decipher.setAuthTag(tag);
  try {
    const plain = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    throw new TenantSecretsKeyError(
      'Blob cifrado inválido o autenticación fallida',
    );
  }
}
