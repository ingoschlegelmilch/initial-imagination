# Tiled .tmj format — what this skill emits

The script produces a minimal-but-valid Tiled 1.10 JSON map. This file documents what's included and why, and flags what you'd need to add for more advanced features.

## What we emit

A single orthogonal map with one embedded tileset and N tile layers. Every layer covers the full map; data is a flat row-major int array. No object layers, no image layers, no custom properties, no compression.

Top-level fields produced:

```
orientation:     "orthogonal"   (standard square grid)
renderorder:     "right-down"   (Tiled default)
infinite:        false
tilewidth / tileheight: cfg.tile_size
width / height:  cfg.map_width / cfg.map_height
tilesets:        one embedded tileset
layers:          N tilelayer entries
```

## Tilesets — embedded, not external

We embed the tileset directly in the map (rather than a separate `.tsj` file). This keeps the map self-contained — only two files need to ship, the `.tmj` and the atlas PNG.

Embedded tileset fields:

```
firstgid:        1
name:            cfg.name
image:           relative path to the atlas PNG from the .tmj location
imagewidth / imageheight
tilewidth / tileheight: cfg.tile_size
columns:         atlas width in tiles
tilecount:       total tiles in the atlas
spacing:         0  (tiles packed flush)
margin:          0
```

If you want to share one tileset across multiple maps, extract it to a `.tsj` and reference via `source` instead. Not implemented here — edit the script to do it.

## Tile IDs (gids)

Tiled uses **global tile IDs**. Within a map they start at `firstgid` (1 here) and increment through the tileset's tiles in row-major order.

- `0` = empty cell.
- `1`..`tilecount` = tiles in the atlas, indexed row-major from top-left.

This skill assigns gids in **alphabetical order** of tile PNG filenames. That means adding or removing a tile shifts IDs for every subsequent tile — any `.tmj` previously hand-edited in Tiled will reference wrong tiles after a rebuild.

Mitigation (if you plan to keep hand-editing):
- Lock your tile set before hand-editing, OR
- Switch to a stable-ID scheme (e.g., a persistent `tile-ids.json` mapping) — not implemented yet.

## Render order

`right-down` is Tiled's default: the renderer draws top-left first, then right, then wraps to the next row. Good for orthogonal top-down perspectives. Other valid values are `right-up`, `left-down`, `left-up` — for isometric projections you'd likely want to revisit along with `orientation: "isometric"`.

## Layer data format

We emit uncompressed flat arrays:

```json
"data": [1, 2, 1, 0, 0, 3, ...],
"type": "tilelayer"
```

Tiled also supports:
- **CSV** (`"encoding": "csv"`) — human-readable for small maps, not worth it here.
- **Base64 + zlib/gzip/zstd** — useful for very large maps; for typical RPG maps under ~10k tiles, uncompressed JSON is fine and keeps the file diffable.

## Phaser 3 loader

The emitted `<name>.loader.js` uses Phaser's standard API:

```js
this.load.image('<name>_tiles', '<atlas.png>');
this.load.tilemapTiledJSON('<name>', '<name>.tmj');
// ...
const map = this.make.tilemap({ key: '<name>' });
const tileset = map.addTilesetImage('<name>', '<name>_tiles');
const groundLayer = map.createLayer('ground', tileset, 0, 0);
```

Two things to watch:

1. **Paths are relative to the `.tmj` location** in the emitted snippet. Phaser's loader resolves paths relative to its base URL (usually your web root). Adjust when you drop the snippet into your scene.

2. **Tileset name passed to `addTilesetImage`** must match the `name` field in the embedded tileset JSON, which the script sets to `cfg.name`. If you rename the map later without re-running the script, update both sides.

## What we don't emit (yet)

- Object layers (doors, NPCs, triggers) — use Tiled to add these.
- Tile animations (frame sequences per tile) — Tiled supports this; not scripted here.
- Custom tile properties (collidable, damageTile, etc.) — easiest to add in Tiled.
- Tilesets split across multiple atlases.
- Infinite maps / chunked data.

All of these are clean to add in Tiled after the initial map is built, which is the intended workflow.

## Tiled version compatibility

The skill writes `tiledversion: "1.11.0"` and `version: "1.10"`. Tiled opens files from older/newer versions with warnings. If you hit compatibility issues, bump both values or open and re-save in Tiled.

## Further reading

- Tiled JSON format reference: https://doc.mapeditor.org/en/stable/reference/json-map-format/
- Phaser 3 tilemap docs: https://phaser.io/examples/v3.85.0/tilemap/
