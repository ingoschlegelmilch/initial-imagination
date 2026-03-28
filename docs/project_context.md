# RPG Project – Context

## 1. High-level overview

- **Project type:** 2D RPG / tactics-style game prototype
- **Engine:** Phaser (browser-based)
- **Language:** TypeScript
- **Runtime target:** Web (canvas), served via Next dev server (port 8080)

The goal is to build a small but extendable RPG framework: tile-based maps, a controllable hero, and a turn-based battle system, with code structured so it’s easy to refactor and extend later.

---

## 2. Current status

- Basic Phaser setup is in place.
- A tile-based “board” is being rendered to the canvas (chessboard-style grid).
- Horizontal scrolling has been implemented via camera / world movement.
- A spritesheet is available under `/public/assets` and is planned to replace the placeholder rectangles.
- A `core` module contains shared models and battle system logic (`src/game/core/models.ts`, `src/game/core/battleSystem.ts`).
- Scenes import from `../core/...` using relative paths.
- A global textbox overlay scene (`Textbox`) runs above gameplay scenes; demo trigger: press `T` in `World`.

---

## 3. Tech stack and tooling

- **Language:** TypeScript
- **Engine:** Phaser
- **Bundler / dev server:** Next.js (`next dev -p 8080`; template notes Vite, but build/dev scripts rely on Next).
- **Testing:** Vitest (`npm test`) for unit-level checks.
- **Directory layout (simplified):**
  - `src/game/`
    - `core/`
      - `models.ts` – shared domain models (units, stats, etc.)
      - `battleSystem.ts` – turn/battle logic
    - `scenes/`
      - `World.ts` / `Battle.ts` / `Textbox.ts` – main gameplay + UI overlay scenes
    - `ui/`
      - `textbox.ts` / `textboxTypes.ts` – helpers + types for textbox requests
  - `public/`
    - `assets/`
      - `tileset.png` / `spritesheet.png` – tile and character graphics
  - `docs/`
    - `PROJECT_CONTEXT.md` – this file
    - `DECISIONS.md` – design decisions
    - `LLM_BRIEF.md` – short summary for LLM tools

---

## 4. Game design snapshot

This is intentionally minimal; update as design hardens.

### Core gameplay ideas

- Tile-based navigation on a grid.
- Player controls a hero (and later possibly a party).
- Encounters trigger a turn-based battle system.
- Focus on clarity and debuggability: the system should be easy to inspect and test.

### World / map

- For now: single board / “chessboard” style map.
- Procedurally generated or programmatically laid out.
- Later: layered tilemaps, collision, interactive tiles (blocked, special tiles, etc.).

### Battle system

- Turn-based combat (initiative order to be defined).
- Units have basic stats (e.g. HP, attack, defense, speed).
- Actions (move, attack, skill) are handled in `core/battleSystem.ts`.

---

## 5. Code conventions

### Imports and structure

- Scenes import core logic via **relative imports**:
  - `../core/models`
  - `../core/battleSystem`
- File names are case-sensitive; stick to lowercase or `PascalCase` consistently depending on file type.
- Avoid circular dependencies between scenes and `core`.
- Use the global textbox overlay instead of scene-local `Text` objects (`queueTextbox` + EventBus; respect `ui:textbox:active` to pause input).

### TypeScript

- Prefer explicit types on public functions and exported interfaces.
- Use interfaces for domain models (e.g., `Unit`, `Stats`).
- Avoid `any` unless absolutely necessary; if used, mark with a TODO.

### Game logic separation

- Scenes handle:
  - Rendering
  - Input
  - High-level orchestration
- `core` modules handle:
  - Game rules
  - Data models
  - Pure logic that can be tested without Phaser

---

## 6. Tilemap system (current approach)

- Tiles are rendered as rectangles (temporary) for quick iteration.
- Tile size currently: `64x64` (see `World.ts` `TILE` constant).
- The grid is generated in nested loops in the scene’s `create()` method:
  - Iteration over `x` and `y` indices.
  - Each tile’s position = base + `index * TILE_SIZE`.
- Previous experimental code used `Math.sin` / `Math.cos` for visual effects; this has been removed for a plain grid.

Planned improvements:

- Replace rectangles with tile sprites from `/public/assets/spritesheet.png`.
- Introduce multiple layers (ground, objects, decorations).
- Add collision information and a way to query tiles (walkable / non-walkable).

---

## 7. UI: Global textbox overlay

- Scene `Textbox` runs alongside gameplay scenes and sits above `World`/`Battle`.
- Queue requests via `queueTextbox(payload)` or `EventBus.emit('ui:textbox:enqueue', payload)`.
- Payload supports `text` (string or string[]), `speaker`, `mode` (`dialogue | system | combat | shop`), and `choices` (with optional `choiceEvent`/`completeEvent`).
- Emits `ui:textbox:active` while visible so scenes can pause input; choices emit either a custom event or the default `ui:textbox:choice`.
- Default controls: SPACE/ENTER to advance, UP/DOWN to select choices, ESC to skip current entry. Demo: press `T` in `World`.

---

## 8. Open questions / TODOs

- Define a stable map format:
  - Hardcoded arrays vs. JSON vs. Tiled export.
- Decide how encounters are triggered (random, tile-based, scripted).
- Define a minimal “hero” data structure:
  - Base stats, equipment slots, abilities.
- Set up proper unit tests for `core/battleSystem.ts` and `core/models.ts`.
- Asset pipeline:
  - Finalize tile sizes and sprite sheet layout.
  - Decide scaling rules (1:1 pixels, or scaled up).

---

## 9. How to run the project

Fill this out to avoid repeating it in every chat.

- **Install:**
  - `npm install`
- **Dev server:**
  - `npm run dev`
- **Build:**
  - `npm run build`
- **Tests:**
  - `npm test` (if applicable)

Update these commands as scripts change.
