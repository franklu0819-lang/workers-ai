// Model configuration for Cloudflare Workers AI proxy

export type ModelType = "chat" | "image" | "tts" | "asr";

export interface ModelInfo {
  id: string; // short, user-facing name (what clients send in requests)
  object: "model";
  created: number;
  owned_by: string;
  type: ModelType;
  model_id: string; // full Cloudflare "@cf/..." identifier
}

export interface ModelList {
  object: "list";
  data: ModelInfo[];
}

interface ModelEntry {
  id: string; // short, user-facing name
  model_id: string; // full Cloudflare "@cf/..." identifier
  type: ModelType;
}

export const DEFAULT_CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
export const DEFAULT_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
export const DEFAULT_TTS_MODEL = "@cf/myshell-ai/melotts";
export const DEFAULT_ASR_MODEL = "@cf/openai/whisper";

const MODEL_ENTRIES: readonly ModelEntry[] = [
  // Chat models
  { id: "llama-3.1-8b-fp8", model_id: "@cf/meta/llama-3.1-8b-instruct-fp8", type: "chat" },
  { id: "llama-3.1-8b-fast", model_id: "@cf/meta/llama-3.1-8b-instruct-fast", type: "chat" },
  { id: "llama-3.2-1b", model_id: "@cf/meta/llama-3.2-1b-instruct", type: "chat" },
  { id: "llama-3.2-3b", model_id: "@cf/meta/llama-3.2-3b-instruct", type: "chat" },
  { id: "llama-3.3-70b", model_id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", type: "chat" },
  { id: "llama-4-scout", model_id: "@cf/meta/llama-4-scout-17b-16e-instruct", type: "chat" },
  { id: "qwq-32b", model_id: "@cf/qwen/qwq-32b", type: "chat" },
  { id: "qwen2.5-coder", model_id: "@cf/qwen/qwen2.5-coder-32b-instruct", type: "chat" },
  { id: "qwen3-30b-a3b", model_id: "@cf/qwen/qwen3-30b-a3b-fp8", type: "chat" },
  { id: "deepseek-r1-32b", model_id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", type: "chat" },
  { id: "gemma-4-26b-a4b", model_id: "@cf/google/gemma-4-26b-a4b-it", type: "chat" },
  { id: "granite-micro", model_id: "@cf/ibm-granite/granite-4.0-h-micro", type: "chat" },
  { id: "mistral-small", model_id: "@cf/mistralai/mistral-small-3.1-24b-instruct", type: "chat" },
  { id: "glm-4.7-flash", model_id: "@cf/zai-org/glm-4.7-flash", type: "chat" },
  { id: "glm-5.2", model_id: "@cf/zai-org/glm-5.2", type: "chat" },
  { id: "gpt-oss-20b", model_id: "@cf/openai/gpt-oss-20b", type: "chat" },
  { id: "gpt-oss-120b", model_id: "@cf/openai/gpt-oss-120b", type: "chat" },
  { id: "kimi-k2.5", model_id: "@cf/moonshotai/kimi-k2.5", type: "chat" },
  { id: "kimi-k2.6", model_id: "@cf/moonshotai/kimi-k2.6", type: "chat" },
  { id: "kimi-k2.7-code", model_id: "@cf/moonshotai/kimi-k2.7-code", type: "chat" },
  { id: "nemotron-3-120b", model_id: "@cf/nvidia/nemotron-3-120b-a12b", type: "chat" },
  // Image models
  { id: "flux-schnell", model_id: "@cf/black-forest-labs/flux-1-schnell", type: "image" },
  { id: "flux-2-dev", model_id: "@cf/black-forest-labs/flux-2-dev", type: "image" },
  { id: "flux-2-klein-4b", model_id: "@cf/black-forest-labs/flux-2-klein-4b", type: "image" },
  { id: "flux-2-klein-9b", model_id: "@cf/black-forest-labs/flux-2-klein-9b", type: "image" },
  { id: "lucid-origin", model_id: "@cf/leonardo/lucid-origin", type: "image" },
  // TTS models
  { id: "melotts", model_id: "@cf/myshell-ai/melotts", type: "tts" },
  // ASR models
  { id: "whisper", model_id: "@cf/openai/whisper", type: "asr" },
  { id: "whisper-tiny-en", model_id: "@cf/openai/whisper-tiny-en", type: "asr" },
  { id: "whisper-large-v3-turbo", model_id: "@cf/openai/whisper-large-v3-turbo", type: "asr" },
];

// Short name (id) → full Cloudflare model_id lookup. Used to resolve the
// user-facing identifier clients send into the @cf/ ID the AI binding expects.
const aliasMap = new Map<string, string>(
  MODEL_ENTRIES.map((entry) => [entry.id, entry.model_id]),
);

/**
 * Resolve a model identifier.
 * - Known short name → full @cf/ model_id
 * - Already a @cf/ ID → return as-is
 * - Anything else → return as-is (let Cloudflare handle the error)
 */
export function resolveModel(input: string): string {
  const resolved = aliasMap.get(input);
  if (resolved) return resolved;
  return input;
}

/**
 * Return all available models in OpenAI-compatible list format.
 */
export function getModelList(): ModelList {
  // Computed at request time — Date.now() during module/isolate init returns 0
  // in the Workers runtime, so a module-level constant would yield created: 0.
  const created = Math.floor(Date.now() / 1000);
  const entries: ModelInfo[] = [];
  for (const entry of MODEL_ENTRIES) {
    entries.push({
      id: entry.id,
      object: "model" as const,
      created,
      owned_by: "cloudflare",
      type: entry.type,
      model_id: entry.model_id,
    });
  }
  return {
    object: "list",
    data: entries,
  };
}
