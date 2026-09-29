/**
 * Tiny synthesized sound effects (WebAudio, no assets). Loot drops get distinct chimes by
 * value, so a rare orb or unique "sounds" different before you even see its label.
 */

export type Sfx = 'hit' | 'swing' | 'spell' | 'drop' | 'currency' | 'rare_drop' | 'unique' | 'levelup' | 'death' | 'pickup' | 'portal' | 'flask' | 'explode';

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<Sfx, number>();
  volume = 0.5;

  /** Must be called from a user gesture (browsers block audio until then). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slide = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(dur: number, gain: number, filterFreq: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFreq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, filterFreq * 0.2), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  play(s: Sfx): void {
    if (!this.ctx || !this.master || this.volume <= 0) return;
    const now = this.ctx.currentTime;
    const minGap = s === 'hit' ? 0.05 : s === 'drop' ? 0.04 : 0.02;
    if (now - (this.last.get(s) ?? -1) < minGap) return;
    this.last.set(s, now);
    this.master.gain.value = this.volume * 0.6;
    switch (s) {
      case 'hit':
        this.burst(0.08, 0.25, 1400);
        this.tone(110, 0.08, 'sine', 0.15, 0, 0.6);
        break;
      case 'swing':
        this.burst(0.12, 0.08, 3000);
        break;
      case 'spell':
        this.tone(420, 0.2, 'triangle', 0.06, 0, 1.8);
        break;
      case 'explode':
        this.burst(0.35, 0.3, 900);
        this.tone(70, 0.3, 'sine', 0.2, 0, 0.5);
        break;
      case 'drop':
        this.tone(900, 0.06, 'square', 0.03);
        break;
      case 'currency':
        this.tone(1320, 0.12, 'sine', 0.08);
        this.tone(1760, 0.18, 'sine', 0.06, 0.05);
        break;
      case 'rare_drop':
        for (const [i, f] of [880, 1109, 1319, 1760].entries()) this.tone(f, 0.5, 'sine', 0.12, i * 0.06);
        break;
      case 'unique':
        this.tone(196, 1.4, 'sine', 0.2);
        this.tone(294, 1.2, 'sine', 0.12, 0.05);
        this.tone(392, 1.0, 'triangle', 0.08, 0.1);
        break;
      case 'levelup':
        for (const [i, f] of [523, 659, 784, 1047].entries()) this.tone(f, 0.35, 'triangle', 0.12, i * 0.09);
        break;
      case 'death':
        this.tone(220, 1.2, 'sawtooth', 0.08, 0, 0.3);
        this.burst(0.6, 0.15, 500);
        break;
      case 'pickup':
        this.tone(660, 0.05, 'triangle', 0.06);
        break;
      case 'portal':
        this.tone(300, 0.6, 'sine', 0.1, 0, 2.5);
        break;
      case 'flask':
        this.burst(0.15, 0.08, 2500);
        this.tone(500, 0.15, 'sine', 0.05, 0.02, 1.5);
        break;
    }
  }
}
