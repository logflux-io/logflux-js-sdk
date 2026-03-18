import { VERSION } from '../version';

const USER_AGENT = `logflux-js-sdk/${VERSION}`;

export interface SendResult {
  ok: boolean;
  statusCode: number;
  retryAfterSec?: number;
  isRateLimited: boolean;
  isQuotaExceeded: boolean;
  rateLimitInfo?: {
    limit: number;
    remaining: number;
    reset: number;
  };
  error?: string;
}

/**
 * Sends a multipart/mixed request to the ingest endpoint.
 * Handles 429 (rate limited) and 507 (quota exceeded) responses.
 */
export async function sendMultipart(
  url: string,
  apiKey: string,
  body: Buffer,
  contentType: string,
  timeoutMs: number,
): Promise<SendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': USER_AGENT,
      },
      body,
      signal: controller.signal,
    });

    const result: SendResult = {
      ok: resp.status >= 200 && resp.status < 300,
      statusCode: resp.status,
      isRateLimited: resp.status === 429,
      isQuotaExceeded: resp.status === 507,
    };

    // Parse rate limit headers
    const rlLimit = resp.headers.get('X-RateLimit-Limit');
    const rlRemaining = resp.headers.get('X-RateLimit-Remaining');
    const rlReset = resp.headers.get('X-RateLimit-Reset');
    if (rlLimit || rlRemaining || rlReset) {
      result.rateLimitInfo = {
        limit: rlLimit ? parseInt(rlLimit, 10) : 0,
        remaining: rlRemaining ? parseInt(rlRemaining, 10) : 0,
        reset: rlReset ? parseInt(rlReset, 10) : 0,
      };
    }

    // Handle rate limiting
    if (resp.status === 429) {
      const retryAfter = resp.headers.get('Retry-After');
      result.retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : 60;
      const text = await resp.text().catch(() => '');
      result.error = `HTTP 429: rate limited (retry after ${result.retryAfterSec}s)`;
      return result;
    }

    // Handle quota exceeded
    if (resp.status === 507) {
      const text = await resp.text().catch(() => '');
      result.error = `HTTP 507: quota exceeded`;
      return result;
    }

    if (!result.ok) {
      const text = await resp.text().catch(() => '');
      result.error = `HTTP ${resp.status}: ${text.substring(0, 200)}`;
    }

    return result;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return {
        ok: false,
        statusCode: 0,
        isRateLimited: false,
        isQuotaExceeded: false,
        error: `Request timed out after ${timeoutMs}ms`,
      };
    }
    return {
      ok: false,
      statusCode: 0,
      isRateLimited: false,
      isQuotaExceeded: false,
      error: (err as Error).message,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Determines if a send error is retryable.
 */
export function isRetryable(result: SendResult): boolean {
  if (result.ok) return false;
  if (result.isRateLimited) return true;
  const code = result.statusCode;
  if (code === 500 || code === 502 || code === 503 || code === 504) return true;
  if (code === 0) return true; // Network error
  return false;
}

/**
 * Calculates exponential backoff delay with 25% jitter.
 */
export function calculateBackoff(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffFactor: number,
): number {
  let delay = initialDelayMs * Math.pow(backoffFactor, attempt);
  if (delay > maxDelayMs) delay = maxDelayMs;
  // 25% jitter
  const jitter = Math.random() * 0.25;
  return Math.floor(delay * (1 + jitter));
}
