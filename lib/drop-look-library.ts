import dropData from '@/data/drop-look-library.json';
import type { DropLook } from '@/components/DailyDrop';
import type { Category, Product } from '@/lib/types';
import { VIBES, type VibeId } from '@/lib/vibes';
import { isVerificationFresh } from '@/lib/verification-freshness';

interface DropLookRecord {
  id: string;
  slots: Partial<Record<Category, string>>;
}

interface DropLookData {
  verifiedAt: string;
  maxHealthAgeHours: number;
  products: Product[];
  looks: Partial<Record<VibeId, DropLookRecord[]>>;
}

const DATA = dropData as unknown as DropLookData;
const BY_ID = new Map(DATA.products.map((product) => [product.id, product]));
const VIBE_LABEL = new Map(VIBES.map((vibe) => [vibe.id, vibe.label]));

export function dropLibraryFresh(now = Date.now()): boolean {
  const maxAge = Math.max(1, DATA.maxHealthAgeHours || 24) * 60 * 60 * 1000;
  return isVerificationFresh(DATA.verifiedAt, maxAge, now);
}

function hydrate(vibe: VibeId, record: DropLookRecord): DropLook | null {
  const items = Object.fromEntries(
    Object.entries(record.slots).flatMap(([slot, id]) => {
      const product = id ? BY_ID.get(id) : undefined;
      return product ? [[slot, product]] : [];
    }),
  ) as Partial<Record<Category, Product>>;
  if (!items.top || !items.bottom || !items.shoes) return null;
  return {
    key: record.id,
    items,
    source: 'engine',
    label: `${VIBE_LABEL.get(vibe) || 'Sylistly'} fit`,
  };
}

export function getVerifiedDropLooks(
  vibe: VibeId | null,
  seed: number,
  limit = 10,
  now = Date.now(),
): DropLook[] {
  if (!dropLibraryFresh(now)) return [];
  const vibes = vibe ? [vibe] : Object.keys(DATA.looks) as VibeId[];
  const pool = vibes.flatMap((entry) => (DATA.looks[entry] || [])
    .map((record) => hydrate(entry, record))
    .filter((look): look is DropLook => Boolean(look)));
  if (!pool.length) return [];
  const offset = Math.abs(Math.floor(seed)) % pool.length;
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
  return rotated.slice(0, Math.max(0, limit));
}

/** Resolve saved Drop identities against the same compact, freshly verified
 * product snapshot that powers the current route. Historical/stale IDs are
 * withheld instead of pulling the entire 1.9MB candidate catalog client-side. */
export function resolveVerifiedDropProducts(
  productIds: string[],
  now = Date.now(),
): Product[] {
  if (!dropLibraryFresh(now)) return [];
  return productIds.flatMap((id) => {
    const product = BY_ID.get(id);
    return product ? [product] : [];
  });
}
