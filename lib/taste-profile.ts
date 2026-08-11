import type { Category, Product } from './types';
import { VIBES, type VibeId } from './vibes';

/**
 * Sylistly's on-device taste memory.
 *
 * This is intentionally a small, deterministic preference heuristic rather
 * than an ML claim. Explicit actions become bounded, recency-weighted nudges;
 * they can reorder otherwise-eligible products but can never bypass commerce,
 * size, frame, vibe, or budget gates.
 */
export const TASTE_PROFILE_STORAGE_KEY = 'sylistly.taste-profile.v1';
export const TASTE_PROFILE_SCHEMA_VERSION = 1;
export const TASTE_PROFILE_MAX_BYTES = 32 * 1024;

const LEGACY_FEED_LIKES_KEY = 'sylistly.vibe-likes.v1';
const LEGACY_FEED_PASSES_KEY = 'sylistly.vibe-passes.v1';
const LEGACY_BUILDER_KEY = 'sylistly-builder-preferences-v1';
const MAX_EVENTS = 180;
const HALF_LIFE_MS = 120 * 24 * 60 * 60 * 1000;
const VIBE_IDS = new Set<string>(VIBES.map((vibe) => vibe.id));

export type TasteAction =
  | 'save'
  | 'pass'
  | 'remix'
  | 'shop'
  | 'replacement'
  | 'onboarding'
  | 'legacy_like'
  | 'legacy_pass';

export interface TasteProductSnapshot {
  id: string;
  category?: Category;
  brand?: string;
  retailer?: string;
  colors?: string[];
  terms?: string[];
}

export interface TasteEvent {
  id: string;
  action: TasteAction;
  vibe?: VibeId;
  products: TasteProductSnapshot[];
  rejectedProducts: TasteProductSnapshot[];
  contextId?: string;
  strength: number;
  createdAt: number;
}

export interface TasteProfile {
  schemaVersion: typeof TASTE_PROFILE_SCHEMA_VERSION;
  updatedAt: number;
  events: TasteEvent[];
  migrations: {
    legacyFeed: boolean;
    legacyBuilder: boolean;
  };
}

export interface TasteRankingSignals {
  evidenceCount: number;
  vibeScores: Partial<Record<VibeId, number>>;
  productScores: Record<string, number>;
  brandScores: Record<string, number>;
  retailerScores: Record<string, number>;
  colorScores: Record<string, number>;
  termScores: Record<string, number>;
  categoryScores: Partial<Record<Category, number>>;
}

export interface TasteSignalInput {
  action: Exclude<TasteAction, 'legacy_like' | 'legacy_pass'>;
  vibe?: VibeId;
  products?: Array<Product | TasteProductSnapshot>;
  rejectedProducts?: Array<Product | TasteProductSnapshot>;
  contextId?: string;
  /** Optional evidence multiplier, bounded so no single click can dominate. */
  strength?: number;
}

export interface TasteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type CompactProduct = [
  id: string,
  category: Category | null,
  brand: string | null,
  retailer: string | null,
  colors?: string[],
  terms?: string[],
];

type CompactEvent = [
  id: string,
  action: TasteAction,
  vibe: VibeId | null,
  strength: number,
  createdAt: number,
  contextId: string | null,
  products: CompactProduct[],
  rejectedProducts: CompactProduct[],
];

interface CompactProfile {
  v: typeof TASTE_PROFILE_SCHEMA_VERSION;
  u: number;
  /** Migration bitset: 1 = Feed, 2 = Builder. */
  m: number;
  e: CompactEvent[];
}

export function emptyTasteRankingSignals(): TasteRankingSignals {
  return {
    evidenceCount: 0,
    vibeScores: {},
    productScores: {},
    brandScores: {},
    retailerScores: {},
    colorScores: {},
    termScores: {},
    categoryScores: {},
  };
}

const ACTION_VIBE_WEIGHT: Record<TasteAction, number> = {
  save: 2,
  pass: -2,
  remix: 0.65,
  shop: 3,
  replacement: 0.75,
  onboarding: 0.75,
  legacy_like: 1,
  legacy_pass: -1,
};

const ACTION_PRODUCT_WEIGHT: Record<TasteAction, number> = {
  save: 1.15,
  pass: -0.7,
  remix: 0.3,
  shop: 1.8,
  replacement: 1.5,
  onboarding: 0,
  legacy_like: 0,
  legacy_pass: 0,
};

function emptyProfile(now: number): TasteProfile {
  return {
    schemaVersion: TASTE_PROFILE_SCHEMA_VERSION,
    updatedAt: now,
    events: [],
    migrations: { legacyFeed: false, legacyBuilder: false },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: unknown): string {
  return typeof value === 'string'
    ? value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80)
    : '';
}

function cleanString(value: unknown, maxLength = 120): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || undefined;
}

function uniqueStrings(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map(normalize).filter(Boolean))).slice(0, limit);
}

function metadataStrings(product: Partial<Product>, key: string): string[] {
  const value = product.metadata?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && [
    'hat', 'outer', 'top', 'bottom', 'shoes', 'bag', 'eyewear', 'jewelry',
  ].includes(value);
}

function isVibe(value: unknown): value is VibeId {
  return typeof value === 'string' && VIBE_IDS.has(value);
}

function isTasteAction(value: unknown): value is TasteAction {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ACTION_VIBE_WEIGHT, value);
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function safeGetItem(storage: TasteStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** UTF-8 byte count without relying on TextEncoder in older embedded webviews. */
export function tasteProfileSerializedBytes(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) || 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

function expandCompactProduct(value: unknown): TasteProductSnapshot | null {
  if (!Array.isArray(value)) return null;
  return productSnapshot({
    id: value[0],
    category: value[1],
    brand: value[2],
    retailer: value[3],
    colors: value[4],
    terms: value[5],
  });
}

function expandStoredProfile(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const compact = value as Partial<CompactProfile>;
  if (compact.v !== TASTE_PROFILE_SCHEMA_VERSION || !Array.isArray(compact.e)) return value;
  return {
    schemaVersion: TASTE_PROFILE_SCHEMA_VERSION,
    updatedAt: compact.u,
    migrations: {
      legacyFeed: Boolean((compact.m || 0) & 1),
      legacyBuilder: Boolean((compact.m || 0) & 2),
    },
    events: compact.e.map((event) => ({
      id: event?.[0],
      action: event?.[1],
      vibe: event?.[2],
      strength: event?.[3],
      createdAt: event?.[4],
      contextId: event?.[5],
      products: Array.isArray(event?.[6])
        ? event[6].map(expandCompactProduct).filter(Boolean)
        : [],
      rejectedProducts: Array.isArray(event?.[7])
        ? event[7].map(expandCompactProduct).filter(Boolean)
        : [],
    })),
  };
}

function productSnapshot(value: Product | TasteProductSnapshot | unknown): TasteProductSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<Product & TasteProductSnapshot>;
  const id = cleanString(candidate.id, 120);
  if (!id) return null;
  const product = value as Partial<Product>;
  const storedTerms = (value as TasteProductSnapshot).terms;
  const terms = uniqueStrings(
    Array.isArray(storedTerms)
      ? storedTerms
      : [
          ...metadataStrings(product, 'styles'),
          ...(product.vibes || []),
          ...(product.occasions || []),
          ...(product.searchTerms || []),
        ],
    8,
  );
  const colors = uniqueStrings(product.colors || (value as TasteProductSnapshot).colors, 6);
  return {
    id,
    ...(isCategory(candidate.category) ? { category: candidate.category } : {}),
    ...(cleanString(candidate.brand, 60) ? { brand: cleanString(candidate.brand, 60) } : {}),
    ...(cleanString(candidate.retailer, 60) ? { retailer: cleanString(candidate.retailer, 60) } : {}),
    ...(colors.length ? { colors } : {}),
    ...(terms.length ? { terms } : {}),
  };
}

function sanitizeProducts(values: unknown): TasteProductSnapshot[] {
  if (!Array.isArray(values)) return [];
  const byId = new Map<string, TasteProductSnapshot>();
  for (const value of values) {
    const snapshot = productSnapshot(value);
    if (snapshot && !byId.has(snapshot.id)) byId.set(snapshot.id, snapshot);
  }
  return Array.from(byId.values()).slice(0, 8);
}

function sanitizeEvent(value: unknown, now: number): TasteEvent | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as Partial<TasteEvent>;
  const action = isTasteAction(event.action) ? event.action : null;
  const id = cleanString(event.id, 180);
  if (!action || !id) return null;
  const createdAt = typeof event.createdAt === 'number' && Number.isFinite(event.createdAt)
    ? clamp(event.createdAt, 0, now + 5 * 60 * 1000)
    : now;
  return {
    id,
    action,
    ...(isVibe(event.vibe) ? { vibe: event.vibe } : {}),
    products: sanitizeProducts(event.products),
    rejectedProducts: sanitizeProducts(event.rejectedProducts),
    ...(cleanString(event.contextId, 180) ? { contextId: cleanString(event.contextId, 180) } : {}),
    strength: clamp(
      typeof event.strength === 'number' && Number.isFinite(event.strength) ? event.strength : 1,
      0.1,
      12,
    ),
    createdAt,
  };
}

function sanitizeProfile(value: unknown, now: number): TasteProfile {
  const base = emptyProfile(now);
  if (!value || typeof value !== 'object') return base;
  const candidate = value as Partial<TasteProfile>;
  const events = Array.isArray(candidate.events)
    ? candidate.events
        .map((event) => sanitizeEvent(event, now))
        .filter((event): event is TasteEvent => Boolean(event))
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, MAX_EVENTS)
    : [];
  return {
    schemaVersion: TASTE_PROFILE_SCHEMA_VERSION,
    updatedAt: typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt)
      ? candidate.updatedAt
      : now,
    events,
    migrations: {
      legacyFeed: candidate.migrations?.legacyFeed === true,
      legacyBuilder: candidate.migrations?.legacyBuilder === true,
    },
  };
}

function compactProduct(product: TasteProductSnapshot): CompactProduct {
  const compact: CompactProduct = [
    product.id,
    product.category || null,
    product.brand || null,
    product.retailer || null,
  ];
  if (product.colors?.length || product.terms?.length) {
    compact[4] = product.colors || [];
    compact[5] = product.terms || [];
  }
  return compact;
}

function serializeCompactProfile(profile: TasteProfile, events: TasteEvent[]): string {
  const compact: CompactProfile = {
    v: TASTE_PROFILE_SCHEMA_VERSION,
    u: profile.updatedAt,
    m: (profile.migrations.legacyFeed ? 1 : 0) | (profile.migrations.legacyBuilder ? 2 : 0),
    e: events.map((event) => [
      event.id,
      event.action,
      event.vibe || null,
      event.strength,
      event.createdAt,
      event.contextId || null,
      event.products.map(compactProduct),
      event.rejectedProducts.map(compactProduct),
    ]),
  };
  return JSON.stringify(compact);
}

/** Persist compactly, trimming oldest evidence before the model can pressure
 * localStorage. A quota rejection retries with progressively smaller history. */
function persistTasteProfile(storage: TasteStorage, profile: TasteProfile): void {
  let events = profile.events.slice(0, MAX_EVENTS);
  let serialized = serializeCompactProfile(profile, events);
  while (events.length && tasteProfileSerializedBytes(serialized) > TASTE_PROFILE_MAX_BYTES) {
    events = events.slice(0, Math.max(0, events.length - Math.max(1, Math.ceil(events.length * 0.1))));
    serialized = serializeCompactProfile(profile, events);
  }

  for (let attempt = 0; attempt < 9; attempt += 1) {
    try {
      storage.setItem(TASTE_PROFILE_STORAGE_KEY, serialized);
      profile.events = events;
      return;
    } catch {
      if (!events.length) return;
      events = events.slice(0, Math.floor(events.length / 2));
      serialized = serializeCompactProfile(profile, events);
    }
  }
}

function legacyEventId(source: string, ...parts: Array<string | number>): string {
  return `migration:${source}:${parts.join(':')}`.slice(0, 180);
}

function stableEventHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function migrateLegacyFeed(storage: TasteStorage, profile: TasteProfile, now: number): void {
  const likes = parseJson(safeGetItem(storage, LEGACY_FEED_LIKES_KEY));
  const passes = parseJson(safeGetItem(storage, LEGACY_FEED_PASSES_KEY));
  for (const [action, value] of [
    ['legacy_like', likes],
    ['legacy_pass', passes],
  ] as const) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    for (const [vibe, rawCount] of Object.entries(value as Record<string, unknown>)) {
      if (!isVibe(vibe) || typeof rawCount !== 'number' || !Number.isFinite(rawCount) || rawCount <= 0) continue;
      profile.events.push({
        id: legacyEventId('feed', action, vibe),
        action,
        vibe,
        products: [],
        rejectedProducts: [],
        strength: clamp(rawCount, 0.1, 12),
        createdAt: now - 2,
      });
    }
  }
  profile.migrations.legacyFeed = true;
}

function migrateLegacyBuilder(storage: TasteStorage, profile: TasteProfile, now: number): void {
  const raw = parseJson(safeGetItem(storage, LEGACY_BUILDER_KEY));
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const history = raw as {
      events?: unknown[];
      vibes?: Record<string, { saved?: number; passed?: number }>;
      products?: Record<string, { saved?: number; passed?: number }>;
    };
    if (Array.isArray(history.events) && history.events.length) {
      history.events.slice(0, 120).forEach((value, index) => {
        if (!value || typeof value !== 'object') return;
        const event = value as {
          kind?: unknown;
          vibe?: unknown;
          productIds?: unknown;
          categories?: unknown;
          createdAt?: unknown;
        };
        if (event.kind !== 'save' && event.kind !== 'pass') return;
        const ids = Array.isArray(event.productIds) ? event.productIds : [];
        const categories = Array.isArray(event.categories) ? event.categories : [];
        const products = ids
          .map((id, productIndex) => productSnapshot({ id, category: categories[productIndex] }))
          .filter((product): product is TasteProductSnapshot => Boolean(product));
        const createdAt = typeof event.createdAt === 'number' && Number.isFinite(event.createdAt)
          ? event.createdAt
          : now - index - 1;
        profile.events.push({
          id: legacyEventId('builder-event', createdAt, index),
          action: event.kind,
          ...(isVibe(event.vibe) ? { vibe: event.vibe } : {}),
          products,
          rejectedProducts: [],
          // Old counters were +1/-1; new explicit saves/passes carry more weight.
          strength: 0.5,
          createdAt,
        });
      });
    } else {
      for (const [vibe, counts] of Object.entries(history.vibes || {})) {
        if (!isVibe(vibe) || !counts) continue;
        for (const [action, count] of [
          ['legacy_like', counts.saved],
          ['legacy_pass', counts.passed],
        ] as const) {
          if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) continue;
          profile.events.push({
            id: legacyEventId('builder-vibe', action, vibe),
            action,
            vibe,
            products: [],
            rejectedProducts: [],
            strength: clamp(count, 0.1, 12),
            createdAt: now - 1,
          });
        }
      }
      for (const [id, counts] of Object.entries(history.products || {})) {
        if (!cleanString(id, 160) || !counts) continue;
        for (const [action, count] of [
          ['save', counts.saved],
          ['pass', counts.passed],
        ] as const) {
          if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) continue;
          profile.events.push({
            id: legacyEventId('builder-product', action, id),
            action,
            products: [{ id: id.slice(0, 160) }],
            rejectedProducts: [],
            strength: clamp(count * 0.5, 0.1, 12),
            createdAt: now - 1,
          });
        }
      }
    }
  }
  profile.migrations.legacyBuilder = true;
}

/** Read, validate, and one-time bridge both previous taste stores. */
export function loadTasteProfile(storage: TasteStorage, now = Date.now()): TasteProfile {
  const stored = parseJson(safeGetItem(storage, TASTE_PROFILE_STORAGE_KEY));
  const profile = sanitizeProfile(expandStoredProfile(stored), now);
  let changed = false;
  if (!profile.migrations.legacyFeed) {
    migrateLegacyFeed(storage, profile, now);
    changed = true;
  }
  if (!profile.migrations.legacyBuilder) {
    migrateLegacyBuilder(storage, profile, now);
    changed = true;
  }
  if (changed) {
    profile.events = profile.events
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, MAX_EVENTS);
    profile.updatedAt = now;
    persistTasteProfile(storage, profile);
  }
  return profile;
}

/** Persist one explicit interaction and return its id for an optional undo. */
export function recordTasteSignal(
  storage: TasteStorage,
  input: TasteSignalInput,
  now = Date.now(),
): { profile: TasteProfile; eventId: string | null } {
  const profile = loadTasteProfile(storage, now);
  const products = sanitizeProducts(input.products || []);
  const rejectedProducts = sanitizeProducts(input.rejectedProducts || []);
  const vibe = isVibe(input.vibe) ? input.vibe : undefined;
  if (!vibe && !products.length && !rejectedProducts.length) return { profile, eventId: null };
  const strength = clamp(
    typeof input.strength === 'number' && Number.isFinite(input.strength) ? input.strength : 1,
    0.1,
    5,
  );
  const contextId = cleanString(input.contextId, 120);
  const existingIndex = contextId
    ? profile.events.findIndex((event) => event.action === input.action && event.contextId === contextId)
    : -1;
  const existing = existingIndex >= 0 ? profile.events[existingIndex] : undefined;
  if (existingIndex >= 0) profile.events.splice(existingIndex, 1);
  const identity = contextId
    ? `${input.action}:${contextId}`
    : `${input.action}:${now}:${profile.events.length}:${vibe || ''}:${products.map(({ id }) => id).join(',')}`;
  const eventId = existing?.id || `t:${stableEventHash(identity)}`;
  profile.events.unshift({
    id: eventId,
    action: input.action,
    ...(vibe ? { vibe } : {}),
    products,
    rejectedProducts,
    ...(contextId ? { contextId } : {}),
    strength,
    createdAt: now,
  });
  profile.events = profile.events.slice(0, MAX_EVENTS);
  profile.updatedAt = now;
  persistTasteProfile(storage, profile);
  return { profile, eventId };
}

/** Remove the newest matching action (used by Feed's real pass undo). */
export function undoTasteSignal(
  storage: TasteStorage,
  match: { action: TasteAction; contextId: string },
  now = Date.now(),
): { profile: TasteProfile; undone: boolean } {
  const profile = loadTasteProfile(storage, now);
  const index = profile.events.findIndex((event) =>
    event.action === match.action && event.contextId === match.contextId,
  );
  if (index < 0) return { profile, undone: false };
  profile.events.splice(index, 1);
  profile.updatedAt = now;
  persistTasteProfile(storage, profile);
  return { profile, undone: true };
}

function addScore(target: Record<string, number>, key: string | undefined, amount: number): void {
  const normalizedKey = normalize(key);
  if (!normalizedKey || !Number.isFinite(amount)) return;
  target[normalizedKey] = (target[normalizedKey] || 0) + amount;
}

function squashScores(raw: Record<string, number>, cap: number, scale: number): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const score = Math.round(Math.tanh(value / scale) * cap);
    if (score) result[key] = score;
  }
  return result;
}

/** Convert event evidence into bounded ranking nudges. */
export function buildTasteRankingSignals(profile: TasteProfile, now = Date.now()): TasteRankingSignals {
  if (!profile.events.length) return emptyTasteRankingSignals();
  const rawVibes: Record<string, number> = {};
  const rawProducts: Record<string, number> = {};
  const rawBrands: Record<string, number> = {};
  const rawRetailers: Record<string, number> = {};
  const rawColors: Record<string, number> = {};
  const rawTerms: Record<string, number> = {};
  const rawCategories: Record<string, number> = {};
  let evidenceCount = 0;

  const applyProduct = (product: TasteProductSnapshot, amount: number) => {
    if (!amount) return;
    addScore(rawProducts, product.id, amount);
    addScore(rawBrands, product.brand, amount * 0.45);
    addScore(rawRetailers, product.retailer, amount * 0.3);
    addScore(rawCategories, product.category, amount * 0.2);
    for (const color of product.colors || []) addScore(rawColors, color, amount * 0.3);
    for (const term of product.terms || []) addScore(rawTerms, term, amount * 0.18);
  };

  for (const event of profile.events) {
    const age = Math.max(0, now - event.createdAt);
    const decay = Math.pow(0.5, age / HALF_LIFE_MS);
    if (decay < 0.04) continue;
    evidenceCount += 1;
    const vibeAmount = ACTION_VIBE_WEIGHT[event.action] * event.strength * decay;
    if (event.vibe) addScore(rawVibes, event.vibe, vibeAmount);
    const productAmount = ACTION_PRODUCT_WEIGHT[event.action] * event.strength * decay;
    for (const product of event.products) applyProduct(product, productAmount);
    // A successful replacement is the only interaction with a known rejected
    // item. Keep that penalty moderate: the old piece may not be the sole cause.
    const rejectedAmount = event.action === 'replacement'
      ? -1.1 * event.strength * decay
      : 0;
    for (const product of event.rejectedProducts) applyProduct(product, rejectedAmount);
  }

  const vibeScores: Partial<Record<VibeId, number>> = {};
  for (const [vibe, value] of Object.entries(rawVibes)) {
    if (!isVibe(vibe)) continue;
    const bounded = Math.round(clamp(value, -12, 12) * 100) / 100;
    if (bounded) vibeScores[vibe] = bounded;
  }

  return {
    evidenceCount,
    vibeScores,
    productScores: squashScores(rawProducts, 52, 4),
    brandScores: squashScores(rawBrands, 22, 5),
    retailerScores: squashScores(rawRetailers, 14, 5),
    colorScores: squashScores(rawColors, 12, 4),
    termScores: squashScores(rawTerms, 10, 4),
    categoryScores: squashScores(rawCategories, 8, 4) as Partial<Record<Category, number>>,
  };
}

/** Gentle product-level nudge used by both live composition and library rows. */
export function scoreProductForTaste(product: Product, signals?: TasteRankingSignals): number {
  if (!signals?.evidenceCount) return 0;
  const productTerms = new Set(uniqueStrings([
    ...metadataStrings(product, 'styles'),
    ...(product.vibes || []),
    ...(product.occasions || []),
    ...(product.searchTerms || []),
  ], 60));
  const colors = uniqueStrings(product.colors || [], 20);
  let score = signals.productScores[normalize(product.id)] || 0;
  score += signals.brandScores[normalize(product.brand)] || 0;
  score += signals.retailerScores[normalize(product.retailer)] || 0;
  score += signals.categoryScores[product.category] || 0;
  score += colors.reduce((best, color) => Math.max(best, signals.colorScores[color] || 0), 0);
  score += Array.from(productTerms).reduce((best, term) => {
    const candidate = signals.termScores[term] || 0;
    return Math.abs(candidate) > Math.abs(best) ? candidate : best;
  }, 0);
  return Math.round(clamp(score, -72, 72));
}

export function scoreOutfitForTaste(
  products: Array<Product | undefined>,
  signals?: TasteRankingSignals,
): number {
  const resolved = products.filter((product): product is Product => Boolean(product));
  if (!resolved.length || !signals?.evidenceCount) return 0;
  return resolved.reduce((sum, product) => sum + scoreProductForTaste(product, signals), 0) / resolved.length;
}

/** Shared stable deck/library score: product evidence plus a modest vibe nudge. */
export function scoreLookForTaste(
  products: Array<Product | undefined>,
  vibe: VibeId,
  signals?: TasteRankingSignals,
): number {
  return scoreOutfitForTaste(products, signals) + (signals?.vibeScores[vibe] || 0) * 4;
}

/** Adapter retained for compose-look's serializable generation cursor. */
export function tasteVibeCounters(signals: TasteRankingSignals): {
  likes: Record<string, number>;
  passes: Record<string, number>;
} {
  const likes: Record<string, number> = {};
  const passes: Record<string, number> = {};
  for (const [vibe, score] of Object.entries(signals.vibeScores)) {
    if (!score) continue;
    if (score > 0) likes[vibe] = score;
    else passes[vibe] = Math.abs(score);
  }
  return { likes, passes };
}
