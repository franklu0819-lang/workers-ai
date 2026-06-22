// Model configuration for Cloudflare Workers AI proxy

export type ModelType = "chat" | "image" | "tts" | "asr";

export interface ModelInfo {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
  type: ModelType;
  alias: string;
}

interface ModelEntry {
  alias: string;
  id: string;
  type: ModelType;
}

export const DEFAULT_CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
export const DEFAULT_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
export const DEFAULT_TTS_MODEL = "@cf/myshell-ai/melotts";
export const DEFAULT_ASR_MODEL = "@cf/openai/whisper";

const MODEL_ENTRIES: readonly ModelEntry[] = [
  // Chat models
  { alias: "llama-3.1-8b-fast", id: "@cf/meta/llama-3.1-8b-instruct-fast", type: "chat" },
  { alias: "llama-3.2-3b", id: "@cf/meta/llama-3.2-3b-instruct", type: "chat" },
  { alias: "llama-3.2-1b", id: "@cf/meta/llama-3.2-1b-instruct", type: "chat" },
  { alias: "llama-3.3-70b", id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", type: "chat" },
  { alias: "llama-4-scout", id: "@cf/meta/llama-4-scout-17b-16e-instruct", type: "chat" },
  { alias: "qwq-32b", id: "@cf/qwen/qwq-32b", type: "chat" },
  { alias: "qwen2.5-coder", id: "@cf/qwen/qwen2.5-coder-32b-instruct", type: "chat" },
  { alias: "qwen3-30b-a3b", id: "@cf/qwen/qwen3-30b-a3b-fp8", type: "chat" },
  { alias: "deepseek-r1-32b", id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", type: "chat" },
  { alias: "gemma-4-26b-a4b", id: "@cf/google/gemma-4-26b-a4b-it", type: "chat" },
  { alias: "granite-micro", id: "@cf/ibm-granite/granite-4.0-h-micro", type: "chat" },
  { alias: "mistral-small", id: "@cf/mistralai/mistral-small-3.1-24b-instruct", type: "chat" },
  { alias: "glm-4.7-flash", id: "@cf/zai-org/glm-4.7-flash", type: "chat" },
  { alias: "gpt-oss-120b", id: "@cf/openai/gpt-oss-120b", type: "chat" },
  { alias: "gpt-oss-20b", id: "@cf/openai/gpt-oss-20b", type: "chat" },
  { alias: "kimi-k2.6", id: "@cf/moonshotai/kimi-k2.6", type: "chat" },
  { alias: "nemotron-3-120b", id: "@cf/nvidia/nemotron-3-120b-a12b", type: "chat" },
  // Image models
  { alias: "flux-schnell", id: "@cf/black-forest-labs/flux-1-schnell", type: "image" },
  { alias: "flux-2-dev", id: "@cf/black-forest-labs/flux-2-dev", type: "image" },
  { alias: "flux-2-klein-4b", id: "@cf/black-forest-labs/flux-2-klein-4b", type: "image" },
  { alias: "flux-2-klein-9b", id: "@cf/black-forest-labs/flux-2-klein-9b", type: "image" },
  { alias: "lucid-origin", id: "@cf/leonardo/lucid-origin", type: "image" },
  // TTS models
  { alias: "melotts", id: "@cf/myshell-ai/melotts", type: "tts" },
  // ASR models
  { alias: "whisper", id: "@cf/openai/whisper", type: "asr" },
  { alias: "whisper-tiny-en", id: "@cf/openai/whisper-tiny-en", type: "asr" },
  { alias: "whisper-large-v3-turbo", id: "@cf/openai/whisper-large-v3-turbo", type: "asr" },
];

// Alias → full model ID lookup map
const aliasMap = new Map<string, string>(
  MODEL_ENTRIES.map((entry) => [entry.alias, entry.id]),
);

const LIST_CREATED = Math.floor(Date.now() / 1000);

/**
 * Resolve a model identifier.
 * - Known alias → full @cf/ ID
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
export function getModelList(): {
  object: "list";
  data: ModelInfo[];
} {
  const entries: ModelInfo[] = [];
  for (const entry of MODEL_ENTRIES) {
    entries.push({
      id: entry.alias,
      object: "model" as const,
      created: LIST_CREATED,
      owned_by: "cloudflare",
      type: entry.type,
      alias: entry.id,
    });
  }
  return {
    object: "list",
    data: entries,
  };
}
