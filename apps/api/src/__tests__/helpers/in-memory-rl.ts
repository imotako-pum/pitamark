// `in-memory-kv.ts` の RateLimit binding 版。本物の binding は async で edge 越しに
// eventually consistent。stub は process 内 map で synchronous だが、pass/fail
// semantics だけ確認したい unit test には十分。

export type StubRateLimitOptions = Readonly<{
  /** state に関係なく常に `{ success: false }` を返す。 */
  alwaysBlock?: boolean;
  /** 期間ごとの request 予算。default 1000 (実質 unlimited)。 */
  limit?: number;
  /** 期間長さ (秒)。default 60。 */
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
