import type { Env } from "./types";
import { errorResponse } from "./utils";

export function validateAuth(
  request: Request,
  env: Env,
): Response | null {
  if (!env.API_KEY) {
    return errorResponse(503, "Service not configured", "server_error");
  }

  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(401, "Missing or invalid Authorization header", "auth_error", null, "invalid_api_key");
  }

  const token = authHeader.slice(7);
  if (!timingSafeEqual(token, env.API_KEY)) {
    return errorResponse(401, "Invalid API key", "auth_error", null, "invalid_api_key");
  }

  return null;
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
