import type { CockpitAction } from './cockpit';

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
  /** Steering column pivot (may lie below the image). */
  pivot: { x: number; y: number };
  /** Rectangle covering the instrument screen; the live gauge is drawn into it. */
  gauge: { x: number; y: number; w: number; h: number };
  /** Shape the gauge is clipped to: the oval dial glass or a rounded LCD rectangle. */
  gaugeClip: 'ellipse' | 'rect';
  /** Face used when this bike is picked (the rider can still change it). */
  face: string;
  hotspots: Hotspot[];
}

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
    face: 'classic',
    hotspots: [
      { x: 368, y: 440, w: 70, h: 78, label: 'Đèn pha', down: 'light' },
      { x: 384, y: 535, w: 100, h: 60, label: 'Còi', down: 'horn-down', up: 'horn-up' },
      { x: 398, y: 594, w: 40, h: 42, label: 'Xi nhan trái', down: 'signal-left' },
      { x: 438, y: 594, w: 40, h: 42, label: 'Xi nhan phải', down: 'signal-right' },
      { x: 1200, y: 615, w: 100, h: 60, label: 'Nút đề', down: 'engine' },
    ],
  },
];

export const DEFAULT_BIKE = 'scooter-red';

export function bikeDef(id: string | null): BikeDef {
  return BIKES.find((b) => b.id === id) ?? BIKES.find((b) => b.id === DEFAULT_BIKE)!;
}
