/**
 * Offline outfit-library generator — ZERO API cost, deterministic.
 *
 * Composes a large library of *well-coordinated* outfits per vibe × frame
 * directly from the bundled client catalog, scoring each candidate for real
 * coordination (color harmony + vibe coherence + formality cohesion) and
 * keeping only the ones that clear a quality bar. Thin slots are widened with
 * formality-compatible fallbacks so no vibe ever runs out of a category.
 *
 * Output: data/outfit-library.json  (compact: product IDs + metadata).
 * The app hydrates IDs from the bundled catalog at runtime → instant, $0.
 *
 * Run:  node scripts/generate-outfit-library.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const catalog = JSON.parse(readFileSync(join(ROOT, 'data/client-catalog.json'), 'utf8'));
const health = JSON.parse(readFileSync(join(ROOT, 'data/catalog-health.json'), 'utf8'));
const CATALOG_PRODUCTS = Array.isArray(catalog) ? catalog : catalog.products || Object.values(catalog)[0];
const MAX_HEALTH_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const BASELINE_ROWS = 12_000;
const BASELINE_METRICS = Object.freeze({
  rows: BASELINE_ROWS,
  uniqueSignatures: 11_810,
  duplicateSignatures: 190,
  duplicateRatePct: 1.5833,
  compactArtifactBytes: 356_360,
});
const TARGET_UNIQUE_SIGNATURES = BASELINE_ROWS * 2;
const TARGET_PER_COMBO = TARGET_UNIQUE_SIGNATURES / (10 * 3);

if (health.schemaVersion < 2 || !health.products || !health.generatedAt) {
  throw new Error('A schema-v2 catalog-health.json is required. Run npm run health:sweep first.');
}
const generatedMs = Date.parse(health.generatedAt);
const generatedAgeMs = Date.now() - generatedMs;
if (!Number.isFinite(generatedMs)
  || generatedAgeMs < -MAX_FUTURE_SKEW_MS
  || generatedAgeMs > MAX_HEALTH_AGE_MS) {
  throw new Error('Catalog health evidence must be current (<=24 hours old). Run npm run health:sweep first.');
}

// ── Shoppability (mirrors lib/product-image-quality hasExactProductLink) ──
// A piece is "exact" when productUrl/retailerUrl points at a real merchant
// PDP — not a search/aggregator URL. Exact links are what affiliate wrapping
// can actually monetize; google-search fallbacks earn nothing.
function isSearchOrAggregatorUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.toLowerCase();
    const params = parsed.searchParams;
    const hash = parsed.hash.toLowerCase();
    const isNordstromProductPath =
      (hostname === 'nordstrom.com' || hostname === 'nordstromrack.com') &&
      /^\/s\/[^/]+\/\d+/.test(pathname);
    if (hostname.includes('google.') && (pathname.includes('/search') || pathname.includes('/shopping'))) return true;
    if (hash.includes('oshopproduct')) return true;
    if (pathname.includes('/search') || (pathname.includes('/s/') && !isNordstromProductPath) || pathname.includes('search-result')) return true;
    return params.has('q') || params.has('query') || params.has('search')
      || params.has('searchTerm') || params.has('text') || params.has('keyword');
  } catch {
    return true;
  }
}

function hasExactLink(p) {
  const url = [p?.productUrl, p?.retailerUrl]
    .find((value) => typeof value === 'string' && value.trim());
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (!parsed.pathname || parsed.pathname === '/') return false;
  } catch { return false; }
  return !isSearchOrAggregatorUrl(url);
}

function hasFreshPositiveEvidence(p) {
  const record = health.products[p.id];
  const checkedMs = Date.parse(record?.checkedAt || '');
  const ageMs = Date.now() - checkedMs;
  return p
    && p.imageTransparentUrl
    && p.category
    && p.trusted !== false
    && p.inStock !== false
    && Number.isFinite(p.priceCents)
    && p.priceCents > 0
    && record?.outcome === 'available'
    && record.exactPdp === true
    && Number.isFinite(checkedMs)
    && ageMs >= -MAX_FUTURE_SKEW_MS
    && ageMs <= MAX_HEALTH_AGE_MS
    && hasExactLink(p);
}

// This is deliberately a positive-evidence allowlist, not a dead-link denylist.
// A retailer block, a merely reachable page, or missing/stale evidence excludes
// the product. Runtime hydration applies the same fail-closed policy.
const PRODUCTS = CATALOG_PRODUCTS.filter(hasFreshPositiveEvidence);
const EXACT_LINK_IDS = new Set(PRODUCTS.filter(hasExactLink).map((p) => p.id));

// ── Color taxonomy ────────────────────────────────────────────────
const NEUTRALS = new Set(['black', 'white', 'tan', 'beige', 'grey', 'gray', 'brown', 'navy', 'ivory', 'cream', 'olive']);
const METALLICS = new Set(['gold', 'silver']);
const CLASH_PAIRS = [
  ['red', 'green'], ['orange', 'purple'], ['pink', 'red'], ['orange', 'pink'],
  ['green', 'purple'], ['red', 'orange'], ['blue', 'orange'], ['purple', 'yellow'],
];
const norm = (c) => (c === 'gray' ? 'grey' : c);

// ── Formality scale (from occasions) ──────────────────────────────
// 0 athletic · 1 casual/relaxed · 2 smart-casual · 3 formal/dressy
const OCCASION_FORMALITY = {
  workout: 0, gym: 0, running: 0, training: 0,
  everyday: 1, casual: 1, streetwear: 1, school: 1, beach: 1, summer: 1, vacation: 1, travel: 1, outdoor: 1, cozy: 1, winter: 1,
  clean: 2, minimal: 2, classic: 2, preppy: 2, 'smart casual': 2,
  office: 3, workwear: 3, 'business casual': 3, date: 3, 'night out': 3, night: 3,
};
function pieceFormality(p) {
  const vals = (p.occasions || []).map((o) => OCCASION_FORMALITY[o]).filter((v) => v != null);
  if (!vals.length) return 1;
  // representative = median
  vals.sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)];
}

// ── Vibe config: canonical vibe → adjacent tags, slots, target formality ──
const VIBE_CONFIG = {
  clean:    { adj: ['minimal', 'casual', 'classic', 'premium', 'old money', 'business casual'], slots: ['top', 'bottom', 'shoes', 'outer', 'bag'], formality: 2 },
  street:   { adj: ['streetwear', 'casual', 'edgy', 'techwear', 'y2k', 'sneaker'], slots: ['top', 'bottom', 'shoes', 'outer', 'bag', 'hat'], formality: 1 },
  office:   { adj: ['workwear', 'business casual', 'classic', 'preppy', 'clean', 'minimal', 'old money'], slots: ['top', 'bottom', 'shoes', 'outer', 'bag'], formality: 3 },
  date:     { adj: ['night out', 'night', 'premium', 'clean', 'minimal', 'dressy'], slots: ['top', 'bottom', 'shoes', 'outer', 'jewelry', 'bag'], formality: 3 },
  gym:      { adj: ['athletic', 'workout', 'training', 'running', 'sneaker'], slots: ['top', 'bottom', 'shoes', 'bag', 'hat'], formality: 0 },
  cozy:     { adj: ['casual', 'minimal', 'clean', 'winter', 'everyday'], slots: ['top', 'bottom', 'shoes', 'outer'], formality: 1 },
  vacation: { adj: ['beach', 'summer', 'coastal', 'travel', 'casual'], slots: ['top', 'bottom', 'shoes', 'hat', 'eyewear', 'bag'], formality: 1 },
  preppy:   { adj: ['classic', 'old money', 'clean', 'college', 'business casual'], slots: ['top', 'bottom', 'shoes', 'outer', 'bag'], formality: 2 },
  night:    { adj: ['night out', 'date', 'premium', 'luxury', 'dressy', 'edgy'], slots: ['top', 'bottom', 'shoes', 'outer', 'jewelry', 'bag'], formality: 3 },
  edgy:     { adj: ['street', 'streetwear', 'techwear', 'y2k'], slots: ['top', 'bottom', 'shoes', 'outer', 'bag'], formality: 1 },
};
const REQUIRED = ['top', 'bottom', 'shoes'];
const FRAMES = ['androgynous', 'fem', 'masc'];

// ── Seeded PRNG (deterministic, reproducible) ─────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Gender taxonomy: male / female / neutral ──────────────────────
// Infer from product name (the catalog over-tags "androgynous"), so the
// female/male libraries are genuinely deep & gendered, and "neutral" stays
// truly unisex. Each gender's pool = its own items + neutral (unisex), which
// also guarantees no outfit mixes a women's-specific with a men's-specific piece.
const FRAME_TO_GENDER = { androgynous: 'neutral', fem: 'female', masc: 'male' };
function inferGender(p) {
  const raw = `${p.brand || ''} ${p.name || ''}`.toLowerCase();
  const womens = /\bwomen'?s?\b|\bwmns\b|\bwomens\b|\bladies\b|\bgirls?\b/.test(raw);
  const mens = /\bmen'?s?\b|\bmens\b|\bboys?\b/.test(raw);
  if (womens && mens) return 'neutral';           // unisex sizing ("Mens 5.5 / Womens 7")
  // female-specific garments — strip "dress shirt/pant/shoe" so they don't read as a dress
  const s = raw.replace(/dress\s+(shirt|pant|pants|shoe|shoes|trouser|trousers|sock|socks|code)/g, 'x');
  // Women-leaning brands (overwhelmingly womenswear in this catalog).
  const femBrand = /\balo yoga\b|set active|reformation|\bganni\b|free people|\bvarley\b|beyond yoga|girlfriend collective|outdoor voices|good american|\bspanx\b|princess polly|white fox|\bmeshki\b|oh polly|house of cb|cult gaia|\bstaud\b|edikted|\bskims\b|aritzia|babaton|wilfred/.test(raw);
  // Women-coded garments + lines (mirrors lib/frame-inference FEM_ONLY_TERMS).
  const femGarment = /\bskirt\b|\bskort\b|\bblouse\b|\bcami\b|camisole|bodysuit|\bhalter\b|bandeau|\bcorset\b|bustier|\bromper\b|playsuit|catsuit|jumpsuit|\bmidi\b|\bmaxi\b|\bdress(es)?\b|crop top|cropped top|cropped polo|cropped tee|cropped cami|cropped tank|tube top|tube dress|scoop neck|scoop tank|square neck|sweetheart|off.?shoulder|one.?shoulder|wrap top|wrap dress|peplum|ruched|smocked|milkmaid|sports bra|bralette|bra top|align tank|aspire tank|\blegging|jegging|airbrush|airlift|alosoft|biker short|micro short|booty short|slingback|ballet flat|ballerina flat|kitten heel|\bmule\b|mary jane|stiletto|\bpumps?\b|\bheels?\b/.test(s);
  // catalog jewelry skews feminine (earrings, dainty/delicate rings) — keep it out of male fits
  const femJewelry = p.category === 'jewelry'
    && /earring|dainty|delicate|birthstone|\bcharm|pearl|dewdrop|moonstone|stacking|huggie|\bstud|solitaire|ombre/.test(raw);
  const tag = (p.gender || [])[0];
  if (womens || femBrand || femGarment || femJewelry || tag === 'fem') return 'female';
  if (mens || tag === 'masc') return 'male';
  return 'neutral';
}
function genderOk(p, frame) {
  const want = FRAME_TO_GENDER[frame] || 'neutral';
  const g = inferGender(p);
  if (want === 'neutral') return g === 'neutral'; // truly unisex only
  return g === want || g === 'neutral';            // gendered + unisex
}
const vibeMatch = (p, vibe, adj) => {
  const v = p.vibes || [];
  if (v.includes(vibe)) return 1;
  if (v.some((x) => adj.includes(x))) return 0.6;
  return 0;
};

// ── Name-based type classification (tags are too noisy for coordination) ──
const nameOf = (p) => `${p.brand || ''} ${p.name || ''}`.toLowerCase();
const isJunkBag = (p) => p.category === 'bag' && /shopping bag/.test(nameOf(p));

const ATHLETIC = /jordan|air max|dunk|air force|af1|yeezy|presto|vapor|foam|\bf50\b/;          // loud sport
const CHUNKY = /990|992|993|860|9060|2002r|new balance|\bnb\b|\bgel[- ]|vomero|\b1300\b|990v/; // dad/runner
const MINIMAL = /samba|gazelle|campus|stan smith|margiela|court sneaker|chuck taylor|converse|leather sneaker|cup sole|tread-bare|releather|\b550\b|\b327\b/;
const DRESS_SHOE = /loafer|oxford|derby|monk|brogue|penny|dress shoe|moccasin|boat shoe/;
const HEEL = /heel|pump|slingback|stiletto|\bmule/;
const BOOT = /boot|chelsea/;
const SANDAL = /birkenstock|sandal|\bslide|clog|espadrille|boston|arizona|flip[- ]?flop/;
const FLAT = /ballet|flat|mary jane/;
function shoeTags(p) {
  const n = nameOf(p);
  const t = new Set();
  if (ATHLETIC.test(n)) t.add('athletic');
  if (CHUNKY.test(n)) t.add('chunky');
  if (MINIMAL.test(n)) t.add('minimal');
  if (DRESS_SHOE.test(n)) t.add('dress');
  if (HEEL.test(n)) t.add('heel');
  if (BOOT.test(n)) t.add('boot');
  if (SANDAL.test(n)) t.add('sandal');
  if (FLAT.test(n)) t.add('flat');
  if (!t.size) t.add('minimal'); // unclassified → treat as a plain casual sneaker
  return t;
}
// allowed footwear tag-set per vibe (night = dressy only; formal vibes ban loud/chunky)
const FOOTWEAR_ALLOW = {
  gym:      new Set(['athletic', 'chunky', 'minimal']),
  street:   new Set(['athletic', 'chunky', 'minimal', 'boot']),
  edgy:     new Set(['athletic', 'chunky', 'minimal', 'boot']),
  cozy:     new Set(['minimal', 'chunky', 'boot', 'sandal']),
  vacation: new Set(['sandal', 'minimal', 'flat']),
  clean:    new Set(['minimal', 'dress', 'boot', 'flat']),
  preppy:   new Set(['minimal', 'dress', 'boot', 'flat']),
  office:   new Set(['dress', 'heel', 'boot', 'flat', 'minimal']),
  date:     new Set(['heel', 'dress', 'boot', 'flat', 'minimal']),
  night:    new Set(['heel', 'dress', 'boot']),
};
const GYM_BOTTOM_OK = /legging|short|jogger|sweatpant|track|tight|bike/;
const GYM_BOTTOM_NO = /jean|trouser|cargo|suit|chino|dress|skirt|tube|denim/;
const GYM_TOP_OK = /tee|t-shirt|tank|jersey|sports bra|hoodie|sweatshirt|crew|base layer|active/;
const GYM_TOP_NO = /tube top|blouse|button|polo|sweater|cardigan|dress shirt|halter/;
// Formal vibes (office/date/night/preppy) reject overtly casual/athletic garments.
const CASUAL_GARMENT_NO = /hoodie|sweatpant|sweat short|jogger|cargo|mesh|bikini|swim|board ?short|\bjersey\b|tube top|baggy|track |athletic short|sports bra/;
function formalGarmentOk(p, vibe) {
  if (!['office', 'date', 'night', 'preppy'].includes(vibe)) return true;
  if (p.category !== 'top' && p.category !== 'bottom') return true;
  const n = nameOf(p);
  if (CASUAL_GARMENT_NO.test(n)) return false;
  // Swimwear/beachwear never belongs in a dressy or professional fit.
  if (/bikini|swim|board ?short|bond eye|\blumi\b|bandeau|sarong/.test(n)) return false;
  // Office & preppy are professional daywear — no going-out/revealing tops
  // (date & night legitimately allow cami/halter/bodysuit).
  if ((vibe === 'office' || vibe === 'preppy') && p.category === 'top'
    && /halter|crop|tube|cami|bodysuit|corset|napkin|sheer|mesh|cut[- ]?out/.test(n)) return false;
  return true;
}

// Is this product type-appropriate for the slot within this vibe?
function typeAllowed(p, slot, vibe) {
  if (slot === 'bag') return !isJunkBag(p);
  if (slot === 'shoes') {
    const allow = FOOTWEAR_ALLOW[vibe];
    if (!allow) return true;
    return [...shoeTags(p)].some((t) => allow.has(t));
  }
  if (vibe === 'gym' && slot === 'bottom') return GYM_BOTTOM_OK.test(nameOf(p)) && !GYM_BOTTOM_NO.test(nameOf(p));
  if (vibe === 'gym' && slot === 'top') return GYM_TOP_OK.test(nameOf(p)) && !GYM_TOP_NO.test(nameOf(p));
  return formalGarmentOk(p, vibe);
}

// ── Coordination scorer ───────────────────────────────────────────
function scoreOutfit(pieces, vibe, cfg) {
  // colors
  const colors = [];
  for (const p of pieces) for (const c of p.colors || []) colors.push(norm(c));
  const distinctAccents = [...new Set(colors.filter((c) => !NEUTRALS.has(c) && !METALLICS.has(c)))];
  let color;
  if (distinctAccents.length === 0) color = 1.0;
  else if (distinctAccents.length === 1) color = 0.9;
  else if (distinctAccents.length === 2) color = 0.58;
  else color = 0.28;
  for (const [a, b] of CLASH_PAIRS) if (distinctAccents.includes(a) && distinctAccents.includes(b)) color -= 0.22;
  if (colors.includes('black') || colors.includes('white')) color += 0.05; // anchor
  color = Math.max(0, Math.min(1, color));

  // vibe coherence
  const vibeScores = pieces.map((p) => vibeMatch(p, vibe, cfg.adj));
  const vibe01 = vibeScores.reduce((s, v) => s + v, 0) / pieces.length;

  // formality cohesion (penalize spread + distance from target)
  const fvals = pieces.map(pieceFormality);
  const spread = Math.max(...fvals) - Math.min(...fvals);
  const avgDist = fvals.reduce((s, f) => s + Math.abs(f - cfg.formality), 0) / fvals.length;
  let formality = 1 - spread / 3 * 0.6 - avgDist / 3 * 0.4;
  formality = Math.max(0, Math.min(1, formality));

  // completeness
  const have = new Set(pieces.map((p) => p.category));
  const reqOk = REQUIRED.every((s) => have.has(s));
  const preferredFilled = cfg.slots.filter((s) => !REQUIRED.includes(s) && have.has(s)).length;
  const completeness = (reqOk ? 0.7 : 0) + Math.min(0.3, preferredFilled * 0.1);

  // Brand diversity — penalize repeating the same label across an outfit
  // (the catalog is brand-concentrated, so this spreads brands).
  const brands = pieces.map((p) => (p.brand || '').toLowerCase()).filter(Boolean);
  const dupBrands = brands.length - new Set(brands).size;
  const brandDiversity = Math.max(0, 1 - dupBrands * 0.5);

  // Shoppability — share of pieces with a real merchant PDP link (what
  // affiliate wrapping can monetize), plus a bonus once the look clears the
  // ≥3-exact floor the feed already uses. Soft weight, not a gate: thin slots
  // (e.g. bottoms are mostly link-less) must still fill.
  const exactCount = pieces.filter((p) => EXACT_LINK_IDS.has(p.id)).length;
  const shoppability = (exactCount / pieces.length) * 0.8 + (exactCount >= 3 ? 0.2 : 0);

  // Color data is sparse, so weight it modestly and lean on vibe + formality
  // cohesion (and the type-appropriate pools) + brand diversity for coordination.
  const total = vibe01 * 0.33 + formality * 0.22 + color * 0.14 + completeness * 0.11 + brandDiversity * 0.10 + shoppability * 0.10;
  return { total, color, vibe01, formality, completeness, brandDiversity, shoppability, distinctAccents };
}

// ── Build slot pools (with coverage widening) ─────────────────────
function buildPools(vibe, cfg, frame) {
  const pools = {};
  for (const slot of cfg.slots) {
    const base = PRODUCTS.filter((p) => p.category === slot && genderOk(p, frame) && typeAllowed(p, slot, vibe));
    let pool = base.filter((p) => vibeMatch(p, vibe, cfg.adj) > 0);
    // Coverage widening: if a slot is thin, add formality-compatible items of
    // the SAME type-appropriateness so the vibe never runs out of a category
    // (but never pulls, e.g., athletic sneakers into an office fit).
    if (pool.length < 8) {
      const extra = base.filter((p) => Math.abs(pieceFormality(p) - cfg.formality) <= 1 && !pool.includes(p));
      pool = pool.concat(extra);
    }
    pools[slot] = pool;
    // Pre-split for shoppability-weighted sampling (see sampling loop).
    pools[`${slot}:exact`] = pool.filter((p) => EXACT_LINK_IDS.has(p.id));
  }
  return pools;
}

// ── Generate library ──────────────────────────────────────────────
const QUALITY_BAR = 0.64;
const CAP_PER_COMBO = TARGET_PER_COMBO;
const SAMPLES_PER_COMBO = 180_000;

const library = [];
const stats = [];
// A signature describes the actual slot→product composition. Vibe/frame labels
// are intentionally excluded: relabeling the same outfit is not new diversity.
const globalSignatures = new Set();

for (const vibe of Object.keys(VIBE_CONFIG)) {
  const cfg = VIBE_CONFIG[vibe];
  for (const frame of FRAMES) {
    const pools = buildPools(vibe, cfg, frame);
    const reqMissing = REQUIRED.filter((s) => !pools[s] || pools[s].length === 0);
    if (reqMissing.length) {
      stats.push({
        vibe,
        frame,
        kept: 0,
        target: CAP_PER_COMBO,
        shortfall: CAP_PER_COMBO,
        attempts: 0,
        pools: Object.fromEntries(cfg.slots.map((slot) => [slot, pools[slot].length])),
        note: `missing ${reqMissing.join(',')}`,
      });
      continue;
    }

    const rand = mulberry32(hashStr(`${vibe}:${frame}`));
    const seen = new Set();
    const kept = [];
    let attempts = 0;
    while (kept.length < CAP_PER_COMBO && attempts < SAMPLES_PER_COMBO) {
      attempts += 1;
      const pieces = [];
      for (const slot of cfg.slots) {
        const pool = pools[slot];
        if (!pool || !pool.length) continue;
        // Optional slots: include probabilistically so outfits vary in richness.
        // Skip bag/eyewear MORE — the catalog is brand-concentrated there
        // (Telfar = 65% of bags, only ~16 eyewear), so over-including them
        // makes every fit look same-brand.
        if (!REQUIRED.includes(slot)) {
          const skipProb = slot === 'bag' || slot === 'eyewear' ? 0.62 : 0.42;
          if (rand() < skipProb) continue;
        }
        pieces.push(pool[Math.floor(rand() * pool.length)]);
      }
      if (!REQUIRED.every((s) => pieces.some((p) => p.category === s))) continue;
      const sig = pieces
        .map((p) => `${p.category}:${p.id}`)
        .sort()
        .join('|');
      if (seen.has(sig) || globalSignatures.has(sig)) continue;
      const sc = scoreOutfit(pieces, vibe, cfg);
      if (sc.total < QUALITY_BAR) continue;
      seen.add(sig);
      globalSignatures.add(sig);
      const items = {};
      for (const p of pieces) items[p.category] = p.id;
      kept.push({
        vibe, frame, items,
        score: Math.round(sc.total * 1000) / 1000,
        palette: dominantPalette(pieces),
      });
    }
    kept.sort((a, b) => b.score - a.score);
    kept.forEach((o, i) => { o.id = `lib-${vibe}-${frame}-${i}`; });
    library.push(...kept);
    stats.push({
      vibe,
      frame,
      kept: kept.length,
      target: CAP_PER_COMBO,
      shortfall: Math.max(0, CAP_PER_COMBO - kept.length),
      attempts,
      pools: Object.fromEntries(cfg.slots.map((s) => [s, pools[s].length])),
    });
  }
}

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function dominantPalette(pieces) {
  const counts = {};
  for (const p of pieces) for (const c of p.colors || []) counts[norm(c)] = (counts[norm(c)] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
}

// ── Validate and measure before writing ───────────────────────────
const PRODUCT_BY_ID = new Map(PRODUCTS.map((product) => [product.id, product]));
const BUDGET_BAND_IDS = ['lte250', 'gt250_lte500', 'gt500_lte1000', 'gt1000'];
const budgetBand = (totalCents) => {
  if (totalCents <= 25_000) return BUDGET_BAND_IDS[0];
  if (totalCents <= 50_000) return BUDGET_BAND_IDS[1];
  if (totalCents <= 100_000) return BUDGET_BAND_IDS[2];
  return BUDGET_BAND_IDS[3];
};
const emptyBudgetBands = () => Object.fromEntries(BUDGET_BAND_IDS.map((id) => [id, 0]));
const signatureForItems = (items) => Object.entries(items)
  .map(([slot, id]) => `${slot}:${id}`)
  .sort()
  .join('|');
const measuredSignatures = new Set();
const duplicateSignatures = [];
const invariantErrors = [];
const totals = [];
const budgetBands = emptyBudgetBands();
const comboBudgetBands = new Map();
const usedProductIds = new Set();

for (const outfit of library) {
  const missing = REQUIRED.filter((slot) => !outfit.items[slot]);
  if (missing.length) invariantErrors.push(`${outfit.vibe}/${outfit.frame}: missing ${missing.join(',')}`);
  const signature = signatureForItems(outfit.items);
  if (measuredSignatures.has(signature)) duplicateSignatures.push(signature);
  measuredSignatures.add(signature);
  let totalCents = 0;
  for (const id of Object.values(outfit.items)) {
    const product = PRODUCT_BY_ID.get(id);
    if (!product || !hasFreshPositiveEvidence(product)) {
      invariantErrors.push(`${outfit.vibe}/${outfit.frame}: unverified product ${id}`);
      continue;
    }
    usedProductIds.add(id);
    totalCents += product.priceCents;
  }
  totals.push(totalCents);
  const band = budgetBand(totalCents);
  budgetBands[band] += 1;
  const key = `${outfit.vibe}:${outfit.frame}`;
  const comboBands = comboBudgetBands.get(key) || emptyBudgetBands();
  comboBands[band] += 1;
  comboBudgetBands.set(key, comboBands);
}

if (invariantErrors.length) {
  throw new Error(`Refusing to write an invalid outfit library:\n${invariantErrors.slice(0, 20).join('\n')}`);
}

const sortedTotals = [...totals].sort((a, b) => a - b);
const percentile = (ratio) => sortedTotals[Math.min(
  sortedTotals.length - 1,
  Math.max(0, Math.floor((sortedTotals.length - 1) * ratio)),
)] || 0;
const totalStats = {
  minCents: sortedTotals[0] || 0,
  medianCents: percentile(0.5),
  p90Cents: percentile(0.9),
  maxCents: sortedTotals.at(-1) || 0,
  averageCents: Math.round(totals.reduce((sum, total) => sum + total, 0) / (totals.length || 1)),
};

// ── Compact, interned output (product ids → indices, fixed slot order) ──
const SLOT_ORDER = ['top', 'bottom', 'shoes', 'outer', 'bag', 'hat', 'jewelry', 'eyewear'];
const idList = [];
const idIndex = new Map();
const intern = (id) => {
  if (!idIndex.has(id)) { idIndex.set(id, idList.length); idList.push(id); }
  return idIndex.get(id);
};
const looksByKey = {};
for (const outfit of library) {
  const row = SLOT_ORDER.map((slot) => (outfit.items[slot] != null ? intern(outfit.items[slot]) : -1));
  // Undefined trailing slots hydrate exactly like -1, so trimming them keeps a
  // 24k-row client artifact materially smaller without changing the schema.
  while (row.at(-1) === -1) row.pop();
  (looksByKey[outfit.vibe] ||= {})[outfit.frame] ||= [];
  looksByKey[outfit.vibe][outfit.frame].push(row);
}
const out = {
  schemaVersion: 2,
  verifiedAt: health.generatedAt,
  maxHealthAgeHours: 24,
  slots: SLOT_ORDER,
  ids: idList,
  looks: looksByKey,
};
const serializedOut = `${JSON.stringify(out)}\n`;
writeFileSync(join(ROOT, 'data/outfit-library.json'), serializedOut, 'utf8');

const duplicateCount = duplicateSignatures.length;
const report = {
  schemaVersion: 1,
  sourceHealthGeneratedAt: health.generatedAt,
  maxHealthAgeHours: 24,
  baseline: BASELINE_METRICS,
  acceptance: {
    baselineRows: BASELINE_ROWS,
    targetUniqueSignatures: TARGET_UNIQUE_SIGNATURES,
    totalRows: library.length,
    uniqueSignatures: measuredSignatures.size,
    duplicateSignatures: duplicateCount,
    duplicateRatePct: Number(((duplicateCount / (library.length || 1)) * 100).toFixed(4)),
    meetsTarget: measuredSignatures.size >= TARGET_UNIQUE_SIGNATURES && duplicateCount === 0,
  },
  inventory: {
    catalogProducts: CATALOG_PRODUCTS.length,
    freshPositiveExactProducts: PRODUCTS.length,
    usedProducts: usedProductIds.size,
    byCategory: Object.fromEntries(
      [...new Set(PRODUCTS.map((product) => product.category))]
        .sort()
        .map((category) => [category, PRODUCTS.filter((product) => product.category === category).length]),
    ),
  },
  compactArtifactBytes: Buffer.byteLength(serializedOut),
  coordination: {
    qualityBar: QUALITY_BAR,
    averageScore: Number((library.reduce((sum, outfit) => sum + outfit.score, 0) / (library.length || 1)).toFixed(3)),
  },
  wholeLookTotals: totalStats,
  budgetBands,
  combinations: stats.map((stat) => ({
    ...stat,
    budgetBands: comboBudgetBands.get(`${stat.vibe}:${stat.frame}`) || emptyBudgetBands(),
  })),
};
writeFileSync(join(ROOT, 'data/outfit-library-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

// ── Human-readable report ────────────────────────────────────────
console.log(`\nWrote ${library.length} coordinated outfits to data/outfit-library.json`);
console.log('Wrote validation metrics to data/outfit-library-report.json\n');
console.log('vibe        frame         kept   shortfall   pools');
for (const stat of stats) {
  console.log(
    `${stat.vibe.padEnd(10)} ${String(stat.frame).padEnd(12)} ${String(stat.kept).padStart(4)}   ${String(stat.shortfall).padStart(9)}   ${stat.note || JSON.stringify(stat.pools)}`,
  );
}
console.log(`\nunique signatures: ${measuredSignatures.size}/${TARGET_UNIQUE_SIGNATURES} target`);
console.log(`duplicates: ${duplicateCount} (${report.acceptance.duplicateRatePct.toFixed(4)}%)`);
console.log(`strict inventory: ${PRODUCTS.length}/${CATALOG_PRODUCTS.length} products · ${usedProductIds.size} used`);
console.log(`budget bands: ${JSON.stringify(budgetBands)}`);
console.log(`whole-look totals (cents): ${JSON.stringify(totalStats)}`);
console.log(`compact artifact: ${report.compactArtifactBytes.toLocaleString()} bytes`);
console.log(`avg coordination score: ${report.coordination.averageScore}`);

if (!report.acceptance.meetsTarget) {
  console.error('\nOutfit diversity target was not met; see exact per-combination shortfalls in data/outfit-library-report.json.');
  process.exitCode = 2;
}
