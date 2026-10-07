/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE GAME'S OWN PICTURES
 * ═══════════════════════════════════════════════════════════════════════════
 * Drawn on top of the two layers, on real time rather than the finger clock,
 * so a blow answers at once whatever tempo the hands are asking for:
 *
 *   Sparks   little white five-pointed stars thrown off where a blow lands,
 *            and a ring knocked out from it
 *   Victory  he is gone: a big solid red star with 13 on it lands in the
 *            middle, its repeats opening out behind it, fainter and fainter,
 *            vibrating, and white stars falling round it
 *   LHand    and the hand stops following the camera and makes an L
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { HandData } from './app/App';

const TAU = Math.PI * 2;
const RED = '#ff202f';
/** The typeface Big Type loads, so the 13 is in the same letters as the words. */
const FONT = '"Strichpunkt Sans", "Arial Black", sans-serif';
/** A regular five-pointed star: its inner corners, as a share of its points. */
const INNER = 0.382;

/** A five-pointed star's outline, a point straight up when `turn` is 0. */
export function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, turn = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = turn - Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

// ── sparks ───────────────────────────────────────────────────────────────────

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fall: number;
  size: number;
  turn: number;
  spin: number;
  age: number;
  life: number;
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  width: number;
  age: number;
  life: number;
}

export interface Burst {
  /** How many stars. */
  count: number;
  /** The biggest one's width, in pixels. */
  size: number;
  /** How fast they leave, in pixels a second. */
  speed: number;
  /** Which way they mostly go; none, all round. */
  dx?: number;
  dy?: number;
  /** How far either side of that way, in radians. */
  spread?: number;
  /** How long the slowest lasts, in seconds. */
  life?: number;
}

export class Sparks {
  private stars: Spark[] = [];
  private rings: Ring[] = [];

  /** Stars thrown off from (x, y), in pixels. */
  burst(x: number, y: number, b: Burst) {
    const aimed = !!(b.dx || b.dy);
    const along = Math.atan2(b.dy ?? 0, b.dx ?? 0);
    const spread = b.spread ?? Math.PI * 0.6;
    const life = b.life ?? 1;
    for (let i = 0; i < b.count; i++) {
      const a = aimed ? along + (Math.random() - 0.5) * 2 * spread : Math.random() * TAU;
      const v = b.speed * (0.35 + Math.random() * 0.85);
      this.stars.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        fall: b.speed * 0.9,
        size: b.size * (0.4 + Math.random() * 0.6),
        turn: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 12,
        age: 0,
        life: life * (0.55 + Math.random() * 0.45),
      });
    }
  }

  /** A ring knocked out from (x, y), growing to `radius`. */
  ring(x: number, y: number, radius: number, width: number, life = 0.35) {
    this.rings.push({ x, y, radius, width, age: 0, life });
  }

  update(dt: number) {
    const drag = Math.exp(-dt * 3);
    for (const s of this.stars) {
      s.age += dt;
      s.vx *= drag;
      s.vy = s.vy * drag + s.fall * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.turn += s.spin * dt;
    }
    for (const r of this.rings) r.age += dt;
    this.stars = this.stars.filter((s) => s.age < s.life);
    this.rings = this.rings.filter((r) => r.age < r.life);
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.stars.length && !this.rings.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#fff';
    for (const r of this.rings) {
      const u = r.age / r.life;
      ctx.globalAlpha = (1 - u) * 0.9;
      ctx.lineWidth = Math.max(0.5, r.width * (1 - u));
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * (1 - (1 - u) ** 3), 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
    for (const s of this.stars) {
      const u = s.age / s.life;
      // Out at full size at once, then shrinking away.
      const k = Math.min(1, u * 10) * (1 - u * u);
      if (k <= 0) continue;
      const r = (s.size / 2) * k;
      ctx.globalAlpha = Math.min(1, (1 - u) * 2);
      ctx.shadowBlur = r * 1.2;
      starPath(ctx, s.x, s.y, r, r * 0.45, s.turn);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ── victory ──────────────────────────────────────────────────────────────────

/** When things happen, in seconds from the moment he goes. */
const STAR_IN = 0.15;
const STAR_LANDS = 0.55;
const STAR_SETTLES = 1.05;
const NUMBER_IN = 0.8;
const NUMBER_SLAMS = 1.1;
/** How long it takes to clear away when the game starts again. */
const LEAVE = 0.6;
/** The star's repeats behind it: how many, how much bigger each, how strong the nearest. */
const ECHOES = 7;
const ECHO_STEP = 0.17;
const ECHO_ALPHA = 0.3;

/** Where the big star stands, and how big: its middle and the reach of its points. */
export function starGeometry(width: number, height: number) {
  // Big: a third of the frame's height, or most of a phone's width.
  const R = Math.min(width * 0.4, height * 0.3);
  // The star's points reach further up than down: lift it so it looks
  // centred, a little above the middle, leaving room for the score below.
  return { cx: width / 2, cy: height * 0.45 + R * 0.095, R };
}

export class Victory {
  /** Seconds since he went; below zero, nothing showing. */
  private t = -1;
  private fade = 1;
  private leaving = false;
  private sparks = new Sparks();
  private landed = false;
  private slammed = false;
  private showered = 0;

  get showing() {
    return this.t >= 0;
  }

  /** How much of it is showing: 1, and down to 0 as it clears away. */
  get opacity() {
    return this.t >= 0 ? Math.max(0, this.fade) : 0;
  }

  start() {
    this.t = 0;
    this.fade = 1;
    this.leaving = false;
    this.landed = false;
    this.slammed = false;
    this.showered = 0;
  }

  /** Clears away. */
  leave() {
    if (this.showing) this.leaving = true;
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number, dt: number) {
    if (this.t < 0) return;
    this.t += dt;
    if (this.leaving) {
      this.fade -= dt / LEAVE;
      if (this.fade <= 0) {
        this.t = -1;
        return;
      }
    }
    const t = this.t;
    const m = Math.min(width, height);
    const { cx, cy, R } = starGeometry(width, height);

    // The moments, each once.
    if (!this.landed && t >= STAR_LANDS) {
      this.landed = true;
      this.sparks.ring(cx, cy, Math.hypot(width, height) * 0.6, m * 0.03, 0.9);
      this.sparks.burst(cx, cy, { count: 36, size: m * 0.05, speed: m * 1.6, life: 1.4 });
    }
    if (!this.slammed && t >= NUMBER_SLAMS) {
      this.slammed = true;
      this.sparks.ring(cx, cy, R * 1.5, m * 0.018, 0.5);
      this.sparks.burst(cx, cy, { count: 18, size: m * 0.035, speed: m * 1.1, life: 1 });
    }
    // Once it has settled, a steady fall of white stars from round its edge.
    if (t > STAR_SETTLES && !this.leaving) {
      const due = Math.floor((t - STAR_SETTLES) * 9);
      for (; this.showered < due; this.showered++) {
        const a = Math.random() * TAU;
        this.sparks.burst(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9, {
          count: 1, size: m * 0.03, speed: m * 0.35, dx: Math.cos(a), dy: Math.sin(a), spread: 0.4, life: 2,
        });
      }
    }
    this.sparks.update(dt);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // The two layers stay, dimmed, behind it.
    ctx.fillStyle = '#000';
    ctx.globalAlpha = this.fade * 0.55 * ease(t / 0.5);
    ctx.fillRect(0, 0, width, height);

    // One flash as he goes.
    if (t < 0.25) {
      ctx.globalAlpha = this.fade * 0.3 * (1 - t / 0.25);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
    }

    // The star: spun in, overshooting, then breathing and rocking a little.
    const u = (t - STAR_IN) / (STAR_SETTLES - STAR_IN);
    if (u > 0) {
      const settle = Math.min(1, u);
      const scale = backOut(settle) * (1 + 0.03 * Math.sin(t * 2.6) * ease(u - 1));
      const shake = this.slammed ? Math.exp(-(t - NUMBER_SLAMS) * 9) * m * 0.012 : 0;
      const turn = -TAU * 0.75 * (1 - ease(settle)) + 0.05 * Math.sin(t * 1.1) * ease(u - 1);
      const x = cx + (Math.random() - 0.5) * shake;
      const y = cy + (Math.random() - 0.5) * shake;
      const r = R * Math.max(0, scale);

      // Its repeats, opening out from it as it lands, each bigger and
      // fainter than the last, and vibrating: a quick pulse running out
      // through them, and a shiver that grows toward the outside.
      const open = ease((t - STAR_LANDS) / 0.8);
      ctx.fillStyle = RED;
      for (let k = ECHOES; k >= 1 && open > 0; k--) {
        const pulse = 1 + 0.035 * Math.sin(t * 9 - k * 0.9);
        const er = r * (1 + k * ECHO_STEP * open) * pulse;
        const shiver = R * 0.012 * Math.sqrt(k);
        ctx.globalAlpha = this.fade * ECHO_ALPHA * (1 - (k - 1) / ECHOES);
        starPath(ctx, x + (Math.random() - 0.5) * shiver, y + (Math.random() - 0.5) * shiver,
          er, er * INNER, turn + 0.03 * Math.sin(t * 7 + k * 1.3));
        ctx.fill();
      }

      // The star itself, solid.
      ctx.globalAlpha = this.fade;
      starPath(ctx, x, y, r, r * INNER, turn);
      ctx.fill();

      // 13, slammed down on it like a stamp.
      const n = (t - NUMBER_IN) / (NUMBER_SLAMS - NUMBER_IN);
      if (n > 0) {
        const stamp = 1 + 1.4 * (1 - Math.min(1, n)) ** 2;
        ctx.globalAlpha = this.fade * Math.min(1, n * 1.5);
        ctx.translate(x, y);
        ctx.rotate(turn);
        ctx.scale(stamp * scale, stamp * scale);
        drawNumber(ctx, '13', R);
      }
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = this.fade;
    this.sparks.draw(ctx);
    ctx.restore();
  }
}

/**
 * The number, white, centred on the origin, well inside the star: within the
 * solid middle between its arms, which is about 0.72 of its reach across.
 */
function drawNumber(ctx: CanvasRenderingContext2D, text: string, R: number) {
  ctx.font = `900 100px ${FONT}`;
  const probe = ctx.measureText(text);
  const size = (100 * R * 0.6) / Math.max(1, probe.width);
  ctx.font = `900 ${size}px ${FONT}`;
  const box = ctx.measureText(text);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 0, (box.actualBoundingBoxAscent - box.actualBoundingBoxDescent) / 2 + R * 0.01);
}

// ── the L ────────────────────────────────────────────────────────────────────

/**
 * A hand making an L: the index finger straight up, the thumb straight out
 * to the right, the other three folded down. The tracker's 21 points, in
 * units of the hand's size (the wrist to the middle finger's knuckle),
 * measured from the wrist, y down.
 */
const L_POSE: [number, number][] = [
  [0, 0], // wrist
  [0.3, -0.22], [0.58, -0.4], [0.86, -0.5], [1.12, -0.56], // thumb, out to the right
  [0.3, -0.95], [0.33, -1.4], [0.35, -1.7], [0.36, -1.95], // index, up
  [0.05, -1], [0.07, -1.22], [0.06, -1.04], [0.05, -0.86], // middle, folded
  [-0.18, -0.95], [-0.19, -1.15], [-0.18, -0.98], [-0.16, -0.82], // ring, folded
  [-0.38, -0.84], [-0.4, -1], [-0.38, -0.86], [-0.35, -0.74], // little finger, folded
];
/** How long the hand takes to become the L, and the other one to go. */
const L_FORMS = 0.9;
const OTHER_GOES = 0.4;

type Point = { x: number; y: number; z: number };

/**
 * When he is gone the hands stop following the camera. One of them — the
 * right, if both were up — moves beside the star and makes an L; the other
 * fades where it stopped. With no hand up at all, the L simply appears.
 */
export class LHand {
  private t = -1;
  private from: Point[] | null = null;
  private other: Point[] | null = null;

  get showing() {
    return this.t >= 0;
  }

  /** Takes the hands as they were when he went. */
  start(hands: HandData) {
    const right = hands.right?.landmarks?.length === 21 ? hands.right.landmarks : null;
    const left = hands.left?.landmarks?.length === 21 ? hands.left.landmarks : null;
    this.from = (right ?? left)?.map((p) => ({ ...p })) ?? null;
    this.other = right && left ? left.map((p) => ({ ...p })) : null;
    this.t = 0;
  }

  stop() {
    this.t = -1;
  }

  /** Draws them, through `paint`, the Slap's own hand outline, at `fade`. */
  draw(width: number, height: number, dt: number, fade: number, paint: (hands: HandData, alpha: number) => void) {
    if (this.t < 0 || fade <= 0) return;
    this.t += dt;
    const k = smoothstep(this.t / L_FORMS);

    // Where the L goes: beside the star when there is room, over its lower
    // right point on a narrow screen, bobbing gently once it is made.
    const { cx, cy, R } = starGeometry(width, height);
    const s = R * 0.55;
    const wide = width >= height;
    const ax = wide ? cx + R * 1.5 : cx + R * 0.55;
    const ay = (wide ? cy : cy + R * 1.25) + Math.sin(this.t * 2.6) * 0.04 * s * smoothstep(this.t - L_FORMS);
    const wx = ax - 0.35 * s;
    const wy = ay + 0.83 * s;
    // With nothing to move from, it grows in where it will stand.
    const grow = this.from ? 1 : 0.6 + 0.4 * k;
    const target = L_POSE.map(([x, y]) => ({ x: (ax + (wx - ax + x * s) * grow) / width, y: (ay + (wy - ay + y * s) * grow) / height, z: 0 }));
    const points = this.from
      ? target.map((p, i) => ({ x: lerp(this.from![i].x, p.x, k), y: lerp(this.from![i].y, p.y, k), z: 0 }))
      : target;
    paint(asHands(points), fade * (this.from ? 1 : k));

    if (this.other && this.t < OTHER_GOES) paint(asHands(this.other), fade * (1 - this.t / OTHER_GOES));
  }
}

/** A drawn hand, as the Slap's outline reads one. */
function asHands(points: Point[]): HandData {
  return { left: null, right: { position: { x: points[9].x, y: points[9].y }, gesture: 'none', landmarks: points } };
}

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

function smoothstep(x: number) {
  const u = Math.max(0, Math.min(1, x));
  return u * u * (3 - 2 * u);
}

/** 0 to 1, slowing into the end. */
function ease(x: number) {
  const u = Math.max(0, Math.min(1, x));
  return 1 - (1 - u) ** 3;
}

/** 0 to 1, overshooting and coming back. */
function backOut(x: number) {
  const c = 2.2;
  const u = Math.max(0, Math.min(1, x)) - 1;
  return 1 + (c + 1) * u ** 3 + c * u ** 2;
}
