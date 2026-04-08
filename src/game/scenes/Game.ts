import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import type { ActorComputed } from '../core/models';
import { HeroWarriorTemplate } from '../data/actors';

/**
 * Game is a silent orchestrator scene — it stays active for the lifetime of a
 * play session and manages transitions between World and Battle.
 */
export class Game extends Scene {
  private hero: ActorComputed = {
    uid: 'hero#1',
    templateId: HeroWarriorTemplate.id,
    name: HeroWarriorTemplate.name,
    level: 1,
    xp: 0,
    statsTotal: { ...HeroWarriorTemplate.baseStats },
    growthPerLevel: HeroWarriorTemplate.growthPerLevel ?? {},
    elementModsTotal: {},
    statusResistTotal: {},
  };

  constructor() {
    super('Game');
  }

  create() {
    this.scene.launch('Textbox');
    this.scene.launch('World');

    EventBus.on('request-battle', this.handleEnterBattle, this);
    EventBus.on('exit-battle', this.handleExitBattle, this);
    EventBus.on('battle:hero-updated', this.onHeroUpdated, this);

    EventBus.emit('current-scene-ready', this);
  }

  private handleEnterBattle() {
    if (this.scene.isActive('World')) this.scene.sleep('World');
    if (!this.scene.isActive('Battle')) {
      this.scene.launch('Battle', { hero: this.hero });
    } else {
      this.scene.wake('Battle');
    }
  }

  private handleExitBattle() {
    if (this.scene.isActive('Battle')) this.scene.stop('Battle');
    if (this.scene.isSleeping('World')) this.scene.wake('World');
  }

  private onHeroUpdated(hero: ActorComputed) {
    this.hero = hero;
  }

  // kept for template compatibility
  changeScene() {
    this.scene.stop('Battle');
    this.scene.stop('World');
    this.scene.stop('Textbox');
    this.scene.start('GameOver');
  }

  shutdown() {
    EventBus.off('request-battle', this.handleEnterBattle, this);
    EventBus.off('exit-battle', this.handleExitBattle, this);
    EventBus.off('battle:hero-updated', this.onHeroUpdated, this);
  }
}
