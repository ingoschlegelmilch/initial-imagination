#!/usr/bin/env python3
"""
Import area configs from areas.ts and generate Tiled map files.

Reads src/game/core/areas.ts, extracts each AreaConfig (key, name, cols, rows,
layout), generates a build_map.py config per area using the char_grid strategy,
then runs build_map.py to produce the atlas PNG + Tiled .tmj.

Run from the project root:
    python3.11 scripts/import_areas.py
    python3.11 scripts/import_areas.py --area overworld
    python3.11 scripts/import_areas.py --no-build   # write configs only

Outputs (relative to project root):
    maps/<key>.config.json          versionable config, re-run to rebuild
    public/assets/tilesets/<key>.png   stitched atlas
    public/assets/maps/<key>.tmj       Tiled map — open in Tiled to hand-edit

Default char map (override with --char-map '{"W":"my-wall",...}'):
    .  →  overworld-grass
    W  →  overworld-wall
    ~  →  overworld-water
    F  →  indoor-floor
    R  →  overworld-road
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).parent.parent
BUILD_MAP = Path(__file__).parent / "build_map.py"

# Per-layer char→tile-name maps. The same character can mean different things
# in different layers ('.' = grass on `ground`, but means "empty" everywhere
# else by virtue of being absent from those layer's char maps).
LAYER_CHAR_MAPS: dict[str, dict[str, str]] = {
    "ground": {
        ".": "overworld-grass",
        "~": "overworld-water",
        "F": "indoor-floor",
        "R": "overworld-road",
    },
    "belowPlayer": {
        "W": "overworld-wall",
        "H": "fence-horizontal",
        "V": "fence-vertical",
        "B": "house-body",
    },
    "abovePlayer": {
        "r": "house-roof",
    },
}

DEFAULT_NON_WALKABLE: set[str] = {
    "overworld-wall",
    "overworld-water",
    "fence-horizontal",
    "fence-vertical",
    "house-body",
}

# Paths written into configs — relative to the maps/ directory.
DEFAULT_TILE_DIR = "../public/assets/tiles"
DEFAULT_OUTPUT_DIR = "../public/assets"


# Recommended layer ordering. World.ts renders these at:
#   ground       depth 0      (base terrain)
#   belowPlayer  depth 0.4    (decoration on the ground; player walks over)
#   abovePlayer  depth 2      (canopies/awnings; player walks under)
# Other layer names are accepted but won't get any special treatment.
KNOWN_LAYER_ORDER: list[str] = ["ground", "belowPlayer", "abovePlayer"]


def parse_named_layouts(text: str) -> dict[str, list[str]]:
    """Parse `name: [ '...', '...', ]` entries inside a `layouts: { ... }` block."""
    layouts: dict[str, list[str]] = {}
    for m in re.finditer(r"(\w+)\s*:\s*\[(.*?)\]", text, re.DOTALL):
        name = m.group(1)
        rows = re.findall(r"['\"]([^'\"]+)['\"]", m.group(2))
        layouts[name] = rows
    return layouts


def parse_areas(ts_text: str) -> list[dict]:
    """Extract AreaConfig blocks from TypeScript source.

    Finds each `export const AREA_*: AreaConfig = { ... };` block and extracts
    key, name, cols, rows, and layouts. Supports both:
      - single-layer: `layout: ['...', '...']`  (becomes the `ground` layer)
      - multi-layer:  `layouts: { ground: [...], belowPlayer: [...], ... }`
    cols/rows are inferred from the ground layer if not explicitly set.
    """
    areas: list[dict] = []
    blocks = re.findall(
        r"export const AREA_\w+\s*:\s*AreaConfig\s*=\s*\{(.+?)\n\};",
        ts_text,
        re.DOTALL,
    )
    for block in blocks:
        area: dict = {}

        m = re.search(r"key\s*:\s*['\"]([^'\"]+)['\"]", block)
        if m:
            area["key"] = m.group(1)

        m = re.search(r"name\s*:\s*['\"]([^'\"]+)['\"]", block)
        if m:
            area["name"] = m.group(1)

        m = re.search(r"cols\s*:\s*(\d+)", block)
        if m:
            area["cols"] = int(m.group(1))

        m = re.search(r"rows\s*:\s*(\d+)", block)
        if m:
            area["rows"] = int(m.group(1))

        # Try multi-layer first; fall back to single-layer `layout`.
        layouts_m = re.search(r"layouts\s*:\s*\{(.+?)\n\s*\}", block, re.DOTALL)
        if layouts_m:
            area["layouts"] = parse_named_layouts(layouts_m.group(1))
        else:
            layout_m = re.search(r"\blayout\s*:\s*\[([^\]]+)\]", block, re.DOTALL)
            if layout_m:
                rows_list = re.findall(r"['\"]([^'\"]+)['\"]", layout_m.group(1))
                area["layouts"] = {"ground": rows_list}

        # Infer cols/rows from the ground layer if missing.
        if "layouts" in area and ("cols" not in area or "rows" not in area):
            ref = area["layouts"].get("ground") or next(iter(area["layouts"].values()), [])
            if ref:
                area.setdefault("cols", max(len(row) for row in ref))
                area.setdefault("rows", len(ref))

        if all(k in area for k in ("key", "layouts", "cols", "rows")):
            areas.append(area)

    return areas


def make_config(
    area: dict,
    layer_char_maps: dict[str, dict[str, str]],
    tile_dir: str,
    output_dir: str,
    non_walkable: set[str] | None = None,
) -> dict:
    """Build a build_map.py config dict from an extracted area."""
    layouts: dict[str, list[str]] = area["layouts"]

    # Order known layer names first (ground → belowPlayer → abovePlayer),
    # then any unknown layers in declaration order. This is the depth order.
    ordered_names = [n for n in KNOWN_LAYER_ORDER if n in layouts] + [
        n for n in layouts if n not in KNOWN_LAYER_ORDER
    ]

    layers = []
    all_active_tile_names: set[str] = set()
    for layer_name in ordered_names:
        layout = layouts[layer_name]
        char_map = layer_char_maps.get(layer_name, {})
        used_chars = set(ch for row in layout for ch in row)
        active_char_map = {ch: name for ch, name in char_map.items() if ch in used_chars}
        all_active_tile_names.update(active_char_map.values())
        layers.append({
            "name": layer_name,
            "strategy": "char_grid",
            "layout": layout,
            "char_map": active_char_map,
        })

    cfg: dict = {
        "name": area["key"],
        "tile_size": 64,
        "map_width": area["cols"],
        "map_height": area["rows"],
        "tile_dir": tile_dir,
        "output_dir": output_dir,
        "layers": layers,
    }

    nw = non_walkable if non_walkable is not None else DEFAULT_NON_WALKABLE
    nw_tiles = sorted(nw & all_active_tile_names)
    if nw_tiles:
        cfg["non_walkable_tiles"] = nw_tiles

    return cfg


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument(
        "--areas",
        default="src/game/core/areas.ts",
        help="Path to areas.ts (default: src/game/core/areas.ts)",
    )
    ap.add_argument(
        "--area",
        metavar="KEY",
        help="Only process this area key; processes all areas if omitted",
    )
    ap.add_argument(
        "--no-build",
        action="store_true",
        help="Write config files only; skip running build_map.py",
    )
    ap.add_argument(
        "--tile-dir",
        default=DEFAULT_TILE_DIR,
        help=f"Tile PNG dir, relative to maps/ (default: {DEFAULT_TILE_DIR})",
    )
    ap.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output root for atlas + tmj, relative to maps/ (default: {DEFAULT_OUTPUT_DIR})",
    )
    ap.add_argument(
        "--char-map",
        metavar="JSON",
        help=(
            'JSON object overriding the per-layer char→tile-name maps. '
            'Format: {"ground": {".": "grass"}, "belowPlayer": {"W": "wall"}}. '
            'Layers not in the override fall back to LAYER_CHAR_MAPS defaults.'
        ),
    )
    args = ap.parse_args()

    areas_path = Path(args.areas)
    if not areas_path.exists():
        print(f"ERROR: {areas_path} not found", file=sys.stderr)
        sys.exit(1)

    ts_text = areas_path.read_text(encoding="utf-8")
    areas = parse_areas(ts_text)

    if not areas:
        print("ERROR: No AreaConfig blocks found in the TypeScript file.", file=sys.stderr)
        sys.exit(1)

    if args.area:
        areas = [a for a in areas if a["key"] == args.area]
        if not areas:
            print(f"ERROR: Area key '{args.area}' not found.", file=sys.stderr)
            print(f"Available: {', '.join(a['key'] for a in parse_areas(ts_text))}", file=sys.stderr)
            sys.exit(1)

    layer_char_maps: dict[str, dict[str, str]] = {**LAYER_CHAR_MAPS}
    if args.char_map:
        for layer_name, override in json.loads(args.char_map).items():
            layer_char_maps[layer_name] = override

    maps_dir = Path("maps")
    maps_dir.mkdir(exist_ok=True)

    for area in areas:
        cfg = make_config(area, layer_char_maps, args.tile_dir, args.output_dir, DEFAULT_NON_WALKABLE)
        config_path = maps_dir / f"{area['key']}.config.json"
        config_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
        layer_names = ", ".join(cfg["layers"][i]["name"] for i in range(len(cfg["layers"])))
        print(f"Wrote {config_path}  ({area['cols']}×{area['rows']}, layers: {layer_names})")

        if args.no_build:
            continue

        print(f"  Building '{area['key']}' map...")
        result = subprocess.run(
            [sys.executable, str(BUILD_MAP), str(config_path)],
        )
        if result.returncode != 0:
            print(f"ERROR: build_map.py failed for '{area['key']}'", file=sys.stderr)
            sys.exit(1)
        print()

    if args.no_build:
        print(f"\nConfigs written. Run build_map.py on each to produce atlas + .tmj:")
        for area in areas:
            print(f"  python3.11 {BUILD_MAP} maps/{area['key']}.config.json")


if __name__ == "__main__":
    main()
