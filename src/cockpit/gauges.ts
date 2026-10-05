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

/** Segments lit for each digit, in the order a b c d e f g (top, top-right, bottom-right, bottom, bottom-left, top-left, middle). */
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  N: 'ebcfa',
  ' ': '',
};

/** One seven-segment digit with unlit segments faintly visible, like a real LCD. */
function seg7(ctx: Ctx, ch: string, x: number, y: number, w: number, h: number, t: number, on: string, off: string, skew = 0.12) {
  const lit = SEGMENTS[ch] ?? '';
  const half = h / 2;
  // Each segment as a hexagon-ish bar between two points.
  const bar = (x0: number, y0: number, x1: number, y1: number) => {
    const horiz = y0 === y1;
    ctx.beginPath();
    if (horiz) {
      ctx.moveTo(x0 + t * 0.6, y0);
      ctx.lineTo(x0 + t, y0 - t / 2);
      ctx.lineTo(x1 - t, y1 - t / 2);
      ctx.lineTo(x1 - t * 0.6, y1);
      ctx.lineTo(x1 - t, y1 + t / 2);
      ctx.lineTo(x0 + t, y0 + t / 2);
    } else {
      ctx.moveTo(x0, y0 + t * 0.6);
      ctx.lineTo(x0 + t / 2, y0 + t);
      ctx.lineTo(x1 + t / 2, y1 - t);
      ctx.lineTo(x1, y1 - t * 0.6);
      ctx.lineTo(x1 - t / 2, y1 - t);
      ctx.lineTo(x0 - t / 2, y0 + t);
    }
    ctx.closePath();
    ctx.fill();
  };
  const segs: Record<string, [number, number, number, number]> = {
    a: [0, 0, w, 0],
    b: [w, 0, w, half],
    c: [w, half, w, h],
    d: [0, h, w, h],
    e: [0, half, 0, h],
    f: [0, 0, 0, half],
    g: [0, half, w, half],
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(1, 0, -skew, 1, skew * h, 0);
  for (const [name, [x0, y0, x1, y1]] of Object.entries(segs)) {
    ctx.fillStyle = lit.includes(name) ? on : off;
    bar(x0, y0, x1, y1);
  }
  ctx.restore();
}

/** Right-aligned number in seven-segment digits; blanks leading zeros. */
function segNumber(ctx: Ctx, value: number, digits: number, right: number, y: number, w: number, h: number, t: number, gap: number, on: string, off: string) {
  const str = String(Math.max(0, Math.round(value))).slice(-digits).padStart(digits, ' ');
  for (let k = 0; k < digits; k++) {
    const x = right - (digits - k) * (w + gap);
    seg7(ctx, str[k], x, y, w, h, t, on, off);
  }
}

/** Rounded panel path used for LCD screens. */
function panelPath(ctx: Ctx, pts: [number, number][], r: number) {
  ctx.beginPath();
  for (let k = 0; k < pts.length; k++) {
    const p0 = pts[(k + pts.length - 1) % pts.length];
    const p1 = pts[k];
    const p2 = pts[(k + 1) % pts.length];
    const a = Math.atan2(p0[1] - p1[1], p0[0] - p1[0]);
    const b = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const s = [p1[0] + Math.cos(a) * r, p1[1] + Math.sin(a) * r];
    const e = [p1[0] + Math.cos(b) * r, p1[1] + Math.sin(b) * r];
    if (k === 0) ctx.moveTo(s[0], s[1]);
    else ctx.lineTo(s[0], s[1]);
    ctx.quadraticCurveTo(p1[0], p1[1], e[0], e[1]);
  }
  ctx.closePath();
}

const clock = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Small fuel gauge arc with E/F marks; the tank is always nearly full in this game. */
function fuelGauge(ctx: Ctx, cx: number, cy: number, r: number, face: string, ink: string, red: string) {
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  for (let k = 0; k <= 4; k++) {
    const a = -1.1 + (k / 4) * 2.2;
    const [x0, y0] = polar(a, r - 3, cx, cy + 6);
    const [x1, y1] = polar(a, r - 9, cx, cy + 6);
    ctx.strokeStyle = k === 0 ? red : ink;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.fillStyle = ink;
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('E', cx - r + 9, cy + 12);
  ctx.fillText('F', cx + r - 9, cy + 12);
  const [nx, ny] = polar(0.85, r - 8, cx, cy + 6);
  ctx.strokeStyle = red;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 6);
  ctx.lineTo(nx, ny);
  ctx.stroke();
}

/** Gear shown on the sport LCD, guessed from speed. */
const gearFor = (kmh: number) => (kmh < 1 ? 'N' : kmh < 15 ? '1' : kmh < 28 ? '2' : kmh < 40 ? '3' : kmh < 52 ? '4' : '5');

/** Faces modelled on real scooter and underbone dashboards. */
const REAL_FACES: GaugeTheme[] = [
  {
    id: 'lcd-blue',
    name: 'LCD xanh dương',
    description: 'Màn xanh phát sáng, số trắng, thanh vòng tua',
    draw(ctx, v) {
      fillLens(ctx, '#15181c', '#07080a');
      panelPath(ctx, [[96, 52], [384, 52], [366, 184], [114, 184]], 14);
      const g = ctx.createLinearGradient(0, 52, 0, 184);
      g.addColorStop(0, '#3550ff');
      g.addColorStop(1, '#1b2fd8');
      ctx.save();
      ctx.shadowColor = 'rgba(70,100,255,0.9)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
      const ink = '#f4f7ff';
      const off = 'rgba(255,255,255,0.09)';
      // Tachometer bar along the top, driven by speed as a stand-in for engine revs.
      const bars = 24;
      const lit = Math.round(Math.min(1, v.speedKmh / 90 + (v.engineOn ? 0.12 : 0)) * bars);
      for (let k = 0; k < bars; k++) {
        const x = 118 + k * 10.5;
        const h = 6 + k * 0.6;
        ctx.fillStyle = k < lit ? (k > 19 ? '#ff6a6a' : ink) : off;
        ctx.fillRect(x, 74 - h, 7, h);
      }
      segNumber(ctx, v.speedKmh, 3, 300, 88, 27, 54, 5.5, 17, ink, off);
      ctx.fillStyle = ink;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('km/h', 306, 136);
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText(clock(), 128, 98);
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.fillText('ODO', 140, 166);
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText(`${v.odometerKm.toFixed(1).padStart(7, ' ')} km`, 168, 166);
      // Fuel bars on the right.
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k < 5 ? ink : off;
        ctx.fillRect(320 + k * 7, 160, 5, 10);
      }
      lamps(ctx, v, { ...DEFAULT_LAMPS, beamOn: '#7fa8ff' });
      gloss(ctx, 0.08);
    },
  },
  {
    id: 'analog-amber',
    name: 'Kim cam đêm',
    description: 'Số cam đỏ phát sáng, kim đỏ, đồng hồ xăng nhỏ',
    draw(ctx, v) {
      fillLens(ctx, '#161b2a', '#06080e');
      ctx.fillStyle = '#0d1120';
      ctx.beginPath();
      ctx.arc(CX, CY, 108, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,80,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.shadowColor = 'rgba(255,90,50,0.9)';
      ctx.shadowBlur = 8;
      ticks(ctx, { r: 100, sweep: 100, color: '#ff8a5a', red: '#ff3b2f', redFrom: 100, numbers: '#ff6a3d', font: 'bold 15px system-ui, sans-serif', numberR: 76 });
      ctx.restore();
      // White odometer drum in the middle.
      const digits = v.odometerKm.toFixed(1).replace('.', '').padStart(5, '0');
      for (let k = 0; k < 5; k++) {
        const x = CX - 30 + k * 12;
        ctx.fillStyle = k === 4 ? '#ff5a3c' : '#f1efe9';
        ctx.fillRect(x, CY - 44, 11, 15);
        ctx.fillStyle = '#121212';
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(digits[k], x + 5.5, CY - 36);
      }
      ctx.fillStyle = '#ff8a5a';
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.fillText('km/h', CX, CY + 26);
      fuelGauge(ctx, 128, 78, 26, '#0d1120', '#ff8a5a', '#ff3b2f');
      needle(ctx, v.speedKmh, 100, 96, '#ff2a1a', 3.5, '#2a2f3a', 'rgba(255,60,30,0.8)');
      lamps(ctx, v, { ...DEFAULT_LAMPS, engineOff: '#ff9a1a' }, true);
      gloss(ctx, 0.1);
    },
  },
  {
    id: 'lcd-grey',
    name: 'LCD xám',
    description: 'Màn xám, số đen, kiểu tay ga đời mới',
    draw(ctx, v) {
      fillLens(ctx, '#2a2e33', '#111316');
      panelPath(ctx, [[90, 64], [390, 64], [372, 176], [108, 176]], 12);
      const g = ctx.createLinearGradient(0, 64, 0, 176);
      g.addColorStop(0, '#a9b1ab');
      g.addColorStop(1, '#868f89');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#4c5350';
      ctx.lineWidth = 3;
      ctx.stroke();
      const ink = '#161a18';
      const off = 'rgba(20,26,24,0.08)';
      segNumber(ctx, v.speedKmh, 3, 262, 84, 23, 48, 5, 15, ink, off);
      ctx.fillStyle = ink;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('km/h', 268, 124);
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText(clock(), 300, 92);
      ctx.fillText(`ODO ${v.odometerKm.toFixed(1)}`, 128, 160);
      // Fuel as a stack of bars on the left.
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k < 5 ? ink : off;
        ctx.fillRect(122, 136 - k * 8, 18 + k * 2, 5);
      }
      ctx.fillText('F', 152, 98);
      lamps(ctx, v, { ...DEFAULT_LAMPS, arrowOff: '#2c3330', beamOff: '#2c3330' });
      gloss(ctx, 0.16);
    },
  },
  {
    id: 'white-dial',
    name: 'Mặt trắng',
    description: 'Mặt kim trắng, số đen, đồng hồ xăng bên phải',
    draw(ctx, v) {
      fillLens(ctx, '#2a2f38', '#0e1014');
      const face = ctx.createRadialGradient(CX, CY - 30, 10, CX, CY, 116);
      face.addColorStop(0, '#ffffff');
      face.addColorStop(1, '#dcdde0');
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.arc(CX, CY, 110, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9aa0a8';
      ctx.lineWidth = 4;
      ctx.stroke();
      ticks(ctx, { r: 102, sweep: 98, color: '#1b1d22', red: '#c8261c', redFrom: 110, numbers: '#15171b', font: 'bold 15px system-ui, sans-serif', numberR: 78 });
      ctx.fillStyle = '#3a3f48';
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.fillText('km/h', CX, CY - 30);
      odometer(ctx, v, CX, CY + 26, '#1b1d22', '#f2f2f2');
      fuelGauge(ctx, 352, 78, 26, '#f3f3f1', '#1b1d22', '#c8261c');
      needle(ctx, v.speedKmh, 98, 98, '#e0261a', 3, '#20232a');
      lamps(ctx, v, { ...DEFAULT_LAMPS, engineOff: '#ff8a1a' });
      gloss(ctx, 0.22);
    },
  },
  {
    id: 'lcd-mono',
    name: 'LCD thể thao',
    description: 'Màn đen trắng, số to, báo số, vòng tua dạng vòng cung',
    draw(ctx, v) {
      fillLens(ctx, '#121315', '#040405');
      panelPath(ctx, [[110, 60], [356, 50], [384, 112], [356, 180], [124, 180], [100, 120]], 12);
      const g = ctx.createLinearGradient(0, 50, 0, 180);
      g.addColorStop(0, '#d9ddd6');
      g.addColorStop(1, '#b6bbb3');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#2a2c2e';
      ctx.lineWidth = 3;
      ctx.stroke();
      const ink = '#0e0f10';
      const off = 'rgba(14,15,16,0.07)';
      // Rev arc in the top right.
      const bars = 18;
      const lit = Math.round(Math.min(1, v.speedKmh / 70 + (v.engineOn ? 0.15 : 0)) * bars);
      for (let k = 0; k < bars; k++) {
        const a = -0.2 + (k / (bars - 1)) * 1.25;
        const [x0, y0] = polar(a, 62, 300, 150);
        const [x1, y1] = polar(a, 76, 300, 150);
        ctx.strokeStyle = k < lit ? (k > 13 ? '#7a0d0d' : ink) : off;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      segNumber(ctx, v.speedKmh, 3, 236, 92, 23, 50, 5, 15, ink, off);
      ctx.fillStyle = ink;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText('km/h', 242, 138);
      // Gear indicator.
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.strokeRect(122, 86, 30, 46);
      seg7(ctx, gearFor(v.speedKmh), 129, 94, 16, 30, 4, ink, off, 0.08);
      ctx.font = '600 9px system-ui, sans-serif';
      ctx.fillText('GEAR', 122, 142);
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText(clock(), 300, 162);
      ctx.fillText(`${v.odometerKm.toFixed(1)} km`, 150, 164);
      lamps(ctx, v, { ...DEFAULT_LAMPS, arrowOff: '#202224', beamOff: '#202224' });
      gloss(ctx, 0.1);
    },
  },
];

export const GAUGE_THEMES: GaugeTheme[] = [
  ...REAL_FACES,
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
  return GAUGE_THEMES.find((t) => t.id === id) ?? GAUGE_THEMES.find((t) => t.id === DEFAULT_GAUGE)!;
}

/**
 * Draws a face into a canvas of any size (live gauge or a preview). Faces are designed in a 480 × 220 space,
 * stretched to the canvas, and clipped to the oval dial glass or a rounded LCD rectangle.
 */
export function drawGauge(canvas: HTMLCanvasElement, theme: GaugeTheme, v: GaugeView, clip: 'ellipse' | 'rect' = 'ellipse'): void {
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(canvas.width / GAUGE_W, 0, 0, canvas.height / GAUGE_H, 0, 0);
  ctx.save();
  ctx.beginPath();
  if (clip === 'ellipse') ctx.ellipse(LENS.x, LENS.y, LENS.rx, LENS.ry, 0, 0, Math.PI * 2);
  else ctx.roundRect(4, 4, GAUGE_W - 8, GAUGE_H - 8, 18);
  ctx.clip();
  theme.draw(ctx, v);
  ctx.restore();
}
