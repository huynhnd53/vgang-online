/**
 * Live speed shown on a photo's own instrument: the old digits are covered with the screen's colour
 * and the current speed is drawn in seven-segment digits, so the rest of the photo stays as it is.
 */
type Ctx = CanvasRenderingContext2D;

export interface ReadoutStyle {
  /** Screen colour used to cover the photo's printed number. */
  bg: string;
  /** Digit colour. */
  ink: string;
  /** Faint colour of unlit segments; omit for none. */
  off?: string;
  /** Glow around lit segments (backlit LCDs, glowing dials). */
  glow?: string;
  digits: number;
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

/** Draws `kmh` into the whole canvas, which covers the number on the photo. */
export function drawReadout(canvas: HTMLCanvasElement, style: ReadoutStyle, kmh: number): void {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = style.bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, Math.min(W, H) * 0.12);
  ctx.fill();
  const n = style.digits;
  const pad = H * 0.1;
  const h = H - pad * 2;
  const gap = h * 0.22;
  const w = Math.min(h * 0.52, (W - pad * 2 - gap * (n - 1)) / n);
  const t = Math.max(1, h * 0.11);
  if (style.glow) {
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = h * 0.18;
  }
  segNumber(ctx, kmh, n, W - pad, pad, w, h, t, gap, style.ink, style.off ?? 'rgba(0,0,0,0)');
  ctx.shadowBlur = 0;
}
