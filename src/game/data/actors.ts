import type { ActorTemplate } from '../core/models';

export const HeroWarriorTemplate: ActorTemplate = {
  id: 'hero-warrior',
  kind: 'Hero',
  name: 'Hero',
  baseStats: { hpMax: 30, mpMax: 10, atk: 8, def: 4, mag: 2, res: 2, spd: 6, luk: 3 },
  growthPerLevel: { hpMax: 2, atk: 1, def: 1 },
};

export const SlimeTemplate: ActorTemplate = {
  id: 'slime',
  kind: 'Enemy',
  name: 'Slime',
  baseStats: { hpMax: 20, mpMax: 0, atk: 4, def: 2, mag: 0, res: 1, spd: 3, luk: 1 },
  growthPerLevel: {},
  xpReward: 5,
  aiTag: 'basic',
};
