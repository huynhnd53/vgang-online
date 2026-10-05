import * as THREE from 'three';
import { radialTexture } from './proc';

/**
 * A light source in the street: lamp heads, shop fronts, door lamps.
 * `dir` is the main beam direction; `cosOuter` its cone (−1 for omni).
 */
export interface StreetLight {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  cosOuter: number;
  color: THREE.Color;
  /** Candela, same scale as three.js punctual lights. */
  intensity: number;
  range: number;
  /** Only street lamps get real (shadow-casting, specular) lights. */
  real: boolean;
}

export interface Quality {
  fakeLights: number;
  realLights: number;
  shadows: number;
}

/** Uniform arrays shared by every lit material. */
interface FakeUniforms {
  uFLPos: { value: THREE.Vector4[] };
  uFLDir: { value: THREE.Vector4[] };
  uFLCol: { value: THREE.Vector3[] };
}

/**
 * Lighting for hundreds of street lights on a forward renderer:
 * - the nearest N lights are evaluated per pixel in every lit material (diffuse only, injected into the shader);
 * - the nearest few street lamps also become real SpotLights for specular highlights on the wet road and shadows.
 * Both use the same falloff so they blend without popping.
 */
export class StreetLighting {
  readonly uniforms: FakeUniforms;
  readonly group = new THREE.Group();
  private spots: THREE.SpotLight[] = [];
  private order: number[] = [];
  private tmp = new THREE.Vector3();
  private tmpDir = new THREE.Vector3();

  constructor(
    private lights: StreetLight[],
    private quality: Quality,
  ) {
    const n = quality.fakeLights;
    this.uniforms = {
      uFLPos: { value: Array.from({ length: n }, () => new THREE.Vector4(0, -1000, 0, 0.001)) },
      uFLDir: { value: Array.from({ length: n }, () => new THREE.Vector4(0, -1, 0, 1)) },
      uFLCol: { value: Array.from({ length: n }, () => new THREE.Vector3()) },
    };
    for (let k = 0; k < quality.realLights; k++) {
      const s = new THREE.SpotLight(0xffb067, 0, 30, 1.2, 0.75, 2);
      if (k < quality.shadows) {
        s.castShadow = true;
        s.shadow.mapSize.set(1024, 1024);
        s.shadow.bias = -0.0004;
        s.shadow.normalBias = 0.03;
        s.shadow.camera.near = 0.5;
        s.shadow.camera.far = 32;
      }
      this.group.add(s, s.target);
      this.spots.push(s);
    }
    this.order = lights.map((_, i) => i);
  }

  /** Adds the per-pixel street lights to a standard material. */
  apply<T extends THREE.MeshStandardMaterial>(mat: T, opts: { foliage?: boolean } = {}): T {
    const n = this.quality.fakeLights;
    const foliage = !!opts.foliage;
    const u = this.uniforms;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uFLPos = u.uFLPos;
      shader.uniforms.uFLDir = u.uFLDir;
      shader.uniforms.uFLCol = u.uFLCol;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
#define FL_N ${n}
uniform vec4 uFLPos[FL_N];
uniform vec4 uFLDir[FL_N];
uniform vec3 uFLCol[FL_N];`,
        )
        .replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
{
  vec3 flFrag = -vViewPosition;
  for (int i = 0; i < FL_N; i++) {
    vec3 toL = uFLPos[i].xyz - flFrag;
    float d = length(toL);
    float range = uFLPos[i].w;
    if (d > range) continue;
    vec3 L = toL / d;
    float ndl = ${foliage ? '0.35 + 0.65 * abs(dot(normal, L))' : 'max(dot(normal, L), 0.0)'};
    float spot = smoothstep(uFLDir[i].w, uFLDir[i].w + 0.3, dot(-L, uFLDir[i].xyz));
    float win = clamp(1.0 - pow(d / range, 4.0), 0.0, 1.0);
    float atten = win * win / max(d * d, 4.0);
    reflectedLight.directDiffuse += BRDF_Lambert(material.diffuseColor) * uFLCol[i] * (ndl * spot * atten);
  }
}`,
        );
    };
    mat.customProgramCacheKey = () => `street-lights-${n}-${foliage}`;
    return mat;
  }

  /** Picks the nearest lights for this frame and uploads them in view space. */
  update(camera: THREE.Camera): void {
    const cam = camera.position;
    const lights = this.lights;
    const dist = (i: number) => {
      const p = lights[i].pos;
      return (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2;
    };
    // The order barely changes between frames, so an insertion sort is close to linear.
    const order = this.order;
    const keys = order.map(dist);
    for (let i = 1; i < order.length; i++) {
      const k = keys[i];
      const v = order[i];
      let j = i - 1;
      while (j >= 0 && keys[j] > k) {
        keys[j + 1] = keys[j];
        order[j + 1] = order[j];
        j--;
      }
      keys[j + 1] = k;
      order[j + 1] = v;
    }

    // Real spot lights for the nearest street lamps, fading out with distance.
    const realFade = new Map<number, number>();
    let used = 0;
    for (let r = 0; r < order.length && used < this.spots.length; r++) {
      const i = order[r];
      const L = lights[i];
      if (!L.real) continue;
      const d = Math.sqrt(keys[r]);
      const fade = 1 - THREE.MathUtils.smoothstep(d, 18, 30);
      const s = this.spots[used++];
      s.position.copy(L.pos);
      s.target.position.copy(L.pos).addScaledVector(L.dir, 5);
      s.color.copy(L.color);
      s.intensity = L.intensity * fade;
      s.distance = L.range;
      s.angle = Math.acos(L.cosOuter) + 0.15;
      realFade.set(i, fade);
    }
    for (; used < this.spots.length; used++) this.spots[used].intensity = 0;

    const view = camera.matrixWorldInverse;
    const n = this.quality.fakeLights;
    const pos = this.uniforms.uFLPos.value;
    const dir = this.uniforms.uFLDir.value;
    const col = this.uniforms.uFLCol.value;
    for (let k = 0; k < n; k++) {
      if (k >= order.length) {
        col[k].set(0, 0, 0);
        continue;
      }
      const i = order[k];
      const L = lights[i];
      // Taper the last few slots so lights entering or leaving the set do not pop.
      const tail = THREE.MathUtils.clamp((n - k) / 6, 0, 1);
      const share = (1 - (realFade.get(i) ?? 0)) * tail;
      this.tmp.copy(L.pos).applyMatrix4(view);
      this.tmpDir.copy(L.dir).transformDirection(view);
      pos[k].set(this.tmp.x, this.tmp.y, this.tmp.z, L.range);
      dir[k].set(this.tmpDir.x, this.tmpDir.y, this.tmpDir.z, L.cosOuter);
      col[k].set(L.color.r, L.color.g, L.color.b).multiplyScalar(L.intensity * share);
    }
  }

  /** Light level at a point for dimming the cockpit photo, roughly 0..1. */
  levelAt(x: number, z: number): number {
    let sum = 0;
    for (let r = 0; r < Math.min(12, this.order.length); r++) {
      const L = this.lights[this.order[r]];
      const d2 = (L.pos.x - x) ** 2 + (L.pos.z - z) ** 2;
      sum += (L.intensity / 900) * Math.exp(-d2 / 60);
    }
    return Math.min(1, sum);
  }
}

/** Additive camera-facing glows around bright light sources. */
export function glowPoints(positions: THREE.Vector3[], colors: THREE.Color[], size: number): THREE.Points {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions.flatMap((p) => [p.x, p.y, p.z]), 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors.flatMap((c) => [c.r, c.g, c.b]), 3));
  const tex = radialTexture(128, [
    [0, 'rgba(255,255,255,1)'],
    [0.08, 'rgba(255,255,255,0.85)'],
    [0.25, 'rgba(255,255,255,0.22)'],
    [0.6, 'rgba(255,255,255,0.05)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  const m = new THREE.PointsMaterial({
    size,
    map: tex,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

/**
 * Elongated light reflections on the wet road, always stretched from each light towards the viewer.
 * One instanced quad per light, oriented in the vertex shader.
 */
export function roadReflections(sources: { pos: THREE.Vector3; color: THREE.Color; strength: number }[]): THREE.Mesh {
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.getAttribute('position'));
  g.setAttribute('uv', base.getAttribute('uv'));
  g.instanceCount = sources.length;
  g.setAttribute(
    'aSource',
    new THREE.InstancedBufferAttribute(new Float32Array(sources.flatMap((s) => [s.pos.x, s.pos.y, s.pos.z])), 3),
  );
  g.setAttribute(
    'aColor',
    new THREE.InstancedBufferAttribute(new Float32Array(sources.flatMap((s) => [s.color.r * s.strength, s.color.g * s.strength, s.color.b * s.strength])), 3),
  );
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uFogDensity: { value: 0.012 }, uScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aSource;
      attribute vec3 aColor;
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vFade;
      uniform float uFogDensity;
      void main() {
        vUv = uv;
        vec2 toCam = cameraPosition.xz - aSource.xz;
        float dist = length(toCam);
        vec2 dir = toCam / max(dist, 0.001);
        vec2 side = vec2(-dir.y, dir.x);
        // The reflection starts under the light and stretches towards the viewer.
        float len = clamp(dist * 0.45, 2.0, 22.0);
        float width = 0.9 + aSource.y * 0.08;
        vec2 p = aSource.xz + side * (position.x * width) + dir * ((position.y + 0.5) * len + 0.4);
        vec4 mv = viewMatrix * vec4(p.x, 0.03, p.y, 1.0);
        gl_Position = projectionMatrix * mv;
        float fog = exp(-pow(uFogDensity * length(mv.xyz), 2.0));
        vFade = fog * smoothstep(3.0, 9.0, dist);
        vColor = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vColor;
      varying float vFade;
      uniform float uScale;
      void main() {
        float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float along = vUv.y;
        float a = pow(across, 2.5) * (1.0 - along) * smoothstep(0.0, 0.08, along);
        gl_FragColor = vec4(vColor * a * vFade * uScale, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}
