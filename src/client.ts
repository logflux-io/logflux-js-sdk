import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import type { Options } from './options';
import { validateApiKey } from './options';
import { Encryptor } from './crypto';
import { Queue, type QueueEntry } from './queue';
import { BreadcrumbRing } from './breadcrumb';
import { StatsTracker } from './stats';
import { Scope } from './scope';
import { Span, startSpan, continueFromHeaders, type SpanData } from './span';
import { configureContext } from './payload/context';
import { createLogPayload } from './payload/log';
import { createMetricPayload } from './payload/metric';
import { createTracePayload } from './payload/trace';
import { createEventPayload } from './payload/event';
import { createAuditPayload } from './payload/audit';
import { createErrorPayload, createErrorPayloadWithMessage } from './payload/error';
import { createTelemetryPayload, type Reading } from './payload/telemetry';
import {
  discoverEndpoints,
  customEndpoint,
  getIngestUrl,
  type EndpointInfo,
} from './transport/discovery';
import { performHandshake, type HandshakeResult } from './transport/handshake';
import { buildMultipartBody, type MultipartEntry } from './transport/multipart';
import { sendMultipart, isRetryable, calculateBackoff } from './transport/sender';
import {
  LogLevel,
  EntryType,
  DropReason,
  entryTypeCategory,
  type ClientStats,
} from './types';

// Default configuration values
const DEFAULT_QUEUE_SIZE = 1000;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_WORKER_COUNT = 2;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;
const DEFAULT_BACKOFF_FACTOR = 2.0;
const DEFAULT_HTTP_TIMEOUT_MS = 30000;
const DEFAULT_MAX_BREADCRUMBS = 100;

/**
 * Core orchestrator for the LogFlux SDK.
 * Manages queue, workers, handshake, encryption, and multipart sending.
 */
export class Client {
  private options: Required<
    Pick<
      Options,
      | 'apiKey'
      | 'node'
      | 'failsafe'
      | 'enableCompression'
      | 'debug'
      | 'sampleRate'
    >
  > & Options;

  private encryptor: Encryptor | null = null;
  private keyUUID = '';
  private endpoints: EndpointInfo | null = null;
  private queue: Queue;
  private stats: StatsTracker;
  readonly breadcrumbs: BreadcrumbRing;

  // Worker state
  private workerTimers: ReturnType<typeof setTimeout>[] = [];
  private closed = false;
  private flushResolvers: Array<() => void> = [];

  // Rate limit state
  private rateLimitPauseUntil = 0;
  private quotaBlocked = new Set<string>();

  // Config
  private batchSize: number;
  private maxRetries: number;
  private initialDelayMs: number;
  private maxDelayMs: number;
  private backoffFactor: number;
  private httpTimeoutMs: number;
  private flushIntervalMs: number;
  private workerCount: number;

  constructor(options: Options) {
    // Apply defaults
    this.options = {
      ...options,
      node: options.node || this.getHostname(),
      failsafe: options.failsafe ?? true,
      enableCompression: options.enableCompression ?? true,
      debug: options.debug ?? false,
      sampleRate: options.sampleRate ?? 1.0,
    };

    const queueSize = options.queueSize ?? DEFAULT_QUEUE_SIZE;
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
    this.maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.backoffFactor = options.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;
    this.httpTimeoutMs = options.httpTimeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.workerCount = options.workerCount ?? DEFAULT_WORKER_COUNT;

    this.queue = new Queue(queueSize);
    this.stats = new StatsTracker();
    this.breadcrumbs = new BreadcrumbRing(options.maxBreadcrumbs ?? DEFAULT_MAX_BREADCRUMBS);

    // Configure global payload context
    const source = options.source || options.node || this.options.node;
    configureContext(source, options.environment ?? '', options.release ?? '');
  }

  private getHostname(): string {
    try {
      return hostname();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Initializes the client: performs discovery and handshake, then starts workers.
   */
  async initialize(): Promise<void> {
    validateApiKey(this.options.apiKey);

    // Discover endpoints
    if (this.options.customEndpointUrl) {
      this.endpoints = customEndpoint(this.options.customEndpointUrl);
    } else {
      this.endpoints = await discoverEndpoints(this.options.apiKey, 10000);
    }

    // Perform handshake
    const result = await performHandshake(
      this.endpoints,
      this.options.apiKey,
      this.httpTimeoutMs,
    );

    this.encryptor = new Encryptor(result.aesKey);
    // Zero source key material
    result.aesKey.fill(0);

    this.keyUUID = result.keyUUID;
    this.stats.handshakeOK = true;

    if (this.options.debug) {
      console.log(
        `[LogFlux] Connected to ${this.endpoints.baseUrl} (key: ${result.serverKeyFingerprint})`,
      );
    }

    // Start background workers
    this.startWorkers();
  }

  /**
   * Enqueues an entry for async sending.
   */
  enqueue(message: string, level: number, entryType: number): void {
    if (this.closed) {
      if (this.options.failsafe) return;
      throw new Error('Client is closed');
    }

    // Sampling (audit entries are exempt)
    if (
      entryType !== EntryType.Audit &&
      this.options.sampleRate < 1.0 &&
      Math.random() >= this.options.sampleRate
    ) {
      return;
    }

    // Quota check
    const category = entryTypeCategory(entryType);
    if (this.quotaBlocked.has(category)) {
      this.stats.recordDrop(DropReason.QuotaExceeded, 1);
      if (this.options.failsafe) return;
      throw new Error(`Quota exceeded for category: ${category}`);
    }

    // BeforeSend hook
    if (this.options.beforeSend) {
      const entry = { message, level, entryType };
      const result = this.options.beforeSend(entry);
      if (result === null) {
        this.stats.recordDrop(DropReason.BeforeSend, 1);
        return;
      }
    }

    const queueEntry: QueueEntry = {
      id: randomBytes(8).toString('hex'),
      message,
      timestamp: new Date(),
      level,
      entryType,
      payloadType: 0,
      node: this.options.node!,
      createdAt: new Date(),
    };

    if (this.queue.enqueue(queueEntry)) {
      this.stats.recordQueued(1);
    } else {
      this.stats.recordDrop(DropReason.QueueOverflow, 1);
      if (!this.options.failsafe) {
        throw new Error('Queue is full, entry dropped');
      }
    }
  }

  /**
   * Starts background workers that drain the queue.
   */
  private startWorkers(): void {
    for (let i = 0; i < this.workerCount; i++) {
      this.runWorker();
    }
  }

  private async runWorker(): Promise<void> {
    while (!this.closed || !this.queue.isEmpty) {
      // Check rate limit pause
      const now = Date.now();
      if (now < this.rateLimitPauseUntil) {
        await this.sleep(this.rateLimitPauseUntil - now);
        continue;
      }

      const entry = await this.queue.dequeueAsync();
      if (entry === null) break;

      // Build batch: start with the dequeued entry
      const entries: QueueEntry[] = [entry];
      if (this.batchSize > 1) {
        const extra = this.queue.dequeueBatch(this.batchSize - 1);
        entries.push(...extra);
      }

      await this.sendBatchWithRetry(entries);

      // Check if flush is waiting
      if (this.queue.isEmpty && this.flushResolvers.length > 0) {
        const resolvers = this.flushResolvers.splice(0);
        for (const resolve of resolvers) resolve();
      }
    }
  }

  private async sendBatchWithRetry(entries: QueueEntry[]): Promise<void> {
    if (!this.encryptor || !this.endpoints) return;

    const multipartEntries: MultipartEntry[] = entries.map((e) => ({
      message: e.message,
      timestamp: e.timestamp,
      entryType: e.entryType,
      payloadType: e.payloadType,
      searchTokens: e.searchTokens,
    }));

    const { body, contentType } = buildMultipartBody(
      multipartEntries,
      this.encryptor,
      this.keyUUID,
      this.options.enableCompression,
    );

    const url = getIngestUrl(this.endpoints);
    const count = entries.length;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const result = await sendMultipart(
        url,
        this.options.apiKey,
        body,
        contentType,
        this.httpTimeoutMs,
      );

      if (result.ok) {
        this.stats.recordSent(count);
        return;
      }

      // Handle rate limiting (don't count as retry attempt)
      if (result.isRateLimited) {
        const pauseSec = result.retryAfterSec ?? 60;
        this.rateLimitPauseUntil = Date.now() + pauseSec * 1000;
        this.stats.recordDrop(DropReason.RateLimited, count);
        this.stats.recordError(result.error ?? 'rate limited');
        return;
      }

      // Handle quota exceeded
      if (result.isQuotaExceeded) {
        const category = entryTypeCategory(entries[0].entryType);
        this.quotaBlocked.add(category);
        this.stats.recordDrop(DropReason.QuotaExceeded, count);
        this.stats.recordError(result.error ?? 'quota exceeded');
        return;
      }

      if (!isRetryable(result) || attempt >= this.maxRetries) {
        // Non-retryable or exhausted retries
        const reason = result.statusCode === 0 ? DropReason.NetworkError : DropReason.SendError;
        this.stats.recordDrop(reason, count);
        this.stats.recordError(result.error ?? 'unknown error');
        return;
      }

      // Backoff before retry
      const delay = calculateBackoff(
        attempt,
        this.initialDelayMs,
        this.maxDelayMs,
        this.backoffFactor,
      );
      await this.sleep(delay);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.workerTimers.push(timer);
    });
  }

  /**
   * Flushes the queue, waiting up to timeoutMs for it to drain.
   */
  async flush(timeoutMs: number = 10000): Promise<void> {
    if (this.queue.isEmpty) return;

    return new Promise<void>((resolve, reject) => {
      this.flushResolvers.push(resolve);
      setTimeout(() => {
        const idx = this.flushResolvers.indexOf(resolve);
        if (idx >= 0) {
          this.flushResolvers.splice(idx, 1);
          reject(new Error(`Flush timeout: queue still has ${this.queue.size} entries`));
        }
      }, timeoutMs);
    });
  }

  /**
   * Closes the client: flushes queue, stops workers, zeroes key material.
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    // Try to flush remaining entries
    try {
      await this.flush(10000);
    } catch {
      // Timeout is ok during close
    }

    this.queue.close();

    // Clear worker timers
    for (const timer of this.workerTimers) {
      clearTimeout(timer);
    }
    this.workerTimers = [];

    // Zero key material
    if (this.encryptor) {
      this.encryptor.close();
      this.encryptor = null;
    }
  }

  /**
   * Returns current client statistics.
   */
  getStats(): ClientStats {
    return this.stats.snapshot(this.queue.size, this.queue.capacity);
  }

  /**
   * Returns true if the client is initialized and not closed.
   */
  get isActive(): boolean {
    return !this.closed && this.encryptor !== null;
  }
}
