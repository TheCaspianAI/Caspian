/**
 * Safe Tauri API wrappers for browser-only development
 * These functions handle the case when running in browser without Tauri backend
 */

// Check if we're running in Tauri (v2 uses __TAURI_INTERNALS__)
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' &&
    ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);
};

/**
 * Options for safeInvoke with retry logic
 */
export interface InvokeOptions {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Error substrings that should trigger retry (default: ['network', 'timeout', 'connection']) */
  retryableErrors?: string[];
  /** Initial delay in ms before first retry (default: 100) */
  baseDelay?: number;
}

/**
 * Result type for safeInvokeWithError - always returns error info instead of null
 */
export interface InvokeResult<T> {
  data: T | null;
  error: string | null;
}

/**
 * Safe invoke wrapper with exponential backoff retry for transient failures
 * Returns mock data when not in Tauri
 */
export async function safeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
  options: InvokeOptions = {}
): Promise<T | null> {
  if (!isTauri()) {
    console.warn(`[Tauri] Not in Tauri environment, skipping invoke: ${cmd}`);
    return null;
  }

  const {
    maxRetries = 3,
    retryableErrors = ['network', 'timeout', 'connection', 'econnrefused'],
    baseDelay = 100,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<T>(cmd, args);
    } catch (error) {
      const errorString = String(error).toLowerCase();
      const isRetryable = retryableErrors.some(e => errorString.includes(e));

      if (!isRetryable || attempt === maxRetries) {
        console.error(`[Tauri] Invoke error for ${cmd}:`, error);
        return null;
      }

      // Exponential backoff: 100ms, 200ms, 400ms, ...
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`[Tauri] Retrying ${cmd} (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return null;
}

/**
 * Safe invoke wrapper that returns error information instead of null.
 * Use this when you need to display error messages to the user.
 * Unlike safeInvoke which swallows errors, this always returns an InvokeResult
 * with either data or a meaningful error message.
 */
export async function safeInvokeWithError<T>(
  cmd: string,
  args?: Record<string, unknown>,
  options: InvokeOptions = {}
): Promise<InvokeResult<T>> {
  if (!isTauri()) {
    return {
      data: null,
      error: 'Not running in desktop app environment',
    };
  }

  const {
    maxRetries = 3,
    retryableErrors = ['network', 'timeout', 'connection', 'econnrefused'],
    baseDelay = 100,
  } = options;

  let lastError: string = 'Unknown error';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const data = await invoke<T>(cmd, args);
      return { data, error: null };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const errorString = lastError.toLowerCase();
      const isRetryable = retryableErrors.some(e => errorString.includes(e));

      if (!isRetryable || attempt === maxRetries) {
        console.error(`[Tauri] Invoke error for ${cmd}:`, error);
        return { data: null, error: lastError };
      }

      // Exponential backoff: 100ms, 200ms, 400ms, ...
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`[Tauri] Retrying ${cmd} (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return { data: null, error: lastError };
}

// Safe event listener wrapper
export async function safeListen<T>(
  event: string,
  handler: (payload: T) => void
): Promise<(() => void) | null> {
  if (!isTauri()) {
    console.warn(`[Tauri] Not in Tauri environment, skipping listen: ${event}`);
    return null;
  }

  try {
    const { listen } = await import('@tauri-apps/api/event');
    const unlisten = await listen<T>(event, (e) => handler(e.payload));
    return unlisten;
  } catch (error) {
    console.error(`[Tauri] Listen error for ${event}:`, error);
    return null;
  }
}
