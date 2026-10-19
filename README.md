# Tic Tac Toe — Futuristic Edition

A polished React tic-tac-toe with an unbeatable AI, coach hints, synthesized sound effects, and a responsive neon-dark UI. Built test-first, phase by phase.

## Features

- **2-Player mode** — local hot-seat play with score tracking
- **vs AI mode** — four difficulty tiers, each with its own personality:
  | Difficulty | Personality | Behavior |
  | --- | --- | --- |
  | Easy | GLITCH | random moves (seeded RNG) |
  | Medium | SCOUT | takes wins, blocks threats, prefers center |
  | Hard | VANGUARD | lookahead minimax (depth 4) |
  | Impossible | NEMESIS | full minimax + alpha-beta — proven unbeatable |
- **Coach hints** — toggle a pulsing highlight on the mathematically best cell (full search, any position)
- **Synthesized sounds** — place/win/draw/invalid effects via Web Audio API (no assets); mute persists across reloads
- **Persistent scores** — X/O/draw tallies survive refreshes (validated localStorage)
- **Responsive** — fits any viewport without scrolling; win-line animation scales with the board
- **Accessible** — keyboard-navigable cells, ARIA labels, live status region

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS · React Router · Vitest + Testing Library · Playwright

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | start dev server |
| `npm run build` | type-check + production build |
| `npm run lint` | ESLint |
| `npm test` | unit + integration tests (Vitest) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:ui` | Vitest UI |
| `npm run test:coverage` | coverage report |
| `npm run test:e2e` | Playwright E2E (desktop + mobile projects) |
| `npm run test:e2e:ws` | E2E online + matchmaking suites over WebSocket (starts relay, port 5200) |
| `npm run relay` | room relay server (ws, port 8787) |
| `npm run relay:cf` | Cloudflare Durable Object relay via wrangler dev (port 8788) |
| `npm run typecheck:cf` | typecheck the Cloudflare worker |
| `npm run test:e2e:cf` | E2E online + matchmaking suites against the wrangler relay (port 5202) |
| `npm run test:e2e:voice` | E2E voice session against a dockerized LiveKit server (starts/stops its own container) |

## Architecture

```
src/
  engine/        pure game logic — no DOM, no React
    types.ts       GameState, config, winning lines
    core.ts        move/win/draw/serialization rules
    ai.ts          minimax, difficulties, personalities, coach scoring
  net/           room networking — protocol, transports, session state
    protocol.ts    room codes + RoomMessage union
    transport.ts   RoomTransport interface, BroadcastChannel, fake buses
    wsTransport.ts WebSocket client transport (outbox until open)
    createRoomTransport.ts  picks WebSocket when VITE_WS_URL is set
    RoomSession.ts host/guest handshake, heartbeats, rematch
    matchmaker.ts Quick Play queue client (queue, timeout, cancel)
    voiceToken.ts LiveKit join-token signer (shared Web Crypto HS256)
    voiceSession.ts join/leave/mute lifecycle over LiveKit, injectable room factory
    livekitVoiceRoom.ts livekit-client adapter (dynamic import)
  hooks/
    useGame.ts     engine wiring, score persistence, AI-turn scheduling, sound
  pages/
    start/         name, mark, mode, difficulty, create/join room, quick play
    queue/         matchmaking wait state, cancel, timeout retry
    lobby/         room code display, join status
    home/          board, scoreboard, hints, dialogs, online state
  components/
    Board.tsx      responsive grid, win-line SVG, hint ring
    VoiceControls.tsx  join/mute/leave voice panel (online rooms only)
  sound/audio.ts   Web Audio synth effects + persisted mute
  storage/         validated localStorage score persistence
server/
  relay.ts       ws room relay — room fan-out + /matchmake queue
cloudflare/
  relay.ts       Worker + RoomRelay and Matchmaker Durable Objects
wrangler.jsonc   worker config (DO bindings, local dev port 8788)
e2e/             Playwright specs (desktop Chromium + iPhone 13 WebKit)
```

The engine is a pure state machine (`createInitialState → makeMove`); UI and hooks only orchestrate. The AI is deterministic and injectable (`rng`) so tests can prove properties like "NEMESIS never loses over 100 seeded games".

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `VITE_AI_DELAY_MS` | `600` | AI "thinking" delay before it moves |
| `VITE_WS_URL` | unset | WebSocket relay base URL; unset means in-browser BroadcastChannel (two tabs, no server) |
| `RELAY_PORT` | `8787` | relay server port |
| `LIVEKIT_URL` | unset | LiveKit ws URL (e.g. `ws://127.0.0.1:7880`); unset disables voice (relay answers `503 voice-unconfigured`) |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | unset | LiveKit API credentials used to mint join tokens (secret must be ≥32 chars) |

### Voice chat

Voice is off by default: the room page hides voice controls without `VITE_WS_URL`, and the relay
returns `503 voice-unconfigured` unless the `LIVEKIT_*` vars are set. To enable locally:

1. Start a dev LiveKit server (the secret in `scripts/livekit.yaml` must be ≥32 characters):

   ```bash
   docker run --rm -p 7880:7880 -p 7881:7881/tcp -p 50000-50100:50000-50100/udp \
     -e NODE_IP=127.0.0.1 -v "$PWD/scripts/livekit.yaml":/lk/livekit.yaml:ro \
     livekit/livekit-server --config /lk/livekit.yaml
   ```

2. Export `LIVEKIT_URL=ws://127.0.0.1:7880`, `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` (matching the
   config file) before `npm run relay`; for `npm run relay:cf`, copy `.dev.vars.example` to
   `.dev.vars` instead.

`npm run test:e2e:voice` wraps steps 1–2: it starts a throwaway container, runs the two-player
voice E2E, and removes the container. Joining a room starts voice **listen-only** — the microphone
is only requested when the player unmutes.

**Cross-device voice on one Wi-Fi network** — point the LiveKit URL at your machine's LAN address
instead of loopback (an `https` page cannot open `ws://127.0.0.1`, and cloudflared quick tunnels
cannot proxy LiveKit's UDP media ports):

1. `NODE_IP=<your-lan-ip>` and the same docker command above (published ports unchanged).
2. `LIVEKIT_URL=ws://<your-lan-ip>:7880` for the relay (this value is returned to clients in the
   token response, so it must be reachable from the other device).
3. Serve the app on the LAN too: `npx vite --port 5173 --host`, open `http://<your-lan-ip>:5173`
   on both devices. A phone on the same Wi-Fi gets full voice; for devices across the internet,
   use a hosted LiveKit (e.g. LiveKit Cloud) and set `LIVEKIT_URL`/keys accordingly.

## Testing strategy

- **Engine** — exhaustive rules tests plus seeded 100-game properties (AI never loses; impossible-vs-impossible always draws)
- **Integration** — Home/Start flows through real components with a mocked Web Audio + localStorage
- **E2E** — Playwright across desktop and iPhone viewports: win/draw/rematch flows, vs-AI behavior, hints, mute silencing (oscillator-level assertion), viewport fit, two-page online play over BroadcastChannel, the Node ws relay, and the Cloudflare Durable Object relay, plus Quick Play matchmaking (WebSocket relays only), the voice-unavailable fallback (no LiveKit), and a two-player voice session against dockerized LiveKit (`test:e2e:voice`)

## Roadmap

- ✅ Phase 1 — core game logic and polish
- ✅ Phase 2 — AI opponent and coach hints
- ✅ Phase 3 — online presence (lobby, room codes, BroadcastChannel transport)
- ✅ Phase 4 — WebSocket transport and room relay server
- ✅ Phase 5 — Cloudflare Durable Object relay (local wrangler dev; `wrangler deploy` awaits account credentials)
- Phase 5b — persistence (Neon/Upstash) — deferred until there is a real persistence need
- ✅ Phase 6a — Quick Play matchmaking (relay queue + Matchmaker DO)
- ✅ Phase 6b — voice chat (LiveKit: join/mute/participants; `wrangler deploy` + LiveKit cloud credentials still pending)
