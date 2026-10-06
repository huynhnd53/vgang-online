/**
 * Speedometer face drawn over the dial glass of the original handlebar photo.
 * Every face draws in the same 480 × 220 canvas space; the dial glass is the ellipse below.
 */
export const GAUGE_W = 480;
export const GAUGE_H = 220;
const LENS = { x: 240, y: 108, rx: 222, ry: 95 };
const CX = 238;
const CY = 158;
const MAX = 140;

export interface GaugeView {
  speedKmh: number;
  leftLamp: boolean;
  rightLamp: boolean;
  headlight: boolean;
  engineOn: boolean;
  odometerKm: number;
}

export interface GaugeTheme {
  id: string;
  name: string;
  description: string;
  draw(ctx: CanvasRenderingContext2D, v: GaugeView): void;
}

type Ctx = CanvasRenderingContext2D;

/** Angle from straight up for a speed on an analogue dial of the given half-sweep (degrees). */
const angleFor = (kmh: number, sweepDeg: number) => {
  const sweep = (sweepDeg * Math.PI) / 180;
  return -sweep + (Math.min(MAX, Math.max(0, kmh)) / MAX) * sweep * 2;
};
const polar = (a: number, r: number, cx = CX, cy = CY) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r] as const;

function fillLens(ctx: Ctx, inner: string, outer: string) {
  const bg = ctx.createRadialGradient(CX, 150, 20, CX, 130, 240);
  bg.addColorStop(0, inner);
  bg.addColorStop(1, outer);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, GAUGE_W, GAUGE_H);
}

interface LampColors {
  arrowOn: string;
  arrowOff: string;
  beamOn: string;
  beamOff: string;
  engineOn: string;
  engineOff: string;
}

const DEFAULT_LAMPS: LampColors = {
  arrowOn: '#3ee86f',
  arrowOff: '#1f3526',
  beamOn: '#3d8bff',
  beamOff: '#1a2840',
  engineOn: '#3ee86f',
  engineOff: '#ffa531',
};

/** Turn-signal arrows, high-beam and engine lamps in the same places on every face. */
function lamps(ctx: Ctx, v: GaugeView, c: LampColors = DEFAULT_LAMPS, glow = false) {
  const arrow = (x: number, dir: -1 | 1, lit: boolean) => {
    ctx.save();
    ctx.fillStyle = lit ? c.arrowOn : c.arrowOff;
    if (glow && lit) {
      ctx.shadowColor = c.arrowOn;
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.moveTo(x + dir * 14, 92);
    ctx.lineTo(x - dir * 2, 80);
    ctx.lineTo(x - dir * 2, 86);
    ctx.lineTo(x - dir * 14, 86);
    ctx.lineTo(x - dir * 14, 98);
    ctx.lineTo(x - dir * 2, 98);
    ctx.lineTo(x - dir * 2, 104);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  arrow(82, -1, v.leftLamp);
  arrow(398, 1, v.rightLamp);
  const dot = (x: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, 140, 7, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(370, v.headlight ? c.beamOn : c.beamOff);
  dot(108, v.engineOn ? c.engineOn : c.engineOff);
}

function gloss(ctx: Ctx, strength = 0.14) {
  const g = ctx.createLinearGradient(0, 0, 0, GAUGE_H);
  g.addColorStop(0, `rgba(255,255,255,${strength})`);
  g.addColorStop(0.45, 'rgba(255,255,255,0.02)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GAUGE_W, GAUGE_H);
}

function odometer(ctx: Ctx, v: GaugeView, x: number, y: number, bg: string, fg: string, font = 'bold 11px ui-monospace, monospace') {
  ctx.fillStyle = bg;
  ctx.fillRect(x - 36, y - 8, 72, 15);
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${v.odometerKm.toFixed(1).padStart(6, '0')} km`, x, y);
}

function ticks(
  ctx: Ctx,
  opts: { r: number; sweep: number; color: string; red?: string; redFrom?: number; numbers?: string; font?: string; numberR?: number },
) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let s = 0; s <= MAX; s += 10) {
    const a = angleFor(s, opts.sweep);
    const major = s % 20 === 0;
    const [x0, y0] = polar(a, opts.r);
    const [x1, y1] = polar(a, opts.r - (major ? 13 : 7));
    ctx.strokeStyle = opts.red && s >= (opts.redFrom ?? 120) ? opts.red : opts.color;
    ctx.lineWidth = major ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    if (major && opts.numbers) {
      ctx.fillStyle = opts.numbers;
      ctx.font = opts.font ?? 'bold 17px system-ui, sans-serif';
      const [tx, ty] = polar(a, opts.numberR ?? opts.r - 28);
      ctx.fillText(String(s), tx, ty);
    }
  }
}

function needle(ctx: Ctx, kmh: number, sweep: number, len: number, color: string, width: number, hub: string, glow?: string) {
  const a = angleFor(kmh, sweep);
  const [nx, ny] = polar(a, len);
  const [tx, ty] = polar(a + Math.PI, 14);
  ctx.save();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
  }
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(nx, ny);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(CX, CY, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(CX, CY, 4, 0, Math.PI * 2);
  ctx.fill();
}

export const GAUGE_THEMES: GaugeTheme[] = [
  {
    id: 'classic',
    name: 'Cổ điển',
    description: 'Kim đỏ, vạch trắng trên nền đen',
    draw(ctx, v) {
      fillLens(ctx, '#20262b', '#0c0f11');
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sweep = (96 * Math.PI) / 180;
      ctx.arc(CX, CY, 102, -Math.PI / 2 - sweep, -Math.PI / 2 + sweep);
      ctx.stroke();
      ticks(ctx, { r: 98, sweep: 96, color: '#f4f4f4', red: '#ff5a4f', numbers: '#f4f4f4' });
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.fillText('km/h', CX, CY - 34);
      odometer(ctx, v, CX, CY + 27, '#9fb59a', '#1f2a1d');
      needle(ctx, v.speedKmh, 96, 92, '#ef3b2d', 4, '#d2271c');
      lamps(ctx, v);
      gloss(ctx);
    },
  },
];

export const DEFAULT_GAUGE = 'classic';

export function gaugeTheme(id: string): GaugeTheme {
  return GAUGE_THEMES.find((t) => t.id === id) ?? GAUGE_THEMES[0];
}

/** Draws a face clipped to the oval dial glass into a canvas of any size. Faces are designed in 480 × 220. */
export function drawGauge(canvas: HTMLCanvasElement, theme: GaugeTheme, v: GaugeView): void {
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(canvas.width / GAUGE_W, 0, 0, canvas.height / GAUGE_H, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(LENS.x, LENS.y, LENS.rx, LENS.ry, 0, 0, Math.PI * 2);
  ctx.clip();
  theme.draw(ctx, v);
  ctx.restore();
}
