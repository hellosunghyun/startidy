/**
 * Simple rate limiter for API calls
 */
export class RateLimiter {
  private lastCallTime = 0;

  constructor(private minDelayMs: number = 1000) {}

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;

    if (elapsed < this.minDelayMs) {
      await this.delay(this.minDelayMs - elapsed);
    }

    this.lastCallTime = Date.now();
    return fn();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Delay helper function
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  } = {},
): Promise<T> {
  const { maxRetries = 3, initialDelayMs = 500, maxDelayMs = 5000 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delayMs = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Run async tasks with concurrency limit
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await processor(items[index]);
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

/**
 * Process items in batches with concurrency control
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: {
    batchSize?: number;
    batchDelayMs?: number;
    onProgress?: (completed: number, total: number) => void;
  } = {},
): Promise<R[]> {
  const { batchSize = 10, batchDelayMs = 3000, onProgress } = options;
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map((item, idx) => processor(item, i + idx)),
    );

    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, items.length), items.length);
    }

    // Delay between batches (skip for last batch)
    if (i + batchSize < items.length) {
      await delay(batchDelayMs);
    }
  }

  return results;
}
