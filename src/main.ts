import './styles.css';
import type { ClassId } from './data/classes';
import { AREAS } from './data/areas';
import { newCharacter, type CharacterData } from './game/character';
import { Game } from './game/game';
import { loadSave, writeSave, type SaveData } from './game/save';
import { Renderer } from './render/renderer';
import { showCharSelect } from './ui/charSelect';
import { clear } from './ui/dom';
import { Input } from './ui/input';
import { UI } from './ui/ui';

/** Application shell: title screen ↔ game session, main loop and persistence. */
class App {
  private save: SaveData = loadSave();
  private renderer: Renderer;
  private uiRoot = document.getElementById('ui')!;
  private game: Game | null = null;
  private ui: UI | null = null;
  private input: Input | null = null;
  private last = performance.now();

  constructor() {
    this.renderer = new Renderer(document.getElementById('game')!);
    window.addEventListener('beforeunload', () => this.persist());
    requestAnimationFrame((t) => this.frame(t));
    const params = new URLSearchParams(location.search);
    const quick = params.get('quickstart') as ClassId | null;
    if (quick) {
      const c = newCharacter('Tester', quick);
      if (params.get('unlock')) c.unlockedAreas = AREAS.map((a) => a.id);
      if (params.get('level')) c.level = Number(params.get('level'));
      this.save.characters.push(c);
      this.start(c);
      if (params.get('area')) this.game!.travelToArea(params.get('area')!);
    } else this.showTitle();
  }

  private showTitle(): void {
    this.renderer.canvas.style.visibility = 'hidden';
    showCharSelect(this.uiRoot, this.save, (c) => this.start(c), () => this.persist());
  }

  private start(char: CharacterData): void {
    clear(this.uiRoot);
    this.renderer.canvas.style.visibility = 'visible';
    const game = new Game(char, this.save.account, this.save.settings);
    this.game = game;
    this.ui = new UI(this.uiRoot, game, this.renderer, () => this.exitToTitle());
    this.ui.hud.showLabels = this.save.settings.alwaysShowLabels;
    this.input = new Input(this.ui, game, this.renderer);
    game.events.on('save', () => this.persist());
    game.log(`Welcome to Duskhaven, ${char.name}. Press H for controls.`, '#d8c8a0');
    if (import.meta.env.DEV) Object.assign(window, { game, renderer: this.renderer, ui: this.ui });
    this.persist();
  }

  private exitToTitle(): void {
    this.ui?.stowCursor();
    this.persist();
    this.input?.destroy();
    this.ui?.destroy();
    this.game = null;
    this.ui = null;
    this.input = null;
    this.showTitle();
  }

  private persist(): void {
    // move the current character to the front so it is selected next time
    if (this.game) {
      const c = this.game.char;
      this.save.characters = [c, ...this.save.characters.filter((x) => x !== c)];
    }
    writeSave(this.save);
  }

  private frame(now: number): void {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const g = this.game;
    if (g && this.ui && this.input) {
      this.input.update();
      g.update(dt);
      for (const e of g.vfxQueue) if (e.type === 'text') this.ui.hud.addText(e);
      this.renderer.render(g, dt);
      g.vfxQueue.length = 0;
      this.ui.update(dt);
    }
    requestAnimationFrame((t) => this.frame(t));
  }
}

new App();
