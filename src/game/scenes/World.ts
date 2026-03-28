import { EventBus } from '../EventBus';
import { Tile, TerrainKind } from '../core/models';

const TILE = 64;
const COLS = 20;
const ROWS = 12;

// Simple hardcoded map — W = wall, ~ = water, everything else = grass
const MAP_LAYOUT: string[] = [
  'WWWWWWWWWWWWWWWWWWWW',
  'W..................W',
  'W....W.....W.......W',
  'W....W.....W.......W',
  'W..............~~~~W',
  'W..............~~~~W',
  'W....W.............W',
  'W....W.............W',
  'W..................W',
  'W..................W',
  'W..................W',
  'WWWWWWWWWWWWWWWWWWWW',
];

const TERRAIN_COLORS: Record<TerrainKind, number> = {
  Grass: 0x4a7c2f,
  Water: 0x2255aa,
  Wall:  0x555555,
  Floor: 0x998866,
  Road:  0xaaaaaa,
};

export class World extends Phaser.Scene {
  private tiles: Tile[][] = [];
  private heroTileX = 2;
  private heroTileY = 2;
  private heroRect!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyBattle!: Phaser.Input.Keyboard.Key;
  private canMove = true;

  constructor() {
    super('World');
  }

  create() {
    this.tiles = this.buildMap();
    this.renderTiles();

    // Hero placeholder (yellow rectangle)
    this.heroRect = this.add
      .rectangle(
        this.heroTileX * TILE + TILE / 2,
        this.heroTileY * TILE + TILE / 2,
        TILE - 8,
        TILE - 8,
        0xffdd00
      )
      .setDepth(1);

    // Camera follows the hero, bounded to the world
    this.cameras.main.setBounds(0, 0, COLS * TILE, ROWS * TILE);
    this.cameras.main.startFollow(this.heroRect, true, 0.1, 0.1);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyBattle = this.input.keyboard!.addKey('B');
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.keyBattle)) {
      EventBus.emit('request-battle');
      return;
    }

    if (!this.canMove) return;

    let dx = 0;
    let dy = 0;

    if (this.cursors.left!.isDown)  dx = -1;
    if (this.cursors.right!.isDown) dx =  1;
    if (this.cursors.up!.isDown)    dy = -1;
    if (this.cursors.down!.isDown)  dy =  1;

    if (dx === 0 && dy === 0) return;

    const nx = this.heroTileX + dx;
    const ny = this.heroTileY + dy;

    if (this.isTileWalkable(nx, ny)) {
      this.heroTileX = nx;
      this.heroTileY = ny;
      this.tweens.add({
        targets: this.heroRect,
        x: nx * TILE + TILE / 2,
        y: ny * TILE + TILE / 2,
        duration: 100,
        ease: 'Linear',
        onStart: () => { this.canMove = false; },
        onComplete: () => { this.canMove = true; },
      });
    }
  }

  private buildMap(): Tile[][] {
    const grid: Tile[][] = [];
    for (let row = 0; row < ROWS; row++) {
      grid[row] = [];
      for (let col = 0; col < COLS; col++) {
        const ch = MAP_LAYOUT[row]?.[col] ?? '.';
        const terrain = charToTerrain(ch);
        grid[row][col] = {
          x: col,
          y: row,
          terrain,
          walkable: terrain !== TerrainKind.Wall && terrain !== TerrainKind.Water,
        };
      }
    }
    return grid;
  }

  private renderTiles() {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tile = this.tiles[row][col];
        const color = TERRAIN_COLORS[tile.terrain];
        this.add.rectangle(
          col * TILE + TILE / 2,
          row * TILE + TILE / 2,
          TILE - 1,
          TILE - 1,
          color
        );
      }
    }
  }

  private isTileWalkable(col: number, row: number): boolean {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    return this.tiles[row][col].walkable;
  }
}

function charToTerrain(ch: string): TerrainKind {
  switch (ch) {
    case 'W': return TerrainKind.Wall;
    case '~': return TerrainKind.Water;
    default:  return TerrainKind.Grass;
  }
}
