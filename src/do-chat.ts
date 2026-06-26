import { resolveModel, DEFAULT_CHAT_MODEL } from "./models";
import { errorResponse } from "./utils";
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
  const encoder = new TextEncoder();
  let buffer = "";
  let sentRole = false;
  let finished = false;

  const MAX_BUFFER = 1024 * 1024;

  function ensureRole(controller: ReadableStreamDefaultController) {
    if (sentRole) return;
    const roleChunk = {
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
    };
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(roleChunk)}\n\n`));
    sentRole = true;
  }

  function emitContent(controller: ReadableStreamDefaultController, text: string) {
    if (!text) return;
    ensureRole(controller);
    controller.enqueue(encoder.encode(toOpenAiStreamChunk(id, created, model, text, null)));
  }

  // Parse one SSE data line and emit any content it carries.
  function processLine(controller: ReadableStreamDefaultController, line: string) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;

    const data = trimmed.slice(5).trim();
    if (data === "[DONE]") return;

    try {
      const parsed = JSON.parse(data);

      // Legacy Workers AI format: { response: "text" }
      if (parsed.response != null && typeof parsed.response === "string") {
        emitContent(controller, parsed.response);
        return;
      }

      // Native OpenAI-compatible format: { choices: [{ delta: { content / reasoning_content } }] }
      if (parsed.choices && Array.isArray(parsed.choices)) {
        const choice = parsed.choices[0];
        if (!choice) return;
        const delta = choice.delta as Record<string, unknown> | undefined;
        if (!delta) return;

        const content = delta.content ?? delta.reasoning_content;
        if (typeof content === "string") emitContent(controller, content);
      }
    } catch {
      // skip malformed JSON
    }
  }

  return new ReadableStream({
    // One upstream read per pull() so the consumer's backpressure paces the
    // source. If a read yields no complete lines, pull() will be invoked again
    // automatically (queue is below the high-water mark), so the stream never
    // stalls.
    async pull(controller) {
      if (finished) return;
      const { done, value } = await reader.read();

      if (done) {
        // Flush any trailing line that lacked a final newline (parsed, not raw).
        if (buffer.trim()) processLine(controller, buffer);
        ensureRole(controller);
        controller.enqueue(encoder.encode(toOpenAiStreamChunk(id, created, model, "", "stop")));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        finished = true;
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > MAX_BUFFER) {
        const errChunk = { error: { message: "Stream buffer overflow", type: "server_error" } };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errChunk)}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        finished = true;
        reader.cancel();
        return;
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(controller, line);
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

  const completionId = `chatcmpl-${crypto.randomUUID().replace(/-/g, "").slice(0, 29)}`;
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

    if (isStream) {
      if (result instanceof ReadableStream) {
        return new Response(transformSseStream(result, completionId, created, model), {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      }
      return errorResponse(
        500,
        "Streaming was requested but the model returned a non-stream response",
        "server_error",
      );
    }

    const chatResult = result as Record<string, unknown>;

    if (chatResult.choices && Array.isArray(chatResult.choices)) {
      const usage = chatResult.usage as Record<string, unknown> | undefined;
      const cleaned = {
        id: completionId,
        object: "chat.completion",
        created,
        model,
        choices: (chatResult.choices as Array<Record<string, unknown>>).map((choice) => {
          const msg = choice.message as Record<string, unknown> | undefined;
          const content = msg?.content ?? msg?.reasoning_content ?? msg?.reasoning ?? "";
          return {
            index: choice.index ?? 0,
            message: { role: "assistant", content: typeof content === "string" ? content : "" },
            finish_reason: choice.finish_reason ?? "stop",
          };
        }),
        usage: {
          prompt_tokens: usage?.prompt_tokens ?? 0,
          completion_tokens: usage?.completion_tokens ?? 0,
          total_tokens: usage?.total_tokens ?? 0,
        },
      };
      return new Response(
        JSON.stringify(cleaned),
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
    console.error("chat completion error:", err);
    return errorResponse(502, "AI service error", "server_error");
  }
}
