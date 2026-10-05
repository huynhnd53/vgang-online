import { FURNITURE, type FurnitureType } from './catalog';
import { type Rect, circleHitsRect, rectInside, rectsOverlap } from './geometry';
import { HOME_DOOR_ZONE, HOME_FIXED, HOME_INTERIOR } from './homeLayout';
import type { OwnedItem, Placement } from './state';

export const PLACEMENT_GRID = 0.25;

export function snap(value: number, grid = PLACEMENT_GRID): number {
  return Math.round(value / grid) * grid;
}

export function footprint(type: FurnitureType, placement: Placement): Rect {
  const def = FURNITURE[type];
  const turned = placement.rot % 2 === 1;
  return {
    x: placement.x,
    z: placement.z,
    w: turned ? def.depth : def.width,
    d: turned ? def.width : def.depth,
  };
}

export type PlacementCheck = { valid: true } | { valid: false; reason: string };

export interface PlacementContext {
  items: OwnedItem[];
  /** Item being moved; ignored for overlap checks. */
  ignoreId?: number;
  player?: { x: number; z: number; radius: number };
}

export function checkPlacement(type: FurnitureType, placement: Placement, ctx: PlacementContext): PlacementCheck {
  const rect = footprint(type, placement);
  if (!rectInside(rect, HOME_INTERIOR)) return { valid: false, reason: 'Không thể đặt xuyên tường.' };
  if (rectsOverlap(rect, HOME_DOOR_ZONE)) return { valid: false, reason: 'Không chắn lối cửa ra vào.' };
  for (const fixed of HOME_FIXED) {
    if (rectsOverlap(rect, fixed)) return { valid: false, reason: 'Vị trí này đã có đồ.' };
  }
  for (const item of ctx.items) {
    if (!item.placed || item.id === ctx.ignoreId) continue;
    if (rectsOverlap(rect, footprint(item.type, item.placed))) {
      return { valid: false, reason: 'Không chồng đồ lên nhau.' };
    }
  }
  if (ctx.player && circleHitsRect(ctx.player.x, ctx.player.z, ctx.player.radius, rect)) {
    return { valid: false, reason: 'Đang vướng chỗ bạn đứng.' };
  }
  return { valid: true };
}
