/**
 * src/features/ai/concurrency.ts — Single-slot async concurrency limiter.
 *
 * From plan §8: "Use a single-concurrency limiter rather than a durable queue."
 * This is a simple async mutex/queue — not a durable queue. Only one Ollama
 * request runs at a time; callers queue behind the running request.
 *
 * Server-only — never import in browser code.
 */

type Task<T> = () => Promise<T>;

/**
 * A simple single-slot concurrency limiter (async mutex).
 * At most one task runs at a time; all others queue in order.
 */
export class ConcurrencyLimiter {
  private _running = false;
  private _queue: Array<() => void> = [];

  /**
   * Run `task` when the slot is free. If another task is running,
   * this call waits until the slot becomes available.
   */
  async run<T>(task: Task<T>): Promise<T> {
    await this._acquire();
    try {
      return await task();
    } finally {
      this._release();
    }
  }

  private _acquire(): Promise<void> {
    if (!this._running) {
      this._running = true;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this._queue.push(resolve);
    });
  }

  private _release(): void {
    const next = this._queue.shift();
    if (next) {
      next();
    } else {
      this._running = false;
    }
  }
}

/**
 * Module-level singleton limiter used by OllamaAiProvider.
 * AI_CONCURRENCY=1 means this single limiter is all that is needed.
 */
export const aiLimiter = new ConcurrencyLimiter();
