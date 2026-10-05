export type Action = 'interact' | 'camera' | 'rotate' | 'cancel';

const MOUSE_SENSITIVITY = 0.0024;
const TOUCH_SENSITIVITY = 0.0055;
const JOYSTICK_RADIUS = 56;

/**
 * Collects keyboard/mouse and touch input into one shape the game reads each frame.
 */
export class Input {
  private keys = new Set<string>();
  private look = { x: 0, y: 0 };
  private actions: Action[] = [];
  private stick = { x: 0, y: 0 };
  private stickPointer: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private lookPointer: number | null = null;
  private lookLast = { x: 0, y: 0 };
  /** Set by the game: when false, gameplay keys and look are ignored (menus open). */
  enabled = true;
  touchMode: boolean;
  onTouchModeChange: (touch: boolean) => void = () => {};

  constructor(
    private canvas: HTMLCanvasElement,
    private joystickBase: HTMLElement,
    private joystickKnob: HTMLElement,
  ) {
    this.touchMode = window.matchMedia('(pointer: coarse)').matches;

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'KeyE' || e.code === 'Enter') this.push('interact');
      else if (e.code === 'KeyV') this.push('camera');
      else if (e.code === 'KeyR') this.push('rotate');
      else if (e.code === 'KeyQ' || e.code === 'Escape') this.push('cancel');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.canvas || !this.enabled) return;
      // Some browsers report one huge jump right after the pointer locks; drop it.
      if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
      this.look.x += e.movementX * MOUSE_SENSITIVITY;
      this.look.y += e.movementY * MOUSE_SENSITIVITY;
    });

    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));
  }

  private setTouchMode(touch: boolean) {
    if (this.touchMode === touch) return;
    this.touchMode = touch;
    this.onTouchModeChange(touch);
  }

  private onPointerDown(e: PointerEvent) {
    if (e.pointerType !== 'touch') {
      if (e.pointerType === 'mouse') this.setTouchMode(false);
      return;
    }
    this.setTouchMode(true);
    e.preventDefault();
    if (!this.enabled) return;
    if (e.clientX < window.innerWidth * 0.42 && this.stickPointer === null) {
      this.stickPointer = e.pointerId;
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      this.stick = { x: 0, y: 0 };
      this.joystickBase.style.left = `${e.clientX}px`;
      this.joystickBase.style.top = `${e.clientY}px`;
      this.joystickBase.classList.add('active');
      this.joystickKnob.style.transform = 'translate(-50%, -50%)';
    } else if (this.lookPointer === null) {
      this.lookPointer = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  }

  private onPointerMove(e: PointerEvent) {
    if (e.pointerId === this.stickPointer) {
      let dx = e.clientX - this.stickOrigin.x;
      let dy = e.clientY - this.stickOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > JOYSTICK_RADIUS) {
        dx = (dx / len) * JOYSTICK_RADIUS;
        dy = (dy / len) * JOYSTICK_RADIUS;
      }
      this.stick = { x: dx / JOYSTICK_RADIUS, y: -dy / JOYSTICK_RADIUS };
      this.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else if (e.pointerId === this.lookPointer) {
      if (this.enabled) {
        this.look.x += (e.clientX - this.lookLast.x) * TOUCH_SENSITIVITY;
        this.look.y += (e.clientY - this.lookLast.y) * TOUCH_SENSITIVITY;
      }
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  }

  private onPointerUp(e: PointerEvent) {
    if (e.pointerId === this.stickPointer) {
      this.stickPointer = null;
      this.stick = { x: 0, y: 0 };
      this.joystickBase.classList.remove('active');
    } else if (e.pointerId === this.lookPointer) {
      this.lookPointer = null;
    }
  }

  push(action: Action): void {
    this.actions.push(action);
  }

  /** Movement: x = strafe right, y = forward. */
  movement(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 };
    const k = this.keys;
    const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    return { x: x + this.stick.x, y: y + this.stick.y };
  }

  consumeLook(): { x: number; y: number } {
    const l = this.look;
    this.look = { x: 0, y: 0 };
    return l;
  }

  consumeActions(): Action[] {
    const a = this.actions;
    this.actions = [];
    return a;
  }

  reset(): void {
    this.keys.clear();
    this.stick = { x: 0, y: 0 };
    this.stickPointer = null;
    this.lookPointer = null;
    this.look = { x: 0, y: 0 };
    this.joystickBase.classList.remove('active');
  }
}
