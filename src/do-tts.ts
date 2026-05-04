import { resolveModel } from "./models";
import { errorResponse } from "./auth";
import type { Env } from "./types";

const DEFAULT_TTS_MODEL = "@cf/myshell-ai/melotts";

interface TtsRequestBody {
  input?: string;
  model?: string;
  voice?: string;
  response_format?: string;
  speed?: number;
  lang?: string;
}

export async function handleTts(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: TtsRequestBody;
  try {
    body = (await request.json()) as TtsRequestBody;
  } catch {
    return errorResponse(400, "Invalid JSON body", "invalid_request_error");
  }

  const input = body.input;
  if (!input || typeof input !== "string" || input.trim().length === 0) {
    return errorResponse(400, "input is required", "invalid_request_error");
  }

  const rawModel = typeof body.model === "string" && body.model.length > 0
    ? body.model
    : DEFAULT_TTS_MODEL;
  const model = resolveModel(rawModel);

  const lang = body.lang ?? "en";
  if (lang !== "en") {
    return errorResponse(400, "Only English (en) is supported", "invalid_request_error", null, "unsupported_language");
  }

  if (body.response_format && body.response_format !== "mp3") {
    return errorResponse(400, "Only mp3 format is supported", "invalid_request_error", "response_format", "unsupported_format");
  }

  if (body.speed != null && body.speed !== 1) {
    return errorResponse(400, "Custom speed is not supported", "invalid_request_error", "speed", "unsupported_parameter");
  }

  let result: { audio?: string };
  try {
    result = await env.AI.run(model, {
      prompt: input,
      lang,
    }) as { audio?: string };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI binding error";
    return errorResponse(502, message, "server_error");
  }

  if (!result.audio || typeof result.audio !== "string") {
    return errorResponse(502, "Unexpected AI response format", "server_error");
  }

  const audioBytes = Uint8Array.from(atob(result.audio), (c) => c.charCodeAt(0));

  return new Response(audioBytes, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBytes.byteLength),
    },
  });
}
