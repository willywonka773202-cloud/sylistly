/**
 * Global item resolver. Seed items are statically known; user-added items live in
 * the closet store and register themselves here so any component (OutfitCollage,
 * editor, planner) can resolve an item id synchronously without prop-drilling.
 */
import type { ClosetItem } from './social-types';
import { getItem as getSeedItem } from './data/closet';

const userRegistry = new Map<string, ClosetItem>();

export function registerItems(items: ClosetItem[]): void {
  for (const item of items) userRegistry.set(item.id, item);
}

export function unregisterItem(id: string): void {
  userRegistry.delete(id);
}

export function resolveItem(id: string): ClosetItem | undefined {
  return getSeedItem(id) || userRegistry.get(id);
}

export function resolveItems(ids: string[]): ClosetItem[] {
  return ids.map(resolveItem).filter((x): x is ClosetItem => Boolean(x));
}
