import type { Env } from "./types";

export function errorResponse(
  status: number,
  message: string,
  type: string,
  param: string | null = null,
  code: string | null = null,
): Response {
  return new Response(
    JSON.stringify({ error: { message, type, param, code } }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export function validateAuth(
  request: Request,
  env: Env,
): Response | null {
  if (!env.API_KEY) {
    return errorResponse(503, "Service not configured", "server_error");
  }

  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return errorResponse(401, "Missing Authorization header", "auth_error", null, "invalid_api_key");
  }

  if (!authHeader.startsWith("Bearer ")) {
    return errorResponse(401, "Invalid Authorization header format", "auth_error", null, "invalid_api_key");
  }

  const token = authHeader.slice(7);
  if (!token) {
    return errorResponse(401, "Invalid API key", "auth_error", null, "invalid_api_key");
  }

  if (!timingSafeEqual(token, env.API_KEY)) {
    return errorResponse(401, "Invalid API key", "auth_error", null, "invalid_api_key");
  }

  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);

  // Constant-time length check: compare full length of the longer buffer
  const maxLen = Math.max(bufA.length, bufB.length);
  const paddedA = new Uint8Array(maxLen);
  const paddedB = new Uint8Array(maxLen);
  paddedA.set(bufA);
  paddedB.set(bufB);

  let lengthMatch = bufA.length === bufB.length;
  let contentMatch = true;
  for (let i = 0; i < maxLen; i++) {
    contentMatch &&= paddedA[i] === paddedB[i];
  }
  return lengthMatch && contentMatch;
}
