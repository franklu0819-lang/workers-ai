import { resolveModel } from "./models";
import { errorResponse } from "./auth";
import { arrayBufferToBase64 } from "./utils";
import type { Env } from "./types";

const DEFAULT_ASR_MODEL = "@cf/openai/whisper";

const BASE64_AUDIO_MODELS = new Set([
  "@cf/openai/whisper-large-v3-turbo",
]);

interface AsrResult {
  text?: string;
  word_count?: number;
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

    const binary = atob(body.audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    audioBuffer = bytes.buffer;

    modelStr = body.model;
    language = body.language;
    responseFormat = body.response_format || "json";
  } else {
    return errorResponse(400, "Unsupported Content-Type. Use multipart/form-data or application/json", "invalid_request_error");
  }

  const rawModel = modelStr && modelStr.length > 0 ? modelStr : DEFAULT_ASR_MODEL;
  const model = resolveModel(rawModel);

  const useBase64 = BASE64_AUDIO_MODELS.has(model);
  const audioInput = useBase64
    ? arrayBufferToBase64(audioBuffer)
    : [...new Uint8Array(audioBuffer)];

  const input: Record<string, unknown> = { audio: audioInput };
  if (language) input.language = language;

  let result: AsrResult;
  try {
    result = await env.AI.run(model, input) as AsrResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI binding error";
    return errorResponse(502, message, "server_error");
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
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
