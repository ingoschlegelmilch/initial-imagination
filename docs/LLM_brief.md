---

### `docs/LLM_BRIEF.md`

```markdown
# LLM Brief – RPG Project

Use this as a quick context primer when working with code or suggesting changes.

---

## 1. Project summary

- 2D tile-based RPG prototype using **Phaser + TypeScript**.
- Target platform: web canvas.
- Core goals: clean separation between Phaser scenes (rendering/input) and pure game logic in `src/game/core`.
- Global textbox overlay scene exists for dialogue/combat/shop text; feed it via EventBus helpers.

---

## 2. Important directories and files

- `src/game/core/models.ts` – domain models (units, stats, tiles, etc.).
- `src/game/core/battleSystem.ts` – turn-based battle logic.
- `src/game/scenes/` – Phaser scenes (main scene renders the tile grid and handles input).
- `src/game/scenes/Textbox.ts` – global textbox overlay (dialogue/combat/shop UI).
- `src/game/ui/textbox.ts` & `textboxTypes.ts` – helper + types for queuing textbox requests.
- `public/assets/` – spritesheets and tiles.

When you propose changes, try to keep:
- Rules/logic inside `core`.
- Rendering/input inside `scenes`.

---

## 3. Conventions

- Use **TypeScript** with explicit types on exported functions and interfaces.
- Scenes import core logic via relative paths:
  - `../core/models`
  - `../core/battleSystem`
- File names are case-sensitive; keep them consistent with imports.
- Use the global textbox via `queueTextbox` + `EventBus` instead of creating scene-local text objects; pause input when `ui:textbox:active` is true.
- Tests: `npm test` runs Vitest (unit-level helpers/core logic).

---

## 4. Tilemap system (current state)

- Simple grid (`64x64` tiles), generated via nested loops in the main scene’s `create()` method.
- Currently using rectangles as placeholder tiles; plan is to swap in tile sprites from `/public/assets`.
- Horizontal scrolling is implemented; vertical scrolling may be added later.

When modifying this:
- Keep the grid logic easy to read and debug.
- Avoid introducing weird offsets or trig, unless explicitly requested.

---

## 5. How to help

When asked to change or add something:

1. Prefer **small, focused changes** over giant refactors.
2. Respect the separation of:
   - `core` = pure logic
   - `scenes` = Phaser-specific code
3. If adding new features (e.g., collision, pathfinding, battle UI), suggest:
   - Where new modules should live.
   - How they interact with existing `core` and scene code.

If you’re unsure where something belongs, lean toward:
- **Domain rules → `core`**
- **Visual / UX → `scenes`**
