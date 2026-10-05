import type { Rect } from './geometry';

/** Shared by the 3D home scene and the furniture placement rules. */
export const HOME_INTERIOR: Rect = { x: 0, z: 0, w: 10, d: 8 };

/** Area in front of the front door (south wall, z = +4) that must stay clear. */
export const HOME_DOOR_ZONE: Rect = { x: 0, z: 3.1, w: 2.2, d: 1.8 };

export const HOME_BED: Rect = { x: -3.6, z: -2.75, w: 1.6, d: 2.3 };
export const HOME_BASIC_LAMP: Rect = { x: -1.95, z: -3.55, w: 0.5, d: 0.5 };
export const HOME_CATALOG: Rect = { x: 4.45, z: 3.0, w: 0.7, d: 0.7 };

/** Built-in furniture that new items may not overlap. */
export const HOME_FIXED: Rect[] = [HOME_BED, HOME_BASIC_LAMP, HOME_CATALOG];

export const HOME_SPAWN = { x: 0, z: 1.6, yaw: 0 };
