// Phase 7: counterpart to `in-memory-kv.ts` for the Workers `RateLimit`
// binding shape. The real binding is asynchronous and counts are eventually
// consistent across the edge; the stub is synchronous (per-process map) which
// is fine for unit tests that only need pass/fail semantics.

export type StubRateLimitOptions = Readonly<{
  /** Always return `{ success: false }` regardless of state. */
  alwaysBlock?: boolean;
  /** Per-period request budget. Defaults to 1000 (effectively unlimited). */
  limit?: number;
  /** Period length in seconds. Defaults to 60. */
  period?: number;
}>;

export const createStubRateLimit = (opts: StubRateLimitOptions = {}): RateLimit => {
  const counters = new Map<string, { count: number; resetAt: number }>();
  return {
    async limit({ key }) {
      if (opts.alwaysBlock) return { success: false };
      const limit = opts.limit ?? 1000;
      const period = (opts.period ?? 60) * 1000;
      const now = Date.now();
      const entry = counters.get(key);
      if (!entry || entry.resetAt < now) {
        counters.set(key, { count: 1, resetAt: now + period });
        return { success: true };
      }
      if (entry.count >= limit) return { success: false };
      entry.count++;
      return { success: true };
    },
  };
};
