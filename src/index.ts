import { validateAuth, errorResponse } from "./auth";
import { getModelList } from "./models";
import { handleChat } from "./do-chat";
import { handleImage } from "./do-image";
import { handleTts } from "./do-tts";
import { handleAsr } from "./do-asr";
import type { Env } from "./types";

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB for JSON bodies
const MAX_MULTIPART_SIZE = 25 * 1024 * 1024; // 25 MB for audio uploads

function withCORS(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
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

    const authError = validateAuth(request, env);
    if (authError) {
      return withCORS(authError);
    }

    // GET /v1/models
    if (pathname === "/v1/models") {
      if (request.method !== "GET") {
        return withCORS(
          errorResponse(405, "Method not allowed", "invalid_request_error"),
        );
      }
      return withCORS(
        new Response(JSON.stringify(getModelList()), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    }

    // Body size check for POST endpoints
    if (request.method === "POST") {
      const ct = request.headers.get("Content-Type") || "";
      const isMultipart = ct.includes("multipart/form-data");
      const limit = isMultipart ? MAX_MULTIPART_SIZE : MAX_BODY_SIZE;
      const contentLength = request.headers.get("Content-Length");
      if (!contentLength) {
        if (!isMultipart) {
          return withCORS(
            errorResponse(413, "Request body too large", "invalid_request_error"),
          );
        }
      } else if (parseInt(contentLength, 10) > limit) {
        return withCORS(
          errorResponse(413, "Request body too large", "invalid_request_error"),
        );
      }
    }

    // POST /v1/chat/completions
    if (pathname === "/v1/chat/completions") {
      if (request.method !== "POST") {
        return withCORS(
          errorResponse(405, "Method not allowed", "invalid_request_error"),
        );
      }
      return withCORS(await handleChat(request, env));
    }

    // POST /v1/images/generations
    if (pathname === "/v1/images/generations") {
      if (request.method !== "POST") {
        return withCORS(
          errorResponse(405, "Method not allowed", "invalid_request_error"),
        );
      }
      return withCORS(await handleImage(request, env));
    }

    // POST /v1/audio/speech
    if (pathname === "/v1/audio/speech") {
      if (request.method !== "POST") {
        return withCORS(
          errorResponse(405, "Method not allowed", "invalid_request_error"),
        );
      }
      return withCORS(await handleTts(request, env));
    }

    // POST /v1/audio/transcriptions
    if (pathname === "/v1/audio/transcriptions") {
      if (request.method !== "POST") {
        return withCORS(
          errorResponse(405, "Method not allowed", "invalid_request_error"),
        );
      }
      return withCORS(await handleAsr(request, env));
    }

    return withCORS(
      errorResponse(404, "Unknown endpoint", "invalid_request_error"),
    );
  },
};
