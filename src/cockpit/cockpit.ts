/** Native pixel size of public/assets/handlebar.webp. */
const IMG_W = 1672;
const IMG_H = 940;
/** First row of the image that has handlebar pixels; everything above is transparent. */
const BAR_TOP = 270;
/** Steering column pivot, below the image. */
const PIVOT = { x: 836, y: 1180 };
/** Gauge canvas placement over the dial glass, in image pixels. */
const GAUGE = { x: 615, y: 345, w: 480, h: 220 };

export type CockpitAction = 'horn-down' | 'horn-up' | 'light' | 'signal-left' | 'signal-right' | 'engine';

export interface CockpitView {
  speedKmh: number;
  steer: number;
  leftLamp: boolean;
  rightLamp: boolean;
  headlight: boolean;
  engineOn: boolean;
  odometerKm: number;
}

interface Hotspot {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  down: CockpitAction;
  up?: CockpitAction;
}

/** Switch positions on the left and right switch housings of the asset. */
const HOTSPOTS: Hotspot[] = [
  { x: 368, y: 440, w: 70, h: 78, label: 'Đèn pha', down: 'light' },
  { x: 384, y: 535, w: 100, h: 60, label: 'Còi', down: 'horn-down', up: 'horn-up' },
  { x: 398, y: 594, w: 40, h: 42, label: 'Xi nhan trái', down: 'signal-left' },
  { x: 438, y: 594, w: 40, h: 42, label: 'Xi nhan phải', down: 'signal-right' },
  { x: 1200, y: 615, w: 100, h: 60, label: 'Nút đề', down: 'engine' },
];

export class Cockpit {
  readonly root = document.createElement('div');
  private readonly turn = document.createElement('div');
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img: HTMLImageElement;
  private scale = 1;
  private lastKey = '';
  onAction: (action: CockpitAction) => void = () => {};

  constructor(src: string) {
    this.root.id = 'cockpit';
    this.turn.className = 'cockpit-turn';
    const img = document.createElement('img');
    this.img = img;
    img.src = src;
    img.alt = '';
    img.draggable = false;
    img.width = IMG_W;
    img.height = IMG_H;
    this.canvas.className = 'cockpit-gauge';
    Object.assign(this.canvas.style, {
      left: `${GAUGE.x}px`,
      top: `${GAUGE.y}px`,
      width: `${GAUGE.w}px`,
      height: `${GAUGE.h}px`,
    });
    this.ctx = this.canvas.getContext('2d')!;
    this.turn.style.transformOrigin = `${PIVOT.x}px ${PIVOT.y}px`;
    this.turn.append(img, this.canvas);

    for (const h of HOTSPOTS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hotspot';
      btn.setAttribute('aria-label', h.label);
      btn.title = h.label;
      Object.assign(btn.style, { left: `${h.x}px`, top: `${h.y}px`, width: `${h.w}px`, height: `${h.h}px` });
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('pressed');
        this.onAction(h.down);
      });
      const release = () => {
        if (!btn.classList.contains('pressed')) return;
        btn.classList.remove('pressed');
        if (h.up) this.onAction(h.up);
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('pointercancel', release);
      this.turn.append(btn);
    }
    this.root.append(this.turn);
  }

  /** Fits the bars to the bottom of the screen: arms always reach past both edges. */
  layout(vw: number, vh: number): void {
    const scale = Math.max(vw / (IMG_W - 80), 0.2);
    // Show the bar, dial and grips; let the lower column fall off-screen on short screens.
    const visibleBottom = Math.max(600, Math.min(720, BAR_TOP + (vh * 0.44) / scale));
    const left = (vw - IMG_W * scale) / 2;
    const top = vh - visibleBottom * scale;
    this.scale = scale;
    this.root.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(GAUGE.w * scale * dpr));
    const h = Math.max(1, Math.round(GAUGE.h * scale * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.lastKey = '';
    }
  }

  /** Darkens and warms the photo to match the light around the rider (0 = dark, 1 = under a lamp). */
  setLighting(level: number): void {
    const b = Math.max(0.15, Math.min(1, level));
    this.img.style.filter = `brightness(${b.toFixed(2)}) sepia(0.35) saturate(1.15) hue-rotate(-8deg)`;
  }

  /** Screen-space height covered by the bars, so other UI can sit above them. */
  get coveredHeight(): number {
    const rect = this.root.getBoundingClientRect();
    return window.innerHeight - (rect.top + BAR_TOP * this.scale);
  }

  render(v: CockpitView): void {
    this.turn.style.transform = `rotate(${(v.steer * 7).toFixed(2)}deg)`;
    const key = [
      v.speedKmh.toFixed(1),
      v.leftLamp,
      v.rightLamp,
      v.headlight,
      v.engineOn,
      v.odometerKm.toFixed(1),
      this.canvas.width,
    ].join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.drawGauge(v);
  }

  private drawGauge(v: CockpitView): void {
    const ctx = this.ctx;
    const k = this.canvas.width / GAUGE.w;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    // Clip to the dial glass so the bezel from the photo stays visible.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(240, 108, 222, 95, 0, 0, Math.PI * 2);
    ctx.clip();
    const bg = ctx.createRadialGradient(238, 150, 20, 238, 130, 240);
    bg.addColorStop(0, '#20262b');
    bg.addColorStop(1, '#0c0f11');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, GAUGE.w, GAUGE.h);

    const cx = 238;
    const cy = 158;
    const R = 98;
    const MAX = 200;
    const SWEEP = (96 * Math.PI) / 180;
    const angleFor = (kmh: number) => -SWEEP + (kmh / MAX) * SWEEP * 2;
    const polar = (a: number, r: number) => [cx + Math.sin(a) * r, cy - Math.cos(a) * r] as const;

    // Outer ring.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 4, -Math.PI / 2 - SWEEP, -Math.PI / 2 + SWEEP);
    ctx.stroke();

    // Ticks and numbers.
    ctx.fillStyle = '#f4f4f4';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let s = 0; s <= MAX; s += 10) {
      const a = angleFor(s);
      const major = s % 20 === 0;
      const [x0, y0] = polar(a, R);
      const [x1, y1] = polar(a, R - (major ? 13 : 7));
      ctx.strokeStyle = s >= 160 ? '#ff5a4f' : '#f4f4f4';
      ctx.lineWidth = major ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (s % 40 === 0) {
        const [tx, ty] = polar(a, R - 28);
        ctx.fillText(String(s), tx, ty);
      }
    }
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('km/h', cx, cy - 34);

    // Odometer.
    ctx.fillStyle = '#9fb59a';
    ctx.fillRect(cx - 36, cy + 19, 72, 15);
    ctx.fillStyle = '#1f2a1d';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillText(`${v.odometerKm.toFixed(1).padStart(6, '0')} km`, cx, cy + 27);

    // Needle.
    const a = angleFor(Math.min(MAX, Math.max(0, v.speedKmh)));
    const [nx, ny] = polar(a, R - 6);
    const [tx, ty] = polar(a + Math.PI, 14);
    ctx.strokeStyle = '#ef3b2d';
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    ctx.fillStyle = '#d2271c';
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Warning lamps.
    const arrow = (x: number, dir: -1 | 1, lit: boolean) => {
      ctx.fillStyle = lit ? '#3ee86f' : '#1f3526';
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
    };
    arrow(82, -1, v.leftLamp);
    arrow(398, 1, v.rightLamp);
    ctx.fillStyle = v.headlight ? '#3d8bff' : '#1a2840';
    ctx.beginPath();
    ctx.arc(370, 140, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = v.engineOn ? '#3ee86f' : '#ffa531';
    ctx.beginPath();
    ctx.arc(108, 140, 7, 0, Math.PI * 2);
    ctx.fill();

    // Glass reflection.
    const gloss = ctx.createLinearGradient(0, 0, 0, GAUGE.h);
    gloss.addColorStop(0, 'rgba(255,255,255,0.14)');
    gloss.addColorStop(0.45, 'rgba(255,255,255,0.02)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(0, 0, GAUGE.w, GAUGE.h);
    ctx.restore();
  }
}
