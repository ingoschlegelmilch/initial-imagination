#!/usr/bin/env python3
"""
Build a Tiled tilemap from individual tile PNGs.

Reads a map config JSON, stitches the referenced tiles into a tileset atlas,
and emits:
  - tilesets/<name>.png       (atlas PNG)
  - maps/<name>.tmj           (Tiled JSON map)
  - maps/<name>.loader.js     (Phaser 3 loader snippet)

Usage:
    python build_map.py <config.json>

Config schema: see references/map-config-schema.md
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow is required. Install with:", file=sys.stderr)
    print("  pip install Pillow --break-system-packages", file=sys.stderr)
    sys.exit(1)


def build_tileset(tile_paths: list[Path], out_path: Path, tile_size: int) -> dict:
    """Stitch tiles into a single atlas PNG. Returns metadata + name→gid map.

    Tiles are placed in a roughly-square grid, row-major, alphabetical by name.
    Tiled uses 1-based gids (0 = no tile), so ids start at 1.
    """
    n = len(tile_paths)
    if n == 0:
        raise ValueError("No tiles to stitch.")

    columns = max(1, math.ceil(math.sqrt(n)))
    rows = math.ceil(n / columns)

    atlas = Image.new(
        "RGBA", (columns * tile_size, rows * tile_size), (0, 0, 0, 0)
    )
    name_to_gid: dict[str, int] = {}

    for i, p in enumerate(tile_paths):
        tile = Image.open(p).convert("RGBA")
        if tile.size != (tile_size, tile_size):
            tile = tile.resize((tile_size, tile_size), Image.NEAREST)
        col = i % columns
        row = i // columns
        atlas.paste(tile, (col * tile_size, row * tile_size))
        name_to_gid[p.stem] = i + 1

    out_path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(out_path)

    return {
        "columns": columns,
        "rows": rows,
        "tilecount": n,
        "imagewidth": columns * tile_size,
        "imageheight": rows * tile_size,
        "name_to_gid": name_to_gid,
    }


def parse_grid_file(
    path: Path, map_w: int, map_h: int, name_to_gid: dict
) -> list[int]:
    """Parse a whitespace-separated text grid of tile names into a flat
    row-major array of Tiled gids. '.' or unknown → 0 (empty).
    """
    text = path.read_text(encoding="utf-8")
    rows = [row.split() for row in text.splitlines() if row.strip()]
    flat: list[int] = []
    for r in range(map_h):
        for c in range(map_w):
            if r < len(rows) and c < len(rows[r]):
                name = rows[r][c]
                flat.append(0 if name in (".", "") else name_to_gid.get(name, 0))
            else:
                flat.append(0)
    return flat


def weighted_random_fill(
    weights: dict, map_w: int, map_h: int, name_to_gid: dict, rng: random.Random
) -> list[int]:
    """Fill a map with tiles sampled from a weighted distribution."""
    if not weights:
        return [0] * (map_w * map_h)
    names = list(weights.keys())
    wts = [weights[n] for n in names]
    flat: list[int] = []
    for _ in range(map_w * map_h):
        name = rng.choices(names, weights=wts, k=1)[0]
        flat.append(name_to_gid.get(name, 0))
    return flat


def build_layer(
    layer_cfg: dict,
    map_w: int,
    map_h: int,
    name_to_gid: dict,
    rng: random.Random,
    cfg_dir: Path,
    layer_id: int,
) -> dict:
    strategy = layer_cfg.get("strategy", "random")
    if strategy == "random":
        data = weighted_random_fill(
            layer_cfg.get("weights", {}), map_w, map_h, name_to_gid, rng
        )
    elif strategy == "manual":
        grid_file = cfg_dir / layer_cfg["grid_file"]
        data = parse_grid_file(grid_file, map_w, map_h, name_to_gid)
    elif strategy == "char_grid":
        layout = layer_cfg.get("layout", [])
        char_map = layer_cfg.get("char_map", {})
        data = []
        for r in range(map_h):
            row_str = layout[r] if r < len(layout) else ""
            for c in range(map_w):
                ch = row_str[c] if c < len(row_str) else "."
                tile_name = char_map.get(ch)
                data.append(name_to_gid.get(tile_name, 0) if tile_name else 0)
    elif strategy == "empty":
        data = [0] * (map_w * map_h)
    else:
        raise ValueError(f"Unknown layer strategy: {strategy}")
    return {
        "data": data,
        "height": map_h,
        "width": map_w,
        "id": layer_id,
        "name": layer_cfg["name"],
        "opacity": 1,
        "type": "tilelayer",
        "visible": True,
        "x": 0,
        "y": 0,
    }


def build_tmj(
    cfg: dict, tileset_meta: dict, tileset_image_path: str, cfg_dir: Path
) -> dict:
    tile_size = cfg["tile_size"]
    map_w = cfg["map_width"]
    map_h = cfg["map_height"]
    rng = random.Random(cfg.get("seed"))

    layers = []
    for i, layer_cfg in enumerate(cfg["layers"]):
        layers.append(
            build_layer(
                layer_cfg,
                map_w,
                map_h,
                tileset_meta["name_to_gid"],
                rng,
                cfg_dir,
                i + 1,
            )
        )

    # Build per-tile properties for non-walkable tiles (impassable: true).
    non_walkable = set(cfg.get("non_walkable_tiles") or [])
    tile_props = [
        {
            "id": gid - 1,  # 0-indexed within tileset
            "properties": [{"name": "impassable", "type": "bool", "value": True}],
        }
        for name, gid in sorted(tileset_meta["name_to_gid"].items(), key=lambda kv: kv[1])
        if name in non_walkable
    ]

    tileset_entry: dict = {
        "firstgid": 1,
        "name": cfg["name"],
        "image": tileset_image_path,
        "imagewidth": tileset_meta["imagewidth"],
        "imageheight": tileset_meta["imageheight"],
        "tilewidth": tile_size,
        "tileheight": tile_size,
        "columns": tileset_meta["columns"],
        "tilecount": tileset_meta["tilecount"],
        "spacing": 0,
        "margin": 0,
    }
    if tile_props:
        tileset_entry["tiles"] = tile_props

    return {
        "compressionlevel": -1,
        "height": map_h,
        "width": map_w,
        "tilewidth": tile_size,
        "tileheight": tile_size,
        "infinite": False,
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "tiledversion": "1.11.0",
        "type": "map",
        "version": "1.10",
        "nextlayerid": len(layers) + 1,
        "nextobjectid": 1,
        "layers": layers,
        "tilesets": [tileset_entry],
    }


def build_loader_snippet(cfg: dict, tmj_filename: str, atlas_rel_path: str) -> str:
    """Emit a Phaser 3 preload/create snippet. Paths are relative to tmj dir."""
    name = cfg["name"]
    layer_names = [l["name"] for l in cfg["layers"]]
    create_lines = "\n".join(
        f"    const {_safe_ident(ln)}Layer = map.createLayer('{ln}', tileset, 0, 0);"
        for ln in layer_names
    )
    note = (
        "// Paths below are relative to the tmj file's location.\n"
        "// Adjust them to be relative to your Phaser web root before shipping.\n"
    )
    return (
        f"// Phaser 3 loader snippet for the '{name}' map.\n"
        f"// Drop the preload() and create() bodies into your scene.\n"
        f"{note}\n"
        f"function preload() {{\n"
        f"    this.load.image('{name}_tiles', '{atlas_rel_path}');\n"
        f"    this.load.tilemapTiledJSON('{name}', '{tmj_filename}');\n"
        f"}}\n\n"
        f"function create() {{\n"
        f"    const map = this.make.tilemap({{ key: '{name}' }});\n"
        f"    const tileset = map.addTilesetImage('{name}', '{name}_tiles');\n\n"
        f"{create_lines}\n"
        f"}}\n"
    )


def _safe_ident(s: str) -> str:
    """Turn a layer name into a valid JS identifier."""
    out = "".join(c if c.isalnum() else "_" for c in s)
    if out and out[0].isdigit():
        out = "_" + out
    return out or "layer"


def collect_referenced_tiles(cfg: dict, cfg_dir: Path) -> set[str]:
    """Walk the config and collect every tile name referenced in any layer."""
    referenced: set[str] = set()
    for layer in cfg["layers"]:
        strategy = layer.get("strategy", "random")
        if strategy == "random":
            referenced.update(layer.get("weights", {}).keys())
        elif strategy == "manual":
            grid_file = cfg_dir / layer["grid_file"]
            text = grid_file.read_text(encoding="utf-8")
            for tok in text.split():
                if tok != ".":
                    referenced.add(tok)
        elif strategy == "char_grid":
            referenced.update(v for v in layer.get("char_map", {}).values() if v)
    return referenced


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("config", help="Path to the map config JSON")
    args = ap.parse_args()

    cfg_path = Path(args.config).resolve()
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))

    cfg_dir = cfg_path.parent
    tile_dir = (cfg_dir / cfg.get("tile_dir", "assets/tiles")).resolve()
    output_dir = (cfg_dir / cfg.get("output_dir", ".")).resolve()

    referenced = collect_referenced_tiles(cfg, cfg_dir)
    if not referenced:
        print("ERROR: No tiles referenced in any layer.", file=sys.stderr)
        sys.exit(1)

    tile_paths: list[Path] = []
    missing: list[str] = []
    ambiguous: list[str] = []
    for name in sorted(referenced):
        # Search recursively so tiles can be organized into subfolders by
        # layer (e.g. tiles/ground/, tiles/belowPlayer/, tiles/abovePlayer/).
        matches = sorted(tile_dir.rglob(f"{name}.png"))
        if len(matches) == 1:
            tile_paths.append(matches[0])
        elif len(matches) > 1:
            ambiguous.append(f"{name} → {[str(m.relative_to(tile_dir)) for m in matches]}")
        else:
            missing.append(name)

    if missing:
        print(f"ERROR: Missing tile PNGs: {', '.join(missing)}", file=sys.stderr)
        print(f"       Searched recursively in: {tile_dir}", file=sys.stderr)
        sys.exit(1)
    if ambiguous:
        print("ERROR: Multiple matches for tile name(s):", file=sys.stderr)
        for line in ambiguous:
            print(f"  {line}", file=sys.stderr)
        sys.exit(1)

    atlas_path = output_dir / "tilesets" / f"{cfg['name']}.png"
    tileset_meta = build_tileset(tile_paths, atlas_path, cfg["tile_size"])

    tmj_path = output_dir / "maps" / f"{cfg['name']}.tmj"
    tmj_path.parent.mkdir(parents=True, exist_ok=True)
    rel_atlas = os.path.relpath(atlas_path, tmj_path.parent)
    tmj = build_tmj(cfg, tileset_meta, rel_atlas, cfg_dir)
    tmj_path.write_text(json.dumps(tmj, indent=2), encoding="utf-8")

    loader_path = output_dir / "maps" / f"{cfg['name']}.loader.js"
    loader_path.write_text(
        build_loader_snippet(cfg, tmj_path.name, rel_atlas), encoding="utf-8"
    )

    print(
        f"Built map '{cfg['name']}' "
        f"({cfg['map_width']}x{cfg['map_height']} tiles, {cfg['tile_size']}px):"
    )
    print(f"  Atlas:  {atlas_path}  ({tileset_meta['tilecount']} tiles)")
    print(f"  Map:    {tmj_path}")
    print(f"  Loader: {loader_path}")
    print()
    print(f"Open {tmj_path} in Tiled (mapeditor.org) to hand-edit the layout.")


if __name__ == "__main__":
    main()
