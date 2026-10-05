import * as THREE from 'three';
import type { City } from '../../sim/city';
import { buildFacadeAtlas, buildSignAtlas } from './facade';
import { buildHouses } from './houses';
import { glowPoints, type Quality, roadReflections, StreetLighting } from './lighting';
import { buildStreets, signalState, type StreetMaterials, wearTexture } from './streets';
import * as S from './surfaces';

export const FOG_COLOR = new THREE.Color(0x0a0c12);
export const FOG_DENSITY = 0.0105;

const SIGNAL_COLORS = [new THREE.Color(1, 0.12, 0.08), new THREE.Color(1, 0.62, 0.05), new THREE.Color(0.1, 1, 0.55)];

/** Dark night sky: deep navy overhead, faint warm light pollution at the horizon. */
function skyDome(): THREE.Mesh {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 zenith = vec3(0.004, 0.008, 0.02);
        vec3 mid = vec3(0.012, 0.016, 0.03);
        vec3 horizon = vec3(0.05, 0.035, 0.03);
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        c = mix(c, zenith, smoothstep(0.18, 0.8, h));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), m);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

export interface NightCity {
  group: THREE.Group;
  lighting: StreetLighting;
  update(time: number, camera: THREE.Camera): void;
}

export function buildNightCity(city: City, quality: Quality): NightCity {
  const group = new THREE.Group();
  group.add(skyDome());

  // Materials (all lit materials receive the per-pixel street lights).
  const asphalt = S.asphalt();
  const wet = S.wetness();
  wet.channel = 1;
  const tiles = S.sidewalkTiles();
  const curb = S.curbStone();
  const leafTex = S.leaves();

  // Lighting needs the full light list before materials compile, so build geometry first.
  const atlas = buildFacadeAtlas();
  const signs = buildSignAtlas();
  const allLots = [...city.blocks.flatMap((b) => b.lots), ...city.outerLots];
  const houses = buildHouses(allLots, atlas, signs.count);

  // Lit materials get the per-pixel street lights once the full light list is known.
  const pending: THREE.MeshStandardMaterial[] = [];
  const lit = <T extends THREE.MeshStandardMaterial>(m: T) => {
    pending.push(m);
    return m;
  };
  const streetMats: StreetMaterials = {
    road: lit(
      new THREE.MeshStandardMaterial({
        map: asphalt.map,
        normalMap: asphalt.normalMap,
        normalScale: new THREE.Vector2(0.7, 0.7),
        roughnessMap: wet,
        roughness: 1,
        metalness: 0,
      }),
    ),
    sidewalk: lit(new THREE.MeshStandardMaterial({ map: tiles.map, normalMap: tiles.normalMap, roughness: 0.82 })),
    curb: lit(new THREE.MeshStandardMaterial({ map: curb.map, normalMap: curb.normalMap, roughness: 0.75 })),
    paint: lit(
      new THREE.MeshStandardMaterial({
        color: 0x8f8b82,
        roughness: 0.8,
        alphaMap: wearTexture(),
        alphaTest: 0.5,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    ),
    metal: lit(new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.75, metalness: 0.25 })),
    bark: lit(new THREE.MeshStandardMaterial({ map: S.bark(), roughness: 0.95 })),
    leaves: lit(
      new THREE.MeshStandardMaterial({
        map: leafTex,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        roughness: 0.85,
        color: 0xb8c49a,
      }),
    ),
    pot: lit(new THREE.MeshStandardMaterial({ color: 0x9a4f2f, roughness: 0.85 })),
    soil: lit(new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 1 })),
    grass: lit(new THREE.MeshStandardMaterial({ color: 0x24301b, roughness: 0.95 })),
    water: new THREE.MeshStandardMaterial({ color: 0x03060a, roughness: 0.06, metalness: 0.3 }),
  };

  const streets = buildStreets(city, streetMats, houses.pots);
  const lights = [...houses.lights, ...streets.lights];
  const lighting = new StreetLighting(lights, quality);
  for (const m of pending) lighting.apply(m, { foliage: m === streetMats.leaves });
  group.add(lighting.group, streets.group);

  // Houses.
  const facadeMat = lighting.apply(
    new THREE.MeshStandardMaterial({
      map: atlas.map,
      vertexColors: true,
      roughness: 0.9,
    }),
  );
  const facadeMesh = new THREE.Mesh(houses.facades, facadeMat);
  facadeMesh.castShadow = true;
  facadeMesh.receiveShadow = true;
  const trimMesh = new THREE.Mesh(
    houses.trim,
    lighting.apply(new THREE.MeshStandardMaterial({ map: atlas.map, vertexColors: true, roughness: 0.9 })),
  );
  trimMesh.castShadow = true;
  trimMesh.receiveShadow = true;
  const railMesh = new THREE.Mesh(
    houses.railings,
    lighting.apply(new THREE.MeshStandardMaterial({ map: S.railing(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5 })),
  );
  const awningMesh = new THREE.Mesh(
    houses.awnings,
    lighting.apply(new THREE.MeshStandardMaterial({ map: S.awnings(), side: THREE.DoubleSide, roughness: 0.85 })),
  );
  awningMesh.castShadow = true;
  const signMesh = new THREE.Mesh(
    houses.signs,
    new THREE.MeshStandardMaterial({ map: signs.map, emissiveMap: signs.map, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.6 }),
  );
  // Lit windows and shop interiors: additive panels over the facade, only where something is lit.
  const glowMesh = new THREE.Mesh(
    houses.glowPanels,
    new THREE.MeshBasicMaterial({
      map: atlas.emissiveMap,
      color: new THREE.Color(1.3, 1.3, 1.3),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  group.add(facadeMesh, trimMesh, railMesh, awningMesh, signMesh, glowMesh);

  // Glows and wet-road reflections.
  const glowList = [...houses.glows, ...streets.glows];
  group.add(glowPoints(glowList.map((g) => g.pos), glowList.map((g) => g.color), 2.4));
  const reflections = roadReflections(streets.reflections);
  group.add(reflections);

  // Traffic signals: lamp discs, glows and reflections are recoloured as the cycle advances.
  const heads = streets.traffic;
  const sigPositions = heads.flatMap((h) => h.lamps);
  const sigGlow = glowPoints(sigPositions, sigPositions.map(() => new THREE.Color(0, 0, 0)), 1.6);
  group.add(sigGlow);
  const sigReflections = roadReflections(heads.map((h) => ({ pos: h.lamps[1], color: new THREE.Color(0, 0, 0), strength: 1 })));
  group.add(sigReflections);
  let lastPhase = '';

  const updateSignals = (time: number) => {
    const ns = signalState(time, true);
    const ew = signalState(time, false);
    const phase = `${ns}${ew}`;
    if (phase === lastPhase) return;
    lastPhase = phase;
    const glowColors = sigGlow.geometry.getAttribute('color') as THREE.BufferAttribute;
    const reflColors = sigReflections.geometry.getAttribute('aColor') as THREE.InstancedBufferAttribute;
    heads.forEach((h, i) => {
      const state = h.northSouth ? ns : ew;
      for (let k = 0; k < 3; k++) {
        // Lamp order is red, yellow, green; state is 0 red, 1 yellow, 2 green.
        const on = (k === 0 && state === 0) || (k === 1 && state === 1) || (k === 2 && state === 2);
        const c = SIGNAL_COLORS[k];
        const disc = streets.trafficLampMeshes[k];
        const scale = on ? 9 : 0.05;
        disc.instanceColor!.setXYZ(i, c.r * scale, c.g * scale, c.b * scale);
        glowColors.setXYZ(i * 3 + k, on ? c.r * 0.9 : 0, on ? c.g * 0.9 : 0, on ? c.b * 0.9 : 0);
        if (on) reflColors.setXYZ(i, c.r * 0.5, c.g * 0.5, c.b * 0.5);
      }
    });
    for (const d of streets.trafficLampMeshes) d.instanceColor!.needsUpdate = true;
    glowColors.needsUpdate = true;
    reflColors.needsUpdate = true;
  };

  return {
    group,
    lighting,
    update(time, camera) {
      updateSignals(time);
      lighting.update(camera);
    },
  };
}
