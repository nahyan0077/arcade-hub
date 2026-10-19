#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER=lk-e2e
CONFIG="$PWD/scripts/livekit.yaml"

for port in 5199 5201 8787 7880; do
  lsof -ti:"$port" 2>/dev/null | xargs kill -9 2>/dev/null || true
done

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
  -p 7880:7880 \
  -p 7881:7881/tcp \
  -p 50000-50100:50000-50100/udp \
  -e NODE_IP=127.0.0.1 \
  -v "$CONFIG":/lk/livekit.yaml:ro \
  livekit/livekit-server --config /lk/livekit.yaml >/dev/null

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

ready=""
for _ in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:7880/ || true)
  if [ "$code" != "000" ] && [ -n "$code" ]; then
    ready=1
    break
  fi
  sleep 0.5
done
if [ -z "$ready" ]; then
  echo "LiveKit container did not become ready" >&2
  docker logs "$CONTAINER" >&2 || true
  exit 1
fi

E2E_PORT=5201 E2E_VOICE=1 VITE_WS_URL=ws://127.0.0.1:8787 \
  LIVEKIT_URL=ws://127.0.0.1:7880 \
  LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=devsecret_abcdefghijklmnopqrstuvwxyz0123456789 \
  npx playwright test e2e/voice.spec.ts
