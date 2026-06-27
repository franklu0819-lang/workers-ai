import type { Env } from "./types";
import { errorResponse } from "./utils";
import { checkRateLimit } from "./rate-limit";

export interface AuthResult {
  ok: true;
  token: string;
  rateLimit: { remaining: number };
}

export interface AuthError {
  ok: false;
  response: Response;
  retryAfter?: number;
}

// Authenticate + rate-limit in one step. The rate-limit bucket is keyed on the
// verified token so each API key gets its own quota; unauthenticated requests
// are rejected before consuming any budget.
export async function authorize(
  request: Request,
  env: Env,
): Promise<AuthResult | AuthError> {
  if (!env.API_KEY) {
    return { ok: false, response: errorResponse(503, "Service not configured", "server_error") };
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: errorResponse(401, "Missing or invalid Authorization header", "auth_error", null, "invalid_api_key"),
    };
  }

  const token = authHeader.slice(7);
  if (!timingSafeEqual(token, env.API_KEY)) {
    return {
      ok: false,
      response: errorResponse(401, "Invalid API key", "auth_error", null, "invalid_api_key"),
    };
  }

  // Per-key rate limit, checked after auth so brute-force attempts don't
  // consume quota.
  const decision = await checkRateLimit(env, token);
  if (!decision.allowed) {
    return {
      ok: false,
      response: errorResponse(
        429,
        "Rate limit exceeded. Please retry shortly.",
        "rate_limit_error",
        null,
        "rate_limit_exceeded",
      ),
      retryAfter: decision.retryAfter,
    };
  }

  return { ok: true, token, rateLimit: { remaining: decision.remaining } };
}

// Fixed-window constant-time compare. The loop always runs COMPARE_WINDOW
// iterations regardless of input lengths, so timing does not leak the secret
// length. Inputs longer than the window are rejected outright.
const COMPARE_WINDOW = 256;

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);

  if (bufA.length > COMPARE_WINDOW || bufB.length > COMPARE_WINDOW) {
    return false;
  }

  let match = bufA.length === bufB.length;
  for (let i = 0; i < COMPARE_WINDOW; i++) {
    const aByte = i < bufA.length ? bufA[i] : 0;
    const bByte = i < bufB.length ? bufB[i] : 0;
    match = match && aByte === bByte;
  }
  return match;
}
