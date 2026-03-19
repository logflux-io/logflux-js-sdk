import { randomBytes } from 'node:crypto';
import { Encryptor, gzipCompress } from '../crypto';
import { entryTypeRequiresEncryption, defaultPayloadType } from '../types';

export interface MultipartEntry {
  message: string;
  timestamp: Date;
  entryType: number;
  payloadType: number;
  searchTokens?: string[];
}

export interface MultipartResult {
  body: Buffer;
  contentType: string;
}

/**
 * Builds a multipart/mixed request body from entries.
 * Each part contains encrypted (or compressed) binary payload with metadata headers.
 */
export function buildMultipartBody(
  entries: MultipartEntry[],
  encryptor: Encryptor,
  keyUUID: string,
  enableCompression: boolean,
): MultipartResult {
  const boundary = generateBoundary();
  const parts: Buffer[] = [];

  for (const entry of entries) {
    let payloadType = entry.payloadType;
    if (!payloadType) {
      payloadType = defaultPayloadType(entry.entryType);
    }

    const headers: string[] = [
      `--${boundary}`,
      'Content-Type: application/octet-stream',
      `X-LF-Entry-Type: ${entry.entryType}`,
      `X-LF-Payload-Type: ${payloadType}`,
    ];

    if (entry.timestamp) {
      headers.push(`X-LF-Timestamp: ${entry.timestamp.toISOString()}`);
    }
    if (entry.searchTokens && entry.searchTokens.length > 0) {
      headers.push(`X-LF-Search-Tokens: ${entry.searchTokens.join(',')}`);
    }

    let partBody: Buffer;

    if (entryTypeRequiresEncryption(entry.entryType)) {
      const raw = encryptor.encryptRaw(Buffer.from(entry.message, 'utf-8'), enableCompression);
      headers.push(`X-LF-Key-ID: ${keyUUID}`);
      headers.push(`X-LF-Nonce: ${raw.nonce.toString('base64')}`);
      partBody = raw.ciphertext;
    } else {
      // Type 7: compress only
      if (enableCompression) {
        partBody = gzipCompress(Buffer.from(entry.message, 'utf-8'));
      } else {
        partBody = Buffer.from(entry.message, 'utf-8');
      }
    }

    // Build MIME part: headers + blank line + body
    const headerBlock = Buffer.from(headers.join('\r\n') + '\r\n\r\n');
    parts.push(Buffer.concat([headerBlock, partBody]));
  }

  // Closing boundary
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return {
    body: Buffer.concat(parts),
    contentType: `multipart/mixed; boundary=${boundary}`,
  };
}

function generateBoundary(): string {
  return randomBytes(16).toString('hex');
}
