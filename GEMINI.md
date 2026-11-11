# Project Rules & Development Guidelines: Arcade Hub

## 1. Mandatory Documentation Synchronization Rule
Whenever **any kind of major update** occurs in the codebase (including, but not limited to):
- Adding or modifying a game engine or game mode
- UI/UX revamps, layout alterations, or design system changes
- Networking, protocol, relay, or room state machine changes
- Deployment, CI/CD, or infrastructure updates

**You MUST always update:**
1. **`README.md`**: Update feature lists, games overview, controls, project structure, and roadmap.
2. **`docs/ARCHITECTURE.md`**: Update system diagrams (Mermaid), low-level designs (LLD), component responsibilities, data flows, and design invariants.

> **Note**: Documentation drift is treated as a breaking bug. Never commit or push major features without keeping the documentation 100% synchronized in the same changeset.

---

## 2. Purity & Separation of Concerns
- **Engine Purity**: Pure TypeScript state machines in `src/engine/<game>/` must have ZERO React or DOM dependencies. They must be deterministic, pure reducers capable of headless testing.
- **Game-Scoped Protocol**: Network messages, rooms, matchmaker queues, and LiveKit audio channels must always be scoped by `game` (`<game>:<code>`).
- **One Source of Truth**: State lives in the engine; React components render snapshots without duplicating derived state.

---

## 3. Responsive Viewport Guarantees
- Every screen (`Hub`, `Start`, `Home`, `ConnectFour`, `DirectionRush`) must fit within the viewport without vertical scrolling or clipped controls across all form factors:
  - Mobile portrait (375x667, 390x844)
  - Short landscape tablets (e.g., 800x550)
  - Standard & large desktops (1280x720, 1440x900+)
- Always use flex budgeting: interactive playing arenas get `flex-1 min-h-0`, while headers and control pads remain `shrink-0`.
- All viewport fits must be tested and confirmed via Playwright E2E suites.

---

## 4. Quality Gates Before Commit & Push
Before any commit or push, the following suite must pass locally:
1. `npm run lint` (0 errors)
2. `npm run build` (Clean production bundle build)
3. `npm run typecheck:cf` (0 Cloudflare worker type errors)
4. `npm test` (All unit and component tests passing)
5. `npx playwright test` (E2E tests passing)
6. Push to `main` and verify the GitHub Actions CI pipeline finishes green.
