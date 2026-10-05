import type { CockpitAction } from './cockpit';
import type { ReadoutStyle } from './readout';

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
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
  /**
   * How speed is shown:
   * - 'gauge': a drawn speedometer face over the dial glass (the original photo has a blank dial);
   * - 'readout': the photo stays as it is and only its printed number is replaced by the live speed.
   */
  display:
    | { kind: 'gauge'; rect: Rect; face: string }
    | ({ kind: 'readout'; rect: Rect } & ReadoutStyle);
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
    display: { kind: 'gauge', rect: { x: 615, y: 345, w: 480, h: 220 }, face: 'classic' },
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
    display: { kind: 'readout', rect: { x: 230, y: 62, w: 37, h: 27 }, bg: '#4a45b0', ink: '#e4e9ff', off: 'rgba(228,233,255,0.08)', glow: 'rgba(200,210,255,0.6)', digits: 2 },
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
    display: { kind: 'readout', rect: { x: 218, y: 105, w: 31, h: 14 }, bg: '#24090f', ink: '#ffb27a', off: 'rgba(255,178,122,0.08)', glow: 'rgba(255,120,60,0.7)', digits: 2 },
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
    display: { kind: 'readout', rect: { x: 315, y: 55, w: 33, h: 25 }, bg: '#94979f', ink: '#d9dbdf', off: 'rgba(217,219,223,0.1)', digits: 2 },
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
    display: { kind: 'readout', rect: { x: 230, y: 99, w: 34, h: 12 }, bg: '#cedeee', ink: '#3e4955', digits: 2 },
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
    display: { kind: 'readout', rect: { x: 249, y: 24, w: 29, h: 22 }, bg: '#d1e2f4', ink: '#4c5d72', off: 'rgba(76,93,114,0.08)', digits: 2 },
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
