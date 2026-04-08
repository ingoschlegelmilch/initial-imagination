import { TerrainKind } from './models';

export interface PortalConfig {
  x: number;              // tile column in this area
  y: number;              // tile row in this area
  destinationKey: string; // key of the destination AreaConfig
  spawnX: number;         // where the hero appears in the destination
  spawnY: number;
}

export interface AreaConfig {
  key: string;
  name: string;
  layout: string[];
  cols: number;
  rows: number;
  allowBattles: boolean;
  encounterRate?: number;    // chance per step (0–1), only used if allowBattles
  encounterCooldown?: number; // min steps between encounters (default 10)
  terrainColors?: Partial<Record<TerrainKind, number>>;
  portals?: PortalConfig[];
}

// ─── Maps ─────────────────────────────────────────────────────────────────────

export const AREA_OVERWORLD: AreaConfig = {
  key: 'overworld',
  name: 'Overworld',
  cols: 20,
  rows: 12,
  allowBattles: true,
  encounterRate: 0.05,
  encounterCooldown: 10,
  layout: [
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
  ],
  portals: [
    { x: 18, y: 8, destinationKey: 'forest-1', spawnX: 2, spawnY: 8 },
  ],
};

export const AREA_FOREST: AreaConfig = {
  key: 'forest-1',
  name: 'Whisperwood',
  cols: 20,
  rows: 12,
  allowBattles: true,
  encounterRate: 0.07,
  encounterCooldown: 8,
  terrainColors: {
    Grass: 0x2d5a1b,
    Wall:  0x1a3d0a,
    Water: 0x1a4455,
  },
  layout: [
    'WWWWWWWWWWWWWWWWWWWW',
    'W..W...W..W.......WW',
    'WW.....WWW....W....W',
    'W..WW..........WW..W',
    'W.....WWWW.....W...W',
    'WW....W....W.......W',
    'W.....W....~~~~....W',
    'WW....WWWW.~~~~....W',
    'W..................W',
    'W..W...W....W......W',
    'WW..........W......W',
    'WWWWWWWWWWWWWWWWWWWW',
  ],
  portals: [
    { x: 1, y: 9, destinationKey: 'overworld', spawnX: 17, spawnY: 8 },
  ],
};

export const AREA_TOWN: AreaConfig = {
  key: 'town-millhaven',
  name: 'Millhaven',
  cols: 20,
  rows: 12,
  allowBattles: false,
  terrainColors: {
    Grass: 0x7aab50,
    Floor: 0xc8b88a,
  },
  layout: [
    'WWWWWWWWWWWWWWWWWWWW',
    'W...WWWW...WWWW....W',
    'W...W..W...W..W....W',
    'W...WWWW...WWWW....W',
    'W..................W',
    'W....RRRRRRRR......W',
    'W..................W',
    'W..WWWWWW..........W',
    'W..W....W..........W',
    'W..W....W..........W',
    'W..WWWWWW..........W',
    'WWWWWWWWWWWWWWWWWWWW',
  ],
};

export const AREA_DUNGEON: AreaConfig = {
  key: 'dungeon-1',
  name: 'Cave of Echoes',
  cols: 20,
  rows: 12,
  allowBattles: true,
  encounterRate: 0.1,
  encounterCooldown: 6,
  terrainColors: {
    Grass: 0x222222,
    Floor: 0x3a3030,
    Wall:  0x1a1a1a,
    Water: 0x001133,
  },
  layout: [
    'WWWWWWWWWWWWWWWWWWWW',
    'WF.FWWWWWWWWWWWWWWWW',
    'W...WWWWWW.........W',
    'W...W....W.........W',
    'W...W....WWWWWWW...W',
    'W........W~~~~~W...W',
    'WWWWWW...W~~~~~W...W',
    'W....W...WWWWWWW...W',
    'W....W.............W',
    'W....WWWWWW........W',
    'W..................W',
    'WWWWWWWWWWWWWWWWWWWW',
  ],
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const AREAS: Record<string, AreaConfig> = {
  [AREA_OVERWORLD.key]: AREA_OVERWORLD,
  [AREA_FOREST.key]:    AREA_FOREST,
  [AREA_TOWN.key]:      AREA_TOWN,
  [AREA_DUNGEON.key]:   AREA_DUNGEON,
};
