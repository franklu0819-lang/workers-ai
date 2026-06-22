import { resolveModel, DEFAULT_IMAGE_MODEL } from "./models";
import { errorResponse } from "./auth";
import { arrayBufferToBase64 } from "./utils";
import type { Env } from "./types";

interface ImageRequestBody {
  prompt?: string;
  model?: string;
  size?: string;
  response_format?: "b64_json" | "url";
  steps?: number;
  n?: number;
}

interface AiImageResponse {
  image?: string | ArrayBuffer | Uint8Array;
}

const MULTIPART_MODELS = new Set([
  "@cf/black-forest-labs/flux-2-dev",
  "@cf/black-forest-labs/flux-2-klein-4b",
  "@cf/black-forest-labs/flux-2-klein-9b",
]);

function parseSize(size: string | undefined, defaultW: number, defaultH: number): { width: number; height: number } {
  if (!size) return { width: defaultW, height: defaultH };
  const parts = size.split("x");
  if (parts.length !== 2) return { width: defaultW, height: defaultH };
  const width = parseInt(parts[0], 10);
  const height = parseInt(parts[1], 10);
  if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
    return { width: defaultW, height: defaultH };
  }
  return { width, height };
}

async function runMultipart(
  env: Env,
  model: string,
  prompt: string,
  width: number,
  height: number,
  steps: number,
): Promise<AiImageResponse> {
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("width", String(width));
  form.append("height", String(height));
  form.append("steps", String(steps));

  const formResponse = new Response(form);
  const formStream = formResponse.body;
  const formContentType = formResponse.headers.get("content-type")!;

  return await env.AI.run(model, {
    multipart: {
      body: formStream,
      contentType: formContentType,
    },
  }) as AiImageResponse;
}

async function runJson(
  env: Env,
  model: string,
  prompt: string,
  width: number,
  height: number,
  steps: number,
): Promise<AiImageResponse> {
  return await env.AI.run(model, {
    prompt,
    width,
    height,
    steps,
  }) as AiImageResponse;
}

export async function handleImage(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: ImageRequestBody;
  try {
    body = (await request.json()) as ImageRequestBody;
  } catch {
    return errorResponse(400, "Invalid JSON body", "invalid_request_error");
  }

  if (!body.prompt || typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return errorResponse(400, "prompt is required", "invalid_request_error");
  }

  if (body.n != null && body.n !== 1) {
    return errorResponse(400, "Only n=1 is supported", "invalid_request_error", "n", "unsupported_value");
  }

  if (body.response_format && body.response_format !== "b64_json") {
    return errorResponse(
      400,
      "response_format must be 'b64_json' (the proxy does not host downloadable image URLs)",
      "invalid_request_error",
      "response_format",
      "unsupported_value",
    );
  }

  const rawModel = typeof body.model === "string" && body.model.length > 0
    ? body.model
    : DEFAULT_IMAGE_MODEL;
  const model = resolveModel(rawModel);

  const isMultipart = MULTIPART_MODELS.has(model);
  const { width, height } = parseSize(body.size, 1024, 1024);
  const defaultSteps = isMultipart ? 20 : 4;
  const steps = body.steps ?? defaultSteps;

  let result: AiImageResponse;
  try {
    result = isMultipart
      ? await runMultipart(env, model, body.prompt, width, height, steps)
      : await runJson(env, model, body.prompt, width, height, steps);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI binding error";
    return errorResponse(502, message, "server_error");
  }

  let base64: string;
  if (typeof result.image === "string") {
    base64 = result.image;
  } else if (result.image instanceof Uint8Array) {
    base64 = arrayBufferToBase64(result.image.buffer);
  } else if (result.image instanceof ArrayBuffer) {
    base64 = arrayBufferToBase64(result.image);
  } else {
    return errorResponse(502, "Unexpected AI response format", "server_error");
  }

  const imageItem = { b64_json: base64 };

  return new Response(
    JSON.stringify({
      created: Math.floor(Date.now() / 1000),
      data: [imageItem],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
