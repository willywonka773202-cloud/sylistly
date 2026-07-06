import { CLIENT_CATALOG_PRODUCTS } from './client-catalog';
import type { Product } from './types';
import type { VaultEntry } from './drop-vault';

// Split out of drop-vault so the streak/vault storage logic stays catalog-free.
// drop-vault is imported by the global BottomNav (every route) and DailyDrop;
// keeping the 898KB catalog import here — used only by the /drop vault re-shop —
// keeps it out of every route's First Load JS. Only app/drop imports this.
const BY_ID = new Map(CLIENT_CATALOG_PRODUCTS.map((product) => [product.id, product]));

/** Rehydrate a vault entry's products from the catalog (for re-shop/re-view). */
export function rehydratePull(entry: VaultEntry): Product[] {
  return entry.productIds.map((id) => BY_ID.get(id)).filter((p): p is Product => Boolean(p));
}
