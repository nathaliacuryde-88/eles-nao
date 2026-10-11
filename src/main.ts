import { BigTypeRenderer } from './app/components/renderers/BigTypeRenderer';
import { SlapRenderer } from './app/components/renderers/SlapRenderer';
import { Callouts, LHand, Sparks, Victory, type StarStyle } from './fx';
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
/** Why each blow lands: one per hit, in this order, round again after the last. */
const REASONS = [
  'Esse é porque o Flávio jurou que não conhecia o Vorcaro.',
  'Esse vai pelo golpe do Jair. 27 anos de pena.',
  'Pela rachadinha do Flávio.',
  'Esse é pelas vacinas que o Jair deixou atrasar.',
  'Porque o Flávio deu medalha a um miliciano preso.',
  'Esse é pelas joias sauditas do Jair.',
  'Pela mansão do Flávio com juros camaradas do BRB.',
  'Esse vai pelo Eduardo, que foi pedir tarifaço ao Trump.',
  'Porque o Flávio ofereceu as terras raras ao Trump.',
  'Esse é pela loja de chocolate do Flávio, que o MP chamou de lavanderia.',
  'Pelo Jair, que disse "não sou coveiro" na pandemia.',
  'Porque o Flávio empregou a mãe e a ex-mulher de um miliciano.',
  'Esse é pela anistia que o Flávio quer pros golpistas.',
  'Pelo Eduardo, que pediu sanções contra o Brasil pra salvar o pai.',
  'E esse porque o Flávio só é candidato porque o Jair está preso.',
];
/** And, between them, what it is all for: one of these after every two of the above. */
const CAUSES = [
  'Pela Amazônia em pé.',
  'Pelo SUS, que vacinou o Brasil quando o Jair duvidava da vacina.',
  'Pela continuidade do Bolsa Família.',
  'Pela proteção da Amazônia.',
];
/** The n-th blow's line: two reasons against, then a cause, and round again. */
function lineFor(n: number) {
  return n % 3 === 2 ? CAUSES[Math.floor(n / 3) % CAUSES.length] : REASONS[(n - Math.floor(n / 3)) % REASONS.length];
}
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
 * ?camera at the end of the address plays the opening for the stories, once,
 * after the first round. Without it the camera switch, bottom left,
 * starts off.
 */
const SHOW_CAMERA = new URLSearchParams(location.search).has('camera');
/** With the camera, for the stories: these come in first, word by word, then the page. */
const STORY = [
  'Os argumentos já estão por aí, e muita gente explica o porquê melhor do que eu.',
  'Eu fiz um lugar pra descarregar.',
  'Agora solta a mão.',
];
/** How long the star shows before the opening plays over it, in milliseconds. */
const STORY_AFTER_WIN = 5000;
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
const callouts = new Callouts();
let reason = 0;
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
  callouts.draw(out, stage.width, stage.height, delta);
  drawCamera();
  drawScore();
  showRecording();
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

  // The reason for it, well out from the blow on the side the hand came from,
  // away from the middle of the screen.
  callouts.add(lineFor(reason++), x - hit.dx * m * 0.3, y - hit.dy * m * 0.3 - m * 0.06, hit.dx, hit.dy);

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
  // With ?camera, the opening for the stories plays once, after the first
  // round's star has had its moment, and then the next round starts.
  if (SHOW_CAMERA && !storyTold) {
    storyTold = true;
    setTimeout(() => { tellStory().then(playAgain); }, STORY_AFTER_WIN);
  }
}

function playAgain() {
  if (phase !== 'won') return;
  phase = 'playing';
  phaseTime = 0;
  left = WHOLE;
  slaps = 0;
  reason = 0;
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
let bumped = -9;
function showScore(bump: boolean) {
  score.textContent = `TAPAS ${slaps} · SOCOS ${punches}`;
  if (bump) bumped = performance.now();
}

/**
 * The score, drawn into the game's own frame so it is in a recording too:
 * the count of blows top left while playing (jumping a little on each), and
 * the final tally where the page puts it once he is gone.
 */
function drawScore() {
  out.save();
  out.font = '700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  out.letterSpacing = '0.18em';
  out.shadowColor = 'rgba(0, 0, 0, 0.9)';
  out.shadowBlur = 6;
  out.fillStyle = '#fff';
  if ((tracking || intro.classList.contains('gone')) && phase !== 'won') {
    const k = Math.max(0, 1 - (performance.now() - bumped) / 250);
    out.translate(14, 20);
    out.scale(1 + 0.25 * k, 1 + 0.25 * k);
    out.globalAlpha = 0.8 + 0.2 * k;
    out.textBaseline = 'middle';
    out.fillText(score.textContent ?? '', 0, 0);
  } else if (phase === 'won' && won.classList.contains('shown')) {
    const r = tally.getBoundingClientRect();
    out.font = '700 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    out.textAlign = 'center';
    out.textBaseline = 'middle';
    out.fillText((tally.textContent ?? '').toUpperCase(), r.left + r.width / 2, r.top + r.height / 2);
  }
  out.restore();
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
    cameraVideo = video;
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

// ── the camera on screen, and recording ──────────────────────────────────────

/**
 * The camera's picture can be shown in the top right corner — drawn into the
 * game's own frame, so it is in a recording too. Off unless switched on (or
 * ?camera); the choice is remembered.
 */
let cameraVideo: HTMLVideoElement | null = null;
// On to start, always; the switch turns it off for this visit only.
let cameraOn = true;
const camSwitch = document.getElementById('cam') as HTMLButtonElement;
function showCameraSwitch() {
  camSwitch.classList.toggle('off', !cameraOn);
  camSwitch.setAttribute('aria-label', cameraOn ? 'Esconder a câmera' : 'Mostrar a câmera');
}
function switchCamera() {
  cameraOn = !cameraOn;
  showCameraSwitch();
}
showCameraSwitch();
camSwitch.addEventListener('click', switchCamera);

function drawCamera() {
  const v = cameraVideo;
  if (!cameraOn || !v || v.readyState < 2 || !v.videoWidth) return;
  const w = Math.min(stage.width * 0.208, 192);
  const h = w * 0.75;
  const x = stage.width - w - 12;
  const y = 12;
  // Cropped to fill, mirrored like a mirror.
  const scale = Math.max(w / v.videoWidth, h / v.videoHeight);
  const sw = w / scale;
  const sh = h / scale;
  out.save();
  out.beginPath();
  out.roundRect(x, y, w, h, 12);
  out.clip();
  out.translate(x + w, y);
  out.scale(-1, 1);
  out.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, w, h);
  out.restore();
  out.save();
  out.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  out.lineWidth = 1;
  out.beginPath();
  out.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 12);
  out.stroke();
  out.restore();
}

/**
 * Recording: the game's frame (camera included) and its sound, as a video
 * file saved when it stops — MP4 where the browser can, WebM otherwise.
 * Nothing is sent anywhere. The page's own text over the frame (the entry,
 * the score, the opening) is not in it: only what is drawn.
 */
const recSwitch = document.getElementById('rec') as HTMLButtonElement;
const recTime = recSwitch.querySelector('.time') as HTMLElement;
let recorder: MediaRecorder | null = null;
let recStarted = 0;

function switchRecording() {
  if (recorder) {
    recorder.stop();
    return;
  }
  sound.wake();
  const stream = stage.captureStream(30);
  for (const track of sound.stream()?.getAudioTracks() ?? []) stream.addTrack(track);
  const types = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
  const type = types.find((t) => window.MediaRecorder?.isTypeSupported(t));
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
  } catch (error) {
    console.error(error);
    tell('este navegador não grava a tela');
    setTimeout(() => note.classList.remove('shown'), 3000);
    return;
  }
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = () => {
    for (const track of stream.getVideoTracks()) track.stop();
    const blob = new Blob(chunks, { type: rec.mimeType || type || 'video/webm' });
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eles-nao-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    recorder = null;
    recSwitch.classList.remove('on');
    recSwitch.setAttribute('aria-label', 'Gravar a tela');
    recTime.textContent = 'gravar';
  };
  rec.start(1000);
  recorder = rec;
  recStarted = performance.now();
  recSwitch.classList.add('on');
  recSwitch.setAttribute('aria-label', 'Parar e salvar a gravação');
}
recSwitch.addEventListener('click', switchRecording);

/** The running time on the button while recording. */
function showRecording() {
  if (!recorder) return;
  const s = Math.floor((performance.now() - recStarted) / 1000);
  recTime.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'c' || e.key === 'C') switchCamera();
  if (e.key === 'g' || e.key === 'G') switchRecording();
});

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
for (const el of [soundSwitch, camSwitch, recSwitch, creditsOpen, credits]) el.addEventListener('dblclick', (e) => e.stopPropagation());

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
let storyTold = false;

// For testing with made-up hands while developing, and where the head is, to aim them.
if (import.meta.env.DEV) {
  (window as unknown as { setHands: (h: HandData) => void }).setHands = setHands;
  (window as unknown as { where: () => unknown }).where = () => slap.where();
}
