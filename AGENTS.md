# Agent Guidelines: Arcade Hub

## Mandatory Documentation Synchronization Rule
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

## Architectural & Engineering Rules
1. **Engine Purity**: Pure TypeScript state machines in `src/engine/<game>/` must have ZERO React or DOM dependencies.
2. **Game-Scoped Protocol**: Network messages, rooms, matchmaker queues, and LiveKit audio channels must always be scoped by `game` (`<game>:<code>`).
3. **Responsive Viewport Guarantees**: Every screen (`Hub`, `Start`, `Home`, `ConnectFour`, `DirectionRush`) must fit within the viewport without vertical scrolling or clipped controls across all form factors (mobile, short landscape tablet e.g. `800x550`, and desktop).
4. **Quality Gates**: Every change must pass `npm run lint`, `npm run build`, `npm run typecheck:cf`, `npm test`, and Playwright E2E tests before committing.
