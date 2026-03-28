import { EventBus } from '../EventBus';
import { Scene } from 'phaser';

/**
 * Game is a silent orchestrator scene — it stays active for the lifetime of a
 * play session and manages transitions between World and Battle.
 */
export class Game extends Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.scene.launch('Textbox');
    this.scene.launch('World');

    EventBus.on('request-battle', this.handleEnterBattle, this);
    EventBus.on('exit-battle', this.handleExitBattle, this);

    EventBus.emit('current-scene-ready', this);
  }

  private handleEnterBattle() {
    if (this.scene.isActive('World')) this.scene.sleep('World');
    if (!this.scene.isActive('Battle')) {
      this.scene.launch('Battle');
    } else {
      this.scene.wake('Battle');
    }
  }

  private handleExitBattle() {
    if (this.scene.isActive('Battle')) this.scene.stop('Battle');
    if (this.scene.isSleeping('World')) this.scene.wake('World');
  }

  // kept for template compatibility
  changeScene() {
    this.scene.stop('Battle');
    this.scene.stop('World');
    this.scene.stop('Textbox');
    this.scene.start('GameOver');
  }
}
