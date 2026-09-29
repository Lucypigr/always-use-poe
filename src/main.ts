import './styles.css';
import type { ClassId } from './data/classes';
import { AREAS } from './data/areas';
import { newCharacter, type CharacterData } from './game/character';
import { Game } from './game/game';
import { loadSave, writeSave, type SaveData } from './game/save';
import { Renderer } from './render/renderer';
import { CURRENCY_BY_ID } from './data/currency';
import { currencyId } from './items/item';
import { Audio } from './ui/audio';
import { showCharSelect } from './ui/charSelect';
import { clear } from './ui/dom';
import { Input } from './ui/input';
import { installLandscapeGuard, mustRotate } from './ui/landscape';
import { isTouchDevice } from './ui/touch';
import { TouchControls } from './ui/touchControls';
import { UI } from './ui/ui';

/** Application shell: title screen ↔ game session, main loop and persistence. */
class App {
  private save: SaveData = loadSave();
  private renderer: Renderer;
  private uiRoot = document.getElementById('ui')!;
  private game: Game | null = null;
  private ui: UI | null = null;
  private input: Input | null = null;
  private touch: TouchControls | null = null;
  private last = performance.now();
  readonly audio = new Audio();

  constructor() {
    this.renderer = new Renderer(document.getElementById('game')!);
    installLandscapeGuard();
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('beforeunload', () => this.persist());
    requestAnimationFrame((t) => this.frame(t));
    const params = new URLSearchParams(location.search);
    const quick = params.get('quickstart') as ClassId | null;
    if (quick) {
      const c = newCharacter('測試者', quick);
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
    if (isTouchDevice()) this.touch = new TouchControls(this.ui, this.input);
    this.ui.startStory();
    game.events.on('save', () => this.persist());
    this.audio.volume = this.save.settings.volume;
    game.events.on('drop', ({ item }) => {
      const cid = currencyId(item);
      if (item.rarity === 'unique') this.audio.play('unique');
      else if (cid && CURRENCY_BY_ID[cid].tier >= 2) this.audio.play('rare_drop');
      else if (cid) this.audio.play('currency');
      else this.audio.play('drop');
    });
    game.events.on('pickup', () => this.audio.play('pickup'));
    game.events.on('levelup', () => this.audio.play('levelup'));
    game.events.on('death', () => this.audio.play('death'));
    game.events.on('area', () => this.audio.play('portal'));
    game.events.on('quest', ({ ready }) => ready && this.audio.play('levelup'));
    game.log(this.touch ? `歡迎來到暮港，${char.name}。左下拖曳移動，按住右下技能鍵攻擊。` : `歡迎來到暮港，${char.name}。左鍵移動，右鍵 / 空白鍵 / QWERT 施放技能，按 H 查看操作說明。`, '#d8c8a0');
    if (import.meta.env.DEV) Object.assign(window, { game, renderer: this.renderer, ui: this.ui });
    this.persist();
  }

  private exitToTitle(): void {
    this.ui?.stowCursor();
    this.persist();
    this.input?.destroy();
    this.touch?.destroy();
    this.touch = null;
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
      // phones held upright are paused behind the "rotate your phone" screen
      if (!mustRotate()) g.update(dt);
      this.audio.volume = g.settings.volume;
      this.renderer.postFx = g.settings.postFx;
      for (const e of g.vfxQueue) {
        if (e.type === 'text') this.ui.hud.addText(e);
        else if (e.type === 'impact') this.audio.play('hit');
        else if (e.type === 'swing') this.audio.play('swing');
        else if (e.type === 'explosion') this.audio.play('explode');
        else if (e.type === 'nova' || e.type === 'lightning' || e.type === 'blink') this.audio.play('spell');
        else if (e.type === 'flask') this.audio.play('flask');
      }
      this.renderer.render(g, dt);
      g.vfxQueue.length = 0;
      this.ui.update(dt);
      this.touch?.update();
    }
    requestAnimationFrame((t) => this.frame(t));
  }
}

new App();
