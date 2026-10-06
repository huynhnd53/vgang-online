import * as THREE from 'three';
import { Sound } from './audio/sound';
import { Cockpit } from './cockpit/cockpit';
import { type Action, Input } from './input/input';
import { BIKES, bikeDef } from './cockpit/bikes';
import { getFlag, getString, loadRide, type RideSave, saveRide, setFlag, setString } from './save';
import { type Block, type City, generateCity, groundHeight } from './sim/city';
import { circleHitsRect, type Rect } from './sim/geometry';
import { CRUISE_SPEED, SCOOTER_RADIUS, type ScooterState, stepScooter } from './sim/scooter';
import { Minimap } from './ui/minimap';
import { Traffic } from './sim/traffic';
import { NpcView } from './world/night/npcs';
import { buildNightCity, FOG_COLOR, FOG_DENSITY, type NightCity } from './world/night/simpleCity';

const EYE_HEIGHT = 1.35;
const SAVE_INTERVAL = 2;
const LANDMARK_NAMES: Partial<Record<Block['kind'], string>> = {
  lake: 'Hồ Sen',
  park: 'Công viên',
  plaza: 'Quảng trường Đài phun nước',
};

type Signal = 'left' | 'right' | null;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

export class Game {
  readonly city: City = generateCity();
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.1, 600);
  readonly input: Input;
  readonly cockpit: Cockpit;
  readonly sound = new Sound();
  readonly minimap: Minimap;
  readonly traffic: Traffic;
  private npcs: NpcView;

  scooter: ScooterState;
  engineOn = false;
  signal: Signal = null;
  headlight: boolean;
  odometerKm: number;

  private timer = new THREE.Timer();
  private elapsed = 0;
  private renderScale = 1;
  private perfTime = 0;
  private perfFrames = 0;
  private fastPeriods = 0;
  private saveTimer = 0;
  private signalHeading = 0;
  private lastBlinkPhase = false;
  private shake = 0;
  /** Smoothed height of the ground under the scooter (rises onto the sidewalk). */
  private ground = 0;
  private groundTarget = 0;
  private staticColliders: Rect[] = [];
  private hornHeld = false;
  private hornDownAt = 0;
  private night: NightCity;
  private cockpitLight = -1;
  private landmark: Block | null = null;
  private throttle = 0;

  constructor(canvas: HTMLCanvasElement) {
    const { spawn } = this.city;
    const saved = loadRide({ odometerKm: 0, x: spawn.x, z: spawn.z, heading: spawn.heading, headlight: true, muted: false });
    // A saved position inside a block or off the map (e.g. after a layout change) falls back to the spawn point.
    const b = this.city.bounds;
    const invalid =
      Math.abs(saved.x - b.x) > b.w / 2 - 1 ||
      Math.abs(saved.z - b.z) > b.d / 2 - 1 ||
      this.city.colliders.some((c) => Math.abs(saved.x - c.x) < c.w / 2 + 0.5 && Math.abs(saved.z - c.z) < c.d / 2 + 0.5);
    this.scooter = invalid
      ? { x: spawn.x, z: spawn.z, heading: spawn.heading, speed: 0, steer: 0 }
      : { x: saved.x, z: saved.z, heading: saved.heading, speed: 0, steer: 0 };
    this.odometerKm = saved.odometerKm;
    this.headlight = saved.headlight;
    this.sound.setMuted(saved.muted);

    // Everything is unlit (light is baked into vertex colours at load), so this runs on modest GPUs too.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);
    this.night = buildNightCity(this.city, `${import.meta.env.BASE_URL}assets/`);
    this.scene.add(this.night.group);
    this.staticColliders = [...this.city.colliders, ...this.night.obstacles];
    // Motorbikes, cars and people moving about the city.
    this.traffic = new Traffic(this.city, 220, 320);
    this.npcs = new NpcView(this.traffic, (x, z) => this.night.levelAt(x, z));
    this.scene.add(this.npcs.group);

    this.camera.rotation.order = 'YXZ';
    this.camera.far = 1000;
    this.camera.updateProjectionMatrix();
    this.scene.add(this.camera);

    this.cockpit = new Cockpit(`${import.meta.env.BASE_URL}assets/`);
    this.cockpit.setBike(bikeDef(getString('bike')).id);
    $('cockpit-layer').append(this.cockpit.root);
    this.cockpit.onAction = (a) => this.handle(a);

    this.minimap = new Minimap($('minimap') as HTMLCanvasElement, this.city);

    this.input = new Input($('app'), $('joystick'), $('joystick-knob'));
    this.input.onFirstInput = () => this.sound.unlock();
    this.input.onTouchModeChange = () => this.refreshChrome();

    this.bindUi();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pagehide', () => this.persist());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.persist();
        this.input.reset();
      }
    });

    // The start screen (bike picker) shows on every visit.
    this.buildBikePicker();
    this.refreshChrome();
  }

  private pixelRatio(): number {
    return Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.5) * this.renderScale);
  }

  /** Dynamic resolution: trade sharpness for a steady frame rate on slower GPUs. */
  private adaptResolution(frameTime: number): void {
    if (this.elapsed < 3) return;
    this.perfTime += frameTime;
    this.perfFrames++;
    if (this.perfTime < 2) return;
    const avg = this.perfTime / this.perfFrames;
    this.perfTime = 0;
    this.perfFrames = 0;
    let next = this.renderScale;
    if (avg > 0.026) {
      next = Math.max(0.5, this.renderScale - 0.15);
      this.fastPeriods = 0;
    } else if (avg < 0.0175 && ++this.fastPeriods >= 2) {
      next = Math.min(1, this.renderScale + 0.1);
      this.fastPeriods = 0;
    }
    if (next !== this.renderScale) {
      this.renderScale = next;
      const pr = this.pixelRatio();
      this.renderer.setPixelRatio(pr);
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    }
  }

  /** Cards for each front end; picking one swaps the handlebar photo and remembers it. */
  private buildBikePicker(): void {
    const picker = $('bike-picker');
    const cards: HTMLButtonElement[] = [];
    const select = (id: string) => {
      this.cockpit.setBike(id);
      setString('bike', id);
      for (const c of cards) c.setAttribute('aria-checked', String(c.dataset.id === id));
    };
    for (const bike of BIKES) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'gauge-card bike-card';
      card.setAttribute('role', 'radio');
      card.dataset.id = bike.id;
      const img = document.createElement('img');
      img.src = `${import.meta.env.BASE_URL}assets/${bike.image}`;
      img.alt = '';
      // Show only the handlebar part of the photo.
      img.style.objectPosition = `50% ${Math.round((bike.barTop / bike.height) * 100 + 15)}%`;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = bike.name;
      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = bike.description;
      card.append(img, name, sub);
      card.addEventListener('click', () => select(bike.id));
      cards.push(card);
      picker.append(card);
    }
    select(this.cockpit.bikeId);
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private bindUi(): void {
    $('panel-close').addEventListener('click', () => {
      this.sound.unlock();
      $('panel').classList.add('hidden');
    });
    $('btn-help').addEventListener('click', () => $('panel').classList.remove('hidden'));
    $('btn-mute').addEventListener('click', () => this.handle('mute'));
    $('rotate-dismiss').addEventListener('click', () => {
      setFlag('rotate-dismissed');
      this.refreshChrome();
    });

    const press = (id: string, down: Action, up?: Action) => {
      const el = $(id);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.sound.unlock();
        this.handle(down);
      });
      if (up) {
        const release = () => this.handle(up);
        el.addEventListener('pointerup', release);
        el.addEventListener('pointerleave', release);
        el.addEventListener('pointercancel', release);
      }
    };
    press('t-horn', 'horn-down', 'horn-up');
    press('t-signal-left', 'signal-left');
    press('t-signal-right', 'signal-right');
    press('t-light', 'light');
    press('t-engine', 'engine');
  }

  private handle(action: Action): void {
    this.sound.unlock();
    switch (action) {
      case 'engine':
        this.engineOn = !this.engineOn;
        this.sound.setEngine(this.engineOn);
        if (!this.engineOn) this.toast('Đã tắt máy.');
        break;
      case 'horn-down':
        this.hornHeld = true;
        this.hornDownAt = performance.now();
        this.sound.hornOn();
        break;
      case 'horn-up': {
        this.hornHeld = false;
        // A quick tap still gives a short beep.
        const wait = Math.max(0, 220 - (performance.now() - this.hornDownAt));
        window.setTimeout(() => {
          if (!this.hornHeld) this.sound.hornOff();
        }, wait);
        break;
      }
      case 'signal-left':
      case 'signal-right': {
        const side = action === 'signal-left' ? 'left' : 'right';
        this.signal = this.signal === side ? null : side;
        this.signalHeading = this.scooter.heading;
        this.sound.tick(true);
        break;
      }
      case 'light':
        this.headlight = !this.headlight;
        this.sound.tick(false);
        this.persist();
        break;
      case 'mute':
        this.sound.setMuted(!this.sound.muted);
        this.persist();
        break;
    }
    this.refreshChrome();
  }

  private toast(text: string): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 2) box.firstElementChild?.remove();
    window.setTimeout(() => el.remove(), 3500);
  }

  private persist(): void {
    const s = this.scooter;
    const data: RideSave = {
      odometerKm: this.odometerKm,
      x: s.x,
      z: s.z,
      heading: s.heading,
      headlight: this.headlight,
      muted: this.sound.muted,
    };
    saveRide(data);
  }

  private refreshChrome(): void {
    const touch = this.input.touchMode;
    $('touch').classList.toggle('hidden', !touch);
    $('btn-mute').textContent = this.sound.muted ? 'Âm thanh: tắt' : 'Âm thanh: bật';
    $('t-light').classList.toggle('on', this.headlight);
    $('t-engine').classList.toggle('on', this.engineOn);
    $('t-engine').textContent = this.engineOn ? 'Tắt' : 'Đề';
    $('t-signal-left').classList.toggle('on', this.signal === 'left');
    $('t-signal-right').classList.toggle('on', this.signal === 'right');
    const portrait = window.innerHeight > window.innerWidth;
    $('rotate-hint').classList.toggle('hidden', !(touch && portrait && !getFlag('rotate-dismissed')));
    this.updatePrompt();
  }

  private updatePrompt(): void {
    const prompt = $('prompt');
    const helpOpen = !$('panel').classList.contains('hidden');
    let html = '';
    if (!this.engineOn && !helpOpen) {
      html = this.input.touchMode
        ? 'Chạm nút <b>Đề</b> (hoặc nút ⚡ trên tay lái) để nổ máy'
        : 'Nhấn <kbd>K</kbd> hoặc bấm nút ⚡ trên tay lái để nổ máy';
    }
    if (prompt.innerHTML !== html) prompt.innerHTML = html;
    prompt.classList.toggle('hidden', html === '');
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.cockpit.layout(w, h);
    this.refreshChrome();
  }

  private updateSignals(): { left: boolean; right: boolean } {
    if (!this.signal) return { left: false, right: false };
    // Cancel automatically once a turn is finished and the bars are straight again.
    let turned = this.scooter.heading - this.signalHeading;
    turned = Math.atan2(Math.sin(turned), Math.cos(turned));
    if (Math.abs(turned) > 1.1 && Math.abs(this.scooter.steer) < 0.15) {
      this.signal = null;
      this.refreshChrome();
      return { left: false, right: false };
    }
    const phase = Math.floor(this.elapsed * 3) % 2 === 0;
    if (phase !== this.lastBlinkPhase) {
      this.lastBlinkPhase = phase;
      this.sound.tick(phase);
    }
    return { left: this.signal === 'left' && phase, right: this.signal === 'right' && phase };
  }

  private updateLandmark(): void {
    const s = this.scooter;
    let near: Block | null = null;
    for (const b of this.city.blocks) {
      if (b.kind === 'houses') continue;
      if (Math.abs(s.x - b.rect.x) < b.rect.w / 2 + 10 && Math.abs(s.z - b.rect.z) < b.rect.d / 2 + 10) near = b;
    }
    if (near !== this.landmark) {
      this.landmark = near;
      const name = near ? LANDMARK_NAMES[near.kind] : undefined;
      $('place').textContent = name ?? 'Dạo phố';
      if (name) this.toast(`Đang đi ngang ${name}`);
    }
  }

  private frame(): void {
    this.timer.update();
    // Physics runs in fixed steps so slow devices still ride at the true speed.
    const frameTime = this.timer.getDelta();
    const rawDt = Math.min(frameTime, 0.25);
    const dt = Math.min(rawDt, 0.05);
    this.elapsed += dt;

    for (const a of this.input.consumeActions()) this.handle(a);
    const helpOpen = !$('panel').classList.contains('hidden');
    const c = helpOpen ? { throttle: 0, brake: 0, steer: 0 } : this.input.controls();
    this.throttle = this.engineOn ? c.throttle : 0;

    for (let left = rawDt; left > 1e-6; left -= 1 / 30) this.traffic.update(Math.min(1 / 30, left), this.scooter);
    this.npcs.update(rawDt);
    // NPCs are solid too; skip any that have already walked into the rider so the scooter can always pull away.
    const near = this.traffic
      .collidersNear(this.scooter.x, this.scooter.z, 25)
      .filter((r) => !circleHitsRect(this.scooter.x, this.scooter.z, SCOOTER_RADIUS, r));
    // Same for furniture, in case a saved position starts on top of a lamp post or planter.
    const stuck = this.staticColliders.some((r) => circleHitsRect(this.scooter.x, this.scooter.z, SCOOTER_RADIUS, r));
    const fixed = stuck
      ? this.staticColliders.filter((r) => !circleHitsRect(this.scooter.x, this.scooter.z, SCOOTER_RADIUS, r))
      : this.staticColliders;
    const colliders = near.length ? [...fixed, ...near] : fixed;

    let impact = 0;
    for (let left = rawDt; left > 1e-6; left -= 1 / 60) {
      const before = this.scooter;
      const result = stepScooter(before, c, Math.min(1 / 60, left), this.engineOn, colliders, this.city.bounds);
      this.scooter = result.state;
      this.odometerKm += Math.hypot(this.scooter.x - before.x, this.scooter.z - before.z) / 1000;
      impact = Math.max(impact, result.impact);
    }
    if (impact > 1.2) {
      this.sound.bump(impact);
      this.shake = Math.min(0.6, impact * 0.06);
    }
    this.sound.updateEngine(this.scooter.speed, this.throttle);
    this.input.relaxLook(dt);

    const signals = this.updateSignals();
    this.updateLandmark();

    // First-person camera: lean into turns, a little road buzz, and the rider's head look.
    const s = this.scooter;
    const speedRatio = Math.min(1.6, Math.abs(s.speed) / CRUISE_SPEED);
    const lean = -s.steer * speedRatio * 0.16;
    const buzz = this.engineOn ? Math.sin(this.elapsed * 40) * 0.004 * (0.3 + speedRatio) : 0;
    this.shake = Math.max(0, this.shake - dt * 2);
    const jolt = this.shake * Math.sin(this.elapsed * 60) * 0.05;
    // Riding up or down the curb: a quick hop of the camera and a thud.
    const target = groundHeight(this.city, s.x, s.z);
    if (target !== this.groundTarget && Math.abs(s.speed) > 1) {
      this.shake = Math.max(this.shake, Math.min(0.5, 0.15 + Math.abs(s.speed) * 0.02));
      this.sound.bump(2 + Math.abs(s.speed) * 0.2);
    }
    this.groundTarget = target;
    this.ground += (target - this.ground) * Math.min(1, dt * 18);
    this.camera.position.set(s.x, EYE_HEIGHT + this.ground + buzz + jolt, s.z);
    this.camera.rotation.set(-0.07 + this.input.look.pitch, s.heading + this.input.look.yaw, lean);
    const fov = 72 + speedRatio * 8;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.night.headlight.visible = this.headlight;
    this.night.headlight.position.set(s.x, 0.02, s.z);
    this.night.headlight.rotation.y = s.heading;

    // The cockpit photo is day-lit; darken it to match the street light around the rider.
    const level = Math.round((0.3 + this.night.levelAt(s.x, s.z) * 0.6) * 50) / 50;
    if (level !== this.cockpitLight) {
      this.cockpitLight = level;
      this.cockpit.setLighting(level);
    }

    this.cockpit.render({
      speedKmh: Math.abs(s.speed) * 3.6,
      steer: s.steer,
      leftLamp: signals.left,
      rightLamp: signals.right,
      headlight: this.headlight,
      engineOn: this.engineOn,
      odometerKm: this.odometerKm,
    });
    this.minimap.draw(s.x, s.z, s.heading, this.traffic.vehicles);
    this.updatePrompt();

    this.saveTimer += dt;
    if (this.saveTimer > SAVE_INTERVAL) {
      this.saveTimer = 0;
      this.persist();
    }

    this.renderer.render(this.scene, this.camera);
    this.adaptResolution(frameTime);
  }
}
