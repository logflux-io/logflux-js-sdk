import { applyContext } from './context';
import type { Breadcrumb } from '../breadcrumb';

/**
 * A single frame in a stack trace.
 */
export interface StackFrame {
  function: string;
  file: string;
  line: number;
}

/**
 * A chained error in an unwrapped error chain.
 */
export interface ChainedError {
  type: string;
  message: string;
}

/**
 * Creates a v2 error payload (type 1 with error-specific fields).
 */
export function createErrorPayload(
  error: Error,
  attributes?: Record<string, string>,
  breadcrumbs?: Breadcrumb[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    v: '2.0',
    type: 'log',
    source: '',
    level: 4, // Error level
    ts: new Date().toISOString(),
    message: error.message,
    error_type: error.constructor.name || 'Error',
    error_message: error.message,
  };

  const stackFrames = parseStackTrace(error);
  if (stackFrames.length > 0) {
    payload.stack_trace = stackFrames;
  }

  const chain = unwrapErrorChain(error);
  if (chain.length > 1) {
    payload.error_chain = chain;
  }

  if (breadcrumbs && breadcrumbs.length > 0) {
    payload.breadcrumbs = breadcrumbs;
  }

  if (attributes && Object.keys(attributes).length > 0) {
    payload.attributes = attributes;
  }

  applyContext(payload);
  return payload;
}

/**
 * Creates a v2 error payload with a custom message.
 */
export function createErrorPayloadWithMessage(
  error: Error,
  message: string,
  attributes?: Record<string, string>,
  breadcrumbs?: Breadcrumb[],
): Record<string, unknown> {
  const mergedAttrs = { ...attributes, error: error.message };

  const payload: Record<string, unknown> = {
    v: '2.0',
    type: 'log',
    source: '',
    level: 4,
    ts: new Date().toISOString(),
    message,
    error_type: error.constructor.name || 'Error',
    error_message: error.message,
  };

  const stackFrames = parseStackTrace(error);
  if (stackFrames.length > 0) {
    payload.stack_trace = stackFrames;
  }

  const chain = unwrapErrorChain(error);
  if (chain.length > 1) {
    payload.error_chain = chain;
  }

  if (breadcrumbs && breadcrumbs.length > 0) {
    payload.breadcrumbs = breadcrumbs;
  }

  if (Object.keys(mergedAttrs).length > 0) {
    payload.attributes = mergedAttrs;
  }

  applyContext(payload);
  return payload;
}

/**
 * Parses a JS Error stack trace into structured frames.
 */
function parseStackTrace(error: Error): StackFrame[] {
  if (!error.stack) return [];

  const frames: StackFrame[] = [];
  const lines = error.stack.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) continue;

    // Parse: "at functionName (file:line:col)" or "at file:line:col"
    const withParens = trimmed.match(/^at\s+(.+?)\s+\((.+?):(\d+):\d+\)$/);
    if (withParens) {
      frames.push({
        function: withParens[1],
        file: withParens[2],
        line: parseInt(withParens[3], 10),
      });
      continue;
    }

    const withoutParens = trimmed.match(/^at\s+(.+?):(\d+):\d+$/);
    if (withoutParens) {
      frames.push({
        function: '<anonymous>',
        file: withoutParens[1],
        line: parseInt(withoutParens[2], 10),
      });
    }
  }

  return frames.slice(0, 20);
}

/**
 * Unwraps an error chain using the cause property (up to 10 levels).
 */
function unwrapErrorChain(error: Error): ChainedError[] {
  const chain: ChainedError[] = [];
  let current: Error | undefined = error;
  for (let i = 0; i < 10 && current; i++) {
    chain.push({
      type: current.constructor.name || 'Error',
      message: current.message,
    });
    current = (current as { cause?: Error }).cause;
  }
  return chain;
}
