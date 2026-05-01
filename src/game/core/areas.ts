export interface PortalConfig {
  x: number;              // tile column in this area
  y: number;              // tile row in this area
  destinationKey: string; // key of the destination AreaConfig
  spawnX: number;         // where the hero appears in the destination
  spawnY: number;
}

export interface AreaLayouts {
  ground: string[];
  belowPlayer?: string[];
  abovePlayer?: string[];
}

export interface AreaConfig {
  key: string;
  name: string;
  allowBattles: boolean;
  encounterRate?: number;    // chance per step (0–1), only used if allowBattles
  encounterCooldown?: number; // min steps between encounters (default 10)
  portals?: PortalConfig[];
  // Layout source for re-running scripts/import_areas.py.
  // Not used at runtime — .tmj files are the canonical map source after import.
  cols?: number;
  rows?: number;
  layouts?: AreaLayouts;
}

// ─── Maps ─────────────────────────────────────────────────────────────────────

export const AREA_OVERWORLD: AreaConfig = {
  key: 'overworld',
  name: 'Overworld',
  allowBattles: true,
  encounterRate: 0.05,
  encounterCooldown: 10,
  portals: [
    { x: 18, y: 8, destinationKey: 'forest-1',     spawnX: 2,  spawnY: 8 },
    { x: 10, y: 1, destinationKey: 'town-millhaven', spawnX: 10, spawnY: 10 },
  ],
  cols: 20,
  rows: 12,
  layouts: {
    ground: [
      '....................',
      '....................',
      '....................',
      '....................',
      '...............~~~~.',
      '...............~~~~.',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
    ],
    belowPlayer: [
      'WWWWWWWWWWWWWWWWWWWW',
      'W..................W',
      'W....W.....W.......W',
      'W....W.....W.......W',
      'W..................W',
      'W..................W',
      'W....W.............W',
      'W....W.............W',
      'W..................W',
      'W..................W',
      'W..................W',
      'WWWWWWWWWWWWWWWWWWWW',
    ],
  },
};

export const AREA_FOREST: AreaConfig = {
  key: 'forest-1',
  name: 'Whisperwood',
  allowBattles: true,
  encounterRate: 0.07,
  encounterCooldown: 8,
  portals: [
    { x: 1, y: 9, destinationKey: 'overworld', spawnX: 17, spawnY: 8 },
  ],
  cols: 20,
  rows: 12,
  layouts: {
    ground: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '...........~~~~.....',
      '...........~~~~.....',
      '....................',
      '....................',
      '....................',
      '....................',
    ],
    belowPlayer: [
      'WWWWWWWWWWWWWWWWWWWW',
      'W..W...W..W.......WW',
      'WW.....WWW....W....W',
      'W..WW..........WW..W',
      'W.....WWWW.....W...W',
      'WW....W....W.......W',
      'W.....W............W',
      'WW....WWWW.........W',
      'W..................W',
      'W..W...W....W......W',
      'WW..........W......W',
      'WWWWWWWWWWWWWWWWWWWW',
    ],
  },
};

export const AREA_TOWN: AreaConfig = {
  key: 'town-millhaven',
  name: 'Millhaven',
  allowBattles: false,
  portals: [
    { x: 10, y: 10, destinationKey: 'overworld', spawnX: 10, spawnY: 2 },
  ],
  cols: 20,
  rows: 12,
  layouts: {
    ground: [
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '.....RRRRRRRR.......',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
    ],
    belowPlayer: [
      'WWWWWWWWWWWWWWWWWWWW',
      'W...WWWW...WWWW....W',
      'W...W..W...W..W....W',
      'W...WWWW...WWWW....W',
      'W..................W',
      'W................B.W',
      'W...........HHHHHH.W',
      'W..WWWWWW...V....V.W',
      'W..W....W...V....V.W',
      'W..W....W...V....V.W',
      'W..WWWWWW...HHHHHH.W',
      'WWWWWWWWWWWWWWWWWWWW',
    ],
    abovePlayer: [
      '....................',
      '....................',
      '....................',
      '....................',
      '.................r..',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
    ],
  },
};

export const AREA_DUNGEON: AreaConfig = {
  key: 'dungeon-1',
  name: 'Cave of Echoes',
  allowBattles: true,
  encounterRate: 0.1,
  encounterCooldown: 6,
  cols: 20,
  rows: 12,
  layouts: {
    ground: [
      '....................',
      '.F.F................',
      '....................',
      '....................',
      '....................',
      '..........~~~~~.....',
      '..........~~~~~.....',
      '....................',
      '....................',
      '....................',
      '....................',
      '....................',
    ],
    belowPlayer: [
      'WWWWWWWWWWWWWWWWWWWW',
      'W...WWWWWWWWWWWWWWWW',
      'W...WWWWWW.........W',
      'W...W....W.........W',
      'W...W....WWWWWWW...W',
      'W........W.....W...W',
      'WWWWWW...W.....W...W',
      'W....W...WWWWWWW...W',
      'W....W.............W',
      'W....WWWWWW........W',
      'W..................W',
      'WWWWWWWWWWWWWWWWWWWW',
    ],
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const AREAS: Record<string, AreaConfig> = {
  [AREA_OVERWORLD.key]: AREA_OVERWORLD,
  [AREA_FOREST.key]:    AREA_FOREST,
  [AREA_TOWN.key]:      AREA_TOWN,
  [AREA_DUNGEON.key]:   AREA_DUNGEON,
};
