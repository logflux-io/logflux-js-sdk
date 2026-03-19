import { Encryptor, generateAESKey, gzipCompress, gzipDecompress } from '../crypto';

describe('Crypto', () => {
  test('generateAESKey returns 32 bytes', () => {
    const key = generateAESKey();
    expect(key.length).toBe(32);
  });

  test('encrypt/decrypt roundtrip without compression', () => {
    const key = generateAESKey();
    const enc = new Encryptor(key);

    const plaintext = Buffer.from('Hello, LogFlux!');
    const result = enc.encryptRaw(plaintext, false);

    expect(result.ciphertext.length).toBeGreaterThan(0);
    expect(result.nonce.length).toBe(12);

    const decrypted = enc.decryptRaw(result.ciphertext, result.nonce, false);
    expect(decrypted.toString()).toBe('Hello, LogFlux!');

    enc.close();
  });

  test('encrypt/decrypt roundtrip with compression', () => {
    const key = generateAESKey();
    const enc = new Encryptor(key);

    const plaintext = Buffer.from('A'.repeat(1000));
    const result = enc.encryptRaw(plaintext, true);

    // Compressed+encrypted should be smaller than uncompressed
    expect(result.ciphertext.length).toBeLessThan(1000);

    const decrypted = enc.decryptRaw(result.ciphertext, result.nonce, true);
    expect(decrypted.toString()).toBe('A'.repeat(1000));

    enc.close();
  });

  test('different nonces produce different ciphertexts', () => {
    const key = generateAESKey();
    const enc = new Encryptor(key);

    const plaintext = Buffer.from('same data');
    const r1 = enc.encryptRaw(plaintext, false);
    const r2 = enc.encryptRaw(plaintext, false);

    expect(r1.nonce.equals(r2.nonce)).toBe(false);
    expect(r1.ciphertext.equals(r2.ciphertext)).toBe(false);

    enc.close();
  });

  test('close zeroes key material', () => {
    const key = generateAESKey();
    const enc = new Encryptor(key);

    // Encrypt before close
    const plaintext = Buffer.from('test data');
    const beforeClose = enc.encryptRaw(plaintext, false);

    enc.close();

    // After close, the encryptor uses a zeroed key.
    // Encrypting with a zeroed key produces ciphertext that
    // cannot be decrypted by the original key.
    const afterClose = enc.encryptRaw(plaintext, false);

    // Create a fresh encryptor with the original key to verify
    const freshEnc = new Encryptor(key);
    // The before-close ciphertext should decrypt fine
    const decrypted = freshEnc.decryptRaw(beforeClose.ciphertext, beforeClose.nonce, false);
    expect(decrypted.toString()).toBe('test data');

    // The after-close ciphertext should NOT decrypt with the original key
    // (it was encrypted with zeroed key)
    expect(() => {
      freshEnc.decryptRaw(afterClose.ciphertext, afterClose.nonce, false);
    }).toThrow();

    freshEnc.close();
  });

  test('gzip compress/decompress roundtrip', () => {
    const data = Buffer.from('Hello compressed world');
    const compressed = gzipCompress(data);
    expect(compressed.length).toBeGreaterThan(0);

    const decompressed = gzipDecompress(compressed);
    expect(decompressed.toString()).toBe('Hello compressed world');
  });

  test('gzip compresses large data effectively', () => {
    const data = Buffer.from('A'.repeat(10000));
    const compressed = gzipCompress(data);
    expect(compressed.length).toBeLessThan(data.length);
  });
});
