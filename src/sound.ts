/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SOUND OF A BLOW
 * ═══════════════════════════════════════════════════════════════════════════
 * Made on the spot with Web Audio, so there are no files to load: a punch is
 * a deep thump with a crunch on top, a slap a sharp smack of noise. Each is
 * pitched a little differently every time, so a run of them does not sound
 * like one sample on repeat.
 *
 * This only plays. It never listens: there is still no microphone.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const SAVED = 'eles-nao.sound';

export class Sound {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  on = true;

  constructor() {
    try {
      this.on = localStorage.getItem(SAVED) !== 'off';
    } catch {
      // No storage here (private window): sound on, not remembered.
    }
  }

  /** Starts the audio. Browsers only allow it from a click or a key, so call it from one. */
  wake() {
    try {
      if (!this.ctx) {
        const ctx = new AudioContext();
        const squeeze = ctx.createDynamicsCompressor();
        squeeze.threshold.value = -10;
        squeeze.ratio.value = 6;
        const out = ctx.createGain();
        out.gain.value = 0.8;
        out.connect(squeeze).connect(ctx.destination);
        // A second of white noise, the raw stuff of every smack and crunch.
        const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.ctx = ctx;
        this.out = out;
        this.noise = noise;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch (error) {
      console.error('No sound here:', error);
    }
  }

  setOn(on: boolean) {
    this.on = on;
    try {
      localStorage.setItem(SAVED, on ? 'on' : 'off');
    } catch {
      // Not remembered, still switched.
    }
  }

  /** A punch: a thump that drops in pitch, a knock, and a short crunch. */
  punch() {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    const p = vary();
    this.tone('sine', t, 170 * p, 42 * p, 0.22, 1, 0.38);
    this.tone('triangle', t, 330 * p, 110 * p, 0.08, 0.35, 0.11);
    this.hiss(t, 'lowpass', 2400 * p, 380, 0.9, 0.13);
  }

  /** A slap: a sharp smack of bright noise, a second one just behind it, and a little body. */
  slap() {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime;
    const p = vary();
    this.hiss(t, 'bandpass', 2700 * p, 2200 * p, 1.3, 0.1);
    this.hiss(t + 0.012, 'bandpass', 3400 * p, 2600 * p, 0.5, 0.07);
    this.tone('sine', t, 280 * p, 160 * p, 0.05, 0.3, 0.07);
  }

  private ready(): AudioContext | null {
    if (!this.on || !this.ctx || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  /** A tone sliding from one pitch to another, struck and dying away. */
  private tone(type: OscillatorType, t: number, from: number, to: number, slide: number, level: number, length: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + slide);
    const gain = strike(ctx, t, level, length);
    osc.connect(gain).connect(this.out!);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  /** A burst of noise through a filter whose frequency moves from one place to another. */
  private hiss(t: number, type: BiquadFilterType, from: number, to: number, level: number, length: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = type === 'bandpass' ? 0.8 : 0.7;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + length);
    const gain = strike(ctx, t, level, length);
    src.connect(filter).connect(gain).connect(this.out!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + length + 0.02);
  }
}

/** A gain that is hit at once and dies away over `length` seconds. */
function strike(ctx: AudioContext, t: number, level: number, length: number) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(level, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  return gain;
}

/** A pitch a few percent either side, different every blow. */
function vary() {
  return 0.93 + Math.random() * 0.14;
}
