/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE SOUND OF A BLOW
 * ═══════════════════════════════════════════════════════════════════════════
 * Made on the spot with Web Audio, so there are no files to load: a punch is
 * a deep thump with a crunch on top, a slap a sharp smack of noise. Each is
 * pitched a little differently every time, so a run of them does not sound
 * like one sample on repeat.
 *
 * And at the end, music: 23.5 to 39 seconds of "Lula lá", round and round
 * while the star is up — cut so its end runs into its start with no click.
 *
 * This only plays. It never listens: there is still no microphone.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import musicUrl from './app/assets/lula-la-loop.wav?url';
import type { AudioData } from './app/App';

const SAVED = 'eles-nao.sound';
/** How loud the music plays, how long it takes to come in, and to go. */
const MUSIC_LEVEL = 0.75;
const MUSIC_IN = 3;
const MUSIC_OUT = 0.6;

export class Sound {
  private ctx: AudioContext | null = null;
  /** Everything passes through here: the switch turns it up and down. */
  private master: GainNode | null = null;
  /** The blows, squeezed so a run of them never clips. */
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private music: AudioBuffer | null = null;
  private loading = false;
  private wantMusic = false;
  private playing: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  // Listening to the music (not a microphone): its bands, and its beat.
  private analyser: AnalyserNode | null = null;
  private bins = new Uint8Array(0);
  private floats = new Float32Array(0);
  private bassAverage = 0;
  private lastBeat = 0;
  private lastListen = 0;
  private onset = 0;
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
        const master = ctx.createGain();
        master.gain.value = this.on ? 1 : 0;
        master.connect(ctx.destination);
        const squeeze = ctx.createDynamicsCompressor();
        squeeze.threshold.value = -10;
        squeeze.ratio.value = 6;
        const out = ctx.createGain();
        out.gain.value = 0.8;
        out.connect(squeeze).connect(master);
        // A second of white noise, the raw stuff of every smack and crunch.
        const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.ctx = ctx;
        this.master = master;
        this.out = out;
        this.noise = noise;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this.loadMusic();
    } catch (error) {
      console.error('No sound here:', error);
    }
  }

  setOn(on: boolean) {
    this.on = on;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
    try {
      localStorage.setItem(SAVED, on ? 'on' : 'off');
    } catch {
      // Not remembered, still switched.
    }
  }

  /** The music for the end, fetched once the audio is awake, so the game starts without waiting for it. */
  private loadMusic() {
    const ctx = this.ctx;
    if (!ctx || this.loading || this.music) return;
    this.loading = true;
    fetch(musicUrl)
      .then((r) => r.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.music = buffer;
        if (this.wantMusic) this.startMusic();
      })
      .catch((error) => console.error('The music did not load:', error))
      .finally(() => { this.loading = false; });
  }

  /** The music, looping, fading in over a few seconds. If it is still loading, it starts when it arrives. */
  startMusic() {
    this.wantMusic = true;
    const ctx = this.ctx;
    if (!ctx || !this.music || !this.master || this.playing) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.music;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(MUSIC_LEVEL, t + MUSIC_IN);
    // Heard before its fade, so the stars and words move with it from the start.
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.3;
    this.analyser = analyser;
    this.bins = new Uint8Array(analyser.frequencyBinCount);
    this.floats = new Float32Array(analyser.frequencyBinCount);
    src.connect(analyser).connect(gain).connect(this.master);
    src.start(t);
    this.playing = { src, gain };
  }

  /**
   * What the music is doing now, as the visuals read it: how much bass,
   * middle and top, and whether a beat just landed: the bass's energy half
   * as much again as its last quarter second (tuned on the loop, it finds
   * about two a second, the jingle's own beat). Nothing while the music is
   * not playing.
   */
  listen(): AudioData | undefined {
    const ctx = this.ctx;
    if (!ctx || !this.playing || !this.analyser) return undefined;
    this.analyser.getByteFrequencyData(this.bins);
    const hz = ctx.sampleRate / this.analyser.fftSize;
    const band = (lo: number, hi: number) => {
      const a = Math.max(1, Math.floor(lo / hz));
      const b = Math.min(this.bins.length - 1, Math.ceil(hi / hz));
      let sum = 0;
      for (let i = a; i <= b; i++) sum += this.bins[i];
      return sum / ((b - a + 1) * 255);
    };
    const bass = band(20, 160);
    // The beat, from the bass's energy in linear terms (the dB bytes above
    // flatten it: the bass is near the top of them all the time).
    this.analyser.getFloatFrequencyData(this.floats);
    let energy = 0;
    const top = Math.max(2, Math.floor(160 / hz));
    for (let i = 1; i <= top; i++) energy += 10 ** (this.floats[i] / 10);
    energy /= top;
    const now = ctx.currentTime;
    const dt = Math.min(0.1, Math.max(0, now - this.lastListen));
    this.lastListen = now;
    const ratio = this.bassAverage > 0 ? energy / this.bassAverage : 1;
    const beat = ratio > 1.5 && now - this.lastBeat > 0.25;
    const beatIntensity = beat ? Math.min(1, (ratio - 1.5) / 1.5 + 0.4) : 0;
    if (beat) {
      this.lastBeat = now;
      this.onset = Math.max(this.onset, 0.6 + beatIntensity * 0.4);
    }
    this.onset *= Math.exp(-dt / 0.25);
    this.bassAverage = this.bassAverage > 0 ? this.bassAverage + (energy - this.bassAverage) * Math.min(1, dt / 0.25) : energy;
    return {
      bass,
      lowMid: band(160, 800),
      mid: band(800, 4000),
      high: band(4000, 12000),
      overall: band(20, 12000),
      beat,
      beatIntensity,
      onset: this.onset,
    };
  }

  /** The music fades out and stops. */
  stopMusic() {
    this.wantMusic = false;
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    const { src, gain } = this.playing;
    this.playing = null;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + MUSIC_OUT);
    src.stop(t + MUSIC_OUT + 0.05);
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
