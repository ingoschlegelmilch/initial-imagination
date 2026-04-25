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
  allowBattles: boolean;
  encounterRate?: number;    // chance per step (0–1), only used if allowBattles
  encounterCooldown?: number; // min steps between encounters (default 10)
  portals?: PortalConfig[];
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
};

export const AREA_TOWN: AreaConfig = {
  key: 'town-millhaven',
  name: 'Millhaven',
  allowBattles: false,
  portals: [
    { x: 10, y: 10, destinationKey: 'overworld', spawnX: 10, spawnY: 2 },
  ],
};

export const AREA_DUNGEON: AreaConfig = {
  key: 'dungeon-1',
  name: 'Cave of Echoes',
  allowBattles: true,
  encounterRate: 0.1,
  encounterCooldown: 6,
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const AREAS: Record<string, AreaConfig> = {
  [AREA_OVERWORLD.key]: AREA_OVERWORLD,
  [AREA_FOREST.key]:    AREA_FOREST,
  [AREA_TOWN.key]:      AREA_TOWN,
  [AREA_DUNGEON.key]:   AREA_DUNGEON,
};
