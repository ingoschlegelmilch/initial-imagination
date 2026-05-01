# Map config schema

The `build_map.py` script reads a JSON config. Store it at `maps/<name>.config.json` alongside its outputs.

## Top-level fields

| Field         | Type   | Required | Description                                                |
|---------------|--------|----------|------------------------------------------------------------|
| `name`        | string | yes      | Slug used in all output filenames (`forest-clearing`).      |
| `tile_size`   | int    | yes      | Tile edge length in pixels (16, 32, 64, ...).               |
| `map_width`   | int    | yes      | Map width in tiles.                                         |
| `map_height`  | int    | yes      | Map height in tiles.                                        |
| `tile_dir`    | string | no       | Path to folder of tile PNGs. Default `assets/tiles`.        |
| `output_dir`  | string | no       | Where to write outputs. Default `.` (config's directory).   |
| `seed`        | int    | no       | RNG seed for reproducible random layers.                    |
| `layers`      | array  | yes      | Ordered list of layers (render bottom-to-top).              |

All paths are resolved relative to the config file's directory.

## Layer object

```json
{"name": "ground", "strategy": "random", "weights": {...}}
```

| Field        | Type   | Required                | Description                                           |
|--------------|--------|-------------------------|-------------------------------------------------------|
| `name`       | string | yes                     | Layer identifier used in Tiled and Phaser.             |
| `strategy`   | string | yes                     | `"random"`, `"manual"`, or `"empty"`.                  |
| `weights`    | object | for `random`            | Tile name → weight (any positive numbers).             |
| `grid_file`  | string | for `manual`            | Path to a text grid file, relative to the config.       |

## Example — simple random ground

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
      "weights": {
        "mossy-grass": 70,
        "wildflowers": 20,
        "dirt-patch": 10
      }
    }
  ],
  "seed": 42
}
```

## Example — ground + manual decoration + empty collision

```json
{
  "name": "forest-clearing",
  "tile_size": 64,
  "map_width": 10,
  "map_height": 6,
  "layers": [
    {
      "name": "ground",
      "strategy": "random",
      "weights": {"mossy-grass": 70, "wildflowers": 20, "dirt-patch": 10}
    },
    {
      "name": "decoration",
      "strategy": "manual",
      "grid_file": "forest-clearing.decoration.txt"
    },
    {
      "name": "collision",
      "strategy": "empty"
    }
  ],
  "seed": 42
}
```

And `forest-clearing.decoration.txt`:

```
. . . tree . . . . . .
. bush . . . . . . . .
. . . . . . flower . .
. . . tree . . . . . .
. . . . . . . bush . .
. . . . . . . . . .
```

Rules for the grid file:
- Whitespace-separated tokens, one row per line.
- `.` = empty cell.
- Unknown tile names = empty (warning not yet implemented — typos silently become empty, so double-check names).
- Grid smaller than the map → remainder is empty.
- Grid larger than the map → truncated.

## Tile naming convention

Tile PNG filenames (without `.png`) are how you reference them in `weights` and grid files. Keep them short and kebab-cased so grids stay readable:

- `mossy-grass.png` → `mossy-grass`
- `tree.png` → `tree`
- `dirt-path-corner.png` → `dirt-path-corner` (still readable; try not to go longer)

## Tips

- Start with a single `ground` layer on `random` to sanity-check the tileset renders before adding decoration.
- For puzzle/dungeon layouts, do `ground` on `random` with a single dominant tile, then hand-author decoration + collision with `manual`.
- The `collision` layer convention: leave it `empty` on creation, then paint it in Tiled using a dedicated "invisible collision" tile.
