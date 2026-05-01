---
name: rpg-tilemap-builder
description: Build Phaser 3 tilemaps from individual tile PNGs. Stitches tiles into a tileset atlas, generates Tiled-compatible .tmj JSON maps (openable in the free Tiled editor at mapeditor.org), and emits ready-to-paste Phaser 3 loader code. Use this skill whenever the user wants to assemble tiles into a map, build a tilemap, create an overworld or dungeon layout, make a Tiled map, turn tile assets into a playable scene, lay out an area, or produce a Phaser tilemap — including vague phrasings like "lay out the forest", "put the tiles together", or "build me a map". Supports both weighted-random terrain fill and hand-authored grid layouts. Pairs with rpg-asset-generate, which produces the tile PNGs this skill consumes. Do NOT use this skill for individual tile art generation — that's rpg-asset-prompts + rpg-asset-generate.
---

# RPG Tilemap Builder (Tiled + Phaser 3)

This skill assembles individual tile PNGs into a Phaser-ready tilemap. Outputs:

1. **Tileset atlas** — all tiles stitched into one PNG grid.
2. **Tiled `.tmj`** — standard Tiled JSON, opens in the free [Tiled editor](https://www.mapeditor.org) for hand-editing.
3. **Phaser 3 loader snippet** — copy-paste code for your scene's `preload()` and `create()`.

Last link in the three-skill pipeline:

```
rpg-asset-prompts  →  rpg-asset-generate  →  rpg-tilemap-builder
```

## Prerequisites

- **Pillow** (Python imaging). If not installed:
  ```bash
  pip install Pillow --break-system-packages
  ```
- **Tile PNGs** somewhere on disk (default location: `assets/tiles/`), named by what you'll reference them as (e.g., `mossy-grass.png`, `tree.png`).

## Info to gather before running

Before writing the config, get these from the user. Ask efficiently — pick sensible defaults for anything unstated:

1. **Map name** (`forest-clearing`, `dungeon-level-1`). Used for all output filenames.
2. **Tile size** in pixels. If unsure, match the dimensions of the tile PNGs.
3. **Map dimensions** in tiles (e.g., 30 × 20).
4. **Tile source folder** (default: `assets/tiles`).
5. **Layers** — the typical trio is `ground` (full coverage), `decoration` (sparse), `collision` (invisible, marks impassable cells). Most maps just need `ground` to start.
6. **Layout strategy per layer** — see below.
7. **Optional seed** for reproducible random fills.

If the user's request is vague ("build me a forest map"), ask one or two targeted questions — don't interrogate. Example minimum-viable interaction:

> User: "Make me a forest map using the tiles I just generated."
> You: "How big should it be, and which tile should dominate the ground? I'll default to 30×20 tiles, 64px each, with your grass tile at ~70% and scattered variations for the rest. Sound good?"

## Layout strategies

Each layer picks one:

### Random (weighted)
Give a tile-name → weight mapping. Script samples tiles per cell:
```json
{"strategy": "random", "weights": {"mossy-grass": 70, "wildflowers": 20, "dirt-patch": 10}}
```
Best for ground layers, natural terrain variation.

### Manual
Provide a text grid in an external file (`.` = empty, whitespace-separated):
```
. . . tree .
. bush . . .
tree . . . flower
```
Then reference it:
```json
{"strategy": "manual", "grid_file": "maps/forest-clearing.decoration.txt"}
```
Best for decoration layers, puzzle layouts, set pieces. If the grid is smaller than the map, the remainder is empty; if larger, it's truncated.

### Empty
```json
{"strategy": "empty"}
```
Empty layer — useful for a `collision` layer the user will fill in Tiled.

## Workflow

1. **Verify tiles exist.** `ls <tile_dir>` and check that every referenced tile name has a matching `.png`. If missing, offer to run `rpg-asset-generate` first.

2. **Write the config** at `maps/<name>.config.json`. Keep it alongside the map so it's versionable and re-runnable. For any manual layer, also write the grid text file.

3. **Run the script:**
   ```bash
   python3.11 .claude/skills/rpg-tilemap-builder/scripts/build_map.py maps/<name>.config.json
   ```

4. **Report outputs:** atlas path, `.tmj` path, loader path. Include a one-line hint:
   ```
   Open maps/<name>.tmj in Tiled to hand-edit the layout.
   ```
   Do NOT paste the loader snippet in chat. The file is the deliverable — tell the user it exists.

## Output layout

```
project/
├── assets/tiles/            (input: individual tile PNGs)
├── maps/
│   ├── <name>.config.json   (versionable config)
│   ├── <name>.tmj           (Tiled JSON — open in Tiled)
│   ├── <name>.loader.js     (Phaser snippet)
│   └── <name>.<layer>.txt   (optional, for manual layers)
└── tilesets/
    └── <name>.png           (stitched atlas)
```

## Why Tiled JSON?

- Phaser 3 native: `this.load.tilemapTiledJSON(...)`.
- Opens in [Tiled](https://www.mapeditor.org) (free, GPL) for hand-editing — faster than JSON-tweaking for anything beyond rectangles.
- Stable format, compatible with Godot, LDtk (import), and Unity importers.

## Tile ID stability warning

Tiled uses 1-based tile IDs within a tileset (0 = "no tile"). This script stitches tiles into the atlas in alphabetical order and assigns IDs in that order. **If you add or remove tiles between runs, IDs shift** — a `.tmj` saved from Tiled will reference the wrong tiles.

If you plan to hand-edit in Tiled:
- Either keep the tile set stable,
- Or re-run the script with `--stable-ids` (TODO — not implemented yet; falls back to alphabetical until added).

For now: hand-edit after all tiles are locked in.

## Config schema

See `references/map-config-schema.md` for the full schema with examples. Minimal config:

```json
{
  "name": "forest-clearing",
  "tile_size": 64,
  "map_width": 30,
  "map_height": 20,
  "tile_dir": "assets/tiles",
  "layers": [
    {
      "name": "ground",
      "strategy": "random",
      "weights": {"mossy-grass": 70, "wildflowers": 20, "dirt-patch": 10}
    }
  ],
  "seed": 42
}
```

## Importing from areas.ts (Tiled-as-source-of-truth workflow)

When the project defines maps in `src/game/core/areas.ts` (char-grid layout arrays)
and wants to migrate to Tiled as the canonical map source, use `import_areas.py`:

```bash
# Import all areas and build maps + atlases in one shot
python3.11 .claude/skills/rpg-tilemap-builder/scripts/import_areas.py

# Import a single area
python3.11 .claude/skills/rpg-tilemap-builder/scripts/import_areas.py --area overworld

# Write config files only, skip building (inspect before spending time)
python3.11 .claude/skills/rpg-tilemap-builder/scripts/import_areas.py --no-build

# Custom char→tile-name mapping
python3.11 .claude/skills/rpg-tilemap-builder/scripts/import_areas.py --char-map '{"W":"dungeon-wall",".":"dungeon-floor"}'
```

**Per-layer default char maps** (each layer has its own — the same char can mean
different tiles in different layers, or be empty in layers that don't define it):

| Layer | Char | Tile name |
|---|---|---|
| `ground` | `.` | `overworld-grass` |
| `ground` | `~` | `overworld-water` |
| `ground` | `F` | `indoor-floor` |
| `ground` | `R` | `overworld-road` |
| `belowPlayer` | `W` | `overworld-wall` |

A char absent from a layer's map renders as empty (gid 0). So `.` in
`belowPlayer` is empty — exactly what you want for the cells where there's
no obstacle on top of the ground tile.

Override per-layer with `--char-map '{"belowPlayer": {"T": "tree-trunk"}}'`
(layers not listed in the override fall back to defaults).

**Tile asset folder convention.** `build_map.py` searches `tile_dir`
recursively, so organizing tiles by layer keeps things tidy:

```
public/assets/tiles/
├── ground/         overworld-grass.png, overworld-water.png, indoor-floor.png, ...
├── belowPlayer/    overworld-wall.png, tree-trunk.png, fence.png, ...
└── abovePlayer/    tree-canopy.png, rooftop.png, awning.png, ...
```

Tile filenames must be globally unique across folders (the script errors on
ambiguity).

**Multi-layer source schema.** `parse_areas` accepts either of:

```typescript
// Single-layer (becomes the `ground` layer)
layout: [
  'WWWW',
  'W..W',
],

// Multi-layer (one Tiled layer per entry)
layouts: {
  ground: [
    'WWWW',
    'W..W',
  ],
  belowPlayer: [   // decoration the player walks over (flowers, rocks)
    '....',
    '.f..',
  ],
  abovePlayer: [   // overlays the player from above (tree canopies, awnings)
    '....',
    '..T.',
  ],
},
```

`cols`/`rows` are inferred from the `ground` layer if omitted. Layer names
`ground`, `belowPlayer`, `abovePlayer` are recognized by `World.ts` and given
sensible depth ordering (0, 0.5, 2 — hero is at depth 1). Other layer names
work but render at depth 0 unless wired up explicitly.

Any tile in *any* layer that's listed in `non_walkable_tiles` blocks movement,
so e.g. putting `tree-trunk` in `belowPlayer` automatically becomes a wall.

**Outputs** (run from project root):

```
maps/<key>.config.json              versionable config; re-run to rebuild
public/assets/tilesets/<key>.png    stitched atlas
public/assets/maps/<key>.tmj        Tiled JSON — open in Tiled to hand-edit
public/assets/maps/<key>.loader.js  Phaser 3 preload/create snippet
```

After running:
1. Open `public/assets/maps/<key>.tmj` in [Tiled](https://www.mapeditor.org) to hand-edit
2. Export from Tiled as JSON (File → Export As → `.tmj`) — Tiled is now the source of truth
3. Load in Phaser: `this.load.tilemapTiledJSON('key', 'assets/maps/key.tmj')`

The `areas.ts` char-grid layout becomes obsolete once maps are exported from Tiled.
Keep `areas.ts` for non-layout metadata (portals, encounter rates, area names).

## Reference files

- `scripts/build_map.py` — atlas + tmj builder (requires Pillow / `python3.11`)
- `scripts/import_areas.py` — reads `areas.ts`, generates configs, calls `build_map.py`
- `references/map-config-schema.md` — full config schema + examples
- `references/tiled-format-notes.md` — relevant `.tmj` fields, Phaser quirks

Run the scripts; don't reimplement. If you hit an edge case, edit the script.
