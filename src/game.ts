import * as THREE from 'three';
import { FURNITURE, FURNITURE_LIST, PRODUCTS, type ProductId, SHELF_CAPACITY, TRANSACTIONS_PER_SHIFT } from './game/catalog';
import { type Rect, distanceToRect } from './game/geometry';
import { HOME_SPAWN } from './game/homeLayout';
import { checkPlacement, footprint, snap } from './game/placement';
import { loadGame, saveGame } from './game/save';
import {
  buy,
  completeTransaction,
  type GameState,
  type Location,
  type Placement,
  placeItem,
  restockShelf,
  type Result,
  startShift,
  storeItem,
  takeFromShelf,
} from './game/state';
import { type Action, Input } from './input/input';
import { el, Hud, type PromptPart } from './ui/hud';
import { CameraRig } from './world/cameraRig';
import { createCarryBox } from './world/characters';
import { CustomerController } from './world/customers';
import { createFurnitureMesh, createGhost, setGhostValid } from './world/furniture';
import { buildHome, type HomeScene } from './world/home';
import { Player, PLAYER_RADIUS } from './world/player';
import { buildStore, STORE_SPAWN, type StoreScene } from './world/store';

const INTERACT_RANGE = 1.3;
const HELP_SEEN_KEY = 'vgang-online/help-seen';
const ROTATE_DISMISSED_KEY = 'vgang-online/rotate-dismissed';

interface Target {
  rect: Rect;
  label: string;
  enabled: boolean;
  run?: () => void;
}

interface Placing {
  itemId: number;
  ghost: THREE.Group;
  placement: Placement;
  valid: boolean;
  reason: string;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage blocked: the hint simply shows again next time. */
  }
}

export class Game {
  state: GameState;
  readonly hud = new Hud();
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;
  readonly player = new Player();
  readonly input: Input;
  readonly home: HomeScene;
  readonly store: StoreScene;
  readonly customers: CustomerController;

  private canvas: HTMLCanvasElement;
  private timer = new THREE.Timer();
  private carrying: ProductId | null = null;
  private carryThird: THREE.Group | null = null;
  private carryFirst: THREE.Group | null = null;
  private furnitureMeshes = new Map<number, THREE.Group>();
  private placing: Placing | null = null;
  private target: Target | null = null;
  private marker: THREE.Mesh;
  private transitioning = false;
  private saveWarned = false;
  private elapsed = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.state = loadGame();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.background = new THREE.Color(0xbcd3dc);

    this.rig = new CameraRig(window.innerWidth / window.innerHeight);
    this.scene.add(this.rig.camera);

    this.scene.add(new THREE.HemisphereLight(0xfff7ea, 0x8a7a66, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(4, 10, 6);
    this.scene.add(sun);

    this.home = buildHome();
    this.store = buildStore();
    this.scene.add(this.home.group, this.store.group, this.player.mesh);

    this.marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.34, 4),
      new THREE.MeshBasicMaterial({ color: 0xffc83d }),
    );
    this.marker.rotation.x = Math.PI;
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.customers = new CustomerController(this.store, {
      shift: () => this.state.shift,
      take: (p) => this.commit(takeFromShelf(this.state, p)),
      complete: (shiftId, index) => this.onTransaction(shiftId, index),
    });

    this.input = new Input(canvas, this.hud.joystick, this.hud.joystickKnob);
    this.input.onTouchModeChange = () => this.refreshChrome();

    this.bindUi();
    this.rig.setMode(this.state.cameraMode);
    this.enterLocation(this.state.location);
    this.syncFurniture();
    this.syncStock();
    this.refreshHud();
    this.refreshChrome();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    if (!safeGet(HELP_SEEN_KEY)) {
      this.openHelp();
      safeSet(HELP_SEEN_KEY, '1');
    }
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------------------------------------------------------------- state

  /** Applies a state transition, saves it, and refreshes the HUD. */
  private commit(result: Result): boolean {
    if (!result.ok) return false;
    this.state = result.state;
    this.persist();
    this.refreshHud();
    return true;
  }

  private persist(): void {
    if (!saveGame(this.state) && !this.saveWarned) {
      this.saveWarned = true;
      this.hud.toast('Trình duyệt đang chặn lưu dữ liệu, tiến độ sẽ không được giữ lại.');
    }
  }

  private onTransaction(shiftId: number, index: number): void {
    const before = this.state.money;
    if (!this.commit(completeTransaction(this.state, shiftId, index))) return;
    const shift = this.state.shift;
    if (shift.paid && this.state.money > before) {
      this.hud.toast(`Hoàn tất ca làm! Nhận lương +${this.state.money - before}`, true);
    } else {
      this.hud.toast(`Giao dịch hoàn tất (${shift.completed}/${TRANSACTIONS_PER_SHIFT})`, true);
    }
  }

  // ---------------------------------------------------------------- UI wiring

  private bindUi(): void {
    const h = this.hud;
    this.canvas.addEventListener('click', () => {
      if (!this.input.touchMode && !h.panelOpen) this.lockPointer();
    });
    document.addEventListener('pointerlockchange', () => this.refreshChrome());

    h.btnCatalog.addEventListener('click', () => this.openCatalog());
    h.btnInventory.addEventListener('click', () => this.openInventory());
    h.btnCamera.addEventListener('click', () => this.toggleCamera());
    h.btnHelp.addEventListener('click', () => this.openHelp());
    h.panelClose.addEventListener('click', () => this.closePanel(true));
    h.panel.addEventListener('click', (e) => {
      if (e.target === h.panel) this.closePanel(false);
    });

    const touchAction = (btn: HTMLElement, action: Action) =>
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.input.push(action);
      });
    touchAction(h.tInteract, 'interact');
    touchAction(h.tRotate, 'rotate');
    touchAction(h.tCancel, 'cancel');

    document.getElementById('rotate-dismiss')!.addEventListener('click', () => {
      safeSet(ROTATE_DISMISSED_KEY, '1');
      this.refreshChrome();
    });
    window.addEventListener('orientationchange', () => this.refreshChrome());
  }

  private lockPointer(): void {
    try {
      const p = this.canvas.requestPointerLock() as unknown;
      if (p instanceof Promise) p.catch(() => undefined);
    } catch {
      /* Pointer lock unavailable; the lock hint stays visible. */
    }
  }

  private openPanel(title: string, body: HTMLElement): void {
    if (document.pointerLockElement) document.exitPointerLock();
    this.input.reset();
    this.hud.openPanel(title, body);
    this.input.enabled = false;
    this.refreshChrome();
  }

  private closePanel(relock: boolean): void {
    this.hud.closePanel();
    this.input.enabled = true;
    if (relock && !this.input.touchMode) this.lockPointer();
    this.refreshChrome();
  }

  private openHelp(): void {
    const items = [
      'Bạn là nhân viên cửa hàng. Đi làm để nhận lương, rồi mua nội thất trang trí nhà.',
      'Ở cửa hàng: đến máy chấm công để bắt đầu ca. Mỗi ca có 3 lượt khách, xong nhận 60 tiền.',
      'Khách thiếu hàng sẽ đứng chờ: lấy hàng ở kho hàng (bên phải) rồi đưa lên đúng kệ.',
      'Ở quầy: quét từng món rồi xác nhận thanh toán. Không có giới hạn thời gian, cứ thong thả.',
      'Ở nhà: mở Danh mục để mua đồ, mở Đồ của tôi để đặt đồ. Nhìn vào đồ đã đặt để cất lại.',
      'Máy tính: WASD đi, chuột nhìn, E tương tác, V đổi góc nhìn, R xoay đồ, Q hủy.',
      'Điện thoại: kéo bên trái để đi, vuốt bên phải để nhìn, nút Dùng để tương tác.',
      'Tiến độ được lưu riêng trên trình duyệt này. Xóa dữ liệu trình duyệt sẽ mất tiến độ.',
    ];
    const list = el('ul', { className: 'help-list' }, items.map((t) => el('li', { text: t })));
    this.openPanel('Hướng dẫn', list);
  }

  private openCatalog(): void {
    if (this.state.location !== 'home') return;
    const body = el('div');
    const render = () => {
      body.replaceChildren(
        el('div', { className: 'note', text: `Bạn đang có ${this.state.money} tiền.` }),
        ...FURNITURE_LIST.map((def) => {
          const owned = this.state.items.filter((i) => i.type === def.type).length;
          const affordable = this.state.money >= def.price;
          const btn = el('button', {
            className: affordable ? 'btn primary' : 'btn',
            text: affordable ? `Mua ${def.price}` : `Cần ${def.price}`,
          });
          btn.type = 'button';
          btn.disabled = !affordable;
          btn.addEventListener('click', () => {
            const result = buy(this.state, def.type);
            if (this.commit(result)) {
              this.hud.toast(`Đã mua ${def.name}. Mở "Đồ của tôi" để đặt vào nhà.`, true);
            } else if (!result.ok) {
              this.hud.toast(result.reason);
            }
            render();
          });
          return el('div', { className: 'row' }, [
            el('div', {}, [
              el('div', { className: 'name', text: def.name }),
              el('div', { className: 'sub', text: owned ? `Đã có ${owned}` : 'Chưa có' }),
            ]),
            btn,
          ]);
        }),
        el('p', { className: 'note', text: 'Đồ mua xong vào kho đồ cá nhân, bạn tự chọn chỗ đặt.' }),
      );
    };
    render();
    this.openPanel('Danh mục nội thất', body);
  }

  private openInventory(): void {
    if (this.state.location !== 'home') return;
    const stored = this.state.items.filter((i) => !i.placed);
    const placedCount = this.state.items.length - stored.length;
    const body = el('div');
    if (stored.length === 0) {
      body.append(
        el('p', {
          className: 'note',
          text: this.state.items.length
            ? 'Mọi món đồ đều đã được đặt trong nhà. Nhìn vào một món và nhấn tương tác để cất lại.'
            : 'Kho đồ đang trống. Mua nội thất ở Danh mục.',
        }),
      );
    }
    for (const item of stored) {
      const btn = el('button', { className: 'btn primary', text: 'Đặt' });
      btn.type = 'button';
      btn.addEventListener('click', () => {
        this.closePanel(true);
        this.beginPlacing(item.id);
      });
      body.append(el('div', { className: 'row' }, [el('div', { className: 'name', text: FURNITURE[item.type].name }), btn]));
    }
    if (placedCount) body.append(el('p', { className: 'note', text: `Đã đặt trong nhà: ${placedCount} món.` }));
    this.openPanel('Đồ của tôi', body);
  }

  // ---------------------------------------------------------------- locations

  private enterLocation(loc: Location): void {
    this.home.group.visible = loc === 'home';
    this.store.group.visible = loc === 'store';
    const spawn = loc === 'home' ? HOME_SPAWN : STORE_SPAWN;
    this.player.teleport(spawn.x, spawn.z, spawn.yaw);
    this.rig.yaw = spawn.yaw;
    this.rig.pitch = this.rig.mode === 'first' ? 0 : 0.4;
    this.customers.clear();
  }

  private travel(loc: Location): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.cancelPlacing();
    this.hud.fade.classList.add('on');
    window.setTimeout(() => {
      if (loc === 'home' && this.carrying !== null) {
        this.setCarrying(null);
        this.hud.toast('Đã để lại thùng hàng ở kho.');
      }
      this.state = { ...this.state, location: loc };
      this.persist();
      this.enterLocation(loc);
      this.refreshHud();
      this.refreshChrome();
      this.hud.fade.classList.remove('on');
      this.transitioning = false;
    }, 380);
  }

  // ---------------------------------------------------------------- camera / carrying

  private toggleCamera(): void {
    const mode = this.rig.mode === 'first' ? 'third' : 'first';
    this.rig.setMode(mode);
    this.state = { ...this.state, cameraMode: mode };
    this.persist();
    this.refreshChrome();
  }

  private setCarrying(product: ProductId | null): void {
    for (const m of [this.carryThird, this.carryFirst]) m?.removeFromParent();
    this.carryThird = this.carryFirst = null;
    this.carrying = product;
    if (product === null) return;
    this.carryThird = createCarryBox(product);
    this.carryThird.position.set(0, 1.0, -0.38);
    this.player.mesh.add(this.carryThird);
    this.carryFirst = createCarryBox(product);
    this.carryFirst.position.set(0.3, -0.34, -0.62);
    this.carryFirst.rotation.y = -0.25;
    this.rig.camera.add(this.carryFirst);
    this.refreshChrome();
  }

  // ---------------------------------------------------------------- furniture

  private syncFurniture(): void {
    const placedIds = new Set<number>();
    for (const item of this.state.items) {
      if (!item.placed) continue;
      placedIds.add(item.id);
      let mesh = this.furnitureMeshes.get(item.id);
      if (!mesh) {
        mesh = createFurnitureMesh(item.type);
        this.furnitureMeshes.set(item.id, mesh);
        this.home.furnitureRoot.add(mesh);
      }
      mesh.position.set(item.placed.x, 0, item.placed.z);
      mesh.rotation.y = (item.placed.rot * Math.PI) / 2;
    }
    for (const [id, mesh] of this.furnitureMeshes) {
      if (placedIds.has(id)) continue;
      mesh.removeFromParent();
      this.furnitureMeshes.delete(id);
    }
  }

  private beginPlacing(itemId: number): void {
    const item = this.state.items.find((i) => i.id === itemId);
    if (!item || item.placed || this.state.location !== 'home') return;
    const ghost = createGhost(item.type);
    this.home.furnitureRoot.add(ghost);
    this.placing = { itemId, ghost, placement: { x: 0, z: 0, rot: 0 }, valid: false, reason: '' };
    this.refreshChrome();
  }

  private cancelPlacing(): void {
    if (!this.placing) return;
    this.placing.ghost.removeFromParent();
    this.placing = null;
    this.refreshChrome();
  }

  private updatePlacing(): void {
    const p = this.placing;
    if (!p) return;
    const item = this.state.items.find((i) => i.id === p.itemId)!;
    const def = FURNITURE[item.type];
    const reach = 1.0 + Math.max(def.width, def.depth) / 2;
    const fwd = this.rig.forward();
    p.placement = {
      x: snap(this.player.position.x + fwd.x * reach),
      z: snap(this.player.position.z + fwd.z * reach),
      rot: p.placement.rot,
    };
    const check = checkPlacement(item.type, p.placement, {
      items: this.state.items,
      ignoreId: item.id,
      player: { x: this.player.position.x, z: this.player.position.z, radius: PLAYER_RADIUS },
    });
    p.valid = check.valid;
    p.reason = check.valid ? '' : check.reason;
    p.ghost.position.set(p.placement.x, 0, p.placement.z);
    p.ghost.rotation.y = (p.placement.rot * Math.PI) / 2;
    setGhostValid(p.ghost, p.valid);
  }

  private confirmPlacing(): void {
    const p = this.placing;
    if (!p) return;
    if (!p.valid) {
      this.hud.toast(p.reason || 'Không thể đặt ở đây.');
      return;
    }
    const name = FURNITURE[this.state.items.find((i) => i.id === p.itemId)!.type].name;
    if (this.commit(placeItem(this.state, p.itemId, p.placement))) {
      this.cancelPlacing();
      this.syncFurniture();
      this.hud.toast(`Đã đặt ${name}.`, true);
    }
  }

  // ---------------------------------------------------------------- interaction

  private colliders(): Rect[] {
    if (this.state.location === 'store') return this.store.colliders;
    const furniture = this.state.items.filter((i) => i.placed).map((i) => footprint(i.type, i.placed!));
    return [...this.home.colliders, ...furniture];
  }

  private targets(): Target[] {
    const s = this.state;
    if (s.location === 'home') {
      const list: Target[] = [
        { rect: this.home.door, label: 'Đi đến cửa hàng', enabled: true, run: () => this.travel('store') },
        { rect: this.home.catalog, label: 'Xem danh mục nội thất', enabled: true, run: () => this.openCatalog() },
      ];
      for (const item of s.items) {
        if (!item.placed) continue;
        const name = FURNITURE[item.type].name;
        list.push({
          rect: footprint(item.type, item.placed),
          label: `Cất ${name} vào kho`,
          enabled: true,
          run: () => {
            if (this.commit(storeItem(this.state, item.id))) {
              this.syncFurniture();
              this.hud.toast(`Đã cất ${name}. Mở "Đồ của tôi" để đặt lại.`);
            }
          },
        });
      }
      return list;
    }

    const shift = s.shift;
    const list: Target[] = [
      { rect: this.store.door, label: 'Về nhà', enabled: true, run: () => this.travel('home') },
      shift.active
        ? { rect: this.store.clock, label: `Ca đang diễn ra (${shift.completed}/${TRANSACTIONS_PER_SHIFT})`, enabled: false }
        : {
            rect: this.store.clock,
            label: 'Bắt đầu ca làm',
            enabled: true,
            run: () => {
              if (this.commit(startShift(this.state))) {
                this.customers.clear();
                this.syncStock();
                this.hud.toast('Bắt đầu ca làm. Khách sắp đến!', true);
              }
            },
          },
    ];
    for (const crate of this.store.crates) {
      const name = PRODUCTS[crate.product].name;
      if (!shift.active) {
        list.push({ rect: crate.rect, label: `Kho ${name} (bắt đầu ca để lấy hàng)`, enabled: false });
      } else if (this.carrying === crate.product) {
        list.push({ rect: crate.rect, label: `Trả ${name} về kho`, enabled: true, run: () => this.setCarrying(null) });
      } else {
        list.push({ rect: crate.rect, label: `Lấy ${name}`, enabled: true, run: () => this.setCarrying(crate.product) });
      }
    }
    for (const shelf of this.store.shelves) {
      const name = PRODUCTS[shelf.product].name;
      const stock = shift.stock[shelf.product];
      if (shift.active && this.carrying === shelf.product) {
        list.push(
          stock >= SHELF_CAPACITY
            ? { rect: shelf.rect, label: `Kệ ${name} đã đầy`, enabled: false }
            : {
                rect: shelf.rect,
                label: `Xếp ${name} lên kệ (${stock}/${SHELF_CAPACITY})`,
                enabled: true,
                run: () => {
                  if (this.commit(restockShelf(this.state, shelf.product))) {
                    this.syncStock();
                    this.setCarrying(null);
                  }
                },
              },
        );
      } else if (this.carrying !== null) {
        list.push({ rect: shelf.rect, label: `Kệ này để ${name}`, enabled: false });
      } else {
        list.push({ rect: shelf.rect, label: `Kệ ${name}: ${stock}/${SHELF_CAPACITY}`, enabled: false });
      }
    }
    const counterAction = this.customers.counterAction();
    if (counterAction) {
      list.push({
        rect: this.store.counter,
        label:
          counterAction.kind === 'scan'
            ? `Quét ${PRODUCTS[counterAction.product].name} (${counterAction.n}/${counterAction.total})`
            : 'Xác nhận thanh toán',
        enabled: true,
        run: () => this.customers.useCounter(),
      });
    } else {
      list.push({ rect: this.store.counter, label: 'Quầy thu ngân', enabled: false });
    }
    return list;
  }

  private pickTarget(): Target | null {
    const pos = this.player.position;
    const fwd = this.rig.forward();
    let best: Target | null = null;
    let bestScore = Infinity;
    for (const t of this.targets()) {
      const dist = distanceToRect(pos.x, pos.z, t.rect);
      if (dist > INTERACT_RANGE) continue;
      const dx = t.rect.x - pos.x;
      const dz = t.rect.z - pos.z;
      const len = Math.hypot(dx, dz) || 1;
      const dot = (dx * fwd.x + dz * fwd.z) / len;
      if (dot < 0.2 && dist > 0.45) continue;
      const score = dist - dot * 0.6;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  private handleActions(): void {
    for (const action of this.input.consumeActions()) {
      if (this.hud.panelOpen) {
        if (action === 'cancel') this.closePanel(false);
        continue;
      }
      if (this.transitioning) continue;
      if (action === 'camera') {
        this.toggleCamera();
      } else if (this.placing) {
        if (action === 'interact') this.confirmPlacing();
        else if (action === 'rotate') this.placing.placement.rot = (this.placing.placement.rot + 1) % 4;
        else if (action === 'cancel') this.cancelPlacing();
      } else if (action === 'interact' && this.target?.enabled) {
        this.target.run?.();
      }
    }
  }

  // ---------------------------------------------------------------- HUD

  private syncStock(): void {
    this.state.shift.stock.forEach((n, p) => this.store.setShelfStock(p as ProductId, n));
  }

  private refreshHud(): void {
    const s = this.state;
    const h = this.hud;
    h.setText(h.money, `Tiền: ${s.money}`);
    h.setText(h.where, s.location === 'home' ? 'Nhà' : 'Cửa hàng');
    const showShift = s.location === 'store' || s.shift.active;
    h.show(h.shift, showShift);
    if (showShift) {
      h.setText(
        h.shift,
        s.shift.active ? `Ca làm: ${s.shift.completed}/${TRANSACTIONS_PER_SHIFT} giao dịch` : 'Chưa vào ca',
      );
    }
    this.syncStock();
  }

  /** Visibility of buttons and overlays that depend on mode rather than per-frame state. */
  private refreshChrome(): void {
    const h = this.hud;
    const touch = this.input.touchMode;
    const home = this.state.location === 'home';
    const first = this.rig.mode === 'first';
    h.show(h.btnCatalog, home);
    h.show(h.btnInventory, home);
    h.setText(h.btnCamera, first ? 'Góc nhìn: 1' : 'Góc nhìn: 3');
    h.show(h.touch, touch && !h.panelOpen);
    h.show(h.tRotate, !!this.placing);
    h.show(h.tCancel, !!this.placing);
    h.show(h.crosshair, first && !h.panelOpen);
    h.show(h.lockHint, !touch && !h.panelOpen && document.pointerLockElement !== this.canvas);
    const portrait = window.innerHeight > window.innerWidth;
    h.show(h.rotateHint, touch && portrait && !safeGet(ROTATE_DISMISSED_KEY));

    this.player.mesh.visible = !first;
    if (this.carryThird) this.carryThird.visible = !first;
    if (this.carryFirst) this.carryFirst.visible = first;
  }

  private updateObjective(): void {
    const s = this.state;
    let text: string | null = null;
    let at: THREE.Vector3 | null = null;
    const over = (r: Rect, y = 1.6) => new THREE.Vector3(r.x, y, r.z);

    if (this.placing) {
      text = 'Di chuyển và nhìn để chọn chỗ. Màu xanh là đặt được.';
    } else if (s.location === 'store') {
      if (!s.shift.active) {
        text = s.shift.id > 0 ? 'Ca làm đã xong. Về nhà mua đồ, hoặc bắt đầu ca mới.' : 'Đến máy chấm công để bắt đầu ca làm.';
        at = over(this.store.clock, 2.4);
      } else {
        const st = this.customers.status();
        if (!st) {
          text = 'Khách sắp đến...';
        } else {
          text = st.text;
          if (st.waitingFor !== null) {
            const p = st.waitingFor;
            const name = PRODUCTS[p].name;
            if (this.carrying === p) {
              text = `Đưa ${name} lên kệ ${name}.`;
              at = over(this.store.shelves[p].rect, 2.2);
            } else {
              at = over(this.store.crates[p].rect, 1.3);
            }
          } else if (st.atCounter) {
            at = over(this.store.counter, 1.7);
          }
        }
      }
    } else {
      const stored = s.items.filter((i) => !i.placed).length;
      if (stored > 0) text = `Bạn có ${stored} món chưa đặt. Mở "Đồ của tôi" để đặt vào nhà.`;
      else if (s.shift.id === 0) {
        text = 'Ra cửa để đến cửa hàng và bắt đầu ca làm đầu tiên.';
        at = over(this.home.door, 2.5);
      } else if (s.money >= FURNITURE.lamp.price && s.items.length === 0) {
        text = `Bạn có ${s.money} tiền. Xem danh mục để mua nội thất.`;
        at = over(this.home.catalog, 1.6);
      }
    }
    this.hud.setObjective(text);
    // Hide the marker when it would sit right in front of the camera lens.
    this.marker.visible = !!at && at.distanceTo(this.rig.camera.position) > 1.6;
    if (at) {
      this.marker.position.set(at.x, at.y + Math.sin(this.elapsed * 3) * 0.08, at.z);
      this.marker.rotation.y = this.elapsed * 1.5;
    }
  }

  private updatePrompt(): void {
    const touch = this.input.touchMode;
    let parts: PromptPart[] | null = null;
    let canInteract = false;
    if (this.hud.panelOpen || this.transitioning) {
      parts = null;
    } else if (this.placing) {
      parts = [
        this.placing.valid ? { key: 'E', text: 'Đặt' } : { text: this.placing.reason },
        { key: 'R', text: 'Xoay' },
        { key: 'Q', text: 'Hủy' },
      ];
      if (touch) parts = [{ text: this.placing.valid ? 'Có thể đặt ở đây' : this.placing.reason }];
      canInteract = this.placing.valid;
    } else if (this.target) {
      parts = [{ key: this.target.enabled ? 'E' : undefined, text: this.target.label }];
      canInteract = this.target.enabled;
    }
    this.hud.setPrompt(parts, !touch);
    this.hud.tInteract.disabled = !canInteract;
    this.hud.setText(this.hud.tInteract, this.placing ? 'Đặt' : 'Dùng');
  }

  // ---------------------------------------------------------------- loop

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.rig.setAspect(w / h);
    this.refreshChrome();
  }

  private frame(): void {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.elapsed += dt;

    const look = this.input.consumeLook();
    if (!this.transitioning) this.rig.look(look.x, look.y);

    const move = this.transitioning ? { x: 0, y: 0 } : this.input.movement();
    this.player.update(dt, move, this.rig.yaw, this.colliders());
    if (this.rig.mode === 'first') this.player.facing = this.rig.yaw;

    if (this.state.location === 'store') {
      const completedBefore = this.state.shift.completed;
      this.customers.update(dt);
      if (this.state.shift.completed !== completedBefore) this.refreshHud();
    }

    // Pick the target before handling input so an action applies to what is in front of the player now.
    this.updatePlacing();
    this.target = this.placing || this.transitioning ? null : this.pickTarget();
    this.handleActions();
    this.updatePlacing();
    this.target = this.placing || this.transitioning ? null : this.pickTarget();
    this.updatePrompt();
    this.updateObjective();

    this.rig.update(this.player.position);
    (this.state.location === 'home' ? this.home : this.store).updateWalls(this.rig.camera.position);
    this.renderer.render(this.scene, this.rig.camera);
  }
}
