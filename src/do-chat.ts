import { resolveModel, DEFAULT_CHAT_MODEL } from "./models";
import { errorResponse } from "./auth";
import type { Env } from "./types";

interface ChatRequestBody {
  model?: string;
  messages?: Array<{ role: string; content: unknown }>;
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  [key: string]: unknown;
}

interface ChatResponse {
  response?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function toOpenAiCompletion(id: string, created: number, model: string, result: ChatResponse): object {
  return {
    id,
    object: "chat.completion",
    created,
    model,
    choices: [{
      index: 0,
      message: { role: "assistant", content: result.response ?? "" },
      finish_reason: "stop",
    }],
    usage: {
      prompt_tokens: result.usage?.prompt_tokens ?? 0,
      completion_tokens: result.usage?.completion_tokens ?? 0,
      total_tokens: result.usage?.total_tokens ?? 0,
    },
  };
}

function toOpenAiStreamChunk(id: string, created: number, model: string, text: string, finishReason: string | null): string {
  const chunk = {
    id,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{
      index: 0,
      delta: text ? { content: text } : {},
      finish_reason: finishReason,
    }],
  };
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

function transformSseStream(source: ReadableStream, id: string, created: number, model: string): ReadableStream {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            controller.enqueue(new TextEncoder().encode(buffer));
          }
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;

          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            controller.enqueue(new TextEncoder().encode(toOpenAiStreamChunk(id, created, model, "", "stop")));
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.response) {
              controller.enqueue(new TextEncoder().encode(toOpenAiStreamChunk(id, created, model, parsed.response, null)));
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

export async function handleChat(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return errorResponse(400, "Invalid JSON body", "invalid_request_error");
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return errorResponse(400, "messages is required and must be a non-empty array", "invalid_request_error");
  }

  const rawModel = typeof body.model === "string" && body.model.length > 0
    ? body.model
    : DEFAULT_CHAT_MODEL;
  const model = resolveModel(rawModel);
  const isStream = body.stream === true;

  const completionId = `chatcmpl-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const created = Math.floor(Date.now() / 1000);

  const params: Record<string, unknown> = {
    messages: body.messages,
    stream: isStream,
  };
  if (body.max_tokens != null) params.max_tokens = body.max_tokens;
  if (body.temperature != null) params.temperature = body.temperature;
  if (body.top_p != null) params.top_p = body.top_p;
  if (body.frequency_penalty != null) params.frequency_penalty = body.frequency_penalty;
  if (body.presence_penalty != null) params.presence_penalty = body.presence_penalty;

  try {
    const result = await env.AI.run(model, params);

    if (isStream && result instanceof ReadableStream) {
      return new Response(transformSseStream(result, completionId, created, model), {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    const chatResult = result as Record<string, unknown>;

    if (chatResult.choices && Array.isArray(chatResult.choices)) {
      return new Response(
        JSON.stringify(chatResult),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const legacyResult = result as ChatResponse;
    return new Response(
      JSON.stringify(toOpenAiCompletion(completionId, created, model, legacyResult)),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI binding error";
    return errorResponse(502, message, "server_error");
  }
}
