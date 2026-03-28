# Design Decisions (ADR-style)

This file records important decisions that came out of LLM sessions, experiments, and refactors.

---

## 2025-11-30 – Global textbox overlay

**Context**

Wanted a single textbox system for dialogue, combat log, pickups, and shop menus instead of ad-hoc `Text` objects in each scene.

**Decision**

- Add a dedicated `Textbox` overlay scene launched alongside gameplay scenes (sits above World/Battle).
- Route text requests through EventBus (`ui:textbox:enqueue`), with helpers + types in `src/game/ui/textbox.ts`.
- Emit `ui:textbox:active` so scenes can pause controls while the box is open; choices emit `ui:textbox:choice` or a custom event set on the request.
- Controls: SPACE/ENTER to advance, UP/DOWN to navigate options, ESC to skip current entry.

**Rationale**

- Keeps presentation/UI concerns out of gameplay scenes.
- Provides a reusable surface for dialogue, pickup notifications, combat text, and shop choices.
- Event-driven API makes it easy to plug in future systems (inventory, quests) without tight coupling.

**Notes**

- Demo wired in `World` (press `T`); adjust palette/layout or fonts as art direction evolves.

---

## 2025-10-27 – Tilemap rendering approach

**Context**

Need a simple, controllable grid-based board (chessboard-like) to serve as the base for maps and movement. Early experiments used trigonometric functions to distort positions for visual effects.

**Decision**

- Use a straightforward nested-loop grid with a fixed `TILE_SIZE` (e.g., 32).
- Render basic rectangles (or tile sprites) at `x * TILE_SIZE`, `y * TILE_SIZE` positions.
- Remove `Math.sin` / `Math.cos` effects from the tile placement.
- Keep horizontal scrolling via camera/world movement.

**Rationale**

- Plain grid is easier to debug and reason about.
- Avoids subtle off-by-pixel artefacts (e.g., overlapping vertical lines).
- Keeps the system ready for swapping rectangles with sprite-based tiles.

**Notes**

- Future step: migrate to using the spritesheet from `/public/assets`.

---

## 2025-10-27 – Separation of concerns: scenes vs. core

**Context**

Logic was at risk of leaking into scenes (Phaser callbacks) and becoming hard to test.

**Decision**

- Put domain logic and models in `src/core`:
  - `core/models.ts` – data structures (units, stats, tiles, etc.).
  - `core/battleSystem.ts` – turn handling, damage resolution, etc.
- Keep scenes mostly concerned with:
  - Input
  - Rendering
  - Wiring events into `core` functions

**Rationale**

- Makes unit testing easier (no Phaser dependency).
- Allows reuse of logic across future scenes (e.g., overworld vs. battle screen).
- Reduces coupling between rendering and rules.

---

## 2025-11-xx – Import and path strategy

**Context**

Import errors due to inconsistent relative paths and case sensitivity.

**Decision**

- Use relative imports from scenes into `core`:
  - `../core/models`
  - `../core/battleSystem`
- Keep file names and import paths consistent in casing (`models.ts` is always `models`, not `Models`).
- Avoid deep nested relative paths by structuring `src` clearly rather than relying on path aliases for now.

**Rationale**

- Less tooling magic; easier to debug in any IDE/LLM.
- Avoids runtime failures on case-sensitive file systems.

---

## 2026-03-28 – Textbox overlay for all in-game text UI

**Context**

Battle needed an action menu and combat log. Rather than building ad-hoc text objects per scene, a shared overlay was added.

**Decision**

- `Textbox` scene runs above all gameplay scenes, launched once by `Game` alongside `World`.
- All text requests go through `queueTextbox(payload)` / `EventBus.emit('ui:textbox:enqueue', payload)`.
- Supports paged text, speaker labels, modes (`dialogue|system|combat|shop`), and choice menus with `choiceEvent`/`completeEvent`.
- Battle wires its entire flow (intro → action menu → result log → enemy turn) through textbox events, keeping no local menu state.

**Rationale**

- Single consistent UI surface for dialogue, combat, pickups, shops.
- Event-driven API keeps scenes decoupled from the presentation layer.

---

## 2026-03-28 – Core-first rebuild

**Context**

Previous work was lost (uncommitted). Restarting from the Phaser/Next.js template with the docs intact.

**Decision**

- Rebuild in order: `core/models.ts` → `core/battleSystem.ts` → `World` scene → `Battle` scene → `Textbox` overlay.
- Keep docs updated after each step.

**Rationale**

- Building core first keeps logic testable before any rendering exists.
- Matches the separation-of-concerns decision already in place.

---

## Template for future decisions

Copy this block for new decisions:

```md
## YYYY-MM-DD – Decision title

**Context**

Short description of the problem or situation.

**Decision**

Bullet points describing what you decided.

**Rationale**

Why this choice was made over alternatives.

**Notes**

Anything extra (links to chats, experiments, etc.).
