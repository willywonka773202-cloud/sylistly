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
const PRODUCTS = (Array.isArray(catalog) ? catalog : catalog.products || Object.values(catalog)[0]).filter(
  (p) => p && p.imageTransparentUrl && p.category,
);

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

// Gender consistency: androgynous frame uses androgynous-only items (so we
// never mix a masc-specific piece with a fem-specific one in the same outfit).
const genderOk = (p, frame) => {
  const g = p.gender || ['androgynous'];
  if (frame === 'androgynous') return g.includes('androgynous');
  return g.includes('androgynous') || g.includes(frame);
};
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

  // Color data is sparse in the catalog, so weight it modestly and lean on
  // vibe + formality cohesion (and the type-appropriate pools) for coordination.
  const total = vibe01 * 0.34 + formality * 0.28 + color * 0.22 + completeness * 0.16;
  return { total, color, vibe01, formality, completeness, distinctAccents };
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
  }
  return pools;
}

// ── Generate library ──────────────────────────────────────────────
const QUALITY_BAR = 0.62;
const CAP_PER_COMBO = 160; // plenty — rotation makes it feel infinite
const SAMPLES_PER_COMBO = 6000;

const library = [];
const stats = [];

for (const vibe of Object.keys(VIBE_CONFIG)) {
  const cfg = VIBE_CONFIG[vibe];
  for (const frame of FRAMES) {
    const pools = buildPools(vibe, cfg, frame);
    const reqMissing = REQUIRED.filter((s) => !pools[s] || pools[s].length === 0);
    if (reqMissing.length) { stats.push({ vibe, frame, kept: 0, note: `missing ${reqMissing.join(',')}` }); continue; }

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
        // optional slots: include probabilistically so outfits vary in richness
        if (!REQUIRED.includes(slot) && rand() < 0.32) continue;
        pieces.push(pool[Math.floor(rand() * pool.length)]);
      }
      if (!REQUIRED.every((s) => pieces.some((p) => p.category === s))) continue;
      const sig = pieces.map((p) => p.id).sort().join('|');
      if (seen.has(sig)) continue;
      const sc = scoreOutfit(pieces, vibe, cfg);
      if (sc.total < QUALITY_BAR) continue;
      seen.add(sig);
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
    stats.push({ vibe, frame, kept: kept.length, pools: Object.fromEntries(cfg.slots.map((s) => [s, pools[s].length])) });
  }
}

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function dominantPalette(pieces) {
  const counts = {};
  for (const p of pieces) for (const c of p.colors || []) counts[norm(c)] = (counts[norm(c)] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c);
}

// ── Compact, interned output (product ids → indices, fixed slot order) ──
const SLOT_ORDER = ['top', 'bottom', 'shoes', 'outer', 'bag', 'hat', 'jewelry', 'eyewear'];
const idList = [];
const idIndex = new Map();
const intern = (id) => {
  if (!idIndex.has(id)) { idIndex.set(id, idList.length); idList.push(id); }
  return idIndex.get(id);
};
const looksByKey = {};
for (const o of library) {
  const row = SLOT_ORDER.map((slot) => (o.items[slot] != null ? intern(o.items[slot]) : -1));
  (looksByKey[o.vibe] ||= {})[o.frame] ||= [];
  looksByKey[o.vibe][o.frame].push(row);
}
const out = { slots: SLOT_ORDER, ids: idList, looks: looksByKey };
writeFileSync(join(ROOT, 'data/outfit-library.json'), `${JSON.stringify(out)}\n`, 'utf8');

// ── Report ────────────────────────────────────────────────────────
console.log(`\nWrote ${library.length} coordinated outfits to data/outfit-library.json\n`);
console.log('vibe        frame         kept   pools');
for (const s of stats) {
  console.log(
    `${s.vibe.padEnd(10)} ${String(s.frame).padEnd(12)} ${String(s.kept).padStart(4)}   ${s.note || JSON.stringify(s.pools)}`,
  );
}
const byVibe = {};
for (const o of library) byVibe[o.vibe] = (byVibe[o.vibe] || 0) + 1;
console.log('\nper-vibe totals:', JSON.stringify(byVibe));
const avgScore = library.reduce((s, o) => s + o.score, 0) / (library.length || 1);
console.log('avg coordination score:', Math.round(avgScore * 1000) / 1000);
