# Architecture

How the Tic Tac Toe Arcade is put together: system context, high-level design (HLD),
low-level design (LLD), data flows, invariants, and how to extend it.

## 1. System context

```
                         ┌─────────────────────────────┐
                         │        Browser (SPA)        │
                         │  React + TS, built by Vite  │
                         └──────────────┬──────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │ room traffic (moves, hello,   │                               │ voice media
        │  rematch, heartbeats)         │ POST /voice/token             │ (WebRTC)
        ▼                               ▼                               ▼
┌───────────────┐             ┌──────────────────┐             ┌────────────────┐
│  Transport    │             │  Relay backend   │             │  LiveKit       │
│  Broadcast-   │             │  Node (server/)  │             │  server        │
│  Channel OR   │◄───────────►│  or Cloudflare   │             │  (media only;  │
│  WebSocket    │             │  DOs (cloudflare)│             │   tokens minted│
└───────────────┘             └────────┬─────────┘             │   by relay)    │
                                       │ /matchmake            └────────────────┘
                                       ▼
                              matchmaking queue
                              (per game id)
```

Two players never talk to each other directly over the internet: every room message flows
through **one** transport (BroadcastChannel for same-browser play, otherwise a relay). Voice
media goes peer-to-peer via WebRTC; the relay only mints join tokens.

## 2. High-level design (HLD)

```
┌────────────────────────────────── Browser ──────────────────────────────────┐
│                                                                             │
│  pages/                  hooks/                 net/                        │
│  ┌──────┐  ┌───────┐   ┌─────────┐   ┌────────────────────────────────┐     │
│  │ hub  │→ │ start │→  │ useGame │   │ OnlineSessionContext           │     │
│  │      │  │ queue │   │ (engine │   │   openRoom() ──► RoomSession   │     │
│  │cards │  │ lobby │   │  wiring,│   │ MatchmakerClient (queue)       │     │
│  │      │  │ home  │   │  AI,    │   │ VoiceSession ──► LiveKit SDK   │     │
│  └──────┘  └───────┘   │  sounds)│   └────────────────────────────────┘     │
│                        └────┬────┘                │                         │
│                             │                     │ RoomTransport           │
│                        ┌────▼────┐          ┌─────▼──────┐                  │
│                        │ engine/ │          │ transport  │                  │
│                        │ pure TS │          │ BC | WS    │                  │
│                        └─────────┘          └────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────── Node relay (server/relay.ts) ────────────┐  ┌── Cloudflare (cloudflare/relay.ts) ──┐
│ in-memory rooms: Map<scopedId, Set<ws>>              │  │ Worker router                          │
│ in-memory queues: Map<gameId, waiters[]>             │  │  /room/:code  → RoomRelay DO           │
│ HTTP: / (health), POST /voice/token (CORS)           │  │  /matchmake   → Matchmaker DO          │
│ WS:    /room/:code?game=…   /matchmake               │  │  POST /voice/token                     │
└──────────────────────────────────────────────────────┘  └────────────────────────────────────────┘
```

The two relays are **behavioral twins** behind the same wire protocol — the Node relay exists
for simple self-hosting and tests; the Cloudflare version is the deploy target (Durable Objects
give per-room and per-queue state with hibernation).

### Key design decisions

| Decision | Rationale |
| --- | --- |
| Pure-TS engine, no framework imports | exhaustive unit tests, property-based AI proofs, reuse by a future game |
| Transport behind a `RoomTransport` interface | the same `RoomSession` logic runs on BroadcastChannel, Node ws, and CF DOs |
| Relay is a dumb fan-out (not authoritative) | simplicity; state lives in clients who already validate moves. Trade-off: a modified client can cheat (see §7) |
| Game-scoped ids (`<game>:<code>`) everywhere | rooms, queues, and LiveKit rooms isolated per game; adding a game doesn't touch transports |
| Voice tokens minted by the relay | LiveKit secrets never reach the browser; one env-var set per deployment |

## 3. Data flows

### 3.1 Create / join a room

```
Host                         Relay                        Guest
 │  openRoom(role=host)        │                            │
 │  WS connect /room/CODE?game=│                            │
 │  .........................  │                            │
 │                             │◄── WS connect /room/CODE ──┤ openRoom(role=guest)
 │                             │    (room size ≤ 8 checked) │
 │  hello {roomCode,playerId,name,game}  (retried every     │
 │◄────── relay fan-out ───────┤◄──────────── 500ms) ───────┤
 │  welcome {hostId,hostName} ─┼───────────────────────────►│
 │  status: connected          │                            │  status: connected
```

- The guest retries `hello` until `welcome` arrives or the join window (3s) closes → `rejected`.
- A second, different guest triggers `rejected {reason:'room-full'}` from the host.
- Both sides heartbeat with `ping`/`pong` every 2s; >6s of silence marks the session `disconnected`.

### 3.2 Quick Play matchmaking

```
Player A                     Matchmaker                   Player B
 │ queue {playerId,game} ────►│ waiting[game] = [A]         │
 │                            │◄── queue {playerId,game} ───┤
 │ matched {roomCode,role:host,   game} ───────────────────►│ matched {…,role:guest,game}
 │ (then both follow 3.1 with the announced code)          │
```

Queues are keyed by game id; players queueing for different games never pair. Local timeout
(default 30s client-side) sends `cancel` and surfaces a retry UI.

### 3.3 A move

```
Player A (myMark's turn)         Relay                Player B
 │ session.playMove(index)        │                     │
 │  — validates turn + cell       │                     │
 │  — applies optimistically      │                     │
 │ move {roomCode,playerId,       │                     │
 │       index,game} ────────────►│── fan-out ─────────►│ session applies (validates again)
```

The sender applies the move locally before the wire confirms (optimistic UI); the receiver
re-validates (`isValidMove`, correct turn) before applying. The relay forwards bytes
unchanged after checking the message's `roomCode`+`game` match the connection's room.

### 3.4 Voice join

```
Client (in room)          Relay                 LiveKit
 │ VoiceSession.join()      │                     │
 │ POST /voice/token        │                     │
 │  {roomCode,name,game} ──►│ verifies shape,     │
 │                          │ mints HS256 JWT ───►│ (offline signing; no
 │◄── {url, token} ─────────│  room = "<game>:<code>"  LiveKit call)
 │ room.connect(url, token) ─────────────────────►│ WebRTC connect (media)
 │ mic stays OFF until user unmutes (listen-only join)
```

## 4. Low-level design (LLD)

### 4.1 Protocol (`src/net/protocol.ts`)

Room messages (over any transport; `game` optional, defaults to `tictactoe`):

| Type | Sender → Receiver | Payload |
| --- | --- | --- |
| `hello` | guest → host | `roomCode, playerId, name, game?` |
| `welcome` | host → guest | `roomCode, hostId, hostName, game?` |
| `rejected` | host → guest | `roomCode, reason: 'not-found'\|'room-full'` |
| `move` | either | `roomCode, playerId, index, game?` |
| `rematch` / `rematch-start` | either / host | `roomCode, playerId?` |
| `leave` | either | `roomCode, playerId` |
| `ping` / `pong` | either (heartbeat) | `roomCode, playerId` |

Matchmaker messages (JSON over its own WebSocket): `queue`/`cancel` carry `playerId, game?`;
the server answers `matched {playerId, roomCode, role, game?}` or the client times out.

Room codes: 6 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no I/L/O/1). Scoped room id:
`scopedRoomId(game, code)` → `"tictactoe:ABC234"` — used as the relay room key, the BC
channel suffix (`room:<scopedId>`), the Durable Object `idFromName` input, and the LiveKit
room name in minted tokens.

### 4.2 RoomSession (`src/net/RoomSession.ts`)

Owns one room membership: handshake, heartbeats, move/rematch application, teardown.

```
            start()
 guest:  ─────────────► connecting ──welcome──► connected ──leave/timeout──► disconnected
                           │  ▲                                            ▲
            join deadline  │  │ hello retries                              │
                           ▼  │                                            │
                        rejected ──────────────────────────────────────────┘
 host:   waiting ──first hello──► connected ─────────────────────────────► disconnected
```

- Snapshot (`status, role, roomCode, game, myId, myName, myMark, opponentName, state, rematchRequested`)
  is immutable-by-replacement; subscribers get a fresh object per change.
- Every outbound message is stamped with the session's `game`; inbound messages with a foreign
  `game` (or room code) are dropped before touching state.
- Rematch: both sides send `rematch`; the host emits `rematch-start` when it has seen both.

### 4.3 Transports (`src/net/transport.ts`, `wsTransport.ts`, `createRoomTransport.ts`)

| Transport | Used when | Notes |
| --- | --- | --- |
| BroadcastChannel `room:<game>:<code>` | `VITE_WS_URL` unset | same browser profile + origin only (partitioned storage; incognito ≠ normal window) |
| WebSocket `<VITE_WS_URL>/room/<code>?game=…` | `VITE_WS_URL` set | outbox buffers posts until open; used by both relays |

`createRoomTransport(roomCode, game)` picks. The Node/CF relays accept **no** `game` query
param as the default game, so older clients interop.

### 4.4 Node relay (`server/relay.ts`)

- `rooms: Map<scopedId, Set<ws>>` — fan-out; refuses >8 members before handshake (`1013`)
  and unknown codes/games (`1008`).
- `queue: Map<gameId, waiters[]>` — FIFO per game; `matched` echoes the game.
- HTTP: `GET /` health text; `POST /voice/token` (CORS-enabled, 503 when unconfigured,
  400 on malformed body including unknown `game`).
- Validation on forward: JSON-parse, size cap (4KB), and `scopedRoomId(msg.game, msg.roomCode)`
  must equal the connection's room.

### 4.5 Cloudflare relay (`cloudflare/relay.ts`)

| DO | State | Behavior |
| --- | --- | --- |
| `RoomRelay` (one per scoped room id) | `Map<WebSocket, scopedId>` in memory (hibernation API) | same fan-out + validation as Node; room-full refused pre-handshake (`503`, because workerd doesn't deliver post-accept `close()`) |
| `Matchmaker` (one, `idFromName('global-queue')`) | `Map<WebSocket, {playerId, game}>` | pairs only equal-game waiters |

The Worker routes by pathname and stamps nothing — clients already carry `game`; the worker
validates the query param and computes `idFromName(scopedRoomId(...))` so isolation is enforced
by DO identity, not by message inspection alone.

### 4.6 Voice (`src/net/voiceToken.ts`, `voiceSession.ts`, `livekitVoiceRoom.ts`)

- Tokens: HS256 JWT via Web Crypto (shared by Node relay, CF worker, and tests). Claims:
  `iss`=api key, `sub`=identity (uuid), `name`, `video: {room: "<game>:<code>", roomJoin,
  canPublish, canSubscribe, canPublishData}`, TTL 6h with 10s clock skew allowance.
- `VoiceSession`: join = POST token → dynamic-import LiveKit SDK → connect **listen-only**;
  mic enabled only on explicit unmute. Status: `off | connecting | live | error`.
- The LiveKit room name is the scoped id, so two future games with the same code never share audio.

### 4.7 Engine (`src/engine/`)

`createInitialState → startGame → makeMove → …` is a pure reducer-style state machine
(`phase: playing|finished`, win lines, scores, move history). AI (`ai.ts`) is deterministic
under an injected `rng`, enabling seeded property tests ("NEMESIS never loses over 100 games").

## 5. Invariants & failure modes

| Invariant / behavior | Where enforced |
| --- | --- |
| A cell can be played only on an empty cell of a `playing` game, by the current player | `engine/core.ts` (`isValidMove`) — checked by both client and receiver |
| Never more than 2 room members; a third joiner is rejected | host (`room-full`) or relay (capacity refusal) |
| Orphaned sessions die | heartbeats (2s) + timeout (6s) + guest hello deadline (3s) |
| A room id belongs to exactly one game | scoped keys at every layer (transport, relay map, DO name, LiveKit room) |
| Unknown game ids never join or match | parsers return `null`; relays close/refuse; voice token 400s |
| Voice is unavailable, not broken, when unconfigured | `503 voice-unconfigured` → UI shows "Voice unavailable" and keeps the join button |

## 6. Testing architecture

| Layer | Tooling | What it proves |
| --- | --- | --- |
| Engine | Vitest (node) | rules, win detection, seeded AI properties |
| Net units | Vitest + fake transports/sockets | handshake, heartbeats, rematch, game scoping, matchmaker parse |
| Relay integration | Vitest (node env, real `ws` server on an ephemeral port) | fan-out, queue pairing, voice token minting |
| UI integration | Vitest + jsdom + Testing Library | Start/Hub/Home flows, perspective copy, mute, dialogs |
| E2E | Playwright (desktop Chromium + iPhone WebKit) | full products: BC, Node relay, CF relay (wrangler dev), voice (docker LiveKit) |

CI (`.github/workflows/ci.yml`) runs lint → build → typecheck → unit → BC E2E → ws E2E.
The voice and CF suites need docker/wrangler heavier setup and run locally (`npm run test:e2e:voice`,
`npm run test:e2e:cf`).

Local gotcha: Playwright **reuses** an existing relay on the suite's port. Kill a
manually-started relay (especially one with `LIVEKIT_*` set — it breaks the
"voice unavailable" fixture) before `npm run test:e2e:ws`.

## 7. Security posture (honest)

- **Not authoritative**: the relay forwards whatever the clients agree on; both clients
  validate moves, but a tampered client can cheat its peer. Making the relay authoritative is
  a known future step (small state machine, already pure).
- **`playerId` is client-generated** (a UUID in localStorage memory) — spoofable across
  sessions; fine for a game, not for identity.
- **Voice tokens don't check room membership** — any caller who can reach `/voice/token` can
  mint a token for any valid code. Acceptable while the relay is private; must be fixed
  (membership proof) before public deployment.
- No rate limiting, no auth, no persistence; LiveKit secrets live only in relay env
  (never shipped to the browser).

## 8. Scaling & deployment notes

- Current relays are single-node, in-memory: fine for friends-scale traffic; a restart drops
  rooms (clients see `disconnected` and can re-join). 
- The Cloudflare path scales further by construction (DO per room, hibernation), limited by
  wrangler/account quotas — the intended production topology.
- LiveKit media never touches the relays; for internet-wide voice use a hosted LiveKit
  (keys in relay env, `LIVEKIT_URL` points clients at it).
- Persistence (scores, rejoin) is deliberately deferred; the seam would be the relay or a
  small KV/Postgres behind `/matchmake` and room creation.

## 9. Extending: adding a game

The networking seam from Phase 7b:

1. Add the id to `GAMES` in `src/net/protocol.ts` (type-checked everywhere else).
2. Build the game as a pure engine module (mirror `src/engine/`).
3. Hub (`src/pages/hub/Hub.tsx`): mark the card playable, navigate to `/start` with the game id
   in router state; Start threads it into `openRoom`/`MatchmakerClient`/`VoiceSession`.
4. A page like `home/` that drives the engine through `RoomSession` (or a sibling session type
   if the rules need different messages — add variants to `RoomMessage`, keep `game` stamped).
5. Add engine + page tests and one E2E happy path; relays and voice need no changes.
