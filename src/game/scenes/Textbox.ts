import { EventBus } from '../EventBus';
import type { TextboxPayload, TextboxMode } from '../ui/textboxTypes';

const BOX_HEIGHT = 200;
const PAD = 24;
const SCREEN_W = 1024;
const SCREEN_H = 768;

const MODE_COLORS: Record<TextboxMode, number> = {
  dialogue: 0x111122,
  system:   0x111111,
  combat:   0x1a0808,
  shop:     0x0a1a0a,
};

const MODE_ACCENT: Record<TextboxMode, string> = {
  dialogue: '#aaaaff',
  system:   '#ffffff',
  combat:   '#ffaaaa',
  shop:     '#aaffaa',
};

export class Textbox extends Phaser.Scene {
  private queue: TextboxPayload[] = [];
  private current: TextboxPayload | null = null;
  private pageIndex = 0;
  private choiceIndex = 0;
  private showing = false;

  // UI objects
  private bg!: Phaser.GameObjects.Rectangle;
  private border!: Phaser.GameObjects.Rectangle;
  private speakerText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private continueHint!: Phaser.GameObjects.Text;
  private choiceTexts: Phaser.GameObjects.Text[] = [];

  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private keyConfirm!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'Textbox', active: false });
  }

  create() {
    this.queue = [];
    this.current = null;
    this.choiceTexts = [];
    this.showing = false;

    this.buildUI();

    this.keyUp      = this.input.keyboard!.addKey('UP');
    this.keyDown    = this.input.keyboard!.addKey('DOWN');
    this.keyConfirm = this.input.keyboard!.addKey('ENTER');
    this.keySpace   = this.input.keyboard!.addKey('SPACE');
    this.keyEsc     = this.input.keyboard!.addKey('ESC');

    EventBus.on('ui:textbox:enqueue', this.enqueue, this);

    this.setVisible(false);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  private enqueue(payload: TextboxPayload) {
    this.queue.push(payload);
    if (!this.showing) this.showNext();
  }

  // ─── Flow control ──────────────────────────────────────────────────────────

  private showNext() {
    if (this.queue.length === 0) {
      this.hide();
      return;
    }
    this.current = this.queue.shift()!;
    this.pageIndex = 0;
    this.choiceIndex = 0;
    this.showing = true;
    this.setVisible(true);
    EventBus.emit('ui:textbox:active', true);
    this.renderPage();
  }

  private advance() {
    if (!this.current) return;
    const pages = Array.isArray(this.current.text) ? this.current.text : [this.current.text];

    if (this.pageIndex < pages.length - 1) {
      this.pageIndex++;
      this.renderPage();
      return;
    }

    // Last page — if choices, wait for selection; otherwise complete
    if (this.current.choices?.length) return;
    this.complete();
  }

  private confirm() {
    if (!this.current) return;
    const pages = Array.isArray(this.current.text) ? this.current.text : [this.current.text];
    const onLastPage = this.pageIndex >= pages.length - 1;

    if (onLastPage && this.current.choices?.length) {
      const chosen = this.current.choices[this.choiceIndex];
      const value = chosen.value ?? chosen.label;
      EventBus.emit(this.current.choiceEvent ?? 'ui:textbox:choice', value);
      this.complete();
      return;
    }

    this.advance();
  }

  private complete() {
    if (this.current?.completeEvent) {
      EventBus.emit(this.current.completeEvent);
    }
    this.current = null;
    this.showNext();
  }

  private hide() {
    this.showing = false;
    this.setVisible(false);
    EventBus.emit('ui:textbox:active', false);
  }

  // ─── Input ─────────────────────────────────────────────────────────────────

  update() {
    if (!this.showing) return;

    if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
      if (this.current?.choices?.length) {
        this.choiceIndex = (this.choiceIndex + this.current.choices.length - 1) % this.current.choices.length;
        this.renderChoices();
      }
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
      if (this.current?.choices?.length) {
        this.choiceIndex = (this.choiceIndex + 1) % this.current.choices.length;
        this.renderChoices();
      }
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyConfirm) || Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.confirm();
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      this.advance(); // skip current page only
    }
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  private renderPage() {
    if (!this.current) return;
    const mode: TextboxMode = this.current.mode ?? 'dialogue';
    const pages = Array.isArray(this.current.text) ? this.current.text : [this.current.text];

    this.bg.setFillStyle(MODE_COLORS[mode], 0.92);
    this.border.setStrokeStyle(2, parseInt(MODE_ACCENT[mode].replace('#', ''), 16));

    this.speakerText.setText(this.current.speaker ?? '');
    this.speakerText.setColor(MODE_ACCENT[mode]);

    this.bodyText.setText(pages[this.pageIndex]);

    const hasChoices = !!(this.current.choices?.length) && this.pageIndex >= pages.length - 1;
    this.continueHint.setVisible(!hasChoices);

    this.renderChoices();
  }

  private renderChoices() {
    // Clear existing choice texts
    this.choiceTexts.forEach(t => t.destroy());
    this.choiceTexts = [];

    const pages = Array.isArray(this.current?.text) ? this.current!.text : [this.current?.text ?? ''];
    const onLastPage = this.pageIndex >= pages.length - 1;
    if (!this.current?.choices?.length || !onLastPage) return;

    const startY = SCREEN_H - BOX_HEIGHT + 80;
    this.current.choices.forEach((choice, i) => {
      const isSelected = i === this.choiceIndex;
      const t = this.add.text(
        PAD + 16,
        startY + i * 32,
        (isSelected ? '> ' : '  ') + choice.label,
        {
          fontSize: '20px',
          fontFamily: 'Arial',
          color: isSelected ? '#ffdd00' : '#cccccc',
        }
      ).setDepth(11);
      this.choiceTexts.push(t);
    });
  }

  private setVisible(visible: boolean) {
    this.bg.setVisible(visible);
    this.border.setVisible(visible);
    this.speakerText.setVisible(visible);
    this.bodyText.setVisible(visible);
    this.continueHint.setVisible(visible);
    if (!visible) {
      this.choiceTexts.forEach(t => t.destroy());
      this.choiceTexts = [];
    }
  }

  // ─── UI construction ───────────────────────────────────────────────────────

  private buildUI() {
    const y = SCREEN_H - BOX_HEIGHT;

    this.bg = this.add
      .rectangle(SCREEN_W / 2, y + BOX_HEIGHT / 2, SCREEN_W - 16, BOX_HEIGHT - 8, 0x111122, 0.92)
      .setDepth(10);

    this.border = this.add
      .rectangle(SCREEN_W / 2, y + BOX_HEIGHT / 2, SCREEN_W - 16, BOX_HEIGHT - 8)
      .setStrokeStyle(2, 0xaaaaff)
      .setFillStyle(0, 0)
      .setDepth(10);

    this.speakerText = this.add.text(PAD, y + 10, '', {
      fontSize: '16px',
      fontFamily: 'Arial Black',
      color: '#aaaaff',
    }).setDepth(11);

    this.bodyText = this.add.text(PAD, y + 36, '', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff',
      wordWrap: { width: SCREEN_W - PAD * 2 - 60 },
    }).setDepth(11);

    this.continueHint = this.add.text(SCREEN_W - PAD - 8, SCREEN_H - PAD, '▶', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#aaaaaa',
    }).setOrigin(1, 1).setDepth(11);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  shutdown() {
    EventBus.off('ui:textbox:enqueue', this.enqueue, this);
    EventBus.emit('ui:textbox:active', false);
  }
}
