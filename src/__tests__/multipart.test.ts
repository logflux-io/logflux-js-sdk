import { buildMultipartBody, type MultipartEntry } from '../transport/multipart';
import { Encryptor, generateAESKey } from '../crypto';
import { EntryType } from '../types';

describe('Multipart body construction', () => {
  let encryptor: Encryptor;

  beforeEach(() => {
    encryptor = new Encryptor(generateAESKey());
  });

  afterEach(() => {
    encryptor.close();
  });

  test('builds valid multipart body with single entry', () => {
    const entries: MultipartEntry[] = [
      {
        message: '{"v":"2.0","type":"log","message":"hello"}',
        timestamp: new Date('2026-01-01T00:00:00Z'),
        entryType: EntryType.Log,
        payloadType: 0,
      },
    ];

    const result = buildMultipartBody(entries, encryptor, 'key-uuid-123', true);
    expect(result.contentType).toMatch(/^multipart\/mixed; boundary=/);
    expect(result.body.length).toBeGreaterThan(0);

    const bodyStr = result.body.toString('utf-8');
    expect(bodyStr).toContain('X-LF-Entry-Type: 1');
    expect(bodyStr).toContain('X-LF-Payload-Type: 1');
    expect(bodyStr).toContain('X-LF-Key-ID: key-uuid-123');
    expect(bodyStr).toContain('X-LF-Nonce:');
  });

  test('builds body with multiple entries', () => {
    const entries: MultipartEntry[] = [
      {
        message: '{"v":"2.0","type":"log","message":"msg1"}',
        timestamp: new Date(),
        entryType: EntryType.Log,
        payloadType: 0,
      },
      {
        message: '{"v":"2.0","type":"event","event":"test"}',
        timestamp: new Date(),
        entryType: EntryType.Event,
        payloadType: 0,
      },
    ];

    const result = buildMultipartBody(entries, encryptor, 'key-123', true);
    const bodyStr = result.body.toString('utf-8');

    // Should have two parts plus closing boundary
    const boundary = result.contentType.split('boundary=')[1];
    const parts = bodyStr.split(`--${boundary}`).filter((p) => p.trim() && p.trim() !== '--');
    expect(parts.length).toBe(2);
  });

  test('type 7 uses compression only (no encryption)', () => {
    const entries: MultipartEntry[] = [
      {
        message: '{"v":"2.0","type":"telemetry"}',
        timestamp: new Date(),
        entryType: EntryType.TelemetryManaged,
        payloadType: 0,
      },
    ];

    const result = buildMultipartBody(entries, encryptor, 'key-123', true);
    const bodyStr = result.body.toString('utf-8');

    expect(bodyStr).toContain('X-LF-Entry-Type: 7');
    expect(bodyStr).toContain('X-LF-Payload-Type: 3');
    // Type 7 should NOT have encryption headers
    expect(bodyStr).not.toContain('X-LF-Key-ID');
    expect(bodyStr).not.toContain('X-LF-Nonce');
  });

  test('includes search tokens header when present', () => {
    const entries: MultipartEntry[] = [
      {
        message: '{"v":"2.0","type":"log"}',
        timestamp: new Date(),
        entryType: EntryType.Log,
        payloadType: 0,
        searchTokens: ['user123', 'order456'],
      },
    ];

    const result = buildMultipartBody(entries, encryptor, 'key-123', true);
    const bodyStr = result.body.toString('utf-8');
    expect(bodyStr).toContain('X-LF-Search-Tokens: user123,order456');
  });
});
