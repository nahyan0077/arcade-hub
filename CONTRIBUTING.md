# Contributing

Thanks for wanting to improve Arcade Hub. This project is built phase-by-phase,
test-first, with strict quality gates — these guidelines keep changes reviewable and green.

## Getting started

```bash
git clone https://github.com/nahyan0077/arcade-hub.git
cd arcade-hub
npm install                 # use --legacy-peer-deps if your npm complains about peer ranges
npm run dev                 # http://localhost:5173
```

Prerequisites: **Node ≥ 20**, npm. Optional: Docker (voice E2E), a Cloudflare account
(only for real `wrangler deploy`).

## Quality gates

Every change must pass all of these before a PR (CI runs the first five automatically):

```bash
npm run lint                # 0 errors (2 known react-refresh warnings are pre-existing)
npm run build               # production build
npm run typecheck:cf        # Cloudflare worker types
npm test                    # unit + integration (Vitest)
npx playwright test         # E2E over BroadcastChannel (desktop + mobile)
npm run test:e2e:ws         # E2E over the Node WebSocket relay
```

Run locally as needed (not in CI):

```bash
npm run test:e2e:cf         # E2E over the Cloudflare DO relay (wrangler dev)
npm run test:e2e:voice      # E2E voice against a throwaway dockerized LiveKit
```

**Gotcha:** Playwright reuses whatever is already listening on the suite's port. Kill a
manually started relay before the ws suite — especially one started with `LIVEKIT_*` vars,
which breaks the "voice unavailable" fixture:

```bash
lsof -ti:8787,8788,5199,5200,5202 | xargs kill -9
```

## How we work

- **Branch** from `main`: `feature/phase-N-…`, `fix/…`, `docs/…`, `test/…`.
- **Commit** with [Conventional Commits](https://www.conventionalcommits.org/):
  `<type>(<scope>): <subject>` — imperative, ≤ 50 chars, no period. Body explains *why*
  for anything non-obvious. Keep commits atomic; don't mix unrelated concerns.
- **Test-first** for behavior: a bug fix gets a failing regression test; a feature gets its
  tests with (or before) the implementation.
- **Small diffs.** A phase is a branch with several focused commits, merged with
  `--no-ff`. Trivial fixes may land on `main` directly.
- **Don't weaken checks** to make them pass (no skipped tests, no lint disables, no
  `@ts-ignore`). If a check is wrong, fix the check and say so in the commit.

## Code conventions

- **Engine purity**: `src/engine/` imports nothing from React/DOM; keep it that way — it's
  the template for future games.
- **One source of truth**: game state lives in the engine; components render snapshots.
  No duplicated derived state.
- **Names** are complete words; comments only where purpose isn't obvious or a gotcha is
  unavoidable.
- **Errors fail loudly** — no swallowed exceptions or silent fallbacks.
- **No secrets** in code, commits, or logs. LiveKit/relay credentials are env vars only
  (`.dev.vars.example` documents the shape).
- Match the surrounding style (2-space TS/TSX, Tailwind utility classes, existing test
  idioms like fake transports and `within(...)` queries).

## Adding a game (the fun part)

The network stack is game-scoped (`<game>:<code>`), so a new game reuses rooms,
matchmaking, and voice. The recipe is in
[docs/ARCHITECTURE.md §9](docs/ARCHITECTURE.md#9-extending-adding-a-game):
add the id to `GAMES`, build a pure engine, wire the hub card, drive it through
`RoomSession`. Relays need no changes.

## Pull requests

A good PR:

1. States **what** changed and **why** (link the issue if there is one).
2. Includes tests proportionate to the risk (bug → regression test).
3. Touches docs when behavior or setup changes (README/ARCHITECTURE drift is a bug).
4. Has a clean commit history (imperative conventional commits).
5. Lists how it was tested — actual commands and results, not "should work".

## Reporting issues

Open a GitHub issue with: what you did, what you expected, what happened, browser/OS, and
whether you were on BroadcastChannel, the Node relay, or the Cloudflare relay. Screenshots
or a failing spec snippet are gold.

## Project docs

- [README.md](README.md) — features, setup, scripts, configuration
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — diagrams, HLD/LLD, data flows, invariants
