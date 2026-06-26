import { resolveModel, DEFAULT_ASR_MODEL } from "./models";
import { errorResponse, arrayBufferToBase64, base64ToArrayBuffer } from "./utils";
import type { Env } from "./types";

const BASE64_AUDIO_MODELS = new Set([
  "@cf/openai/whisper-large-v3-turbo",
]);

const SUPPORTED_FORMATS = new Set(["json", "text", "srt", "vtt"]);

interface AsrResult {
  text?: string;
  words?: Array<{ word: string; start: number; end: number }>;
  vtt?: string;
}

export async function handleAsr(
  request: Request,
  env: Env,
): Promise<Response> {
  const contentType = request.headers.get("Content-Type") || "";

  let audioBuffer: ArrayBuffer;
  let modelStr: string | undefined;
  let language: string | undefined;
  let responseFormat: string = "json";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return errorResponse(400, "file is required", "invalid_request_error");
    }
    audioBuffer = await (file as Blob).arrayBuffer();

    const modelVal = formData.get("model");
    modelStr = typeof modelVal === "string" ? modelVal : undefined;
    const langVal = formData.get("language");
    language = typeof langVal === "string" ? langVal : undefined;
    const fmtVal = formData.get("response_format");
    responseFormat = typeof fmtVal === "string" ? fmtVal : "json";
  } else if (contentType.includes("application/json")) {
    const body = await request.json() as {
      audio?: string;
      model?: string;
      language?: string;
      response_format?: string;
    };

    if (!body.audio || typeof body.audio !== "string") {
      return errorResponse(400, "audio (base64) is required", "invalid_request_error");
    }

    audioBuffer = base64ToArrayBuffer(body.audio);

    modelStr = body.model;
    language = body.language;
    responseFormat = body.response_format || "json";
  } else {
    return errorResponse(400, "Unsupported Content-Type. Use multipart/form-data or application/json", "invalid_request_error");
  }

  const rawModel = modelStr && modelStr.length > 0 ? modelStr : DEFAULT_ASR_MODEL;
  const model = resolveModel(rawModel);

  if (!SUPPORTED_FORMATS.has(responseFormat)) {
    return errorResponse(
      400,
      `Unsupported response_format: '${responseFormat}'. Supported: json, text, srt, vtt`,
      "invalid_request_error",
      "response_format",
      "unsupported_value",
    );
  }

  const useBase64 = BASE64_AUDIO_MODELS.has(model);
  const audioInput = useBase64
    ? arrayBufferToBase64(audioBuffer)
    : new Uint8Array(audioBuffer);

  const input: Record<string, unknown> = { audio: audioInput };
  if (language) input.language = language;

  let result: AsrResult;
  try {
    result = await env.AI.run(model, input) as AsrResult;
  } catch (err) {
    console.error("asr error:", err);
    return errorResponse(502, "AI service error", "server_error");
  }

  if (!result.text) {
    return errorResponse(502, "No transcription returned", "server_error");
  }

  switch (responseFormat) {
    case "text":
      return new Response(result.text, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    case "vtt":
      return new Response(result.vtt ?? result.text, {
        status: 200,
        headers: { "Content-Type": "text/vtt; charset=utf-8" },
      });
    case "srt": {
      if (!result.words || result.words.length === 0) {
        const srt = `1\n00:00:00,000 --> 00:00:10,000\n${result.text}\n`;
        return new Response(srt, {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
      const srt = result.words
        .map((w, i) => `${i + 1}\n${formatSrtTime(w.start)} --> ${formatSrtTime(w.end)}\n${w.word}\n`)
        .join("\n");
      return new Response(srt, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    default:
      return new Response(
        JSON.stringify({ text: result.text }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
  }
}

function formatSrtTime(seconds: number): string {
  // Round once to total milliseconds, then decompose — keeps ms in [0, 999]
  // and avoids floating-point drift across the h/m/s/ms components.
  const totalMs = Math.round(seconds * 1000);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
