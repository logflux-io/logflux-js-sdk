import { createPublicKey, publicEncrypt, createHash, constants as cryptoConstants } from 'node:crypto';
import { generateAESKey } from '../crypto';
import type { EndpointInfo } from './discovery';
import { getHandshakeInitUrl, getHandshakeCompleteUrl } from './discovery';
import { VERSION } from '../version';

const USER_AGENT = `logflux-js-sdk/${VERSION}`;
const MAX_RESPONSE_SIZE = 64 * 1024; // 64 KiB

export interface HandshakeLimits {
  maxBatchSize: number;
  maxPayloadSize: number;
  maxRequestSize: number;
}

export interface HandshakeResult {
  aesKey: Buffer;
  keyUUID: string;
  serverPublicKeyPEM: string;
  serverKeyFingerprint: string;
  limits: HandshakeLimits | null;
  supportsMultipart: boolean;
}

/**
 * Performs the full RSA key exchange handshake:
 * 1. POST /v1/handshake/init -> get server's RSA public key
 * 2. Generate AES-256 key
 * 3. Encrypt AES key with server's RSA public key (OAEP/SHA-256)
 * 4. POST /v1/handshake/complete -> get key_id
 */
export async function performHandshake(
  endpoints: EndpointInfo,
  apiKey: string,
  timeoutMs: number,
): Promise<HandshakeResult> {
  // Step 1: Get server's public key
  const initUrl = getHandshakeInitUrl(endpoints);
  const initResp = await fetchJson(initUrl, 'POST', apiKey, { api_key: apiKey }, timeoutMs);

  // Parse response (supports both top-level and wrapped format)
  let publicKeyPEM: string;
  let limits: HandshakeLimits | null = null;
  let supportsMultipart = false;

  if (initResp.public_key) {
    publicKeyPEM = initResp.public_key;
    supportsMultipart = initResp.supports_multipart ?? false;
    if (initResp.limits) {
      limits = {
        maxBatchSize: initResp.limits.max_batch_size ?? 0,
        maxPayloadSize: initResp.limits.max_payload_size ?? 0,
        maxRequestSize: initResp.limits.max_request_size ?? 0,
      };
    }
  } else if (initResp.data?.public_key) {
    publicKeyPEM = initResp.data.public_key;
    supportsMultipart = initResp.data.supports_multipart ?? false;
    if (initResp.data.limits) {
      limits = {
        maxBatchSize: initResp.data.limits.max_batch_size ?? 0,
        maxPayloadSize: initResp.data.limits.max_payload_size ?? 0,
        maxRequestSize: initResp.data.limits.max_request_size ?? 0,
      };
    }
  } else {
    throw new Error('Handshake init response missing public_key');
  }

  if (!publicKeyPEM.includes('-----BEGIN PUBLIC KEY-----')) {
    throw new Error('Handshake init returned non-PEM public_key');
  }

  // Step 2: Generate AES key
  const aesKey = generateAESKey();

  // Step 3: Encrypt with RSA-OAEP
  const publicKey = createPublicKey(publicKeyPEM);
  const encryptedSecret = publicEncrypt(
    {
      key: publicKey,
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    aesKey,
  ).toString('base64');

  // Generate fingerprint
  const derBytes = publicKey.export({ type: 'spki', format: 'der' });
  const fingerprint = 'SHA256:' + createHash('sha256').update(derBytes).digest('hex');

  // Step 4: Complete handshake
  const completeUrl = getHandshakeCompleteUrl(endpoints);
  const completeResp = await fetchJson(
    completeUrl,
    'POST',
    apiKey,
    { api_key: apiKey, encrypted_secret: encryptedSecret },
    timeoutMs,
  );

  let keyUUID: string;
  if (completeResp.key_id) {
    keyUUID = completeResp.key_id;
  } else if (completeResp.data?.key_id) {
    keyUUID = completeResp.data.key_id;
  } else if (completeResp.key_uuid) {
    keyUUID = completeResp.key_uuid;
  } else if (completeResp.data?.key_uuid) {
    keyUUID = completeResp.data.key_uuid;
  } else {
    throw new Error('Handshake complete response missing key_id');
  }

  return {
    aesKey,
    keyUUID,
    serverPublicKeyPEM: publicKeyPEM,
    serverKeyFingerprint: fingerprint,
    limits,
    supportsMultipart,
  };
}

async function fetchJson(
  url: string,
  method: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<Record<string, any>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Handshake failed with status ${resp.status}: ${text.substring(0, 200)}`);
    }

    return await resp.json() as Record<string, any>;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(`Handshake timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
