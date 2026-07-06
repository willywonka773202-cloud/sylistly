/**
 * Route + integrity smoke test for the CURRENT Sylistly app (scroll / drop era).
 *
 *  - Source mode (default): every real route file exists, the nav wires the real
 *    tabs, key integrity invariants hold, and no dishonest/dark-pattern copy or
 *    tracked junk slipped in.
 *  - Live mode (set SMOKE_BASE_URL, e.g. https://www.sylistly.com): also HTTP-
 *    GETs every public route and asserts it is not an error.
 *
 * Run: `npm run smoke:routes`  (or `SMOKE_BASE_URL=https://www.sylistly.com npm run smoke:routes`)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// The real routes (page.tsx files) of the current app.
const routeFiles = [
  'app/page.tsx', // scroll feed (home)
  'app/drop/page.tsx', // Daily Drop crate shop
  'app/build/page.tsx', // Remix / builder
  'app/browse/page.tsx', // browse catalog
  'app/discover/page.tsx', // discover — curated complete looks
  'app/saved/page.tsx', // saved fits
  'app/profile/page.tsx', // You
  'app/checkout/page.tsx', // shop-the-look review
  'app/look/[id]/page.tsx', // shared look + OG
  'app/style/[id]/page.tsx', // shared style identity + OG
  'app/robots.ts',
  'app/sitemap.ts',
  'app/opengraph-image.tsx',
];

// Public URLs to hit when SMOKE_BASE_URL is set.
const liveRoutes = ['/', '/drop', '/build', '/browse', '/discover', '/saved', '/profile', '/checkout', '/robots.txt', '/sitemap.xml', '/opengraph-image'];

const requiredText: Array<{ file: string; text: string; label: string }> = [
  // Navigation wires the five real tabs.
  { file: 'components/BottomNav.tsx', text: 'href="/"', label: 'BottomNav: Scroll tab' },
  { file: 'components/BottomNav.tsx', text: 'href="/build"', label: 'BottomNav: Remix tab' },
  { file: 'components/BottomNav.tsx', text: 'href="/drop"', label: 'BottomNav: Drop center tab' },
  { file: 'components/BottomNav.tsx', text: 'href="/saved"', label: 'BottomNav: Saved tab' },
  { file: 'components/BottomNav.tsx', text: 'href="/profile"', label: 'BottomNav: You tab' },
  // Drop shop wires the crate, vault, and quests.
  { file: 'app/drop/page.tsx', text: 'DailyDrop', label: 'Drop mounts the crate component' },
  { file: 'app/drop/page.tsx', text: 'Your Vault', label: 'Drop surfaces the collection Vault' },
  { file: 'app/drop/page.tsx', text: 'Daily quests', label: 'Drop surfaces daily quests' },
  { file: 'components/DailyDrop.tsx', text: 'recordPull', label: 'Reveals are recorded to the Vault' },
  { file: 'components/DailyDrop.tsx', text: 'computeBundleDeal', label: 'Drop reveal shows bundle pricing' },
  // Honesty invariants — load-bearing for the brand.
  { file: 'lib/bundle-deals.ts', text: 'verified', label: 'Bundle deals gated on verified codes (no fake discounts)' },
  { file: 'lib/stylist-xp.ts', text: 'real actions', label: 'XP is from real actions only' },
  // Revenue integrity — every shop path must wrap affiliate, and the affiliate
  // wrapper must skip placeholder Rakuten ids (no broken/foreign links).
  { file: 'lib/product-links.ts', text: 'wrapAffiliate', label: 'getShoppableUrl wraps affiliate (no commission leak)' },
  { file: "lib/affiliate.ts", text: "startsWith('__')", label: 'affiliate skips placeholder Rakuten ids (no broken links)' },
  { file: 'components/InAppBrowser.tsx', text: 'wrapAffiliate', label: 'in-app browser opens the affiliate-wrapped page (commission-safe)' },
  { file: 'components/Feed.tsx', text: 'InAppBrowser', label: 'feed opens retailer links in the in-app browser sheet' },
  { file: 'app/build/page.tsx', text: 'shop_link_clicked', label: 'builder shop CTA tracks the revenue funnel' },
  // FTC compliance — the affiliate disclosure is LEGALLY REQUIRED on every shop
  // surface; a refactor must not silently drop it from any of them.
  { file: 'components/AffiliateDisclosure.tsx', text: 'commission', label: 'affiliate disclosure carries the FTC copy' },
  { file: 'components/PiecePeek.tsx', text: 'AffiliateDisclosure', label: 'FTC disclosure on the piece-peek shop CTA' },
  { file: 'components/CheckoutSheet.tsx', text: 'AffiliateDisclosure', label: 'FTC disclosure on the checkout sheet' },
  { file: 'app/checkout/page.tsx', text: 'AffiliateDisclosure', label: 'FTC disclosure on the checkout page' },
  { file: 'app/look/[id]/page.tsx', text: 'AffiliateDisclosure', label: 'FTC disclosure on the shared-look page' },
  { file: 'components/InAppBrowser.tsx', text: 'AffiliateDisclosure', label: 'FTC disclosure on the in-app browser' },
  { file: 'components/SearchSheet.tsx', text: 'AffiliateDisclosure', label: 'FTC disclosure in the builder search' },
  { file: 'app/build/page.tsx', text: 'AffiliateDisclosure', label: 'FTC disclosure on the builder shop' },
  // Catalog display hygiene — names cleaned of redundant brand, feed shows the palette.
  { file: 'lib/client-catalog.ts', text: 'cleanProductName', label: 'catalog cleans redundant brand-in-name' },
  { file: 'components/Feed.tsx', text: 'lookSwatches', label: 'feed renders palette swatch dots + love-burst colours' },
  // The reveal count-up must keep its backstop so a stalled rAF never shows $0.
  { file: 'components/AnimatedNumber.tsx', text: 'setTimeout', label: 'AnimatedNumber keeps the $0-proof backstop' },
  // Load-bearing technical foundations — easy to break in a refactor.
  // The feed is a vertical scroll: Save keeps a fit, Pass down-weights the vibe.
  { file: 'components/Feed.tsx', text: 'overflow-y-auto', label: 'feed is a vertical scroll' },
  { file: 'components/Feed.tsx', text: 'onScroll', label: 'feed tops up on scroll (infinite scroll)' },
  { file: 'components/Feed.tsx', text: 'look_loved', label: 'feed Save records the loved fit' },
  { file: 'components/Feed.tsx', text: 'look_passed', label: 'feed Pass down-weights the vibe (honest personalization)' },
  { file: 'lib/visual-capability.ts', text: 'useHeavyVisuals', label: 'SSR-safe heavy-visuals gate present' },
  { file: 'components/three/Crate3D.tsx', text: 'ssr: false', label: '3D crate stays lazy (three.js out of the main bundle)' },
  // Canonical host is consistent (www).
  { file: 'app/layout.tsx', text: 'www.sylistly.com', label: 'metadataBase canonical host = www' },
  { file: 'app/robots.ts', text: 'www.sylistly.com', label: 'robots canonical host = www' },
  { file: 'app/sitemap.ts', text: 'www.sylistly.com', label: 'sitemap canonical host = www' },
];

// Retired pre-scroll surfaces — must be redirects (next.config), not live pages.
const retiredRouteFiles = ['app/feed/page.tsx', 'app/stylist/page.tsx', 'app/wardrobe/page.tsx', 'app/canvas/page.tsx', 'app/swipe/page.tsx'];

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function source(file: string): string {
  const target = path.join(root, file);
  if (!existsSync(target)) fail(`missing file: ${file}`);
  return readFileSync(target, 'utf8');
}

function gitOutput(args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function run() {
  console.log('Route + integrity smoke');
  console.log('=======================');

  for (const file of routeFiles) {
    if (!existsSync(path.join(root, file))) fail(`missing route file: ${file}`);
    console.log(`PASS route exists: ${file}`);
  }

  for (const file of retiredRouteFiles) {
    if (existsSync(path.join(root, file))) fail(`retired route still has a page (should be a redirect): ${file}`);
  }
  console.log('PASS retired routes are gone (handled by next.config redirects)');

  for (const check of requiredText) {
    if (!source(check.file).includes(check.text)) fail(`${check.label} (${check.file})`);
    console.log(`PASS ${check.label}`);
  }

  // Bundle-deal URL integrity — a VERIFIED deal must link to its OWN retailer's
  // host. Catches the copy-paste cross-retailer URL bug class (e.g. a Merchology
  // deal whose url pointed at nike.com), which would misdirect users dishonestly.
  {
    const dealsSrc = source('lib/bundle-deals.ts');
    const dealRe = /\{\s*retailer:\s*'([^']+)'[^}]*?url:\s*'([^']+)'[^}]*?verified:\s*(true|false)\s*\}/g;
    let match: RegExpExecArray | null;
    let verifiedChecked = 0;
    while ((match = dealRe.exec(dealsSrc))) {
      const [, retailer, url, verified] = match;
      if (verified !== 'true') continue;
      verifiedChecked += 1;
      const host = (url.match(/^https?:\/\/([^/]+)/)?.[1] || '').toLowerCase();
      const retailerKey = retailer.toLowerCase().replace(/[^a-z0-9]/g, '');
      const hostKey = host.replace(/[^a-z0-9]/g, '');
      if (retailerKey && !hostKey.includes(retailerKey)) {
        fail(`verified bundle deal for "${retailer}" links to a foreign host (${host}) — cross-retailer URL bug`);
      }
    }
    console.log(`PASS bundle-deal URL integrity (${verifiedChecked} verified deal${verifiedChecked === 1 ? '' : 's'} link to their own retailer)`);
  }

  // No dishonest / dark-pattern copy, no tracked DB junk.
  const bannedPhrases = [
    // Target fake follower/like COUNTS (social proof), not honest "no fake
    // followers" disclaimers.
    // [ \t]* (not \s*) so the count + word must be on the SAME LINE — a real
    // social-proof string ("1.2k likes"), not a config object where a numeric
    // value happens to precede a `likes:`/`followers:` key on the next line.
    { pattern: /\b\d[\d,.]*[ \t]*(k|m)?[ \t]*followers?\b/i, label: 'fake follower count' },
    { pattern: /\b\d[\d,.]*[ \t]*(k|m)?[ \t]*likes\b/i, label: 'fake like count' },
    { pattern: /fake likes/i, label: 'fake likes language' },
    { pattern: /trending with friends/i, label: 'fake friend trend language' },
    { pattern: /generated by ai/i, label: 'AI-generation claim without backend' },
    { pattern: /background removed/i, label: 'background-removal claim' },
    { pattern: /selling fast|almost gone|only \d+ left/i, label: 'fake scarcity language' },
  ];
  for (const relativeRoot of ['app', 'components', 'store', 'lib']) {
    const files = gitOutput(['ls-files', relativeRoot])
      .split(/\r?\n/)
      .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
    for (const file of files) {
      if (!existsSync(path.join(root, file))) continue; // tracked-but-deleted ghost
      const content = readFileSync(path.join(root, file), 'utf8');
      for (const banned of bannedPhrases) {
        if (banned.pattern.test(content)) fail(`${banned.label}: ${file}`);
      }
    }
  }
  console.log('PASS no fake-social / fake-scarcity / unbacked-AI copy');

  if (gitOutput(['ls-files', 'ruvector.db'])) fail('ruvector.db is tracked');
  console.log('PASS ruvector.db is not tracked');

  // Optional live HTTP smoke.
  const base = process.env.SMOKE_BASE_URL;
  if (base) {
    console.log(`\nLive HTTP smoke @ ${base}`);
    for (const route of liveRoutes) {
      const url = `${base.replace(/\/$/, '')}${route}`;
      const res = await fetch(url, { redirect: 'manual' }).catch((error) => fail(`live request errored: ${url} (${String(error)})`));
      if (res.status >= 400) fail(`live route ${route} returned ${res.status}`);
      console.log(`PASS ${res.status} ${route}`);
    }
  } else {
    console.log('\n(skip live HTTP smoke — set SMOKE_BASE_URL to enable)');
  }

  console.log('\nOverall: PASS');
}

run().catch((error) => fail(String(error)));
