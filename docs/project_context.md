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
- `core/models.ts` defines all domain types: `ActorTemplate`, `ActorInstance`, `ActorComputed`, `Stats`, `Tile`, `TerrainKind`, `Element`, `EquipmentSlot`.
- `core/battleSystem.ts` implements turn-based combat: initiative order, physical/magic damage, defend, flee, status effect ticking, battle-over detection.
- `World` scene renders a tile grid (20×12, 64px tiles) with terrain types (Grass, Wall, Water), a yellow hero placeholder, tile-based movement (arrow keys), and camera follow. Press `B` to trigger battle.
- `Battle` scene uses `battleSystem.ts` for all logic: hero vs slime, HP bars, enemy auto-acts after hero turn, exits automatically on win/loss/flee. Action menu and combat log routed through the Textbox overlay.
- `Textbox` overlay scene handles all in-game text UI: dialogue, combat log, choice menus. Queue via `queueTextbox(payload)` or `EventBus.emit('ui:textbox:enqueue', payload)`. Emits `ui:textbox:active` while visible. Supports paged text, speaker labels, choice menus with `choiceEvent`/`completeEvent`.
- `Game` scene is a silent orchestrator: launches `World`, handles World↔Battle transitions via EventBus.
- A spritesheet is available under `/public/assets` and is planned to replace the placeholder rectangles.
- Scenes import from `../core/...` using relative paths.

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
- Tile size: `64×64` (`TILE` constant in `World.ts`). Grid: 20 columns × 12 rows.
- Map layout defined as a string array in `World.ts`; characters map to `TerrainKind` (`.` = Grass, `W` = Wall, `~` = Water).
- Walkability is stored on each `Tile` object; hero movement checks `isTileWalkable` before committing a step.
- Hero moves one tile at a time (arrow keys); movement is animated with a 100ms tween and locked during animation.
- Camera follows the hero with soft lerp, bounded to the world size.

Planned improvements:

- Replace rectangles with tile sprites from `/public/assets/spritesheet.png`.
- Introduce multiple layers (ground, objects, decorations).
- Move map data to JSON / Tiled export.

---

## 7. UI: Global textbox overlay

- Scene `Textbox` runs alongside gameplay scenes and sits above `World`/`Battle`.
- Queue requests via `queueTextbox(payload)` or `EventBus.emit('ui:textbox:enqueue', payload)`.
- Payload supports `text` (string or string[]), `speaker`, `mode` (`dialogue | system | combat | shop`), and `choices` (with optional `choiceEvent`/`completeEvent`).
- Emits `ui:textbox:active` while visible so scenes can pause input; choices emit either a custom event or the default `ui:textbox:choice`.
- Default controls: SPACE/ENTER to advance, UP/DOWN to select choices, ESC to skip current entry. Demo: press `T` in `World`.

---

## 8. Open questions / TODOs

- Replace placeholder rectangles with sprites from `/public/assets`.
- Define a stable map format: move from hardcoded string arrays to JSON / Tiled export.
- Decide how encounters are triggered (random, tile-based, scripted).
- Define a minimal hero `ActorTemplate` + `ActorInstance` and wire it to the World hero.
- Wire real `ActorTemplate`/`ActorInstance` data into the Battle scene (currently uses hardcoded placeholder actors).
- Pause World input when `ui:textbox:active` is true (textbox open during dialogue etc.).
- Set up unit tests for `core/battleSystem.ts` and `core/models.ts`.
- Asset pipeline: finalize tile sizes, sprite sheet layout, and scaling rules.

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
