// -----------------------------
// Actor core data structures
// -----------------------------

export const ActorKind = {
  Hero: 'Hero',
  Enemy: 'Enemy',
  NPC: 'NPC',
} as const;

export type ActorKind = typeof ActorKind[keyof typeof ActorKind];

export const EquipmentSlot = {
  Weapon: 'Weapon',
  Shield: 'Shield',
  Head: 'Head',
  Body: 'Body',
  Accessory: 'Accessory',
} as const;
export type EquipmentSlot = typeof EquipmentSlot[keyof typeof EquipmentSlot];

export const Element = {
  Neutral: 'Neutral',
  Fire: 'Fire',
  Ice: 'Ice',
  Lightning: 'Lightning',
  Earth: 'Earth',
  Wind: 'Wind',
  Water: 'Water',
  Light: 'Light',
  Dark: 'Dark',
} as const;
export type Element = typeof Element[keyof typeof Element];

// Simple primary stats for an 8-bit style RPG
export type Stats = {
  hpMax: number;
  mpMax: number;
  atk: number; // physical attack
  def: number; // physical defense
  mag: number; // magic power
  res: number; // magic resist
  spd: number; // turn order / initiative
  luk: number; // crit/escape/loot tweaks
};

// Element multipliers: 1 = normal, >1 weak, <1 resist, 0 immune, <0 absorb
export type ElementMultipliers = Partial<Record<Element, number>>;

// Chance to resist status by id (0..1). Example: { "poison": 0.5 }
export type StatusResistances = Record<string, number>;

// Immutable blueprint stored in your content DB
export interface ActorTemplate {
  id: string;               // e.g. "slime" or "hero-warrior"
  kind: ActorKind;
  name: string;             // display name for default instances
  baseStats: Stats;         // level 1 (or base) stats
  growthPerLevel?: Partial<Stats>; // optional linear growth
  elementMods?: ElementMultipliers;
  statusResist?: Partial<StatusResistances>;
  learnset?: Array<{ level: number; skillId: string }>;
  // art/sfx references (kept engine-agnostic)
  visuals?: {
    atlas?: string;
    spriteKey?: string;
    portraitKey?: string;
  };
  drops?: Array<{ itemId: string; chance: number }>; // enemies only
  aiTag?: string; // enemies: key for your AI tables, e.g. "aggressive"
}

// A concrete actor that can be saved/loaded (party member or enemy spawn)
export interface ActorInstance {
  uid: string;              // unique per save/run, e.g. "hero#1" or UUID
  templateId: string;       // references ActorTemplate.id
  name?: string;            // optional nickname override
  level: number;
  exp: number;

  // Current vital values (max values come from stats + gear)
  hp: number;
  mp: number;

  // Persistent progression flags
  learnedSkills: string[];

  // Equipped items by slot (item ids)
  equipment: Partial<Record<EquipmentSlot, string>>;

  // Optional per-instance tweaks (e.g., quest NPCs, bosses)
  tags?: string[]; // e.g., ["boss", "undead"]
}

// Optional: a lightweight read model you might derive at runtime
// (not saved) combining template + instance + gear bonuses.
export interface ActorComputed {
  uid: string;
  templateId: string;
  name: string;
  level: number;
  statsTotal: Stats;                // base + growth + gear
  elementModsTotal: ElementMultipliers;
  statusResistTotal: Partial<StatusResistances>;
}

// -----------------------------
// Tile / map data structures
// -----------------------------

export const TerrainKind = {
  Grass: 'Grass',
  Water: 'Water',
  Wall: 'Wall',
  Floor: 'Floor',
  Road: 'Road',
} as const;
export type TerrainKind = typeof TerrainKind[keyof typeof TerrainKind];

export interface Tile {
  x: number;           // grid column
  y: number;           // grid row
  terrain: TerrainKind;
  walkable: boolean;
  spriteKey?: string;  // optional override for rendering
}
