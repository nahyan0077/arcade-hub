---
description: Rule requiring README.md and docs/ARCHITECTURE.md updates on major changes
globs: ["**/*"]
alwaysApply: true
---

# Documentation Synchronization Rule

Whenever **any major update** is implemented in the Arcade Hub repository (e.g. adding or altering a game, engine changes, UI/UX overhauls, network protocol updates, or page restructuring):

1. **Update `README.md`**:
   - Update games list, features, project structure, and roadmap.
   - Describe all user-visible controls, modes, and aesthetic additions.

2. **Update `docs/ARCHITECTURE.md`**:
   - Update Mermaid system diagrams, component hierarchies, and data flows.
   - Document any new engines in Section 4.7.
   - Document UI shells and responsive viewport constraints in Section 4.8.
   - Document testing layers in Section 6.

3. **Strict Zero-Drift Policy**:
   - Documentation drift is considered a breaking defect.
   - Both `README.md` and `docs/ARCHITECTURE.md` must be updated within the same commit/PR as the code changes.
