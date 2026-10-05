export type FurnitureType = 'lamp' | 'plant' | 'table';

export interface FurnitureDef {
  type: FurnitureType;
  name: string;
  price: number;
  /** Footprint along x (width) and z (depth) when not rotated, in metres. */
  width: number;
  depth: number;
}

/** Illustrative prices from the gameplay plan: one shift buys a small item, two shifts a large one. */
export const FURNITURE: Record<FurnitureType, FurnitureDef> = {
  lamp: { type: 'lamp', name: 'Đèn trang trí', price: 40, width: 0.5, depth: 0.5 },
  plant: { type: 'plant', name: 'Cây cảnh', price: 60, width: 0.6, depth: 0.6 },
  table: { type: 'table', name: 'Bàn', price: 120, width: 1.4, depth: 0.8 },
};

export const FURNITURE_LIST: FurnitureDef[] = [FURNITURE.lamp, FURNITURE.plant, FURNITURE.table];

export function isFurnitureType(value: unknown): value is FurnitureType {
  return value === 'lamp' || value === 'plant' || value === 'table';
}

export type ProductId = 0 | 1 | 2;

export interface ProductDef {
  id: ProductId;
  name: string;
  color: number;
}

export const PRODUCTS: ProductDef[] = [
  { id: 0, name: 'Sữa', color: 0xf4f7fb },
  { id: 1, name: 'Bánh mì', color: 0xd9a35b },
  { id: 2, name: 'Táo', color: 0xd83a34 },
];

export const SHELF_CAPACITY = 4;
export const TRANSACTIONS_PER_SHIFT = 3;
export const SHIFT_WAGE = 60;
