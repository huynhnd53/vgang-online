import * as THREE from 'three';
import type { CameraMode } from '../game/state';

const EYE_HEIGHT = 1.6;
const TP_TARGET_HEIGHT = 1.35;
const TP_DISTANCE = 3.8;
/** Over-the-shoulder offset so the character does not hide what is ahead. */
const TP_SHOULDER = 0.55;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0.4;
  mode: CameraMode = 'third';

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.05, 100);
  }

  look(dx: number, dy: number): void {
    this.yaw -= dx;
    this.pitch += dy;
    const [min, max] = this.mode === 'first' ? [-1.35, 1.35] : [-0.2, 1.2];
    this.pitch = Math.max(min, Math.min(max, this.pitch));
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    this.look(0, 0);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    // Portrait screens get a wider vertical FOV so the sides of the room stay in view.
    this.camera.fov = aspect < 1 ? 85 : 70;
    this.camera.updateProjectionMatrix();
  }

  /** Horizontal forward vector of the view. */
  forward(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  update(player: THREE.Vector3): void {
    const cam = this.camera;
    // Pitch > 0 means looking down.
    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    if (this.mode === 'first') {
      cam.position.set(player.x, EYE_HEIGHT, player.z);
      cam.lookAt(cam.position.clone().add(dir));
      return;
    }
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const target = new THREE.Vector3(player.x, TP_TARGET_HEIGHT, player.z).addScaledVector(right, TP_SHOULDER);
    cam.position.copy(target).addScaledVector(dir, -TP_DISTANCE);
    cam.position.y = Math.max(0.3, cam.position.y);
    cam.lookAt(target);
  }
}
