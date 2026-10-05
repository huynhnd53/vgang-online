import * as THREE from 'three';

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Facade tile covering one floor (3.2 m) by one bay (4 m). Drawn on white so the material colour tints the wall.
 * The top-left pixel is plain wall, which roofs sample.
 */
export function facadeTexture(style: number): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    // Floor line.
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 120, 128, 8);
    if (style === 0) {
      // Two tall shuttered windows.
      for (const x of [18, 74]) {
        ctx.fillStyle = '#3c4a55';
        ctx.fillRect(x, 30, 36, 70);
        ctx.fillStyle = '#6f8fa3';
        ctx.fillRect(x + 3, 33, 30, 32);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x - 4, 100, 44, 6);
      }
    } else if (style === 1) {
      // Wide window with a small balcony rail.
      ctx.fillStyle = '#34424c';
      ctx.fillRect(16, 28, 96, 62);
      ctx.fillStyle = '#7fa6bd';
      ctx.fillRect(20, 32, 42, 54);
      ctx.fillRect(66, 32, 42, 54);
      ctx.fillStyle = '#e6e6e6';
      ctx.fillRect(10, 92, 108, 5);
      for (let x = 12; x < 118; x += 10) ctx.fillRect(x, 92, 3, 24);
    } else {
      // Louvred shutters in green, a common street look.
      for (const x of [20, 72]) {
        ctx.fillStyle = '#3f7d5a';
        ctx.fillRect(x, 26, 36, 76);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        for (let y = 30; y < 100; y += 7) ctx.fillRect(x + 2, y, 32, 2);
      }
    }
  });
}

/** Ground-floor shopfront: roll-up door and a sign band. */
export function shopTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#9aa4ab';
    ctx.fillRect(8, 40, 112, 88);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 44; y < 128; y += 6) ctx.fillRect(8, y, 112, 2);
  });
}

export function sidewalkTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#c9c2b6';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#b5ad9f';
    ctx.fillRect(0, 31, 64, 2);
    ctx.fillRect(31, 0, 2, 64);
  });
}

export function asphaltTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#4a4e52';
    ctx.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 900; k++) {
      const v = 60 + Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
    }
  });
}
