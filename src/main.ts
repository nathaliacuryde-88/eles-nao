import { BigTypeRenderer } from './app/components/renderers/BigTypeRenderer';
import { SlapRenderer } from './app/components/renderers/SlapRenderer';
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
 * One finger slows everything, five speed it up, a clap explodes.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const WORDS = 'ELE(S) NÃO!';

/** Big Type, as it was set. */
const TYPE = {
  'type.style': 3, // Shear
  'type.size': 1.6,
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

let hands: HandData = { left: null, right: null };
const gesture = createGestureState();
let last = performance.now();

function frame() {
  const now = performance.now();
  const delta = Math.min(0.1, (now - last) / 1000);
  last = now;
  const rate = gestureRate(hands, gesture, delta);
  advanceClock(delta, [rate, rate]);

  try {
    useLayerClock(0);
    slap.render(hands, SLAP_COLOURS, undefined);
    useLayerClock(1);
    type.render(hands, TYPE_COLOURS, undefined);
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
  out.drawImage(above.canvas, 0, 0);
  out.globalCompositeOperation = 'source-over';
  out.globalAlpha = 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ── the camera ───────────────────────────────────────────────────────────────

const intro = document.getElementById('intro')!;
const note = document.getElementById('note')!;
const start = document.getElementById('start') as HTMLButtonElement;

async function begin() {
  start.disabled = true;
  start.textContent = '…';
  try {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } catch {
    // no fullscreen here (iPhone): carry on without it
  }
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
  } catch (error) {
    console.error(error);
    intro.classList.add('gone');
    tell('sem câmera, sem tapa — permita a câmera e recarregue a página');
    return;
  }
  intro.classList.add('gone');
  tell('carregando as mãos…');
  try {
    await trackHands(video, (data) => { hands = data; });
    note.classList.remove('shown');
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

// For testing with made-up hands while developing.
if (import.meta.env.DEV) {
  (window as unknown as { setHands: (h: HandData) => void }).setHands = (h) => { hands = h; };
}
