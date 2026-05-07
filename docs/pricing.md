# Cloudflare Workers AI 免费额度换算

免费额度：**10,000 Neurons / 天**（Workers Free 计划），超出部分需 Workers Paid 计划，按 $0.011 / 1,000 Neurons 计费。

所有额度每日 UTC 00:00 重置。

## Chat 模型

假设典型请求：**500 input tokens + 200 output tokens**

| 模型 | Alias | Input 神经元/M tokens | Output 神经元/M tokens | 单次请求消耗 | 每天可调用次数 | 等价 output tokens |
|------|-------|----------------------|----------------------|-------------|-------------|-------------------|
| granite-4.0-h-micro | `granite-micro` | 1,542 | 10,158 | 2.77 | ~3,610 | ~984K |
| llama-3.2-1b-instruct | `llama-3.2-1b` | 2,457 | 18,252 | 4.91 | ~2,037 | ~548K |
| gemma-4-26b-a4b-it | `gemma-4-26b-a4b` | 9,091 | 27,273 | 10.0 | ~1,000 | ~367K |
| glm-4.7-flash | `glm-4.7-flash` | 5,500 | 36,400 | 9.98 | ~1,002 | ~275K |
| qwen3-30b-a3b-fp8 | `qwen3-30b-a3b` | 4,625 | 30,475 | 8.25 | ~1,212 | ~328K |
| llama-3.2-3b-instruct | `llama-3.2-3b` | 4,625 | 30,475 | 8.25 | ~1,212 | ~328K |
| llama-3.1-8b-instruct-fast | `llama-3.1-8b-fast` | 4,119 | 34,868 | 9.01 | ~1,110 | ~287K |
| gpt-oss-20b | `gpt-oss-20b` | 18,182 | 27,273 | 15.5 | ~645 | ~367K |
| llama-4-scout-17b-16e-instruct | `llama-4-scout` | 24,545 | 77,273 | 27.7 | ~361 | ~129K |
| mistral-small-3.1-24b-instruct | `mistral-small` | 31,876 | 50,488 | 23.3 | ~429 | ~198K |
| gpt-oss-120b | `gpt-oss-120b` | 31,818 | 68,182 | 29.7 | ~337 | ~147K |
| nemotron-3-120b-a12b | `nemotron-3-120b` | 45,455 | 136,364 | 49.7 | ~201 | ~73K |
| llama-3.3-70b-instruct-fp8-fast | `llama-3.3-70b` | 26,668 | 204,805 | 54.3 | ~184 | ~49K |
| qwq-32b | `qwq-32b` | 60,000 | 90,909 | 48.2 | ~207 | ~110K |
| qwen2.5-coder-32b-instruct | `qwen2.5-coder` | 60,000 | 90,909 | 48.2 | ~207 | ~110K |
| kimi-k2.6 | `kimi-k2.6` | 86,364 | 363,636 | 118 | ~85 | ~28K |
| deepseek-r1-distill-qwen-32b | `deepseek-r1-32b` | 45,170 | 443,756 | 111 | ~90 | ~23K |

## 图像模型

| 模型 | Alias | 计价方式 | 10,000 neurons 可用 |
|------|-------|---------|-------------------|
| flux-1-schnell | `flux-schnell` | 按图像大小阶梯计价 | 约 10-30 张 |
| flux-2-dev | `flux-2-dev` | 按图像大小阶梯计价 | 约 5-15 张 |
| flux-2-klein-4b | `flux-2-klein-4b` | 5.37 input + 26.05 output / 512x512 tile | ~322 张 (256x256) |
| flux-2-klein-9b | `flux-2-klein-9b` | 1,364 neurons / 首 MP (1024x1024) | ~7 张 (1024x1024) |
| lucid-origin | `lucid-origin` | 按图像大小计价 | 约 5-20 张 |

## TTS 模型

| 模型 | Alias | 神经元/音频分钟 | 10,000 neurons 可用 |
|------|-------|---------------|-------------------|
| melotts | `melotts` | 18.63 | ~537 分钟 (~9 小时) |

## ASR 模型

| 模型 | Alias | 神经元/音频分钟 | 10,000 neurons 可用 |
|------|-------|---------------|-------------------|
| whisper | `whisper` | 41.14 | ~243 分钟 (~4 小时) |
| whisper-tiny-en | `whisper-tiny-en` | ~41 | ~244 分钟 (~4 小时) |
| whisper-large-v3-turbo | `whisper-large-v3-turbo` | 46.63 | ~214 分钟 (~3.6 小时) |

## 性价比排行（从高到低）

1. **granite-micro** — 每天 ~3,610 次请求，适合简单对话
2. **llama-3.2-1b** — 每天 ~2,037 次，轻量通用
3. **qwen3-30b-a3b / llama-3.2-3b** — 每天 ~1,212 次，性价比均衡
4. **llama-3.1-8b-fast / glm-4.7-flash / gemma-4-26b-a4b** — 每天 ~1,000 次
5. **gpt-oss-20b** — 每天 ~645 次
6. **mistral-small** — 每天 ~429 次
7. **llama-4-scout** — 每天 ~361 次
8. **gpt-oss-120b** — 每天 ~337 次
9. **qwq-32b / qwen2.5-coder** — 每天 ~207 次
10. **nemotron-3-120b** — 每天 ~201 次
11. **llama-3.3-70b** — 每天 ~184 次
12. **deepseek-r1-32b** — 每天 ~90 次（推理模型，output 消耗大）
13. **kimi-k2.6** — 每天 ~85 次（最贵，output 单价最高）

> 数据来源：[Cloudflare Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)，截至 2026 年 5 月。
