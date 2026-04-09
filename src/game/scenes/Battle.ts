import { EventBus } from '../EventBus';
import { queueTextbox } from '../ui/textbox';
import {
  createBattleState,
  resolveAction,
  getActiveCombatant,
  isBattleOver,
  calcXpReward,
  BattleState,
  BattleCombatant,
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

    EventBus.on('battle:action',    this.onActionChosen, this);
    EventBus.on('battle:next-turn', this.onNextTurn,     this);

    queueTextbox({
      text: `A wild ${SLIME.name} appears!`,
      mode: 'combat',
      completeEvent: 'battle:next-turn',
    });
  }

  // ─── Textbox-driven flow ───────────────────────────────────────────────────

  /**
   * Central turn dispatcher. Called after every textbox is dismissed.
   * Reads who is currently active from BattleState and routes accordingly:
   * - Hero combatant  → show action menu (player input)
   * - Enemy combatant → auto-resolve AI turn
   * Adding initiative modifiers or multi-character parties only needs to
   * update turnOrder/currentTurnIndex in BattleState — this handler adapts.
   */
  private onNextTurn() {
    if (this.phase === 'battle_over' || this.phase === 'hero_menu') return;

    const active = getActiveCombatant(this.state);
    if (!active) return;

    if (active.actor.uid.startsWith('hero')) {
      // ── Player's turn ──
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
    } else {
      // ── AI turn — auto-resolve, no player input needed ──
      this.phase = 'resolving';
      this.resolveAiTurn(active);
    }
  }

  private onActionChosen(value: string) {
    if (this.phase !== 'hero_menu') return;
    this.phase = 'resolving';

    const active = getActiveCombatant(this.state);
    if (!active) return;

    // Find the first living enemy to target
    const target = this.state.combatants.find(
      c => !c.actor.uid.startsWith('hero') && c.hp > 0
    );

    let action;
    switch (value) {
      case 'Attack':
        if (!target) return;
        action = { kind: 'attack' as const, actorUid: active.actor.uid, targetUid: target.actor.uid };
        break;
      case 'Defend':
        action = { kind: 'defend' as const, actorUid: active.actor.uid };
        break;
      case 'Flee':
      default:
        action = { kind: 'flee' as const, actorUid: active.actor.uid };
        break;
    }

    const logBefore = this.state.log.length;
    this.state = resolveAction(this.state, action);
    const newEntries = this.state.log.slice(logBefore);
    const log = newEntries.join('\n');
    this.refreshHpBars();

    const fleeSucceeded = value === 'Flee' && log.includes('escapes');
    const result = isBattleOver(this.state);

    if (result || fleeSucceeded) {
      this.endBattle(result, log);
      return;
    }

    queueTextbox({ text: log, mode: 'combat', completeEvent: 'battle:next-turn' });
  }

  /** Resolve one AI-controlled combatant's turn, then hand back to the dispatcher. */
  private resolveAiTurn(combatant: BattleCombatant) {
    // Find the first living hero to target
    const target = this.state.combatants.find(
      c => c.actor.uid.startsWith('hero') && c.hp > 0
    );
    if (!target) return;

    const logBefore = this.state.log.length;
    this.state = resolveAction(this.state, {
      kind: 'attack',
      actorUid: combatant.actor.uid,
      targetUid: target.actor.uid,
    });
    const newEntries = this.state.log.slice(logBefore);
    const log = newEntries.join('\n');
    this.refreshHpBars();

    const result = isBattleOver(this.state);
    if (result) {
      this.endBattle(result, log);
      return;
    }

    queueTextbox({ text: log, mode: 'combat', completeEvent: 'battle:next-turn' });
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
    EventBus.off('battle:action',    this.onActionChosen, this);
    EventBus.off('battle:next-turn', this.onNextTurn,     this);
  }
}
