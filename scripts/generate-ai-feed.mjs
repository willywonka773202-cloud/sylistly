/**
 * Offline AI-feed generator. Drives the real AI composer via the /api/look
 * endpoint ONCE and bakes the results into data/ai-feed-looks.json. The social
 * feed seeds from that file, so the feed shows genuinely AI-composed looks with
 * ZERO runtime cost (no per-visitor Claude calls). Re-run to refresh:
 *   1) start the app (npm run dev) with ANTHROPIC_API_KEY in .env.local
 *   2) node scripts/generate-ai-feed.mjs [baseUrl]
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:3939';

const VIBE_PLANS = [
  { vibe: 'clean', frame: 'fem', title: 'Clean capsule', username: '@cleanlines', tags: ['clean', 'minimal'] },
  { vibe: 'clean', frame: 'masc', title: 'Quiet neutrals', username: '@tonalstudio', tags: ['clean', 'neutral'] },
  { vibe: 'street', frame: 'androgynous', title: 'Street layers', username: '@blockparty', tags: ['street', 'layered'] },
  { vibe: 'street', frame: 'masc', title: 'Concrete tones', username: '@offcurb', tags: ['street', 'utility'] },
  { vibe: 'office', frame: 'fem', title: 'Soft tailoring', username: '@deskto5', tags: ['office', 'tailored'] },
  { vibe: 'office', frame: 'masc', title: 'Sharp commute', username: '@ninetofive', tags: ['office', 'sharp'] },
  { vibe: 'date', frame: 'fem', title: 'Evening ease', username: '@afterhours', tags: ['date', 'evening'] },
  { vibe: 'night', frame: 'androgynous', title: 'Lights out', username: '@aftermidnight', tags: ['night', 'luxe'] },
  { vibe: 'gym', frame: 'fem', title: 'Studio set', username: '@warmupclub', tags: ['gym', 'active'] },
  { vibe: 'gym', frame: 'masc', title: 'Training fit', username: '@repsdaily', tags: ['gym', 'sport'] },
  { vibe: 'cozy', frame: 'androgynous', title: 'Slow morning', username: '@homebody', tags: ['cozy', 'soft'] },
  { vibe: 'vacation', frame: 'fem', title: 'Linen escape', username: '@outofoffice', tags: ['vacation', 'resort'] },
  { vibe: 'preppy', frame: 'fem', title: 'Campus polish', username: '@quadlife', tags: ['preppy', 'classic'] },
  { vibe: 'preppy', frame: 'masc', title: 'Old money read', username: '@heirloom', tags: ['preppy', 'heritage'] },
  { vibe: 'edgy', frame: 'androgynous', title: 'Hard edges', username: '@noir.club', tags: ['edgy', 'dark'] },
  { vibe: 'cozy', frame: 'fem', title: 'Weekend knit', username: '@sundaysoft', tags: ['cozy', 'knit'] },
];

const SLOT_TEMPLATES = [
  ['outer', 'top', 'bottom', 'shoes', 'bag'],
  ['hat', 'top', 'bottom', 'shoes', 'eyewear'],
  ['outer', 'top', 'bottom', 'shoes', 'bag', 'jewelry'],
  ['top', 'bottom', 'shoes', 'hat', 'bag'],
];

async function main() {
  const looks = [];
  for (let index = 0; index < VIBE_PLANS.length; index += 1) {
    const plan = VIBE_PLANS[index];
    const targetSlots = SLOT_TEMPLATES[index % SLOT_TEMPLATES.length];
    const seed = 1000 + index * 37;
    try {
      const res = await fetch(`${BASE}/api/look`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vibe: plan.vibe, frame: plan.frame, budget: 'under250', mode: 'full', seed, selectedSlots: targetSlots, diversityStrength: 'high' }),
      });
      const data = await res.json();
      const products = data.products || {};
      const items = {};
      for (const [slot, product] of Object.entries(products)) {
        if (product && product.id) items[slot] = product.id;
      }
      if (Object.keys(items).length < 3) {
        console.warn(`skip ${plan.vibe}/${plan.frame}: ${Object.keys(items).length} slots`);
        continue;
      }
      looks.push({
        id: `ai-${plan.vibe}-${plan.frame}-${index}`,
        vibe: plan.vibe,
        frameBias: plan.frame,
        title: plan.title,
        username: plan.username,
        tags: plan.tags,
        likeCount: 40 + ((index * 17) % 160),
        caption: data.stylingNotes || `An AI-styled ${plan.vibe} look.`,
        palette: Array.isArray(data.palette) ? data.palette : [],
        formula: data.formula || null,
        items,
      });
      console.log(`✓ ${plan.vibe}/${plan.frame} [${data.assistantMode}] — ${Object.keys(items).join(',')}`);
    } catch (error) {
      console.warn(`fail ${plan.vibe}/${plan.frame}: ${error?.message || error}`);
    }
  }

  const outPath = path.join(process.cwd(), 'data', 'ai-feed-looks.json');
  if (looks.length < 8) {
    console.error(`Only ${looks.length} looks generated — refusing to overwrite the baked deck (need >= 8).`);
    process.exit(1);
  }
  writeFileSync(outPath, `${JSON.stringify(looks, null, 2)}\n`, 'utf8');
  const aiCount = looks.filter((l) => l.caption && !l.caption.startsWith('An AI-styled')).length;
  console.log(`\nWrote ${looks.length} looks (${aiCount} AI-styled) to data/ai-feed-looks.json`);
}

main().catch((error) => { console.error(error); process.exit(1); });
