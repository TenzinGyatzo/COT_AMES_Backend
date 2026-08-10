import {
  decryptSecret,
  encryptSecret,
  resolveTenantSecretsKey,
  TenantSecretsKeyError,
} from './tenant-secrets.crypto';

describe('tenant-secrets.crypto (Story 3.2)', () => {
  const HEX_KEY =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  afterEach(() => {
    delete process.env.TENANT_SECRETS_KEY;
  });

  it('resolveTenantSecretsKey acepta hex 64', () => {
    const key = resolveTenantSecretsKey(HEX_KEY);
    expect(key).toHaveLength(32);
  });

  it('resolveTenantSecretsKey acepta base64 32 bytes', () => {
    const b64 = Buffer.from(HEX_KEY, 'hex').toString('base64');
    expect(resolveTenantSecretsKey(b64)).toHaveLength(32);
  });

  it('resolveTenantSecretsKey falla si falta o es inválida', () => {
    expect(() => resolveTenantSecretsKey('')).toThrow(TenantSecretsKeyError);
    expect(() => resolveTenantSecretsKey('corto')).toThrow(
      TenantSecretsKeyError,
    );
  });

  it('encrypt → decrypt roundtrip', () => {
    process.env.TENANT_SECRETS_KEY = HEX_KEY;
    const plain = 'abcd-efgh-ijkl-mnop';
    const blob = encryptSecret(plain);
    expect(blob).not.toContain(plain);
    expect(decryptSecret(blob)).toBe(plain);
  });

  it('cada encrypt usa IV distinto (blobs distintos)', () => {
    const key = resolveTenantSecretsKey(HEX_KEY);
    const a = encryptSecret('same', key);
    const b = encryptSecret('same', key);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, key)).toBe('same');
    expect(decryptSecret(b, key)).toBe('same');
  });
});
