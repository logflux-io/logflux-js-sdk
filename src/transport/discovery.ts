import { VERSION } from '../version';

const MAX_RESPONSE_SIZE = 64 * 1024; // 64 KiB
const USER_AGENT = `logflux-js-sdk/${VERSION}`;

const VALID_REGION_PREFIXES = ['eu-', 'us-', 'ca-', 'au-', 'ap-'];

/**
 * API endpoint paths matching the Go SDK.
 */
export const API_PATHS = {
  ingest: '/v1/ingest',
  batch: '/v1/batch',
  version: '/info',
  health: '/health',
  handshakeBase: '/v1/handshake',
  handshakeInit: '/init',
  handshakeComplete: '/complete',
} as const;

/**
 * Discovered endpoint information.
 */
export interface EndpointInfo {
  baseUrl: string;
  region?: string;
  capabilities?: string[];
  metadata?: Record<string, string>;
}

/**
 * Extracts the region prefix from an API key.
 * Returns [region, strippedKey].
 */
export function extractRegionFromKey(key: string): [string, string] {
  for (const prefix of VALID_REGION_PREFIXES) {
    if (key.startsWith(prefix)) {
      return [prefix.slice(0, -1), key.substring(prefix.length)];
    }
  }
  return ['', key];
}

/**
 * Returns the static discovery URL for a region.
 */
function staticDiscoveryUrl(region: string): string {
  return `https://discover.${region}.logflux.io`;
}

/**
 * Discovers the ingestor endpoint using the API key's region prefix.
 * Tries static discovery first, then authenticated discovery gateways.
 */
export async function discoverEndpoints(
  apiKey: string,
  timeoutMs: number,
): Promise<EndpointInfo> {
  const [region] = extractRegionFromKey(apiKey);

  // Try static discovery first for region-prefixed keys
  if (region) {
    try {
      const result = await tryStaticDiscovery(region, timeoutMs);
      if (result) return result;
    } catch {
      // Fall through to authenticated discovery
    }
  }

  // Authenticated discovery fallback
  const urls = [
    'https://api.logflux.io/api/discovery',
    'https://eu.api.logflux.io/api/discovery',
    'https://us.api.logflux.io/api/discovery',
  ];

  let lastErr: Error | null = null;
  for (const url of urls) {
    try {
      const result = await tryAuthenticatedDiscovery(url, apiKey, timeoutMs);
      if (result) return result;
    } catch (err) {
      lastErr = err as Error;
    }
  }

  throw new Error(`All discovery URLs failed: ${lastErr?.message ?? 'unknown error'}`);
}

async function tryStaticDiscovery(
  region: string,
  timeoutMs: number,
): Promise<EndpointInfo | null> {
  const url = staticDiscoveryUrl(region);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!resp.ok) return null;

    const body = await resp.json() as Record<string, any>;
    const ingestorUrl = body?.endpoints?.ingestor_url;
    if (!ingestorUrl) return null;

    return {
      baseUrl: ingestorUrl,
      region: body.region,
      metadata: {
        backend_url: body.endpoints?.backend_url ?? '',
        dashboard_url: body.endpoints?.dashboard_url ?? '',
        discovery: 'static',
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function tryAuthenticatedDiscovery(
  discoveryUrl: string,
  apiKey: string,
  timeoutMs: number,
): Promise<EndpointInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(discoveryUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!resp.ok) return null;

    const body = await resp.json() as Record<string, any>;

    // Spec format: { ingestor_url, backend_url, data_residency, ... }
    if (body.ingestor_url) {
      return {
        baseUrl: body.ingestor_url,
        region: body.data_residency,
        capabilities: body.features,
        metadata: {
          backend_url: body.backend_url ?? '',
          environment: body.environment ?? '',
          discovery_url: discoveryUrl,
        },
      };
    }

    // Legacy wrapped format: { status, data: { base_url, region, ... } }
    if (body.data?.base_url) {
      return {
        baseUrl: body.data.base_url,
        region: body.data.region,
        capabilities: body.data.capabilities,
      };
    }

    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Creates an EndpointInfo for a custom (overridden) URL.
 */
export function customEndpoint(baseUrl: string): EndpointInfo {
  return { baseUrl };
}

/**
 * Returns the full ingest URL for an endpoint.
 */
export function getIngestUrl(endpoint: EndpointInfo): string {
  return endpoint.baseUrl + API_PATHS.ingest;
}

/**
 * Returns the full handshake init URL.
 */
export function getHandshakeInitUrl(endpoint: EndpointInfo): string {
  return endpoint.baseUrl + API_PATHS.handshakeBase + API_PATHS.handshakeInit;
}

/**
 * Returns the full handshake complete URL.
 */
export function getHandshakeCompleteUrl(endpoint: EndpointInfo): string {
  return endpoint.baseUrl + API_PATHS.handshakeBase + API_PATHS.handshakeComplete;
}

/**
 * Returns the full health URL.
 */
export function getHealthUrl(endpoint: EndpointInfo): string {
  return endpoint.baseUrl + API_PATHS.health;
}
