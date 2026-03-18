import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

const KEY_SIZE = 32;
const NONCE_SIZE = 12;
const TAG_SIZE = 16;

export interface RawEncryptionResult {
  ciphertext: Buffer;
  nonce: Buffer;
}

/**
 * AES-256-GCM encryptor using Node.js built-in crypto.
 */
export class Encryptor {
  private key: Buffer;

  constructor(aesKey: Buffer) {
    this.key = Buffer.alloc(KEY_SIZE);
    aesKey.copy(this.key, 0, 0, KEY_SIZE);
  }

  /**
   * Encrypts plaintext with optional gzip compression.
   * Returns raw ciphertext (GCM sealed, includes auth tag appended) and nonce.
   */
  encryptRaw(plaintext: Buffer, compress: boolean): RawEncryptionResult {
    let data = plaintext;
    if (compress) {
      data = gzipCompress(data);
    }

    const nonce = randomBytes(NONCE_SIZE);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Append auth tag to ciphertext (matches Go's gcm.Seal output)
    const ciphertext = Buffer.concat([encrypted, tag]);

    return { ciphertext, nonce };
  }

  /**
   * Decrypts raw ciphertext (with appended auth tag).
   */
  decryptRaw(ciphertext: Buffer, nonce: Buffer, decompress: boolean): Buffer {
    if (ciphertext.length < TAG_SIZE) {
      throw new Error('Ciphertext too short');
    }
    const encData = ciphertext.subarray(0, ciphertext.length - TAG_SIZE);
    const tag = ciphertext.subarray(ciphertext.length - TAG_SIZE);

    const decipher = createDecipheriv('aes-256-gcm', this.key, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encData), decipher.final()]);

    if (decompress) {
      return gzipDecompress(decrypted);
    }
    return decrypted;
  }

  /**
   * Zeroes out key material. Encryptor must not be used after calling close().
   */
  close(): void {
    this.key.fill(0);
  }
}

/**
 * Generates a cryptographically random 32-byte AES key.
 */
export function generateAESKey(): Buffer {
  return randomBytes(KEY_SIZE);
}

/**
 * Compresses data with gzip.
 */
export function gzipCompress(data: Buffer): Buffer {
  return gzipSync(data);
}

/**
 * Decompresses gzip data.
 */
export function gzipDecompress(data: Buffer): Buffer {
  return gunzipSync(data);
}
