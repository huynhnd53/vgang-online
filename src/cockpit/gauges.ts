/**
 * Speedometer faces drawn over the dial glass of the handlebar photo.
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
  {
    id: 'digital',
    name: 'Điện tử',
    description: 'Số to kiểu màn LCD, thanh tốc độ',
    draw(ctx, v) {
      fillLens(ctx, '#0f2a2c', '#061214');
      // Segmented speed bar along the top.
      const segs = 28;
      const lit = Math.round((Math.min(MAX, v.speedKmh) / MAX) * segs);
      for (let k = 0; k < segs; k++) {
        const t = k / (segs - 1);
        const a = -1.25 + t * 2.5;
        const [x, y] = polar(a, 112, CX, 196);
        const on = k < lit;
        const col = t < 0.6 ? [127, 249, 230] : t < 0.82 ? [255, 214, 90] : [255, 90, 80];
        ctx.fillStyle = on ? `rgb(${col.join(',')})` : 'rgba(127,249,230,0.1)';
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillRect(-4, -9, 8, 18);
        ctx.restore();
      }
      // Ghost digits behind the reading, like an unlit LCD.
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 66px "DS-Digital", ui-monospace, Menlo, monospace';
      ctx.fillStyle = 'rgba(127,249,230,0.08)';
      ctx.fillText('888', CX, 128);
      ctx.save();
      ctx.shadowColor = 'rgba(127,249,230,0.6)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#7ff9e6';
      ctx.fillText(String(Math.round(v.speedKmh)).padStart(3, ' '), CX, 128);
      ctx.restore();
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(127,249,230,0.7)';
      ctx.fillText('km/h', CX + 78, 146);
      odometer(ctx, v, CX, 182, 'rgba(127,249,230,0.12)', '#7ff9e6');
      lamps(ctx, v, { ...DEFAULT_LAMPS, arrowOff: '#123a36', beamOff: '#122436', engineOn: '#7ff9e6' }, true);
      gloss(ctx, 0.08);
    },
  },
  {
    id: 'sport',
    name: 'Thể thao',
    description: 'Vạch cam, vùng đỏ, kim trắng phát sáng',
    draw(ctx, v) {
      // Carbon-like weave.
      fillLens(ctx, '#1a1a1c', '#070708');
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (let x = 0; x < GAUGE_W; x += 8) for (let y = (x / 8) % 2 ? 0 : 4; y < GAUGE_H; y += 8) ctx.fillRect(x, y, 4, 4);
      const sweep = 100;
      const s = (sweep * Math.PI) / 180;
      // Red zone band.
      ctx.strokeStyle = 'rgba(255,40,30,0.85)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(CX, CY, 96, -Math.PI / 2 + angleFor(100, sweep), -Math.PI / 2 + s);
      ctx.stroke();
      // Lit progress arc.
      ctx.save();
      ctx.shadowColor = '#ff7a1a';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#ff7a1a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(CX, CY, 104, -Math.PI / 2 - s, -Math.PI / 2 + angleFor(v.speedKmh, sweep));
      ctx.stroke();
      ctx.restore();
      ticks(ctx, { r: 92, sweep, color: '#ff9a4a', red: '#ff3b30', redFrom: 100, numbers: '#ffffff', font: 'italic bold 16px system-ui, sans-serif', numberR: 66 });
      ctx.textAlign = 'center';
      ctx.font = 'italic bold 22px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(Math.round(v.speedKmh)), CX, CY + 28);
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.fillStyle = '#ff9a4a';
      ctx.fillText('KM/H', CX, CY - 32);
      needle(ctx, v.speedKmh, sweep, 94, '#ffffff', 3, '#ff7a1a', '#ff7a1a');
      lamps(ctx, v, { ...DEFAULT_LAMPS, engineOn: '#ff7a1a' });
      gloss(ctx, 0.1);
    },
  },
  {
    id: 'retro',
    name: 'Retro',
    description: 'Mặt kem, chữ có chân, viền mạ crôm',
    draw(ctx, v) {
      fillLens(ctx, '#2a1d14', '#120c08');
      // Cream face with a chrome bezel.
      const face = ctx.createRadialGradient(CX, CY - 20, 10, CX, CY, 118);
      face.addColorStop(0, '#f6ecd2');
      face.addColorStop(1, '#d9c79f');
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.arc(CX, CY, 112, 0, Math.PI * 2);
      ctx.fill();
      const chrome = ctx.createLinearGradient(CX - 120, CY - 120, CX + 120, CY + 120);
      chrome.addColorStop(0, '#f2f2f2');
      chrome.addColorStop(0.5, '#7d7d7d');
      chrome.addColorStop(1, '#e6e6e6');
      ctx.strokeStyle = chrome;
      ctx.lineWidth = 6;
      ctx.stroke();
      ticks(ctx, { r: 100, sweep: 96, color: '#2b2118', red: '#a8261c', numbers: '#2b2118', font: 'bold 18px Georgia, "Times New Roman", serif', numberR: 74 });
      ctx.font = 'italic 11px Georgia, serif';
      ctx.fillStyle = '#5b4632';
      ctx.fillText('km/h', CX, CY - 36);
      // Drum-style odometer.
      const digits = v.odometerKm.toFixed(1).replace('.', '').padStart(6, '0');
      for (let k = 0; k < 6; k++) {
        const x = CX - 36 + k * 12;
        ctx.fillStyle = k === 5 ? '#f3efe6' : '#1d1814';
        ctx.fillRect(x, CY + 18, 11, 16);
        ctx.fillStyle = k === 5 ? '#1d1814' : '#f3efe6';
        ctx.font = 'bold 12px Georgia, serif';
        ctx.fillText(digits[k], x + 5.5, CY + 27);
      }
      needle(ctx, v.speedKmh, 96, 96, '#1d1814', 2.5, '#1d1814');
      lamps(ctx, v, { ...DEFAULT_LAMPS, arrowOff: '#3b3326', beamOff: '#2a2a33', engineOff: '#b06a1f' });
      gloss(ctx, 0.2);
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Vòng sáng xanh tím, số lớn ở giữa',
    draw(ctx, v) {
      fillLens(ctx, '#0d0820', '#020106');
      const sweep = (110 * Math.PI) / 180;
      const start = -Math.PI / 2 - sweep;
      const end = -Math.PI / 2 + angleFor(v.speedKmh, 110);
      // Track.
      ctx.strokeStyle = 'rgba(120,90,255,0.15)';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(CX, CY, 92, start, -Math.PI / 2 + sweep);
      ctx.stroke();
      // Glowing progress with a cyan-to-magenta gradient.
      const g = ctx.createLinearGradient(CX - 100, 0, CX + 100, 0);
      g.addColorStop(0, '#00e5ff');
      g.addColorStop(1, '#ff3df2');
      ctx.save();
      ctx.shadowColor = '#7a5cff';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = g;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(CX, CY, 92, start, Math.max(start + 0.001, end));
      ctx.stroke();
      ctx.restore();
      ctx.lineCap = 'butt';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px system-ui, sans-serif';
      ctx.fillText(String(Math.round(v.speedKmh)), CX, CY - 22);
      ctx.restore();
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.fillStyle = '#b9a8ff';
      ctx.fillText('km/h', CX, CY + 8);
      odometer(ctx, v, CX, CY + 30, 'rgba(122,92,255,0.18)', '#e6dcff');
      lamps(ctx, v, { arrowOn: '#00ffa3', arrowOff: '#1b1636', beamOn: '#00e5ff', beamOff: '#1b1636', engineOn: '#ff3df2', engineOff: '#5a2a4f' }, true);
      gloss(ctx, 0.08);
    },
  },
];

export const DEFAULT_GAUGE = 'classic';

export function gaugeTheme(id: string): GaugeTheme {
  return GAUGE_THEMES.find((t) => t.id === id) ?? GAUGE_THEMES[0];
}

/** Draws a face clipped to the dial glass into a canvas of any size (live gauge or a preview). */
export function drawGauge(canvas: HTMLCanvasElement, theme: GaugeTheme, v: GaugeView): void {
  const ctx = canvas.getContext('2d')!;
  const k = canvas.width / GAUGE_W;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(LENS.x, LENS.y, LENS.rx, LENS.ry, 0, 0, Math.PI * 2);
  ctx.clip();
  theme.draw(ctx, v);
  ctx.restore();
}
