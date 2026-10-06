import type { CockpitAction } from './cockpit';
import type { GaugeClip } from './classicGauge';

export interface Hotspot {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  down: CockpitAction;
  up?: CockpitAction;
}

/**
 * One rideable front end: a transparent first-person photo of the handlebars plus where its parts are.
 * All coordinates are in the image's own pixels.
 */
export interface BikeDef {
  id: string;
  name: string;
  description: string;
  /** File under public/assets/. */
  image: string;
  width: number;
  height: number;
  /** First image row with handlebar pixels; everything above is transparent. */
  barTop: number;
  /** Rows to keep on screen below barTop on short and tall screens. */
  visibleBottom: [number, number];
  /** Share of the image width that spans the screen width (the rest falls off the sides). */
  fit?: number;
  /** Steering column pivot (may lie below the image). */
  pivot: { x: number; y: number };
  /** Rectangle covering the instrument; the red scooter's gauge is drawn into it. */
  gauge: { x: number; y: number; w: number; h: number };
  /** Enlarges the gauge's numbers on small instruments. */
  textScale?: number;
  gaugeClip: GaugeClip;
  hotspots: Hotspot[];
}

const SIG = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

export const BIKES: BikeDef[] = [
  {
    id: 'scooter-red',
    name: 'Tay ga đỏ',
    description: 'Đầu xe tay ga, mặt đồng hồ hình bầu dục',
    image: 'handlebar.webp',
    width: 1672,
    height: 940,
    barTop: 270,
    visibleBottom: [600, 720],
    pivot: { x: 836, y: 1180 },
    gauge: { x: 615, y: 345, w: 480, h: 220 },
    gaugeClip: 'ellipse',
    fit: 0.952,
    hotspots: [
      { x: 368, y: 440, w: 70, h: 78, label: 'Đèn pha', down: 'light' },
      { x: 384, y: 535, w: 100, h: 60, label: 'Còi', down: 'horn-down', up: 'horn-up' },
      { x: 398, y: 594, w: 40, h: 42, label: 'Xi nhan trái', down: 'signal-left' },
      { x: 438, y: 594, w: 40, h: 42, label: 'Xi nhan phải', down: 'signal-right' },
      { x: 1200, y: 615, w: 100, h: 60, label: 'Nút đề', down: 'engine' },
    ],
  },
  {
    id: 'scooter-lcd-blue',
    name: 'Tay ga LCD xanh',
    description: 'Đầu xe tay ga đen, màn LCD xanh dương',
    image: 'bikes/lcd-blue.png',
    width: 523,
    height: 237,
    barTop: 4,
    visibleBottom: [140, 237],
    pivot: { x: 262, y: 300 },
    gauge: { x: 199, y: 49, w: 94, h: 50 },
    gaugeClip: 'rect',
    textScale: 1.6,
    hotspots: [
      { ...SIG(68, 66, 26, 18), label: 'Đèn pha', down: 'light' },
      { ...SIG(68, 85, 26, 16), label: 'Còi', down: 'horn-down', up: 'horn-up' },
      { ...SIG(56, 102, 18, 14), label: 'Xi nhan trái', down: 'signal-left' },
      { ...SIG(74, 102, 18, 14), label: 'Xi nhan phải', down: 'signal-right' },
      { ...SIG(400, 62, 30, 38), label: 'Nút đề', down: 'engine' },
    ],
  },
  {
    id: 'underbone-amber',
    name: 'Xe số kim cam',
    description: 'Xe số, đồng hồ kim, số cam phát sáng ban đêm',
    image: 'bikes/analog-amber.png',
    width: 512,
    height: 221,
    barTop: 6,
    visibleBottom: [150, 221],
    pivot: { x: 256, y: 290 },
    gauge: { x: 138, y: 64, w: 190, h: 90 },
    gaugeClip: 'ellipse',
    hotspots: [
      { ...SIG(50, 112, 26, 16), label: 'Đèn pha', down: 'light' },
      { ...SIG(52, 128, 26, 14), label: 'Còi', down: 'horn-down', up: 'horn-up' },
      { ...SIG(48, 143, 16, 14), label: 'Xi nhan trái', down: 'signal-left' },
      { ...SIG(64, 143, 16, 14), label: 'Xi nhan phải', down: 'signal-right' },
      { ...SIG(405, 100, 34, 40), label: 'Nút đề', down: 'engine' },
    ],
  },
  {
    id: 'scooter-white',
    name: 'Tay ga trắng',
    description: 'Đầu xe tay ga trắng đen, màn LCD xám',
    image: 'bikes/lcd-grey.png',
    width: 693,
    height: 281,
    barTop: 4,
    visibleBottom: [150, 281],
    pivot: { x: 346, y: 380 },
    gauge: { x: 280, y: 25, w: 128, h: 57 },
    // The LCD is a trapezoid, narrower at the bottom.
    gaugeClip: [
      [0, 0],
      [1, 0],
      [0.92, 1],
      [0.13, 1],
    ],
    textScale: 1.6,
    hotspots: [
      { ...SIG(160, 72, 30, 22), label: 'Đèn pha', down: 'light' },
      { ...SIG(158, 100, 34, 20), label: 'Còi', down: 'horn-down', up: 'horn-up' },
      { ...SIG(150, 122, 20, 18), label: 'Xi nhan trái', down: 'signal-left' },
      { ...SIG(170, 122, 20, 18), label: 'Xi nhan phải', down: 'signal-right' },
      { ...SIG(500, 112, 40, 30), label: 'Nút đề', down: 'engine' },
    ],
  },
  {
    id: 'underbone-white-dial',
    name: 'Xe số mặt trắng',
    description: 'Xe số xanh, đồng hồ kim mặt trắng',
    image: 'bikes/white-dial.png',
    width: 519,
    height: 272,
    barTop: 4,
    visibleBottom: [185, 272],
    pivot: { x: 260, y: 360 },
    gauge: { x: 150, y: 52, w: 193, h: 96 },
    gaugeClip: 'ellipse',
    hotspots: [
      { ...SIG(62, 118, 20, 26), label: 'Đèn pha', down: 'light' },
      { ...SIG(70, 150, 40, 14), label: 'Còi', down: 'horn-down', up: 'horn-up' },
      { ...SIG(78, 166, 14, 20), label: 'Xi nhan trái', down: 'signal-left' },
      { ...SIG(92, 166, 14, 20), label: 'Xi nhan phải', down: 'signal-right' },
      { ...SIG(436, 146, 24, 20), label: 'Nút đề', down: 'engine' },
    ],
  },
  {
    id: 'naked-black',
    name: 'Côn tay đen',
    description: 'Xe côn tay, ghi đông trần, màn LCD đen trắng',
    image: 'bikes/lcd-mono.png',
    width: 521,
    height: 197,
    barTop: 2,
    visibleBottom: [160, 197],
    pivot: { x: 260, y: 270 },
    gauge: { x: 238, y: 12, w: 80, h: 43 },
    gaugeClip: 'rect',
    textScale: 1.6,
    hotspots: [
      { ...SIG(102, 106, 18, 30), label: 'Đèn pha', down: 'light' },
      { ...SIG(70, 142, 22, 20), label: 'Còi', down: 'horn-down', up: 'horn-up' },
      { ...SIG(84, 124, 10, 16), label: 'Xi nhan trái', down: 'signal-left' },
      { ...SIG(94, 124, 10, 16), label: 'Xi nhan phải', down: 'signal-right' },
      { ...SIG(440, 110, 26, 40), label: 'Nút đề', down: 'engine' },
    ],
  },
];

export const DEFAULT_BIKE = 'scooter-red';

export function bikeDef(id: string | null): BikeDef {
  return BIKES.find((b) => b.id === id) ?? BIKES.find((b) => b.id === DEFAULT_BIKE)!;
}
