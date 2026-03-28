import { EventBus } from '../EventBus';
import { queueTextbox } from '../ui/textbox';
import {
  createBattleState,
  resolveAction,
  getActiveCombatant,
  isBattleOver,
  BattleState,
} from '../core/battleSystem';
import { ActorComputed } from '../core/models';

// ─── Placeholder actors (replace with real data once hero/enemy DB exists) ───

const HERO: ActorComputed = {
  uid: 'hero#1',
  templateId: 'hero-warrior',
  name: 'Hero',
  level: 1,
  statsTotal: { hpMax: 30, mpMax: 10, atk: 8, def: 4, mag: 2, res: 2, spd: 6, luk: 3 },
  elementModsTotal: {},
  statusResistTotal: {},
};

const SLIME: ActorComputed = {
  uid: 'enemy#1',
  templateId: 'slime',
  name: 'Slime',
  level: 1,
  statsTotal: { hpMax: 20, mpMax: 0, atk: 4, def: 2, mag: 0, res: 1, spd: 3, luk: 1 },
  elementModsTotal: {},
  statusResistTotal: {},
};

// ─── Scene ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'hero_menu' | 'resolving' | 'enemy_turn' | 'battle_over';

export class Battle extends Phaser.Scene {
  private state!: BattleState;
  private phase: Phase = 'idle';

  // HP bar UI (stays in Battle scene, textbox overlays on top)
  private enemyNameText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;

  private heroNameText!: Phaser.GameObjects.Text;
  private heroHpText!: Phaser.GameObjects.Text;
  private heroHpBar!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('Battle');
  }

  create() {
    this.state = createBattleState([HERO, SLIME]);
    this.phase = 'idle';

    this.cameras.main.setBackgroundColor(0x1a0a0a);
    this.buildUI();

    // Wire textbox choice events
    EventBus.on('battle:action', this.onActionChosen, this);
    EventBus.on('battle:prompt',  this.showActionMenu,   this);
    EventBus.on('battle:after-hero',  this.onAfterHero,  this);
    EventBus.on('battle:after-enemy', this.onAfterEnemy, this);

    // Intro message → then show action menu
    queueTextbox({
      text: `A wild ${SLIME.name} appears!`,
      mode: 'combat',
      completeEvent: 'battle:prompt',
    });
  }

  // ─── Textbox-driven flow ───────────────────────────────────────────────────

  private showActionMenu() {
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
    this.phase = 'resolving';
    const active = getActiveCombatant(this.state);
    if (!active) return;

    let action;
    switch (value) {
      case 'Attack':
        action = { kind: 'attack' as const, actorUid: active.actor.uid, targetUid: 'enemy#1' };
        break;
      case 'Defend':
        action = { kind: 'defend' as const, actorUid: active.actor.uid };
        break;
      case 'Flee':
      default:
        action = { kind: 'flee' as const, actorUid: active.actor.uid };
        break;
    }

    this.state = resolveAction(this.state, action);
    const lastLog = this.state.log[this.state.log.length - 1] ?? '';
    this.refreshHpBars();

    const fleeSucceeded = value === 'Flee' && lastLog.includes('escapes');
    const result = isBattleOver(this.state);

    if (result || fleeSucceeded) {
      this.endBattle(result, lastLog);
      return;
    }

    queueTextbox({ text: lastLog, mode: 'combat', completeEvent: 'battle:after-hero' });
  }

  private onAfterHero() {
    this.phase = 'enemy_turn';
    const active = getActiveCombatant(this.state);
    if (!active) { this.phase = 'hero_menu'; return; }

    this.state = resolveAction(this.state, {
      kind: 'attack',
      actorUid: active.actor.uid,
      targetUid: 'hero#1',
    });

    const lastLog = this.state.log[this.state.log.length - 1] ?? '';
    this.refreshHpBars();

    const result = isBattleOver(this.state);
    if (result) {
      this.endBattle(result, lastLog);
      return;
    }

    queueTextbox({ text: lastLog, mode: 'combat', completeEvent: 'battle:after-enemy' });
  }

  private onAfterEnemy() {
    this.showActionMenu();
  }

  private endBattle(result: 'heroes_win' | 'enemies_win' | null, lastLog: string) {
    this.phase = 'battle_over';
    const ending = result === 'heroes_win'
      ? 'Victory!'
      : result === 'enemies_win'
      ? 'Defeated...'
      : '';

    const text = ending ? [lastLog, ending] : [lastLog];
    queueTextbox({
      text,
      mode: 'combat',
      completeEvent: 'battle:done',
    });
    EventBus.once('battle:done', () => EventBus.emit('exit-battle'));
  }

  // ─── HP bar UI ─────────────────────────────────────────────────────────────

  private buildUI() {
    const W = 1024;
    const H = 768;

    this.add.rectangle(W - 260, 60, 440, 90, 0x330000).setOrigin(0.5);
    this.enemyNameText = this.add.text(W - 470, 30, SLIME.name, { fontSize: '18px', color: '#ffaaaa', fontFamily: 'Arial' });
    this.enemyHpText   = this.add.text(W - 470, 55, '', { fontSize: '14px', color: '#ffffff', fontFamily: 'Arial' });
    this.add.rectangle(W - 260, 85, 400, 14, 0x550000).setOrigin(0.5);
    this.enemyHpBar    = this.add.rectangle(W - 460, 85, 400, 14, 0xdd2222).setOrigin(0, 0.5);

    this.add.rectangle(260, H - 230, 440, 90, 0x000033).setOrigin(0.5);
    this.heroNameText = this.add.text(50, H - 270, HERO.name, { fontSize: '18px', color: '#aaaaff', fontFamily: 'Arial' });
    this.heroHpText   = this.add.text(50, H - 245, '', { fontSize: '14px', color: '#ffffff', fontFamily: 'Arial' });
    this.add.rectangle(260, H - 215, 400, 14, 0x000055).setOrigin(0.5);
    this.heroHpBar    = this.add.rectangle(60, H - 215, 400, 14, 0x2255dd).setOrigin(0, 0.5);

    this.refreshHpBars();
  }

  private refreshHpBars() {
    const hero  = this.state.combatants.find(c => c.actor.uid === 'hero#1')!;
    const enemy = this.state.combatants.find(c => c.actor.uid === 'enemy#1')!;

    this.enemyHpText.setText(`HP ${enemy.hp} / ${enemy.actor.statsTotal.hpMax}`);
    this.enemyHpBar.setScale(Math.max(0, enemy.hp / enemy.actor.statsTotal.hpMax), 1);

    this.heroHpText.setText(`HP ${hero.hp} / ${hero.actor.statsTotal.hpMax}`);
    this.heroHpBar.setScale(Math.max(0, hero.hp / hero.actor.statsTotal.hpMax), 1);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  shutdown() {
    EventBus.off('battle:action',      this.onActionChosen, this);
    EventBus.off('battle:prompt',      this.showActionMenu,  this);
    EventBus.off('battle:after-hero',  this.onAfterHero,    this);
    EventBus.off('battle:after-enemy', this.onAfterEnemy,   this);
  }
}
