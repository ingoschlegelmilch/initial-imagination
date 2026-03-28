import type { ActorComputed, Stats } from './models';

// -----------------------------
// Battle state
// -----------------------------

export type ActionKind = 'attack' | 'skill' | 'item' | 'defend' | 'flee';

export interface BattleAction {
  kind: ActionKind;
  actorUid: string;
  targetUid?: string;
  skillId?: string;
  itemId?: string;
}

export interface BattleCombatant {
  actor: ActorComputed;
  hp: number;
  mp: number;
  isDefending: boolean;
  statusEffects: StatusEffect[];
}

export interface StatusEffect {
  id: string;          // e.g. "poison", "burn", "sleep"
  remainingTurns: number;
  value?: number;      // magnitude (e.g. damage per turn)
}

export interface BattleState {
  combatants: BattleCombatant[];
  turnOrder: string[];  // uids in initiative order
  currentTurnIndex: number;
  round: number;
  log: string[];
}

// -----------------------------
// Initialisation
// -----------------------------

export function createBattleState(actors: ActorComputed[]): BattleState {
  const combatants: BattleCombatant[] = actors.map(actor => ({
    actor,
    hp: actor.statsTotal.hpMax,
    mp: actor.statsTotal.mpMax,
    isDefending: false,
    statusEffects: [],
  }));

  const turnOrder = buildTurnOrder(combatants);

  return {
    combatants,
    turnOrder,
    currentTurnIndex: 0,
    round: 1,
    log: [],
  };
}

function buildTurnOrder(combatants: BattleCombatant[]): string[] {
  return [...combatants]
    .sort((a, b) => b.actor.statsTotal.spd - a.actor.statsTotal.spd)
    .map(c => c.actor.uid);
}

// -----------------------------
// Queries
// -----------------------------

export function getCombatant(state: BattleState, uid: string): BattleCombatant | undefined {
  return state.combatants.find(c => c.actor.uid === uid);
}

export function getActiveCombatant(state: BattleState): BattleCombatant | undefined {
  const uid = state.turnOrder[state.currentTurnIndex];
  return getCombatant(state, uid);
}

export function isAlive(combatant: BattleCombatant): boolean {
  return combatant.hp > 0;
}

export function isBattleOver(state: BattleState): 'heroes_win' | 'enemies_win' | null {
  const alive = state.combatants.filter(isAlive);
  const heroesAlive = alive.some(c => c.actor.templateId !== undefined && c.actor.uid.startsWith('hero'));
  const enemiesAlive = alive.some(c => !c.actor.uid.startsWith('hero'));

  if (!enemiesAlive) return 'heroes_win';
  if (!heroesAlive) return 'enemies_win';
  return null;
}

// -----------------------------
// Damage calculation
// -----------------------------

export function calcPhysicalDamage(attacker: Stats, defender: Stats): number {
  const raw = Math.max(1, attacker.atk - Math.floor(defender.def / 2));
  const variance = 0.9 + Math.random() * 0.2; // ±10%
  return Math.max(1, Math.floor(raw * variance));
}

export function calcMagicDamage(attacker: Stats, defender: Stats): number {
  const raw = Math.max(1, attacker.mag - Math.floor(defender.res / 2));
  const variance = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.floor(raw * variance));
}

function applyDamage(target: BattleCombatant, damage: number): number {
  const actual = target.isDefending ? Math.floor(damage / 2) : damage;
  target.hp = Math.max(0, target.hp - actual);
  return actual;
}

// -----------------------------
// Action resolution
// -----------------------------

export function resolveAction(state: BattleState, action: BattleAction): BattleState {
  // Clone state shallowly so callers can treat it as immutable-ish
  const next: BattleState = {
    ...state,
    combatants: state.combatants.map(c => ({ ...c, statusEffects: [...c.statusEffects] })),
    log: [...state.log],
  };

  const actor = getCombatant(next, action.actorUid);
  if (!actor || !isAlive(actor)) return next;

  // Reset defend flag at start of their action
  actor.isDefending = false;

  switch (action.kind) {
    case 'attack': {
      if (!action.targetUid) break;
      const target = getCombatant(next, action.targetUid);
      if (!target || !isAlive(target)) break;
      const dmg = calcPhysicalDamage(actor.actor.statsTotal, target.actor.statsTotal);
      const actual = applyDamage(target, dmg);
      next.log.push(`${actor.actor.name} attacks ${target.actor.name} for ${actual} damage.`);
      if (!isAlive(target)) next.log.push(`${target.actor.name} is defeated.`);
      break;
    }

    case 'defend': {
      actor.isDefending = true;
      next.log.push(`${actor.actor.name} takes a defensive stance.`);
      break;
    }

    case 'flee': {
      // Flee success: based on actor spd (simple formula for now)
      const fleeChance = 0.5 + (actor.actor.statsTotal.spd / 100);
      if (Math.random() < fleeChance) {
        next.log.push(`${actor.actor.name} escapes from battle!`);
      } else {
        next.log.push(`${actor.actor.name} tries to flee but fails!`);
      }
      break;
    }

    case 'skill':
    case 'item':
      // Placeholder — implement when skill/item systems are defined
      next.log.push(`${actor.actor.name} used ${action.skillId ?? action.itemId ?? '?'} (not yet implemented).`);
      break;
  }

  return advanceTurn(next);
}

// -----------------------------
// Turn management
// -----------------------------

function advanceTurn(state: BattleState): BattleState {
  // Tick status effects for the combatant who just acted
  const actorUid = state.turnOrder[state.currentTurnIndex];
  const actor = getCombatant(state, actorUid);
  if (actor) tickStatusEffects(state, actor);

  // Move to next living combatant
  let next = state.currentTurnIndex + 1;
  let newRound = state.round;

  if (next >= state.turnOrder.length) {
    next = 0;
    newRound += 1;
  }

  // Skip dead combatants
  let attempts = 0;
  while (attempts < state.turnOrder.length) {
    const uid = state.turnOrder[next];
    const c = getCombatant(state, uid);
    if (c && isAlive(c)) break;
    next = (next + 1) % state.turnOrder.length;
    attempts++;
  }

  return { ...state, currentTurnIndex: next, round: newRound };
}

function tickStatusEffects(state: BattleState, combatant: BattleCombatant): void {
  combatant.statusEffects = combatant.statusEffects
    .map(effect => {
      if (effect.id === 'poison' && effect.value) {
        const dmg = effect.value;
        combatant.hp = Math.max(0, combatant.hp - dmg);
        state.log.push(`${combatant.actor.name} takes ${dmg} poison damage.`);
      }
      return { ...effect, remainingTurns: effect.remainingTurns - 1 };
    })
    .filter(effect => effect.remainingTurns > 0);
}
