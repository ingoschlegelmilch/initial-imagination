import { EventBus } from '../EventBus';
import { Tile, TerrainKind } from '../core/models';
import { AreaConfig, AREA_OVERWORLD, AREAS } from '../core/areas';
import { queueTextbox } from '../ui/textbox';

export interface WorldInitData {
  config: AreaConfig;
  spawnX?: number;
  spawnY?: number;
}

const TILE = 64;

const DEFAULT_TERRAIN_COLORS: Record<TerrainKind, number> = {
  Grass: 0x4a7c2f,
  Water: 0x2255aa,
  Wall:  0x555555,
  Floor: 0x998866,
  Road:  0xaaaaaa,
};

const NPC_DIALOGUE = [
  'Hello, traveller!',
  'This world is full of mysteries...',
  'Be careful out there.',
];

export class World extends Phaser.Scene {
  private areaConfig!: AreaConfig;
  private tiles: Tile[][] = [];

  // Hero
  private heroTileX = 2;
  private heroTileY = 2;
  private heroSpawnX = 2;
  private heroSpawnY = 2;
  private heroRect!: Phaser.GameObjects.Rectangle;
  private heroFacing = { dx: 1, dy: 0 };
  private canMove = true;

  // NPC
  private npcTileX = 8;
  private npcTileY = 3;
  private npcRect!: Phaser.GameObjects.Rectangle;
  private npcCanMove = true;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyBattle!: Phaser.Input.Keyboard.Key;
  private keyInteract!: Phaser.Input.Keyboard.Key;

  // State
  private textboxOpen = false;
  private stepsSinceEncounter = 0;

  constructor() {
    super('World');
  }

  init(data: WorldInitData) {
    this.areaConfig  = data?.config ?? AREA_OVERWORLD;
    this.heroSpawnX  = data?.spawnX ?? 2;
    this.heroSpawnY  = data?.spawnY ?? 2;
    this.stepsSinceEncounter = this.areaConfig.encounterCooldown ?? 10;
    // Reset state that could be stuck if scene was interrupted mid-action
    this.textboxOpen = false;
    this.canMove     = true;
    this.npcCanMove  = true;
  }

  create() {
    const { cols, rows } = this.areaConfig;

    this.heroTileX = this.heroSpawnX;
    this.heroTileY = this.heroSpawnY;

    this.tiles = this.buildMap();
    this.renderTiles();
    this.renderPortals();

    this.heroRect = this.add
      .rectangle(
        this.heroTileX * TILE + TILE / 2,
        this.heroTileY * TILE + TILE / 2,
        TILE - 8, TILE - 8,
        0xffdd00
      )
      .setDepth(1);

    this.npcRect = this.add
      .rectangle(
        this.npcTileX * TILE + TILE / 2,
        this.npcTileY * TILE + TILE / 2,
        TILE - 8, TILE - 8,
        0x00cccc
      )
      .setDepth(1);

    this.cameras.main.setBounds(0, 0, cols * TILE, rows * TILE);
    this.cameras.main.startFollow(this.heroRect, true, 0.1, 0.1);

    this.cursors    = this.input.keyboard!.createCursorKeys();
    this.keyBattle  = this.input.keyboard!.addKey('B');
    this.keyInteract = this.input.keyboard!.addKey('E');

    EventBus.on('ui:textbox:active', (active: boolean) => { this.textboxOpen = active; }, this);

    // Reset encounter cooldown when returning from battle
    this.events.on('wake', () => {
      this.stepsSinceEncounter = 0;
    });

    this.time.addEvent({
      delay: 2000,
      callback: this.moveNPCRandomly,
      callbackScope: this,
      loop: true,
    });

    this.showAreaNamePopup();
  }

  private showAreaNamePopup() {
    const pad = 10;
    const label = this.add.text(pad + 8, pad + 6, this.areaConfig.name, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
    }).setScrollFactor(0).setDepth(20);

    const bg = this.add.rectangle(
      pad, pad,
      label.width + 16, label.height + 12,
      0x000000, 0.65
    ).setOrigin(0, 0).setScrollFactor(0).setDepth(19);

    // Fade out over 0.5s starting at 2.5s
    this.time.delayedCall(2500, () => {
      this.tweens.add({
        targets: [bg, label],
        alpha: 0,
        duration: 500,
        onComplete: () => { bg.destroy(); label.destroy(); },
      });
    });
  }

  update() {
    if (this.textboxOpen) return;

    if (Phaser.Input.Keyboard.JustDown(this.keyBattle)) {
      EventBus.emit('request-battle');
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyInteract)) {
      this.tryInteract();
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

    // No diagonal
    if (dx !== 0 && dy !== 0) dy = 0;

    this.heroFacing = { dx, dy };

    const nx = this.heroTileX + dx;
    const ny = this.heroTileY + dy;

    if (nx === this.npcTileX && ny === this.npcTileY) return;

    if (this.isTileWalkable(nx, ny)) {
      this.heroTileX = nx;
      this.heroTileY = ny;
      this.tweens.add({
        targets: this.heroRect,
        x: nx * TILE + TILE / 2,
        y: ny * TILE + TILE / 2,
        duration: 100,
        ease: 'Linear',
        onStart:    () => { this.canMove = false; },
        onComplete: () => {
          this.canMove = true;
          this.onStepTaken();
        },
      });
    }
  }

  // ─── Encounters & portals ──────────────────────────────────────────────────

  private onStepTaken() {
    this.checkPortal();

    if (!this.areaConfig.allowBattles) return;
    this.stepsSinceEncounter++;
    const cooldown = this.areaConfig.encounterCooldown ?? 10;
    if (this.stepsSinceEncounter < cooldown) return;
    if (Math.random() < (this.areaConfig.encounterRate ?? 0.05)) {
      this.stepsSinceEncounter = 0;
      EventBus.emit('request-battle');
    }
  }

  private checkPortal() {
    const portal = this.areaConfig.portals?.find(
      p => p.x === this.heroTileX && p.y === this.heroTileY
    );
    if (!portal) return;

    const destination = AREAS[portal.destinationKey];
    if (!destination) return;

    this.scene.start('World', {
      config: destination,
      spawnX: portal.spawnX,
      spawnY: portal.spawnY,
    } satisfies WorldInitData);
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  private renderPortals() {
    for (const portal of this.areaConfig.portals ?? []) {
      this.add.rectangle(
        portal.x * TILE + TILE / 2,
        portal.y * TILE + TILE / 2,
        TILE - 1, TILE - 1,
        0xcc88ff
      ).setDepth(0.5);
    }
  }

  // ─── Interaction ───────────────────────────────────────────────────────────

  private tryInteract() {
    const tx = this.heroTileX + this.heroFacing.dx;
    const ty = this.heroTileY + this.heroFacing.dy;
    if (tx === this.npcTileX && ty === this.npcTileY) {
      queueTextbox({ text: NPC_DIALOGUE, speaker: 'Villager', mode: 'dialogue' });
    }
  }

  // ─── NPC movement ──────────────────────────────────────────────────────────

  private moveNPCRandomly() {
    if (!this.npcCanMove || this.textboxOpen) return;

    const dirs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 0, dy: 0 }, { dx: 0, dy: 0 },
    ];
    const dir = Phaser.Utils.Array.GetRandom(dirs);
    if (dir.dx === 0 && dir.dy === 0) return;

    const nx = this.npcTileX + dir.dx;
    const ny = this.npcTileY + dir.dy;
    if (!this.isTileWalkable(nx, ny)) return;
    if (nx === this.heroTileX && ny === this.heroTileY) return;
    if (this.isPortalTile(nx, ny)) return;

    this.moveNPCToTile(nx, ny);
  }

  private moveNPCToTile(tx: number, ty: number) {
    this.npcTileX = tx;
    this.npcTileY = ty;
    this.npcCanMove = false;
    this.tweens.add({
      targets: this.npcRect,
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE / 2,
      duration: 200,
      ease: 'Linear',
      onComplete: () => { this.npcCanMove = true; },
    });
  }

  // ─── Map helpers ───────────────────────────────────────────────────────────

  private buildMap(): Tile[][] {
    const { layout, cols, rows } = this.areaConfig;
    const grid: Tile[][] = [];
    for (let row = 0; row < rows; row++) {
      grid[row] = [];
      for (let col = 0; col < cols; col++) {
        const ch = layout[row]?.[col] ?? '.';
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
    const { cols, rows, terrainColors } = this.areaConfig;
    const colors = { ...DEFAULT_TERRAIN_COLORS, ...terrainColors };
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tile = this.tiles[row][col];
        this.add.rectangle(
          col * TILE + TILE / 2,
          row * TILE + TILE / 2,
          TILE - 1, TILE - 1,
          colors[tile.terrain]
        );
      }
    }
  }

  private isTileWalkable(col: number, row: number): boolean {
    const { cols, rows } = this.areaConfig;
    if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
    return this.tiles[row][col].walkable;
  }

  private isPortalTile(col: number, row: number): boolean {
    return !!(this.areaConfig.portals?.some(p => p.x === col && p.y === row));
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  shutdown() {
    EventBus.off('ui:textbox:active', undefined, this);
  }
}

function charToTerrain(ch: string): TerrainKind {
  switch (ch) {
    case 'W': return TerrainKind.Wall;
    case '~': return TerrainKind.Water;
    case 'F': return TerrainKind.Floor;
    case 'R': return TerrainKind.Road;
    default:  return TerrainKind.Grass;
  }
}
