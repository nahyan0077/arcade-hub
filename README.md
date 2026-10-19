# Tic Tac Toe Arcade

[![CI](https://github.com/nahyan0077/tic-tac-toe/actions/workflows/ci.yml/badge.svg)](https://github.com/nahyan0077/tic-tac-toe/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A polished tic-tac-toe **arcade** in the browser: play local hot-seat, face an unbeatable AI, or go online with room codes, Quick Play matchmaking, and live voice chat. Built test-first, phase by phase, with a game-scoped networking layer designed for more games to land on the same stack.

| Hub | Online room |
| --- | --- |
| ![Hub](docs/images/desktop-hub.png) | ![Online room](docs/images/desktop-10-online-room.png) |

## Features

- **Game hub** — landing page is an arcade picker (Tic-Tac-Toe live; more games planned on the same networking stack)
- **2-Player local** — hot-seat play with persistent X/O/draw scores
- **vs AI** — four difficulty tiers, each with its own personality:

  | Difficulty | Personality | Behavior |
  | --- | --- | --- |
  | Easy | GLITCH | random moves (seeded RNG) |
  | Medium | SCOUT | takes wins, blocks threats, prefers center |
  | Hard | VANGUARD | lookahead minimax (depth 4) |
  | Impossible | NEMESIS | full minimax + alpha-beta — proven unbeatable |

- **Online rooms** — create/join with 6-char codes over WebSocket, or **Quick Play** matchmaking; perspective-aware results ("You win!" / "You lose!") with effects that only celebrate on the winner's side
- **Voice chat** — LiveKit-powered per-room audio (listen-only until you unmute); off unless a relay with LiveKit credentials is configured
- **Coach hints** — pulsing highlight on the mathematically best cell (full search, any position)
- **Synthesized sounds** — place/win/lose/draw/invalid effects via Web Audio API (no audio assets); mute persists across reloads
- **Responsive & accessible** — fits any viewport without scrolling; keyboard-navigable cells, ARIA labels, live status region

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS · React Router · WebSockets · Cloudflare Durable Objects · LiveKit · Vitest + Testing Library · Playwright

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173 — local + vs-AI work immediately
```

**Play online against another tab (no server):** just open two tabs — without `VITE_WS_URL` the app uses an in-browser BroadcastChannel (same browser profile and origin only).

**Play online across devices:**

```bash
npm run relay          # ws relay on :8787
VITE_WS_URL=ws://localhost:8787 npm run dev
```

Or run the Cloudflare-style relay locally: `npm run relay:cf` (Durable Objects via wrangler dev, :8788) with `VITE_WS_URL=ws://localhost:8788`.

**Voice chat:** see [Voice chat](#voice-chat) — needs a LiveKit server and a relay started with `LIVEKIT_*` env vars.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | start dev server |
| `npm run build` | type-check + production build |
| `npm run lint` | ESLint |
| `npm test` | unit + integration tests (Vitest) |
| `npm run test:watch` / `test:ui` / `test:coverage` | Vitest variants |
| `npm run test:e2e` | Playwright E2E over BroadcastChannel (desktop + mobile projects) |
| `npm run test:e2e:ws` | E2E online + matchmaking over the Node WebSocket relay |
| `npm run test:e2e:cf` | E2E online + matchmaking over the Cloudflare DO relay (wrangler dev) |
| `npm run test:e2e:voice` | E2E voice session against a throwaway dockerized LiveKit |
| `npm run relay` | room relay server (ws, port 8787) |
| `npm run relay:cf` | Cloudflare Durable Object relay via wrangler dev (port 8788) |
| `npm run typecheck:cf` | typecheck the Cloudflare worker |

## Architecture

```
Browser (React SPA)
├── engine/       pure game state machine — no DOM, no React
├── net/          protocol, transports (BroadcastChannel | WebSocket),
│                 RoomSession (handshake, heartbeats, rematch),
│                 matchmaker client, LiveKit voice session
└── hooks/useGame engine wiring + AI turns + sounds + score persistence

Room traffic (both players' messages flow through one transport):
  BroadcastChannel  →  same browser, same origin, zero servers
  Node relay        →  server/relay.ts   (rooms + /matchmake + /voice/token)
  Cloudflare Worker →  cloudflare/relay.ts (RoomRelay DO + Matchmaker DO)

Voice media → LiveKit server (rooms keyed <game>:<code>; relay mints join tokens)
```

Everything room-related is **game-scoped** (`<game>:<code>`, currently `tictactoe`), so a second game reuses matchmaking, rooms, and voice without touching the transport layer.

Full diagrams, HLD, and LLD live in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

### Project structure

```
src/
  engine/        pure game logic — rules, minimax AI, personalities
  net/           protocol, transports, RoomSession, matchmaker, voice
  hooks/         useGame — engine wiring, AI scheduling, sounds, scores
  pages/         hub, start, queue, lobby, home
  components/    Board, VoiceControls
  sound/         Web Audio synth effects + persisted mute
  storage/       validated localStorage score persistence
server/relay.ts  Node ws relay — room fan-out, /matchmake, /voice/token
cloudflare/      Worker + RoomRelay and Matchmaker Durable Objects
scripts/         LiveKit config + voice E2E orchestration
e2e/             Playwright specs (desktop Chromium + iPhone WebKit)
docs/            architecture deep-dive + README images
```

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `VITE_AI_DELAY_MS` | `600` | AI "thinking" delay before it moves |
| `VITE_WS_URL` | unset | WebSocket relay base URL; unset = in-browser BroadcastChannel |
| `RELAY_PORT` | `8787` | relay server port |
| `LIVEKIT_URL` | unset | LiveKit ws URL (e.g. `ws://127.0.0.1:7880`); unset disables voice (`503 voice-unconfigured`) |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | unset | LiveKit API credentials for minting join tokens (secret must be ≥32 chars) |

### Voice chat

Voice is off by default: the room page hides voice controls without `VITE_WS_URL`, and the relay returns `503 voice-unconfigured` unless the `LIVEKIT_*` vars are set. To enable locally:

1. Start a dev LiveKit server (the secret in `scripts/livekit.yaml` must be ≥32 characters):

   ```bash
   docker run --rm -p 7880:7880 -p 7881:7881/tcp -p 50000-50100:50000-50100/udp \
     -e NODE_IP=127.0.0.1 -v "$PWD/scripts/livekit.yaml":/lk/livekit.yaml:ro \
     livekit/livekit-server --config /lk/livekit.yaml
   ```

2. Export `LIVEKIT_URL=ws://127.0.0.1:7880`, `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` (matching the config file) before `npm run relay`; for `npm run relay:cf`, copy `.dev.vars.example` to `.dev.vars` instead.

`npm run test:e2e:voice` wraps steps 1–2: it starts a throwaway container, runs the two-player voice E2E, and removes the container. Joining a room starts voice **listen-only** — the microphone is only requested when the player unmutes.

**Cross-device voice on one Wi-Fi network** — point the LiveKit URL at your machine's LAN address instead of loopback (an `https` page cannot open `ws://127.0.0.1`, and cloudflared quick tunnels cannot proxy LiveKit's UDP media ports):

1. `NODE_IP=<your-lan-ip>` and the same docker command above (published ports unchanged).
2. `LIVEKIT_URL=ws://<your-lan-ip>:7880` for the relay (this value is returned to clients in the token response, so it must be reachable from the other device).
3. Serve the app on the LAN too: `npx vite --port 5173 --host`, open `http://<your-lan-ip>:5173` on both devices. For devices across the internet, use a hosted LiveKit (e.g. LiveKit Cloud) and set `LIVEKIT_URL`/keys accordingly.

## Testing strategy

- **Engine** — exhaustive rules tests plus seeded 100-game properties (AI never loses; impossible-vs-impossible always draws)
- **Integration** — Home/Start/Hub flows through real components with mocked Web Audio + localStorage
- **E2E** — Playwright across desktop and iPhone viewports: hub, win/draw/rematch flows, vs-AI behavior, hints, mute silencing (oscillator-level assertion), viewport fit, two-page online play over BroadcastChannel, the Node ws relay, and the Cloudflare DO relay, plus Quick Play matchmaking (WebSocket relays only), the voice-unavailable fallback, and a two-player voice session against dockerized LiveKit
- **CI** — lint, build, typecheck, unit, and the BroadcastChannel + WebSocket E2E suites on every push/PR (`.github/workflows/ci.yml`); the voice suite needs docker and runs locally

## Known limitations

- The relays are **not authoritative** for game state (clients validate moves; a modified client could cheat)
- `playerId` is client-generated (spoofable); voice tokens don't verify room membership
- No rate limiting, no persistence for online scores (session-only), no reconnect-resume
- Nothing is deployed yet: `wrangler deploy` and hosted LiveKit credentials await account setup

## Roadmap

- ✅ Phase 1 — core game logic and polish
- ✅ Phase 2 — AI opponent and coach hints
- ✅ Phase 3 — online presence (lobby, room codes, BroadcastChannel transport)
- ✅ Phase 4 — WebSocket transport and room relay server
- ✅ Phase 5 — Cloudflare Durable Object relay (local wrangler dev)
- Phase 5b — persistence (Neon/Upstash) — deferred until there is a real need
- ✅ Phase 6 — Quick Play matchmaking + voice chat (LiveKit)
- ✅ Phase 7a — game hub landing page
- ✅ Phase 7b — game-scoped networking (rooms, queues, voice keyed `<game>:<code>`)
- Phase 7c — second game on the shared stack (Connect Four / Dots & Boxes)
- Deployment (Cloudflare + hosted LiveKit)

## Contributing

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the quality gates every change must pass, and the checklist for adding a new game.

## License

[MIT](LICENSE)
