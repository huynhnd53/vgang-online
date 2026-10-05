import { DEFAULT_GAUGE, drawGauge, type GaugeTheme, gaugeTheme } from './gauges';

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
  private readonly img: HTMLImageElement;
  private scale = 1;
  private lastKey = '';
  private theme: GaugeTheme = gaugeTheme(DEFAULT_GAUGE);
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

  /** Switches the speedometer face; see gauges.ts for the available themes. */
  setTheme(id: string): void {
    this.theme = gaugeTheme(id);
    this.lastKey = '';
  }

  private drawGauge(v: CockpitView): void {
    drawGauge(this.canvas, this.theme, v);
  }
}
