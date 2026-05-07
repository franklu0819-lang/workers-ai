#!/bin/bash
# Test models by type: chat, image, tts, asr
# Usage:
#   ./test-models.sh              # test all
#   ./test-models.sh chat         # test chat only
#   ./test-models.sh chat tts     # test chat + tts
#   ./test-models.sh asr          # test asr (auto-generates TTS audio first)

BASE_URL="https://workers-ai.galatea-ai.cc"
API_KEY="sk-6a4330e17e26595f0a51be9c29e9c4970dc229469532fdb6253cf19895a58934"
PROMPT="9.11和9.9哪个大"

CHAT_MODELS=(
  "llama-3.1-8b-fast"
  "llama-3.2-3b"
  "llama-3.2-1b"
  "llama-3.3-70b"
  "llama-4-scout"
  "qwq-32b"
  "qwen2.5-coder"
  "qwen3-30b-a3b"
  "deepseek-r1-32b"
  "gemma-4-26b-a4b"
  "granite-micro"
  "mistral-small"
  "glm-4.7-flash"
  "gpt-oss-120b"
  "gpt-oss-20b"
  "kimi-k2.6"
  "nemotron-3-120b"
)

IMAGE_MODELS=(
  "flux-schnell"
  "flux-2-dev"
  "flux-2-klein-4b"
  "flux-2-klein-9b"
  "lucid-origin"
)

TTS_MODELS=("melotts")
TTS_INPUT="Hello world, this is a test of speech synthesis and recognition."
ASR_MODELS=("whisper" "whisper-tiny-en" "whisper-large-v3-turbo")

ALL_TYPES="chat image tts asr"

pass=0
fail=0

# --- Parse args ---
if [ $# -eq 0 ]; then
  types="$ALL_TYPES"
else
  types="$*"
fi

for t in $types; do
  if ! echo "$ALL_TYPES" | grep -qw "$t"; then
    echo "Unknown type: $t (valid: $ALL_TYPES)"
    exit 1
  fi
done

# --- Helper functions ---

json_value() {
  python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'error' in d:
        print('ERROR: ' + d['error'].get('message', str(d['error'])))
    else:
        print(json.dumps(d))
except Exception as e:
    print('ERROR: parse failed - ' + str(e))
" 2>&1
}

# --- Test functions ---

test_chat() {
  local model="$1"
  echo -n "  [$model] ... "

  response=$(curl -s --max-time 60 \
    "$BASE_URL/v1/chat/completions" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"$PROMPT\"}],\"max_tokens\":256,\"stream\":false}" 2>&1)

  if [ $? -ne 0 ]; then
    echo "FAIL (curl error)"
    fail=$((fail + 1))
    return
  fi

  content=$(echo "$response" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'error' in d:
        print('ERROR: ' + d['error'].get('message', str(d['error'])))
    elif 'choices' in d and len(d['choices']) > 0:
        c = d['choices'][0].get('message', {}).get('content', '')
        print(c)
    else:
        print('ERROR: unexpected response')
except Exception as e:
    print('ERROR: parse failed - ' + str(e))
" 2>&1)

  if echo "$content" | grep -q "^ERROR:"; then
    echo "FAIL"
    echo "    $content"
    fail=$((fail + 1))
  else
    echo "OK"
    echo "    $content"
    pass=$((pass + 1))
  fi
}

test_image() {
  local model="$1"
  echo -n "  [$model] ... "

  response=$(curl -s --max-time 90 \
    "$BASE_URL/v1/images/generations" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$model\",\"prompt\":\"a beautiful sunset over mountains\",\"size\":\"256x256\"}" 2>&1)

  if [ $? -ne 0 ]; then
    echo "FAIL (curl error)"
    fail=$((fail + 1))
    return
  fi

  result=$(echo "$response" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'error' in d:
        print('ERROR: ' + d['error'].get('message', str(d['error'])))
    elif 'data' in d and len(d['data']) > 0:
        print('OK (' + str(len(d['data'][0].get('b64_json',''))) + ' chars)')
    else:
        print('ERROR: unexpected response')
except Exception as e:
    print('ERROR: parse failed - ' + str(e))
" 2>&1)

  if echo "$result" | grep -q "^ERROR:"; then
    echo "FAIL"
    echo "    $result"
    fail=$((fail + 1))
  else
    echo "$result"
    pass=$((pass + 1))
  fi
}

test_tts() {
  local model="$1"
  local output_file="$2"
  echo -n "  [$model] ... "

  http_code=$(curl -s --max-time 30 -o "$output_file" -w "%{http_code}" \
    "$BASE_URL/v1/audio/speech" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$model\",\"input\":\"$TTS_INPUT\"}" 2>&1)

  if [ "$http_code" = "200" ] && [ -f "$output_file" ] && [ -s "$output_file" ]; then
    local size=$(wc -c < "$output_file" | tr -d ' ')
    echo "OK ($size bytes)"
    pass=$((pass + 1))
  else
    echo "FAIL (HTTP $http_code)"
    fail=$((fail + 1))
  fi
}

test_asr() {
  local model="$1"
  local audio_file="$2"
  echo -n "  [$model] ... "

  if [ ! -f "$audio_file" ] || [ ! -s "$audio_file" ]; then
    echo "SKIP (no audio file)"
    return
  fi

  response=$(curl -s --max-time 30 \
    "$BASE_URL/v1/audio/transcriptions" \
    -H "Authorization: Bearer $API_KEY" \
    -F "file=@$audio_file" \
    -F "model=$model" 2>&1)

  if [ $? -ne 0 ]; then
    echo "FAIL (curl error)"
    fail=$((fail + 1))
    return
  fi

  content=$(echo "$response" | python -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if 'error' in d:
        print('ERROR: ' + d['error'].get('message', str(d['error'])))
    elif 'text' in d:
        print(d['text'])
    else:
        print('ERROR: unexpected response')
except Exception as e:
    print('ERROR: parse failed - ' + str(e))
" 2>&1)

  if echo "$content" | grep -q "^ERROR:"; then
    echo "FAIL"
    echo "    $content"
    fail=$((fail + 1))
  else
    echo "OK"
    echo "    $content"
    pass=$((pass + 1))
  fi
}

# --- Generate TTS audio for ASR testing ---

ensure_audio() {
  AUDIO_FILE="/tmp/tts_test_audio.mp3"
  if [ -f "$AUDIO_FILE" ] && [ -s "$AUDIO_FILE" ]; then
    return
  fi
  echo "  Generating TTS audio for ASR test..."
  http_code=$(curl -s --max-time 30 -o "$AUDIO_FILE" -w "%{http_code}" \
    "$BASE_URL/v1/audio/speech" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"melotts\",\"input\":\"$TTS_INPUT\"}" 2>&1)

  if [ "$http_code" != "200" ] || [ ! -s "$AUDIO_FILE" ]; then
    echo "  Failed to generate TTS audio (HTTP $http_code)"
    rm -f "$AUDIO_FILE"
  fi
}

# --- Run selected tests ---

for t in $types; do
  case "$t" in
    chat)
      echo "=========================================="
      echo " Chat Models (${#CHAT_MODELS[@]})"
      echo " Prompt: $PROMPT"
      echo "=========================================="
      echo ""
      for model in "${CHAT_MODELS[@]}"; do
        test_chat "$model"
      done
      echo ""
      ;;
    image)
      echo "=========================================="
      echo " Image Models (${#IMAGE_MODELS[@]})"
      echo "=========================================="
      echo ""
      for model in "${IMAGE_MODELS[@]}"; do
        test_image "$model"
      done
      echo ""
      ;;
    tts)
      echo "=========================================="
      echo " TTS Models (${#TTS_MODELS[@]})"
      echo " Input: $TTS_INPUT"
      echo "=========================================="
      echo ""
      AUDIO_FILE="/tmp/tts_test_audio.mp3"
      for model in "${TTS_MODELS[@]}"; do
        test_tts "$model" "$AUDIO_FILE"
      done
      echo ""
      ;;
    asr)
      ensure_audio
      echo "=========================================="
      echo " ASR Models (${#ASR_MODELS[@]})"
      echo " Input: $TTS_INPUT"
      echo "=========================================="
      echo ""
      for model in "${ASR_MODELS[@]}"; do
        test_asr "$model" "$AUDIO_FILE"
      done
      rm -f /tmp/tts_test_audio.mp3
      echo ""
      ;;
  esac
done

total=$((pass + fail))
echo "=========================================="
echo " Done: $pass passed, $fail failed (of $total tested)"
echo "=========================================="
