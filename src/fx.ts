/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE GAME'S OWN PICTURES
 * ═══════════════════════════════════════════════════════════════════════════
 * Drawn on top of the two layers, on real time rather than the finger clock,
 * so a blow answers at once whatever tempo the hands are asking for:
 *
 *   Sparks   little white five-pointed stars thrown off where a blow lands,
 *            and a ring knocked out from it
 *   Victory  he is gone: a big red star with 13 on it lands in the middle,
 *            rays turning behind it, rings going out, white stars falling
 * ═══════════════════════════════════════════════════════════════════════════
 */

const TAU = Math.PI * 2;
const RED = '#ff202f';
/** The shadowed half of each of the big star's arms. */
const RED_SHADE = '#c20f1e';
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
const RING_EVERY = 1.7;
/** How long it takes to clear away when the game starts again. */
const LEAVE = 0.6;

export class Victory {
  /** Seconds since he went; below zero, nothing showing. */
  private t = -1;
  private fade = 1;
  private leaving = false;
  private sparks = new Sparks();
  private landed = false;
  private slammed = false;
  private nextRing = 0;
  private showered = 0;

  get showing() {
    return this.t >= 0;
  }

  start() {
    this.t = 0;
    this.fade = 1;
    this.leaving = false;
    this.landed = false;
    this.slammed = false;
    this.nextRing = NUMBER_SLAMS + RING_EVERY;
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
    // Big: a third of the frame's height, or most of a phone's width.
    const R = Math.min(width * 0.4, height * 0.3);
    // The star's points reach further up than down: lift it so it looks
    // centred, a little above the middle, leaving room for the score below.
    const cx = width / 2;
    const cy = height * 0.45 + R * 0.095;

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
    if (t >= this.nextRing) {
      this.nextRing += RING_EVERY;
      this.sparks.ring(cx, cy, Math.hypot(width, height) * 0.55, m * 0.008, 1.6);
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
    ctx.globalAlpha = this.fade;

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

    // Rays, turning slowly, reaching out as the star comes in.
    const reach = Math.hypot(width, height) * ease((t - STAR_IN) / 0.9);
    if (reach > 0) {
      const rays = 16;
      const turn = t * 0.12;
      ctx.globalAlpha = this.fade * 0.2;
      ctx.fillStyle = RED;
      ctx.beginPath();
      for (let i = 0; i < rays; i++) {
        const a = turn + (i / rays) * TAU;
        const half = (TAU / rays) * 0.25;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a - half) * reach, cy + Math.sin(a - half) * reach);
        ctx.lineTo(cx + Math.cos(a + half) * reach, cy + Math.sin(a + half) * reach);
        ctx.closePath();
      }
      ctx.fill();
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

      // A red glow behind it, pulsing.
      const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.9);
      glow.addColorStop(0, 'rgba(255, 32, 47, 0.55)');
      glow.addColorStop(1, 'rgba(255, 32, 47, 0)');
      ctx.globalAlpha = this.fade * (0.75 + 0.25 * Math.sin(t * 2.6));
      ctx.fillStyle = glow;
      ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);

      ctx.globalAlpha = this.fade;
      drawBigStar(ctx, x, y, r, turn);

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

/** The big star, faceted: each arm split down its middle into a lit half and a shaded one. */
function drawBigStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, turn: number) {
  if (r <= 0) return;
  // The whole star in the shade first, so no seam shows between the halves.
  ctx.fillStyle = RED_SHADE;
  starPath(ctx, x, y, r, r * INNER, turn);
  ctx.fill();
  ctx.fillStyle = RED;
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = turn - Math.PI / 2 + (k * TAU) / 5;
    const b = a + Math.PI / 5;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(b) * r * INNER, y + Math.sin(b) * r * INNER);
    ctx.closePath();
  }
  ctx.fill();
}

/** The number, white, as wide as the star's middle, centred on the origin. */
function drawNumber(ctx: CanvasRenderingContext2D, text: string, R: number) {
  ctx.font = `900 100px ${FONT}`;
  const probe = ctx.measureText(text);
  const size = (100 * R * 0.85) / Math.max(1, probe.width);
  ctx.font = `900 ${size}px ${FONT}`;
  const box = ctx.measureText(text);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(80, 0, 8, 0.45)';
  ctx.shadowBlur = R * 0.04;
  ctx.shadowOffsetY = R * 0.025;
  ctx.fillText(text, 0, (box.actualBoundingBoxAscent - box.actualBoundingBoxDescent) / 2);
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
