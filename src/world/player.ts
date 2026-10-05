import * as THREE from 'three';
import { type Rect, circleHitsRect } from '../game/geometry';
import { createPerson } from './characters';

export const PLAYER_RADIUS = 0.3;
const WALK_SPEED = 3;

export class Player {
  readonly mesh = createPerson(0x2f8f6f);
  readonly position = new THREE.Vector3();
  /** Direction the body faces (radians, 0 = -z). */
  facing = 0;

  /** Collision check that works per axis so the player slides along walls. */
  move(dx: number, dz: number, colliders: Rect[]): void {
    const tryAxis = (nx: number, nz: number) => {
      for (const r of colliders) if (circleHitsRect(nx, nz, PLAYER_RADIUS, r)) return false;
      return true;
    };
    if (dx !== 0 && tryAxis(this.position.x + dx, this.position.z)) this.position.x += dx;
    if (dz !== 0 && tryAxis(this.position.x, this.position.z + dz)) this.position.z += dz;
  }

  /**
   * Moves relative to the camera yaw. `input` x is strafe (right +), y is forward (+).
   */
  update(dt: number, input: { x: number; y: number }, cameraYaw: number, colliders: Rect[]): void {
    const len = Math.min(1, Math.hypot(input.x, input.y));
    if (len > 0.01) {
      const fx = -Math.sin(cameraYaw);
      const fz = -Math.cos(cameraYaw);
      const rx = Math.cos(cameraYaw);
      const rz = -Math.sin(cameraYaw);
      const nx = input.x / Math.max(1, Math.hypot(input.x, input.y));
      const ny = input.y / Math.max(1, Math.hypot(input.x, input.y));
      const vx = (fx * ny + rx * nx) * WALK_SPEED;
      const vz = (fz * ny + rz * nx) * WALK_SPEED;
      // Sub-step so fast frames cannot tunnel through thin colliders.
      const steps = Math.ceil((len * WALK_SPEED * dt) / 0.1);
      for (let i = 0; i < steps; i++) this.move((vx * dt) / steps, (vz * dt) / steps, colliders);
      const target = Math.atan2(-vx, -vz);
      let diff = target - this.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.facing += diff * Math.min(1, dt * 12);
    }
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.facing;
  }

  teleport(x: number, z: number, facing: number): void {
    this.position.set(x, 0, z);
    this.facing = facing;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = facing;
  }
}
