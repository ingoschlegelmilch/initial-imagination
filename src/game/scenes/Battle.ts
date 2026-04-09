import { EventBus } from '../EventBus';
import { queueTextbox } from '../ui/textbox';
import {
  createBattleState,
  resolveAction,
  isBattleOver,
  calcXpReward,
  BattleState,
} from '../core/battleSystem';
import { ActorComputed, xpThreshold, applyLevelUpStats } from '../core/models';
import { SlimeTemplate } from '../data/actors';

// ─── Fallback hero (used only if scene data is missing) ───────────────────────

const HERO_FALLBACK: ActorComputed = {
  uid: 'hero#1',
  templateId: 'hero-warrior',
  name: 'Hero',
  level: 1,
  xp: 0,
  statsTotal: { hpMax: 30, mpMax: 10, atk: 8, def: 4, mag: 2, res: 2, spd: 6, luk: 3 },
  growthPerLevel: { hpMax: 2, atk: 1, def: 1 },
  elementModsTotal: {},
  statusResistTotal: {},
};

const SLIME: ActorComputed = {
  uid: 'enemy#1',
  templateId: SlimeTemplate.id,
  name: SlimeTemplate.name,
  level: 1,
  xp: 0,
  statsTotal: { ...SlimeTemplate.baseStats },
  growthPerLevel: {},
  elementModsTotal: {},
  statusResistTotal: {},
  xpReward: SlimeTemplate.xpReward,
};

// ─── Scene ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'hero_menu' | 'resolving' | 'battle_over';

export class Battle extends Phaser.Scene {
  private _hero!: ActorComputed;
  private state!: BattleState;
  private phase: Phase = 'idle';

  // HP bar UI (stays in Battle scene, textbox overlays on top)
  private enemyHpText!: Phaser.GameObjects.Text;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;

  private heroHpText!: Phaser.GameObjects.Text;
  private heroHpBar!: Phaser.GameObjects.Rectangle;
  private heroLevelText!: Phaser.GameObjects.Text;
  private heroXpText!: Phaser.GameObjects.Text;

  constructor() {
    super('Battle');
  }

  init(data: { hero?: ActorComputed }) {
    this._hero = data.hero ?? HERO_FALLBACK;
  }

  create() {
    this.state = createBattleState([this._hero, SLIME]);
    this.phase = 'idle';

    this.cameras.main.setBackgroundColor(0x1a0a0a);
    this.buildUI();

    EventBus.on('battle:action',     this.onActionChosen, this);
    EventBus.on('battle:prompt',     this.showActionMenu, this);
    EventBus.on('battle:enemy-turn', this.onEnemyTurn,   this);

    queueTextbox({
      text: `A wild ${SLIME.name} appears!`,
      mode: 'combat',
      completeEvent: 'battle:prompt',
    });
  }

  // ─── Textbox-driven flow ───────────────────────────────────────────────────

  private showActionMenu() {
    // Guard: never show a new action menu once battle is over or one is already queued
    if (this.phase === 'battle_over' || this.phase === 'hero_menu') return;
    this.phase = 'hero_menu';
    queueTextbox({
      text: 'What will you do?',
      mode: 'combat',
      choices: [
        { label: 'Attack' },
        { label: 'Defend' },
        { label: 'Flee' },
      ],
      choiceEvent: 'battle:action',
    });
  }

  private onActionChosen(value: string) {
    // Guard: only act when it's genuinely the player's turn
    if (this.phase !== 'hero_menu') return;
    this.phase = 'resolving';

    // Always resolve as the hero — never rely on currentTurnIndex for actor identity
    const heroCombatant = this.state.combatants.find(c => c.actor.uid === 'hero#1');
    if (!heroCombatant || heroCombatant.hp <= 0) return;

    let action;
    switch (value) {
      case 'Attack':
        action = { kind: 'attack' as const, actorUid: 'hero#1', targetUid: 'enemy#1' };
        break;
      case 'Defend':
        action = { kind: 'defend' as const, actorUid: 'hero#1' };
        break;
      case 'Flee':
      default:
        action = { kind: 'flee' as const, actorUid: 'hero#1' };
        break;
    }

    // Sync currentTurnIndex to hero so advanceTurn ticks the right status effects
    const heroIndex = this.state.turnOrder.indexOf('hero#1');
    if (heroIndex >= 0) this.state = { ...this.state, currentTurnIndex: heroIndex };

    // ── Hero's turn ──
    this.state = resolveAction(this.state, action);
    const heroLog = this.state.log[this.state.log.length - 1] ?? '';
    this.refreshHpBars();

    const fleeSucceeded = value === 'Flee' && heroLog.includes('escapes');
    const resultAfterHero = isBattleOver(this.state);

    if (resultAfterHero || fleeSucceeded) {
      this.endBattle(resultAfterHero, heroLog);
      return;
    }

    // Show hero's action log; enemy turn resolves only after player confirms
    queueTextbox({ text: heroLog, mode: 'combat', completeEvent: 'battle:enemy-turn' });
  }

  private onEnemyTurn() {
    // Guard: only resolve enemy turn when we're actually waiting for it
    if (this.phase !== 'resolving') return;

    // Find first living enemy directly — never rely on currentTurnIndex for actor identity
    const enemyCombatant = this.state.combatants.find(
      c => !c.actor.uid.startsWith('hero') && c.hp > 0
    );
    if (!enemyCombatant) {
      // All enemies gone (shouldn't reach here normally, but handle gracefully)
      EventBus.emit('battle:prompt');
      return;
    }

    // Sync currentTurnIndex to enemy so advanceTurn ticks the right status effects
    const enemyIndex = this.state.turnOrder.indexOf(enemyCombatant.actor.uid);
    if (enemyIndex >= 0) this.state = { ...this.state, currentTurnIndex: enemyIndex };

    // ── Enemy's turn ──
    this.state = resolveAction(this.state, {
      kind: 'attack',
      actorUid: enemyCombatant.actor.uid,
      targetUid: 'hero#1',
    });
    const enemyLog = this.state.log[this.state.log.length - 1] ?? '';
    this.refreshHpBars();

    const resultAfterEnemy = isBattleOver(this.state);
    if (resultAfterEnemy) {
      this.endBattle(resultAfterEnemy, enemyLog);
      return;
    }

    // Show enemy's action log; loop back to action menu after confirm
    queueTextbox({ text: enemyLog, mode: 'combat', completeEvent: 'battle:prompt' });
  }

  private endBattle(result: 'heroes_win' | 'enemies_win' | null, lastLog: string) {
    this.phase = 'battle_over';

    if (result === 'heroes_win') {
      const xpGained = calcXpReward(this.state);
      let hero = { ...this._hero, xp: this._hero.xp + xpGained };

      queueTextbox({ text: [lastLog, `Gained ${xpGained} XP.`], mode: 'combat' });

      while (hero.xp >= xpThreshold(hero.level)) {
        const prev = hero.statsTotal;
        const next = applyLevelUpStats(prev, hero.growthPerLevel);
        hero = {
          ...hero,
          xp: hero.xp - xpThreshold(hero.level),
          level: hero.level + 1,
          statsTotal: next,
        };
        this.heroLevelText.setText(`Lv.${hero.level}`);
        this.heroXpText.setText(`XP ${hero.xp} / ${xpThreshold(hero.level)}`);
        queueTextbox({ text: `Level Up! Now level ${hero.level}!`, mode: 'combat' });
        queueTextbox({
          text:
            `HP  ${prev.hpMax} → ${next.hpMax} (+${next.hpMax - prev.hpMax})\n` +
            `ATK ${prev.atk}  → ${next.atk}  (+${next.atk - prev.atk})\n` +
            `DEF ${prev.def}  → ${next.def}  (+${next.def - prev.def})`,
          mode: 'combat',
        });
      }

      EventBus.emit('battle:hero-updated', hero);
      queueTextbox({ text: 'Victory!', mode: 'combat', completeEvent: 'battle:done' });
    } else {
      const ending = result === 'enemies_win' ? 'Defeated...' : '';
      const text = ending ? [lastLog, ending] : [lastLog];
      queueTextbox({ text, mode: 'combat', completeEvent: 'battle:done' });
    }

    EventBus.once('battle:done', () => EventBus.emit('exit-battle'));
  }

  // ─── HP bar UI ─────────────────────────────────────────────────────────────

  private buildUI() {
    const W = 1024;
    const H = 768;

    // Enemy block
    this.add.rectangle(W - 260, 60, 440, 90, 0x330000).setOrigin(0.5);
    this.add.text(W - 470, 30, SLIME.name, { fontSize: '18px', color: '#ffaaaa', fontFamily: 'Arial' });
    this.enemyHpText = this.add.text(W - 470, 55, '', { fontSize: '14px', color: '#ffffff', fontFamily: 'Arial' });
    this.add.rectangle(W - 260, 85, 400, 14, 0x550000).setOrigin(0.5);
    this.enemyHpBar = this.add.rectangle(W - 460, 85, 400, 14, 0xdd2222).setOrigin(0, 0.5);

    // Hero block
    this.add.rectangle(260, H - 220, 440, 110, 0x000033).setOrigin(0.5);
    this.add.text(50, H - 270, this._hero.name, { fontSize: '18px', color: '#aaaaff', fontFamily: 'Arial' });
    this.heroLevelText = this.add.text(150, H - 270, `Lv.${this._hero.level}`, { fontSize: '14px', color: '#8888cc', fontFamily: 'Arial' });
    this.heroHpText   = this.add.text(50, H - 248, '', { fontSize: '14px', color: '#ffffff', fontFamily: 'Arial' });
    this.add.rectangle(260, H - 228, 400, 14, 0x000055).setOrigin(0.5);
    this.heroHpBar    = this.add.rectangle(60, H - 228, 400, 14, 0x2255dd).setOrigin(0, 0.5);
    this.heroXpText   = this.add.text(50, H - 208, '', { fontSize: '12px', color: '#666699', fontFamily: 'Arial' });

    this.refreshHpBars();
  }

  private refreshHpBars() {
    const hero  = this.state.combatants.find(c => c.actor.uid === 'hero#1')!;
    const enemy = this.state.combatants.find(c => c.actor.uid === 'enemy#1')!;

    this.enemyHpText.setText(`HP ${enemy.hp} / ${enemy.actor.statsTotal.hpMax}`);
    this.enemyHpBar.setScale(Math.max(0, enemy.hp / enemy.actor.statsTotal.hpMax), 1);

    this.heroHpText.setText(`HP ${hero.hp} / ${hero.actor.statsTotal.hpMax}`);
    this.heroHpBar.setScale(Math.max(0, hero.hp / hero.actor.statsTotal.hpMax), 1);
    this.heroXpText.setText(`XP ${this._hero.xp} / ${xpThreshold(this._hero.level)}`);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  shutdown() {
    EventBus.off('battle:action',     this.onActionChosen, this);
    EventBus.off('battle:prompt',     this.showActionMenu, this);
    EventBus.off('battle:enemy-turn', this.onEnemyTurn,   this);
  }
}
