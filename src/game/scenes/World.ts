import { EventBus } from '../EventBus';
import { AreaConfig, AREA_OVERWORLD, AREAS } from '../core/areas';
import { queueTextbox } from '../ui/textbox';

export interface WorldInitData {
  config: AreaConfig;
  spawnX?: number;
  spawnY?: number;
}

const TILE = 64;


const NPC_DIALOGUE = [
  'Hello, traveller!',
  'This world is full of mysteries...',
  'Be careful out there.',
];

export class World extends Phaser.Scene {
  private areaConfig!: AreaConfig;
  private tilemap!: Phaser.Tilemaps.Tilemap;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;

  // Hero
  private heroTileX = 2;
  private heroTileY = 2;
  private heroSpawnX = 2;
  private heroSpawnY = 2;
  private heroSprite!: Phaser.GameObjects.Sprite;
  private heroFacing = { dx: 0, dy: 1 };
  private canMove = true;

  // NPC
  private npcTileX = 8;
  private npcTileY = 3;
  private npcSprite!: Phaser.GameObjects.Sprite;
  private npcFacing = { dx: 0, dy: 1 };
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
    this.stepsSinceEncounter = 0;
    // Reset state that could be stuck if scene was interrupted mid-action
    this.textboxOpen = false;
    this.canMove     = true;
    this.npcCanMove  = true;
  }

  create() {
    this.heroTileX = this.heroSpawnX;
    this.heroTileY = this.heroSpawnY;

    this.tilemap = this.make.tilemap({ key: this.areaConfig.key });
    const tileset = this.tilemap.addTilesetImage(this.areaConfig.key, `${this.areaConfig.key}-tiles`)!;
    this.groundLayer = this.tilemap.createLayer('ground', tileset, 0, 0)!;

    this.renderPortals();

    this.heroSprite = this.add
      .sprite(
        this.heroTileX * TILE + TILE / 2,
        this.heroTileY * TILE + TILE / 2,
        'hero-fighter'
      )
      .setDepth(1);

    this.createHeroAnims();
    this.heroSprite.setFrame(this.heroIdleFrame());

    this.npcSprite = this.add
      .sprite(
        this.npcTileX * TILE + TILE / 2,
        this.npcTileY * TILE + TILE / 2,
        'npc-wizard'
      )
      .setDepth(1);

    this.createNpcAnims();
    this.npcSprite.setFrame(this.npcIdleFrame());

    this.cameras.main.setBounds(0, 0, this.tilemap.widthInPixels, this.tilemap.heightInPixels);
    this.cameras.main.setZoom(3);
    this.cameras.main.startFollow(this.heroSprite, true, 0.1, 0.1);

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

  // Spritesheet layout: 4 cols × 4 rows, 48×48 px per frame (192×192 total)
  // Row 0 = down, Row 1 = left, Row 2 = right, Row 3 = up
  private static readonly FRAMES_PER_DIR = 4;

  // Spritesheet layout: row 0=up, 1=right, 2=down, 3=left
  // Col 0 & 2 = walk poses (mirrored), col 1 & 3 = standing (identical)
  private createHeroAnims() {
    const n = World.FRAMES_PER_DIR;
    const DIRS = ['up', 'right', 'down', 'left'] as const;
    DIRS.forEach((dir, row) => {
      if (!this.anims.exists(`hero-walk-${dir}`)) {
        this.anims.create({
          key: `hero-walk-${dir}`,
          frames: this.anims.generateFrameNumbers('hero-fighter', {
            frames: [row * n, row * n + 2], // cols 0 and 2 only
          }),
          frameRate: 10,
          repeat: -1,
        });
      }
    });
  }

  private heroWalkAnimKey(): string {
    const { dx, dy } = this.heroFacing;
    if (dy > 0) return 'hero-walk-down';
    if (dy < 0) return 'hero-walk-up';
    if (dx < 0) return 'hero-walk-left';
    return 'hero-walk-right';
  }

  // col 1 of each direction row is the standing pose
  private heroIdleFrame(): number {
    const n = World.FRAMES_PER_DIR;
    const { dx, dy } = this.heroFacing;
    if (dy < 0) return 0 * n + 1;  // up    — row 0, col 1
    if (dx > 0) return 1 * n + 1;  // right — row 1, col 1
    if (dy > 0) return 2 * n + 1;  // down  — row 2, col 1
    return 3 * n + 1;              // left  — row 3, col 1
  }

  private createNpcAnims() {
    const n = World.FRAMES_PER_DIR;
    const DIRS = ['up', 'right', 'down', 'left'] as const;
    DIRS.forEach((dir, row) => {
      if (!this.anims.exists(`npc-wizard-walk-${dir}`)) {
        this.anims.create({
          key: `npc-wizard-walk-${dir}`,
          frames: this.anims.generateFrameNumbers('npc-wizard', {
            frames: [row * n, row * n + 2],
          }),
          frameRate: 10,
          repeat: -1,
        });
      }
    });
  }

  private npcWalkAnimKey(): string {
    const { dx, dy } = this.npcFacing;
    if (dy > 0) return 'npc-wizard-walk-down';
    if (dy < 0) return 'npc-wizard-walk-up';
    if (dx < 0) return 'npc-wizard-walk-left';
    return 'npc-wizard-walk-right';
  }

  private npcIdleFrame(): number {
    const n = World.FRAMES_PER_DIR;
    const { dx, dy } = this.npcFacing;
    if (dy < 0) return 0 * n + 1;
    if (dx > 0) return 1 * n + 1;
    if (dy > 0) return 2 * n + 1;
    return 3 * n + 1;
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

    if (dx === 0 && dy === 0) {
      if (this.heroSprite.anims.isPlaying) {
        this.heroSprite.stop();
        this.heroSprite.setFrame(this.heroIdleFrame());
      }
      return;
    }

    // No diagonal
    if (dx !== 0 && dy !== 0) dy = 0;

    // Turn to face the new direction before walking
    if (dx !== this.heroFacing.dx || dy !== this.heroFacing.dy) {
      this.heroFacing = { dx, dy };
      this.heroSprite.stop();
      this.heroSprite.setFrame(this.heroIdleFrame());
      return;
    }

    const nx = this.heroTileX + dx;
    const ny = this.heroTileY + dy;

    if (nx === this.npcTileX && ny === this.npcTileY) return;

    if (this.isTileWalkable(nx, ny)) {
      this.heroTileX = nx;
      this.heroTileY = ny;
      this.tweens.add({
        targets: this.heroSprite,
        x: nx * TILE + TILE / 2,
        y: ny * TILE + TILE / 2,
        duration: 200,
        ease: 'Linear',
        onStart: () => {
          this.canMove = false;
          const key = this.heroWalkAnimKey();
          if (!this.heroSprite.anims.isPlaying || this.heroSprite.anims.currentAnim?.key !== key) {
            this.heroSprite.play(key);
          }
        },
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
    const dx = tx - this.npcTileX;
    const dy = ty - this.npcTileY;
    this.npcFacing = { dx, dy };
    this.npcTileX = tx;
    this.npcTileY = ty;
    this.npcCanMove = false;
    this.tweens.add({
      targets: this.npcSprite,
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE / 2,
      duration: 200,
      ease: 'Linear',
      onStart: () => {
        const key = this.npcWalkAnimKey();
        if (!this.npcSprite.anims.isPlaying || this.npcSprite.anims.currentAnim?.key !== key) {
          this.npcSprite.play(key);
        }
      },
      onComplete: () => {
        this.npcCanMove = true;
        this.npcSprite.stop();
        this.npcSprite.setFrame(this.npcIdleFrame());
      },
    });
  }

  // ─── Map helpers ───────────────────────────────────────────────────────────

  private isTileWalkable(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= this.tilemap.width || row >= this.tilemap.height) return false;
    const tile = this.groundLayer.getTileAt(col, row);
    return !tile?.properties?.impassable;
  }

  private isPortalTile(col: number, row: number): boolean {
    return !!(this.areaConfig.portals?.some(p => p.x === col && p.y === row));
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  shutdown() {
    EventBus.off('ui:textbox:active', undefined, this);
  }
}
