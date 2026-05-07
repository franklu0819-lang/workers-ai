# Workers AI Proxy

OpenAI-compatible API proxy running on Cloudflare Workers. Forwards requests to Cloudflare Workers AI via the native AI binding.

## Features

- **Chat Completions** — `/v1/chat/completions` with streaming support
- **Image Generation** — `/v1/images/generations`
- **Text-to-Speech** — `/v1/audio/speech`
- **Speech-to-Text** — `/v1/audio/transcriptions`
- Bearer token authentication
- CORS support
- Model alias resolution

## Quick Start

```bash
# Install dependencies
npm install

# Set API key for local development
echo "API_KEY=your-secret-key" > .dev.vars

# Run locally
npm run dev

# Deploy
npm run deploy

# Set production secret
npx wrangler secret put API_KEY
```

## API Endpoints

All endpoints require `Authorization: Bearer <API_KEY>`.

### Chat Completions

```
POST /v1/chat/completions
```

```json
{
  "model": "llama-3.1-8b-fast",
  "messages": [{"role": "user", "content": "Hello"}],
  "stream": false
}
```

Supports `temperature`, `max_tokens`, `top_p`, `frequency_penalty`, `presence_penalty`.

### Image Generation

```
POST /v1/images/generations
```

```json
{
  "model": "flux-schnell",
  "prompt": "a cat on the moon",
  "size": "512x512"
}
```

### Text-to-Speech

```
POST /v1/audio/speech
```

```json
{
  "model": "melotts",
  "input": "Hello world"
}
```

Returns `audio/mpeg` binary. English only.

### Speech-to-Text

```
POST /v1/audio/transcriptions
```

Multipart form-data with `file` field:

```bash
curl -X POST https://your-worker.workers.dev/v1/audio/transcriptions \
  -H "Authorization: Bearer <key>" \
  -F "file=@audio.mp3" \
  -F "model=whisper-large-v3-turbo"
```

Supports `response_format`: `json` (default), `text`, `vtt`, `srt`.

### Models

```
GET /v1/models
```

## Supported Models

### Chat (17 models)

| Alias | Model ID |
|-------|----------|
| `llama-3.1-8b-fast` | `@cf/meta/llama-3.1-8b-instruct-fast` |
| `llama-3.3-70b` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| `llama-4-scout` | `@cf/meta/llama-4-scout-17b-16e-instruct` |
| `llama-3.2-3b` | `@cf/meta/llama-3.2-3b-instruct` |
| `llama-3.2-1b` | `@cf/meta/llama-3.2-1b-instruct` |
| `deepseek-r1-32b` | `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` |
| `qwen3-30b-a3b` | `@cf/qwen/qwen3-30b-a3b-fp8` |
| `qwq-32b` | `@cf/qwen/qwq-32b` |
| `qwen2.5-coder` | `@cf/qwen/qwen2.5-coder-32b-instruct` |
| `gemma-4-26b-a4b` | `@cf/google/gemma-4-26b-a4b-it` |
| `granite-micro` | `@cf/ibm-granite/granite-4.0-h-micro` |
| `mistral-small` | `@cf/mistralai/mistral-small-3.1-24b-instruct` |
| `glm-4.7-flash` | `@cf/zai-org/glm-4.7-flash` |
| `gpt-oss-120b` | `@cf/openai/gpt-oss-120b` |
| `gpt-oss-20b` | `@cf/openai/gpt-oss-20b` |
| `kimi-k2.6` | `@cf/moonshotai/kimi-k2.6` |
| `nemotron-3-120b` | `@cf/nvidia/nemotron-3-120b-a12b` |

### Image (5 models)

| Alias | Model ID |
|-------|----------|
| `flux-schnell` | `@cf/black-forest-labs/flux-1-schnell` |
| `flux-2-dev` | `@cf/black-forest-labs/flux-2-dev` |
| `flux-2-klein-4b` | `@cf/black-forest-labs/flux-2-klein-4b` |
| `flux-2-klein-9b` | `@cf/black-forest-labs/flux-2-klein-9b` |
| `lucid-origin` | `@cf/leonardo/lucid-origin` |

### TTS (1 model)

| Alias | Model ID |
|-------|----------|
| `melotts` | `@cf/myshell-ai/melotts` |

### ASR (3 models)

| Alias | Model ID |
|-------|----------|
| `whisper` | `@cf/openai/whisper` |
| `whisper-tiny-en` | `@cf/openai/whisper-tiny-en` |
| `whisper-large-v3-turbo` | `@cf/openai/whisper-large-v3-turbo` |

You can use either the alias or the full `@cf/` model ID in requests. Unknown IDs are passed through to Cloudflare as-is.

## Project Structure

```
src/
├── index.ts      # Router, CORS, auth gate
├── auth.ts       # Bearer token validation
├── types.ts      # Shared Env interface
├── utils.ts      # Shared utilities
├── models.ts     # Model registry and alias resolution
├── do-chat.ts    # Chat completions handler
├── do-image.ts   # Image generation handler
├── do-tts.ts     # Text-to-speech handler
└── do-asr.ts     # Speech-to-text handler
```

## Usage Example

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-secret-key",
    base_url="https://your-worker.workers.dev/v1",
)

# Chat
response = client.chat.completions.create(
    model="llama-3.1-8b-fast",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)

# Streaming
for chunk in client.chat.completions.create(
    model="llama-3.3-70b",
    messages=[{"role": "user", "content": "Tell me a story"}],
    stream=True,
):
    print(chunk.choices[0].delta.content or "", end="")
```

## License

[MIT](LICENSE)
