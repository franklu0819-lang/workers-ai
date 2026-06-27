import { authorize } from "./auth";
import { errorResponse } from "./utils";
import { getModelList } from "./models";
import { handleChat } from "./do-chat";
import { handleImage } from "./do-image";
import { handleTts } from "./do-tts";
import { handleAsr } from "./do-asr";
import type { Env } from "./types";

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB for JSON bodies
const MAX_MULTIPART_SIZE = 25 * 1024 * 1024; // 25 MB for audio uploads

function withCORS(response: Response, extra?: Record<string, string>): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  if (extra) {
    for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function corsOptions(): Response {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return corsOptions();
    }

    const auth = await authorize(request, env);
    if (!auth.ok) {
      const res = auth.response;
      if (res.status === 429 && auth.retryAfter != null) {
        const headers = new Headers(res.headers);
        headers.set("Retry-After", String(auth.retryAfter));
        return withCORS(new Response(res.body, { status: 429, statusText: res.statusText, headers }));
      }
      return withCORS(res);
    }

    // Surface remaining quota on every response so clients can self-throttle.
    const respond = (response: Response) =>
      withCORS(response, { "X-RateLimit-Remaining": String(auth.rateLimit.remaining) });

    // GET /v1/models
    if (pathname === "/v1/models") {
      if (request.method !== "GET") {
        return respond(
          errorResponse(405, "Method not allowed", "invalid_request_error"),
        );
      }
      return respond(
        new Response(JSON.stringify(getModelList()), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // Body size check for POST endpoints. Content-Length gives a fast early
    // reject; for chunked uploads (no Content-Length) we buffer once and
    // enforce the same limit, then hand handlers a reconstructed request.
    let req: Request = request;
    if (request.method === "POST") {
      const ct = request.headers.get("Content-Type") || "";
      const isMultipart = ct.includes("multipart/form-data");
      const limit = isMultipart ? MAX_MULTIPART_SIZE : MAX_BODY_SIZE;
      const contentLength = request.headers.get("Content-Length");
      if (contentLength) {
        if (parseInt(contentLength, 10) > limit) {
          return respond(
            errorResponse(413, "Request body too large", "invalid_request_error"),
          );
        }
      } else {
        const buf = await request.arrayBuffer();
        if (buf.byteLength > limit) {
          return respond(
            errorResponse(413, "Request body too large", "invalid_request_error"),
          );
        }
        req = new Request(request, { body: buf });
      }
    }

    // POST /v1/chat/completions
    if (pathname === "/v1/chat/completions") {
      if (request.method !== "POST") {
        return respond(
          errorResponse(405, "Method not allowed", "invalid_request_error"),
        );
      }
      return respond(await handleChat(req, env));
    }

    // POST /v1/images/generations
    if (pathname === "/v1/images/generations") {
      if (request.method !== "POST") {
        return respond(
          errorResponse(405, "Method not allowed", "invalid_request_error"),
        );
      }
      return respond(await handleImage(req, env));
    }

    // POST /v1/audio/speech
    if (pathname === "/v1/audio/speech") {
      if (request.method !== "POST") {
        return respond(
          errorResponse(405, "Method not allowed", "invalid_request_error"),
        );
      }
      return respond(await handleTts(req, env));
    }

    // POST /v1/audio/transcriptions
    if (pathname === "/v1/audio/transcriptions") {
      if (request.method !== "POST") {
        return respond(
          errorResponse(405, "Method not allowed", "invalid_request_error"),
        );
      }
      return respond(await handleAsr(req, env));
    }

    return respond(
      errorResponse(404, "Unknown endpoint", "invalid_request_error"),
    );
  },
};
