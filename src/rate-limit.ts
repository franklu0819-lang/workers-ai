import type { Env } from "./types";

// Per-key fixed-window rate limiter backed by KV.
//
// Each (token, window) pair is a KV key holding an integer counter. The window
// is the current minute (UTC). A request is allowed if the counter is below the
// limit; otherwise it is rejected with 429. The counter is incremented with a
// short TTL so stale windows are cleaned up automatically.
//
// Fixed-window (vs sliding-window) keeps this to one KV read + one KV write per
// request, which matters: KV operations are the latency and cost bottleneck.

export const RATE_LIMIT_RPM = 10; // max requests per minute per key
const WINDOW_SECONDS = 60;

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds until the current window resets
}

export async function checkRateLimit(
  env: Env,
  key: string,
): Promise<RateLimitDecision> {
  // If KV isn't bound (e.g. local dev without it), fail open.
  if (!env.RATE_LIMIT_KV) {
    return { allowed: true, remaining: RATE_LIMIT_RPM, retryAfter: 0 };
  }

  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / WINDOW_SECONDS) * WINDOW_SECONDS;
  const retryAfter = windowStart + WINDOW_SECONDS - now;
  const kvKey = `rl:${key}:${windowStart}`;

  const raw = await env.RATE_LIMIT_KV.get(kvKey);
  const current = raw ? parseInt(raw, 10) : 0;

  if (current >= RATE_LIMIT_RPM) {
    return { allowed: false, remaining: 0, retryAfter };
  }

  // Best-effort increment. KV is eventually consistent, so under concurrent
  // bursts the counter may slightly undercount — acceptable for abuse
  // prevention, not for hard billing guarantees.
  await env.RATE_LIMIT_KV.put(kvKey, String(current + 1), {
    expirationTtl: WINDOW_SECONDS + 5,
  });

  return { allowed: true, remaining: RATE_LIMIT_RPM - (current + 1), retryAfter };
}
