import { BigTypeRenderer } from './app/components/renderers/BigTypeRenderer';
import { SlapRenderer } from './app/components/renderers/SlapRenderer';
import { LHand, Sparks, Victory, type StarStyle } from './fx';
import { Sound } from './sound';
import { generateColors } from './app/config/palette';
import { advanceClock, useLayerClock } from './app/motion/clock';
import { createGestureState, gestureRate } from './app/hands/gesture';
import { trackHands } from './app/hands/track';
import type { HandData } from './app/App';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ELE(S) NÃO!
 * ═══════════════════════════════════════════════════════════════════════════
 * Two layers of n4thVJ, fixed as they were set for "mische intro":
 *
 *   1  Slap      the head, slapped and punched by your hands, at 100%
 *   2  Big Type  the words, sheared letter by letter, at 75%, in Difference
 *
 * One finger slows everything, five speed it up. A clap does nothing. The
 * words move with the hands too, less than the head.
 *
 * And a small game on top: every blow shrinks him, a punch more than a slap,
 * throwing off little white stars, with a sound, until he is gone and a big
 * red star with 13 on it lands in his place, and the hand makes an L.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const WORDS = 'ELE(S) NÃO!';

/** Big Type, as it was set. */
const TYPE = {
  'type.style': 3, // Shear
  'type.size': 1.6,
  // The rows fill the screen's height exactly, the first tilde not cut off.
  'type.fill': 1,
  'type.repeat': 4,
  'type.justify': 0, // Even
  'type.weight': 0, // Bold
  'type.colourway': 0, // ink on black
  'dance.amount': 2,
  'dance.words': 0, // by letter
  'lines.density': 0.98,
  'lines.thickness': 0.67,
  'stretch.smear': 1.5,
  'stretch.bands': 0.28,
};
/** The red the words came out in. */
const INK = '#ff202f';
const TYPE_OPACITY = 0.75;

const SLAP_COLOURS = generateColors(260, 100, 'black');
const TYPE_COLOURS = [INK, '#ffffff', INK, INK];

/** The game. How much of him there is to start with, and what each blow takes off. */
const WHOLE = 100;
const SLAP_DAMAGE = 7;
const PUNCH_DAMAGE = 13;
/** How small he gets before the last blow takes him away, as a share of his size. */
const SMALLEST = 0.16;
/** How long he takes to go once the last blow lands, in seconds. */
const VANISH = 0.5;
/** After the star: when the button to play again shows, and when it starts again by itself. */
const AGAIN_AFTER = 2.5;
const AGAIN_BY_ITSELF = 20;
/**
 * The star at the end: 'scatter', rough red stars filling the screen round
 * the one with 13, or 'echo', the one star with its repeats behind it.
 * ?estrela=eco at the end of the address shows the echo.
 */
const STAR_STYLE: StarStyle = new URLSearchParams(location.search).get('estrela') === 'eco' ? 'echo' : 'scatter';
/**
 * ?camera at the end of the address shows the camera's picture in the top
 * right corner, mirrored — for recording yourself playing. Without it, as
 * always, the camera is only read, never shown.
 */
const SHOW_CAMERA = new URLSearchParams(location.search).has('camera');
/** With the camera, for the stories: these come in first, word by word, then the page. */
const STORY = [
  'Os argumentos já estão por aí, e muita gente explica o porquê melhor do que eu.',
  'Eu fiz um lugar pra descarregar.',
  'Agora solta a mão.',
];
/** How soon each word follows the last, and how long a finished line holds, in milliseconds. */
const STORY_WORD = 170;
const STORY_HOLD = 1300;
/**
 * While the star is up the words dance to the music rather than to the
 * hands: slowly between beats, leaping on each one, like the stars.
 */
const VICTORY_PACE = { rest: 0.35, beat: 2.4 };

/**
 * The words move with the hands too, less than the head does: they lean
 * toward where the hands are, and a blow knocks them the way it went, both
 * on a spring back to the middle. How far they follow, as a share of the
 * frame, and how hard a slap and a punch knock them.
 */
const WORDS_FOLLOW = 0.08;
const WORDS_KNOCK = { slap: 0.35, punch: 0.55 };

const stage = document.getElementById('stage') as HTMLCanvasElement;
const out = stage.getContext('2d')!;

function layer() {
  const canvas = document.createElement('canvas');
  return { canvas, ctx: canvas.getContext('2d')! };
}
const below = layer();
const above = layer();
const slap = new SlapRenderer(below.canvas, below.ctx);
const type = new BigTypeRenderer(above.canvas, above.ctx);
type.setParams(TYPE);
type.setText(WORDS);

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  for (const c of [stage, below.canvas, above.canvas]) {
    c.width = width;
    c.height = height;
  }
}
resize();
window.addEventListener('resize', resize);

const NO_HANDS: HandData = { left: null, right: null };
let hands: HandData = NO_HANDS;
// Each hand as last seen, and when, so the L can start from where it was.
const seen: Record<'left' | 'right', { hand: HandData['left']; at: number }> = {
  left: { hand: null, at: 0 },
  right: { hand: null, at: 0 },
};
function setHands(data: HandData) {
  hands = data;
  for (const side of ['left', 'right'] as const) {
    if (data[side]?.landmarks) seen[side] = { hand: data[side], at: performance.now() };
  }
}
const gesture = createGestureState();
let last = performance.now();
const sparks = new Sparks();
const victory = new Victory(STAR_STYLE);
const lhand = new LHand();
const sound = new Sound();
// Where the words have been pushed to, and how fast they are going.
const drift = { x: 0, y: 0, vx: 0, vy: 0 };

function frame() {
  const now = performance.now();
  const delta = Math.min(0.1, (now - last) / 1000);
  last = now;
  // A clap does nothing: none of the layers, nor the tempo, ever hears of
  // one. And once he is gone, the camera is not followed at all.
  const calm: HandData = { ...(phase === 'won' ? NO_HANDS : hands), clapping: false, clapIntensity: 0 };
  const rate = gestureRate(calm, gesture, delta);
  const music = sound.listen();
  const pace = VICTORY_PACE.rest + VICTORY_PACE.beat * (music?.onset ?? 0);
  advanceClock(delta, [rate, phase === 'won' ? pace : rate]);
  play(delta);
  moveWords(delta);

  try {
    useLayerClock(0);
    slap.render(calm, SLAP_COLOURS, undefined);
    useLayerClock(1);
    // While the star is up the words dance to the music.
    type.render(calm, TYPE_COLOURS, music);
  } catch (error) {
    console.error(error);
  }

  out.globalCompositeOperation = 'source-over';
  out.globalAlpha = 1;
  out.fillStyle = '#000';
  out.fillRect(0, 0, stage.width, stage.height);
  out.drawImage(below.canvas, 0, 0);
  out.globalCompositeOperation = 'difference';
  out.globalAlpha = TYPE_OPACITY;
  // Pushed off the middle, and leaning into the way it is going.
  const m = Math.min(stage.width, stage.height);
  const lean = Math.max(-0.08, Math.min(0.08, (drift.vx / m) * 0.12));
  out.translate(stage.width / 2 + drift.x, stage.height / 2 + drift.y);
  out.rotate(lean);
  out.drawImage(above.canvas, -stage.width / 2, -stage.height / 2);
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalCompositeOperation = 'source-over';
  out.globalAlpha = 1;

  victory.draw(out, stage.width, stage.height, delta, music?.onset ?? 0);
  lhand.draw(stage.width, stage.height, delta, victory.opacity, (h, alpha, front) => slap.drawHandsOn(out, h, alpha, front));
  if (lhand.showing && !victory.showing) lhand.stop();
  sparks.update(delta);
  sparks.draw(out);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ── the game ─────────────────────────────────────────────────────────────────

const score = document.getElementById('score')!;
const won = document.getElementById('won')!;
const tally = document.getElementById('tally')!;
const again = document.getElementById('again') as HTMLButtonElement;

type Phase = 'playing' | 'vanishing' | 'won';
let phase: Phase = 'playing';
let phaseTime = 0;
let left = WHOLE;
let slaps = 0;
let punches = 0;
let firstBlow = 0;
let took = 0;
// His size, on a spring, so each blow shrinks him with a little bounce.
let size = 1;
let sizeVel = 0;
let vanishFrom = 1;

slap.onHit = (hit) => {
  if (phase !== 'playing') return;
  if (hit.punch) punches++;
  else slaps++;
  if (slaps + punches === 1) firstBlow = performance.now();
  left = Math.max(0, left - (hit.punch ? PUNCH_DAMAGE : SLAP_DAMAGE));

  if (hit.punch) sound.punch();
  else sound.slap();

  // Little white stars, knocked off the side the hand came in from.
  const m = Math.min(stage.width, stage.height);
  const x = hit.x * stage.width;
  const y = hit.y * stage.height;
  if (hit.punch) {
    sparks.burst(x, y, { count: 14, size: m * 0.065, speed: m * 1.05, dx: -hit.dx, dy: -hit.dy, spread: 1.7 });
    sparks.ring(x, y, m * 0.12, m * 0.012);
  } else {
    sparks.burst(x, y, { count: 8, size: m * 0.045, speed: m * 0.75, dx: -hit.dx, dy: -hit.dy, spread: 1.6 });
    sparks.ring(x, y, m * 0.07, m * 0.006);
  }
  showScore(true);

  // The words, knocked the same way, less.
  const knock = m * (hit.punch ? WORDS_KNOCK.punch : WORDS_KNOCK.slap);
  drift.vx += hit.dx * knock;
  drift.vy += hit.dy * knock;

  if (left <= 0) {
    phase = 'vanishing';
    phaseTime = 0;
    vanishFrom = size;
    took = (performance.now() - firstBlow) / 1000;
  }
};

/** Runs the game one frame on: his size, the end, the start again. */
function play(delta: number) {
  phaseTime += delta;
  if (phase === 'playing') {
    const target = SMALLEST + (1 - SMALLEST) * (left / WHOLE);
    // In small steps: a stiff spring on a long frame would fly apart.
    for (let t = delta; t > 0; t -= 1 / 120) {
      const dt = Math.min(t, 1 / 120);
      sizeVel += ((target - size) * 160 - sizeVel * 14) * dt;
      size += sizeVel * dt;
    }
  } else if (phase === 'vanishing') {
    // Swells for an instant, then is gone.
    const u = Math.min(1, phaseTime / VANISH);
    size = vanishFrom * Math.max(0, 1 - backIn(u));
    if (u >= 1) win();
  } else if (phaseTime > AGAIN_BY_ITSELF) {
    playAgain();
  } else if (phaseTime > AGAIN_AFTER) {
    won.classList.add('ready');
  }
  slap.setScale(size);
  slap.setHittable(phase === 'playing' && !hands.clapping);
}

function win() {
  const { x, y } = slap.where();
  const m = Math.min(stage.width, stage.height);
  sparks.burst(x * stage.width, y * stage.height, { count: 40, size: m * 0.045, speed: m * 1.5, life: 1.3 });
  phase = 'won';
  phaseTime = 0;
  size = 0;
  victory.start();
  sound.startMusic();
  // The hands as they were a moment ago: one of them will make the L.
  const recent = (side: 'left' | 'right') => (performance.now() - seen[side].at < 1500 ? seen[side].hand : null);
  lhand.start({ left: recent('left'), right: recent('right') });
  score.classList.remove('shown');
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const seconds = Math.round(took);
  tally.textContent = `${count(slaps, 'tapa', 'tapas')} · ${count(punches, 'soco', 'socos')} · `
    + `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  won.classList.add('shown');
}

function playAgain() {
  if (phase !== 'won') return;
  phase = 'playing';
  phaseTime = 0;
  left = WHOLE;
  slaps = 0;
  punches = 0;
  // Back from nothing, popping up to full size on the spring.
  size = 0;
  sizeVel = 0;
  slap.reset();
  victory.leave();
  sound.stopMusic();
  won.classList.remove('shown', 'ready');
  showScore(false);
}

/** The count of blows, top left, once the hands are in. */
let tracking = false;
function showScore(bump: boolean) {
  score.textContent = `TAPAS ${slaps} · SOCOS ${punches}`;
  if (!tracking) return;
  score.classList.add('shown');
  if (bump) {
    score.classList.remove('bump');
    void score.offsetWidth;
    score.classList.add('bump');
  }
}
showScore(false);

again.addEventListener('click', playAgain);
// Its double-click is two clicks on the button, not a request for fullscreen.
again.addEventListener('dblclick', (e) => e.stopPropagation());
window.addEventListener('keydown', (e) => {
  // Enter on a focused button is that button's, not a new game.
  if (e.key === 'Enter' && e.target instanceof HTMLButtonElement) return;
  if (e.key === 'r' || e.key === 'R' || e.key === 'Enter') playAgain();
});

/** The words, on their spring, following the hands while the game is on. */
function moveWords(delta: number) {
  const up = phase === 'playing' ? [hands.left, hands.right].filter((h) => h !== null) : [];
  const toward = (axis: 'x' | 'y', size: number) =>
    up.length ? (up.reduce((t, h) => t + h.position[axis], 0) / up.length - 0.5) * size * WORDS_FOLLOW : 0;
  const tx = toward('x', stage.width);
  const ty = toward('y', stage.height);
  for (let t = delta; t > 0; t -= 1 / 120) {
    const dt = Math.min(t, 1 / 120);
    drift.vx += ((tx - drift.x) * 40 - drift.vx * 7) * dt;
    drift.vy += ((ty - drift.y) * 40 - drift.vy * 7) * dt;
    drift.x += drift.vx * dt;
    drift.y += drift.vy * dt;
  }
}

/** 0 to 1, pulling back a little before it goes. */
function backIn(x: number) {
  const c = 1.9;
  return (c + 1) * x ** 3 - c * x ** 2;
}

// ── the camera ───────────────────────────────────────────────────────────────

const intro = document.getElementById('intro')!;
const note = document.getElementById('note')!;
const start = document.getElementById('start') as HTMLButtonElement;

async function begin() {
  sound.wake();
  start.disabled = true;
  start.textContent = '…';
  // The page stays as it is: fullscreen only when asked for (double-click or F).
  let video: HTMLVideoElement;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false,
    });
    video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    if (SHOW_CAMERA) {
      video.id = 'camera';
      document.body.appendChild(video);
    }
  } catch (error) {
    console.error(error);
    intro.classList.add('gone');
    tell('sem câmera, sem tapa — permita a câmera e recarregue a página');
    return;
  }
  intro.classList.add('gone');
  tell('carregando as mãos…');
  try {
    await trackHands(video, setHands);
    note.classList.remove('shown');
    tracking = true;
    if (phase !== 'won') showScore(false);
  } catch (error) {
    console.error(error);
    tell('não deu para carregar o rastreio das mãos — recarregue a página');
  }
}

function tell(text: string) {
  note.textContent = text;
  note.classList.add('shown');
}
start.addEventListener('click', begin);

// Double-click (or F) for fullscreen.
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
window.addEventListener('dblclick', toggleFullscreen);
window.addEventListener('keydown', (e) => { if (e.key === 'f' || e.key === 'F') toggleFullscreen(); });

// ── the sound switch and the credits ─────────────────────────────────────────

const soundSwitch = document.getElementById('sound') as HTMLButtonElement;
function showSound() {
  soundSwitch.classList.toggle('off', !sound.on);
  soundSwitch.setAttribute('aria-label', sound.on ? 'Desligar o som' : 'Ligar o som');
}
function switchSound() {
  sound.wake();
  sound.setOn(!sound.on);
  showSound();
}
showSound();
soundSwitch.addEventListener('click', switchSound);
window.addEventListener('keydown', (e) => { if (e.key === 'm' || e.key === 'M') switchSound(); });

const credits = document.getElementById('credits')!;
const creditsOpen = document.getElementById('credits-open') as HTMLButtonElement;
const creditsClose = document.getElementById('credits-close') as HTMLButtonElement;
function showCredits(open: boolean) {
  credits.hidden = !open;
  if (open) creditsClose.focus();
  else creditsOpen.focus();
}
creditsOpen.addEventListener('click', () => showCredits(true));
creditsClose.addEventListener('click', () => showCredits(false));
// A click outside the card closes it, as does Escape.
credits.addEventListener('click', (e) => { if (e.target === credits) showCredits(false); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !credits.hidden) showCredits(false); });
// Double-clicks on these are clicks, not a request for fullscreen.
for (const el of [soundSwitch, creditsOpen, credits]) el.addEventListener('dblclick', (e) => e.stopPropagation());

// ── the opening, for the stories ─────────────────────────────────────────────

/**
 * Black, ELE(S) NÃO! on top, and the lines one after another: each word
 * rising into view out of a mask, one by one, and once the line is whole it
 * fades out; in the words' red and letters. Then it all fades and the entry
 * is there. A click skips it.
 */
async function tellStory() {
  const story = document.getElementById('story')!;
  let skipped = false;
  const skip = () => { skipped = true; };
  story.addEventListener('click', skip);
  story.hidden = false;
  const top = document.createElement('p');
  top.className = 'top';
  top.textContent = 'ELE(S) NÃO!';
  await document.fonts.ready;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (const sentence of STORY) {
    if (skipped) break;
    const line = document.createElement('p');
    line.className = 'line';
    const words = sentence.split(' ');
    words.forEach((w, i) => {
      const mask = document.createElement('span');
      mask.className = 'mask';
      const word = document.createElement('span');
      word.className = 'word';
      word.textContent = w;
      word.style.animationDelay = `${i * STORY_WORD}ms`;
      mask.appendChild(word);
      line.append(mask, ' ');
    });
    story.replaceChildren(top, line);
    await wait(words.length * STORY_WORD + STORY_HOLD);
    if (sentence !== STORY[STORY.length - 1]) {
      line.classList.add('out');
      await wait(500);
    }
  }
  story.classList.add('gone');
  await wait(800);
  story.hidden = true;
}
if (SHOW_CAMERA) tellStory();

// For testing with made-up hands while developing, and where the head is, to aim them.
if (import.meta.env.DEV) {
  (window as unknown as { setHands: (h: HandData) => void }).setHands = setHands;
  (window as unknown as { where: () => unknown }).where = () => slap.where();
}
