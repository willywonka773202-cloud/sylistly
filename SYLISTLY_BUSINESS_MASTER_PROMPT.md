# SYLISTLY — BUSINESS MASTER PROMPT v2

**Purpose of this document.** This is the single source of truth for turning Sylistly from a polished demo into a real, profitable business. It contains: (1) an unflinching audit of what actually exists in this repo today, (2) every core assumption interrogated with a verdict, (3) the business model with honest math, (4) a phased execution plan where each phase is a self-contained, copy-pasteable Claude Code prompt with acceptance criteria, (5) the go-to-market playbook, (6) metrics and kill criteria, (7) legal/compliance, and (8) a founder checklist of things only a human can do.

**How to use it.** Do the Founder Checklist items in §9 (accounts, applications — Claude can't sign contracts). Then paste the Phase 0 prompt from §5 into a fresh Claude Code session. When Phase 0's acceptance criteria pass, paste Phase 1. Do not skip phases and do not build Phase 3 features before Phase 1 ships. Every prompt is written to be self-contained so no session wastes tokens rediscovering context.

---

## §1 — The brutal audit: what Sylistly actually is today

Audited 2026-07-02 against commit `c0c5038`.

**What's real and good:**

| Asset | Where | Assessment |
|---|---|---|
| Outfit generation engine | `lib/catalog.ts` (~1,760 lines) | Genuinely sophisticated: vibe recipes, quality rules, frame scoring, weighted selection. Deterministic and rules-based — which means it's **fast and free per request**. This is the crown jewel. |
| Product catalog data | `data/photo-catalog.json` (844KB), `data/generated-catalog.json` (696KB, 175 products) | Real brands, prices, images. Static but substantial. |
| Live search pipeline | `app/api/search/route.ts`, `lib/serpapi.ts`, `lib/claude.ts` | Complete Claude-parse → Google Shopping → rerank pipeline. Gated behind `SEARCH_MODE` and API keys, with graceful heuristic fallbacks. Well built. |
| Mobile-native UI | `app/*`, framer-motion gestures, dark + hot-pink identity | Feels like a product, not a prototype. Real design taste. |
| Database schema | `supabase/migrations/0001_initial.sql` | Thoughtful: profiles, products, fits, `fit_shares` and `clicks` tables with commission columns, RLS policies. Designed for the right business. |

**What's fake, broken, or dead:**

| Problem | Where | Severity |
|---|---|---|
| **Revenue is impossible today.** All 175 products in `generated-catalog.json` have `retailerUrl: ""`. Outbound links fall through to Google Shopping *search pages* (`lib/product-links.ts:13-30`), which cannot carry affiliate tags. Rakuten IDs are literal placeholders (`'__RAKUTEN_ID_NORDSTROM__'`, `lib/affiliate.ts:13-18`). Skimlinks ID unset. **Current earning capacity: $0.** | `lib/affiliate.ts`, `lib/product-links.ts`, `data/generated-catalog.json` | FATAL |
| **The social feed is fabricated.** Usernames (`@selene.studio`), like counts (`420 - index*9`), and comments ("Clean fit.") are hardcoded (`store/social-feed.ts:114-169`). No backend, no users. Shipping this as "community" is a trust time-bomb. | `store/social-feed.ts` | HIGH |
| **SSRF vulnerability.** `app/api/image/route.ts:9-37` fetches any attacker-supplied URL server-side with only a protocol check. No host allowlist, no auth, no rate limit. Can be used to probe internal networks / cloud metadata. | `app/api/image/route.ts` | HIGH (security) |
| **No auth, no accounts.** Everything is localStorage. `/api/fit` writes `owner_id: null`. The Supabase auth layer is dead code. No retention loop can exist without an identity. | `lib/supabase.ts`, `app/api/fit/route.ts` | HIGH |
| **Analytics is unwired.** `posthog-js` is in `package.json` and imported nowhere. You are flying blind: no funnel, no click data, no idea what users do. | everywhere | HIGH |
| **"AI" is mostly marketing copy.** The generator is rules-based (fine!), but the UI says "AI pass," "AI stylist assist," shows fake "Balancing silhouette…" loading lines. Claude only runs in the (disabled-by-default) live-search path. | `lib/catalog.ts`, UI copy | MEDIUM (integrity) |
| Unthrottled paid-API routes | `/api/search`, `/api/look` — no rate limit; in-memory cache dies on serverless cold starts | MEDIUM (cost) |
| `sharp` undeclared | Imported in `app/api/image/route.ts:2`, absent from `package.json` deps | MEDIUM |
| Dead code | `/api/shop-all` never called; `/api/tryon` referenced in README but doesn't exist; PostHog unused | LOW |
| Image fragility | Catalog thumbnails hotlink `encrypted-tbn0.gstatic.com` — legally grey, can break anytime, low-res | MEDIUM |
| No CI, no tests, no `vercel.json` | repo root | LOW-MEDIUM |

**One-sentence truth:** Sylistly today is a beautiful storefront with no cash register, a mannequin audience, and an unlocked back door.

---

## §2 — Question everything: assumptions on trial

Each assumption the current product embodies, the evidence, and a verdict. These verdicts drive every decision in §3–§5.

**Q1. "Sylistly should be a social fashion app (feed, likes, comments)."**
Evidence: the entire feed is synthetic; there are zero users; social products die on cold-start; a solo founder cannot seed and moderate a community while also building commerce. Even Combyne, with millions of downloads, struggled to monetize social outfit-sharing.
**VERDICT: NO — kill "social" as a positioning. Reframe the feed as an editorial *Lookbook*: outfits "curated by Sylistly," honest bylines, no fake users, no fake likes.** Social can return in year 2 if there's a real user base begging for it. The swipe deck survives — not as social, but as a *taste-tuner* that feeds the personalization engine.

**Q2. "Affiliate commissions alone can make this profitable."**
Evidence: blended fashion affiliate rates run 3–8% of order value; Skimlinks keeps 25% of the commission; realistic click→purchase conversion from warm outbound clicks is 1–3%; a realistic earnings-per-outbound-click (EPC) is $0.05–$0.20. At 10,000 sessions/month with 0.5 outbound clicks per session, that's ~$250–$1,000/month. Affiliate revenue is real but scale-hungry.
**VERDICT: PARTLY — affiliate is the correct *first* revenue (zero friction, zero payment infra) but it is the floor, not the business. The business is a monetization ladder: affiliate → Pro subscription → (later) creator/brand programs. Never let affiliate-only thinking cap ambition.**

**Q3. "The catalog approach (static local JSON) is a hack to be replaced by live search."**
Evidence: live search costs money per query (SearchAPI + Claude), is rate-limited, is slow, and returns un-monetizable Google Shopping links with hotlinked thumbnails. The static catalog is instant, free per request, and controllable.
**VERDICT: INVERTED — the catalog IS the product; live search is the supplement.** But the catalog must be rebuilt from **affiliate network product datafeeds** (Sovrn/Skimlinks APIs, Awin/CJ/Rakuten datafeeds, Amazon PA-API). This one decision fixes three fatal problems at once: (1) every product gets a *direct, monetizable* deep link, (2) images come licensed for affiliate use — no more gstatic hotlinking, (3) prices/stock can be refreshed nightly. This is the single highest-leverage build item in this document.

**Q4. "Users want to browse fashion content."**
Evidence: browsing/inspo is owned by Pinterest, TikTok, and Instagram — unwinnable. What none of them do well: turn "I have a date Friday and $150" into a *complete, purchasable outfit* in seconds.
**VERDICT: REFRAME — Sylistly's wedge is not browsing, it's *answering*. Positioning: "Tell Sylistly the occasion and budget. Get a complete outfit you can buy right now."** Occasion + budget + size → full look with working buy links. Every surface should serve that sentence.

**Q5. "The AI branding is fine."**
Evidence: the generator is deterministic; fake loading lines imply live AI. Users increasingly punish AI-washing; also you're sitting on a real AI opportunity you haven't used.
**VERDICT: FIX BOTH WAYS — stop faking it in copy, and add real AI where it earns money: a Claude-powered stylist that takes free-text occasions ("rooftop wedding in October, I run cold, size 8, under $200") and drives the rules engine. Rules engine = free tier (fast, free). Claude stylist = the Pro-tier hero feature (real cost, real value).**

**Q6. "We need an app store app."**
Evidence: 15–30% store tax, review cycles, and you have a working PWA-shaped web app with share links. Fashion traffic arrives from links (Pinterest/TikTok/SEO) — the web converts it instantly; an install wall kills it.
**VERDICT: NO — stay web-first (installable PWA). Revisit native only after $10k MRR.**

**Q7. "Checkout is a feature we're missing."**
Evidence: real universal cart/checkout requires merchant integrations (what Stripe killed Link-commerce startups over) or headless-checkout partners. Massive scope.
**VERDICT: NO — outbound affiliate links ARE the checkout.** The current "open retailer tabs" flow is correct; it just needs monetized links and click tracking. Do not build a cart. Ever, until a partner makes it trivial.

**Q8. "Try-on (FASHN) is Phase 2."**
Evidence: try-on is expensive per render, technically fragile, and doesn't serve the wedge (occasion→outfit→buy). It's a delight feature, not a conversion feature.
**VERDICT: DEMOTE to Phase 3+, as a Pro-tier perk and marketing hook ("see it on you"), never a core dependency.**

**Q9. "Supabase schema needs a redesign."**
Evidence: the schema already models the right business (fits, shares, clicks, commissions, RLS).
**VERDICT: KEEP — the schema was designed for the company you're building; the app just never used it. Wire the app to it; don't redesign it.**

**Q10. "More features = more launchable."**
Evidence: six nav surfaces, half placeholder. The handoff doc itself says "the app overall doesn't work."
**VERDICT: CUT — launch with four surfaces: Style (the builder/stylist), Lookbook (editorial feed), Saved, Profile. Swipe becomes an onboarding taste-tuner, not a nav destination. Fewer, finished surfaces beat many, broken ones.**

**Q11. "Growth will come from the product being good."**
Evidence: no product grows itself; fashion is a distribution game. Sylistly has three unusual distribution assets: (a) every generated outfit is a *page* → programmatic SEO ("what to wear to a fall wedding under $200"), (b) every outfit is an *image* → Pinterest is literally an outfit-idea search engine with commercial intent, (c) share cards (`html2canvas` already installed) → TikTok/IG content loops.
**VERDICT: BUILD DISTRIBUTION INTO THE PRODUCT — outfit permalink pages with proper SEO/OG metadata are a launch requirement, not a nice-to-have. Pinterest is the #1 external channel; treat it as seriously as the codebase.**

**Q12. "We can figure out measurement later."**
Evidence: the entire business is a funnel (session → outfit generated → outbound click → purchase → commission). Without instrumentation you cannot know if you're alive.
**VERDICT: NO — PostHog wiring + server-side click logging into the existing `clicks` table ship in Phase 0, before anything else. Revenue you can't attribute is revenue you can't grow.**

**Q13. "The name/domain/brand are settled."**
Evidence: "Sylistly" reads as a typo of "Stylistly" — people will misspell it, and word-of-mouth suffers ("how do you spell that?").
**VERDICT: FLAG, founder's call — before buying domains and building SEO equity, decide deliberately. If keeping Sylistly, own the misspellings (stylistly.com etc. redirecting). Renaming later gets 10× more expensive after SEO/Pinterest equity accrues. Decide once, in §9, then never again.**

---

## §3 — The business

### 3.1 One-liner and positioning

> **Sylistly: tell it the occasion and your budget — get a complete outfit you can buy right now.**

- **Not** a social network. **Not** a search engine. **Not** a wardrobe organizer.
- Category: AI personal stylist + shoppable outfit engine.
- ICP (initial): US women 18–34, mobile, mid-market budget ($30–$150/item), shops ASOS/Nordstrom/Revolve/Mango/Uniqlo/Abercrombie/Amazon, gets outfit ideas from Pinterest/TikTok, has recurring "I have a thing and nothing to wear" moments (dates, weddings, interviews, trips, first days).
- Why now: AI-stylist interest is high, but incumbents split the job — inspo apps (Pinterest) aren't shoppable as complete outfits; wardrobe apps (Whering, Indyx) style clothes you own; shopping apps sell single items. Nobody owns "occasion → complete purchasable look in 10 seconds."

### 3.2 Competitive map (and why we win the wedge)

| Player | What they do | Gap Sylistly exploits |
|---|---|---|
| Pinterest | Outfit inspo at infinite scale | Images aren't buyable as complete looks; no budget/size constraint |
| LTK / ShopMy | Creator-curated shoppable posts | Requires following creators; no on-demand generation for *your* occasion/budget |
| Whering / Indyx / Acloset | Digitize + style your own closet | Doesn't sell you the outfit; onboarding burden (photograph your closet) |
| Style DNA / AI stylist apps | Quiz → style advice | Advice, weak commerce plumbing; rarely full purchasable looks |
| Google Shopping / retailer sites | Single-item search | No outfit assembly, no taste layer |
| ChatGPT et al. | "What should I wear?" answers | No live inventory, no images, no buy links |

**Moat, honestly:** thin at first (execution + taste). It compounds through: the tag/quality-rules layer on top of raw feeds (`lib/catalog.ts` + `catalog-tag-overrides.json` is already this), taste data from swipes/saves/clicks, SEO/Pinterest equity, and eventually direct retailer relationships with negotiated rates. None of that exists on day 1 — speed and focus are the moat until it does.

### 3.3 The monetization ladder

**Rung 1 — Affiliate (Phase 0–1, day one).** Every outbound product link monetized via Sovrn or Skimlinks (instant, blended) + direct programs as approved (Rakuten: Nordstrom/Revolve; Awin: ASOS/Mango; CJ; Amazon Associates for easy approval). Server-side click logging into the `clicks` table. Money math per 1,000 sessions: ~400–600 outbound clicks (if the product does its job) × $0.05–$0.20 EPC = **$20–$120 per 1,000 sessions**. This funds nothing but proves the funnel.

**Rung 2 — Sylistly Pro (Phase 3, after retention is proven).** $5.99/mo or $39/yr via Stripe.
- Free tier (stays generous — it feeds growth + affiliate): unlimited rules-engine outfits, occasion presets, save up to 10 fits, Lookbook, share cards.
- Pro: **Claude AI Stylist** (free-text occasion chat: "rooftop wedding in October, I run cold, under $200"), unlimited saved fits + collections, **price-drop alerts on saved items** (retention + re-click machine), early trend drops, (later) virtual try-on.
- Math: consumer utility apps convert 1–3% of MAU to paid. 25,000 MAU × 2% × $5.50 avg = **~$2,750 MRR** + affiliate on the rest.

**Rung 3 — Later, only after Rungs 1–2 work:** creator storefronts with commission share, brand-sponsored Lookbook placements (clearly labeled), retailer-direct partnerships with negotiated CPA.

**What we will NOT do:** display ads (kills the premium feel and pennies anyway), selling user data, universal cart/checkout, dropshipping.

### 3.4 Unit economics & burn

- **Cost per free user:** ≈ $0. Rules engine is deterministic; catalog is static JSON refreshed nightly by one cron job. This is a structural advantage most "AI stylist" competitors (paying per-generation) don't have.
- **Cost per Pro user:** Claude stylist calls, ~$0.01–0.03/chat with Sonnet-class + caching; heavy user ≈ $0.50–$1.50/mo COGS against $5.99 → 75–90% gross margin.
- **Fixed burn until revenue:** Vercel Hobby $0 (→ Pro $20 when traffic justifies), Supabase free tier, domain ~$12/yr, PostHog free tier, Resend free tier, Anthropic pay-as-you-go (near-$0 in catalog-only mode). **Target: <$50/month total burn until >$500/month revenue.** SearchAPI ($40+/mo) stays OFF until it earns its keep.

### 3.5 Honest milestones

| Milestone | Signal | Realistic timing |
|---|---|---|
| M0: Revenue *possible* | First affiliate-tagged click logged in `clicks` | Phase 0 complete |
| M1: First dollar | First commission in Sovrn/Skimlinks dashboard | 2–6 weeks post-launch |
| M2: $500/mo | ~10–25k sessions/mo + working funnel | Month 3–6 |
| M3: $2,500/mo (ramen) | Pro launched, ~15–30k MAU | Month 6–12 |
| M4: $10k/mo (business) | 50–100k MAU or standout Pro conversion; direct retailer rates | Month 12–24 |

If these look slow, that's because they're real. Anyone promising faster is selling something.

---

## §4 — Product spec v1 (what to cut, keep, build)

### CUT (do not carry into launch)
- Fake social: hardcoded usernames, like counts, canned comments (`store/social-feed.ts:114-169`). Replace with honest editorial framing.
- "AI pass" / fake-AI loading copy anywhere the rules engine runs.
- `/api/shop-all` dead route (or wire it — one or the other, no zombie code).
- Swipe as a top-level nav destination (becomes onboarding + a "tune your taste" entry inside Profile).
- Unused `posthog-js`?? No — WIRE it (Phase 0). Cut nothing that measurement needs.

### KEEP (protect during all refactors)
- `lib/catalog.ts` generation engine and its quality rules — the crown jewel.
- Dark + hot-pink identity, mobile-first framing, framer-motion feel.
- Manual (not per-keystroke) search; explicit demo/live labeling.
- Supabase schema as written.
- Link-list "shop the look" flow (popups were correctly abandoned).

### BUILD (the four launch surfaces)
1. **Style (home).** Occasion presets (Date Night, Wedding Guest, Office, Weekend, Trip, Interview) + budget slider + size hints → rules engine → full look with per-item "why it works" line, swap-item action, Shop Look (link list, all affiliate-tagged), Save, Share card.
2. **Lookbook (was Feed/Discover).** Editorial, honestly bylined ("Curated by Sylistly"), every look shoppable, filterable by occasion/budget. No fake engagement numbers, period.
3. **Saved.** Cloud-synced once auth lands (Phase 2); price shown with "checked <date>"; price-drop badge (Phase 2+).
4. **Profile.** Taste profile from onboarding swipe-tuner + saves/clicks; sizes; style prefs. Feeds the generator's scoring.

Plus the invisible surface that makes growth work: **public outfit permalink pages** (`/fit/[id]`) with full OG/Twitter/Pinterest meta, product schema markup, and occasion-keyword titles — every generated outfit is a potential search/Pinterest landing page.

---

## §5 — Phased execution plan (paste-ready Claude Code prompts)

Rules that apply to every phase: never commit secrets; keep `npm run typecheck` and `npm run build` passing; verify by running the app, not by assertion; each phase ends with a commit + a report of what changed, what's unfinished, and which env vars are needed.

---

### PHASE 0 — "Make revenue possible, make it safe, make it measurable" (1 session)

**Goal:** after this phase, every outbound click CAN earn money and IS logged, and the two security/cost holes are closed. No visual changes.

```text
You are working on Sylistly (Next.js 15 App Router + Supabase + Tailwind), an AI outfit
builder monetized by affiliate links. Read SYLISTLY_BUSINESS_MASTER_PROMPT.md §1 and §5
Phase 0 first. Do exactly this phase, nothing from later phases.

1. FIX THE SSRF HOLE in app/api/image/route.ts:
   - Add a strict hostname allowlist derived from next.config.js remotePatterns
     (retailer CDNs + gstatic). Reject everything else with 400.
   - Block redirects to non-allowlisted hosts (fetch with redirect: "manual" and
     validate Location, or follow and re-validate final URL).
   - Reject private/loopback/link-local IP literals outright.
   - Add sharp to package.json dependencies explicitly (it is currently only a
     transitive dep — a footgun).

2. ADD RATE LIMITING to /api/search, /api/look, /api/image:
   - Simple fixed-window limiter keyed by IP (and user id when auth exists later).
   - Store: Supabase table `rate_limits` OR an in-memory Map fallback when Supabase
     env is absent — but implement the durable path, not just the Map.
   - Sensible defaults: search 10/min, look 30/min, image 60/min. Return 429 with
     Retry-After.

3. MAKE AFFILIATE LINKS REAL in lib/affiliate.ts + lib/product-links.ts:
   - Remove the placeholder '__RAKUTEN_ID_*__' constants. Rakuten wrapping only
     activates when real env-provided IDs exist (RAKUTEN_AFFILIATE_ID plus optional
     per-merchant JSON in RAKUTEN_MERCHANT_MAP).
   - Default monetization path: Sovrn or Skimlinks wrapping of DIRECT retailer URLs
     (env: SKIMLINKS_PUBLISHER_ID and/or SOVRN_API_KEY — support either).
   - CRITICAL: getProductOutboundUrl must NEVER return a Google Shopping search URL
     as a "buy" link. If a product has no direct retailerUrl, the UI should show
     "link unavailable" state instead of a fake buy link. Audit all call sites.

4. ADD SERVER-SIDE CLICK TRACKING:
   - New route app/api/out/route.ts: takes product id + fit id + surface, logs a row
     into the existing `clicks` table (supabase/migrations/0001_initial.sql), then
     302-redirects to the affiliate-wrapped URL. All product outbound links in the UI
     go through /api/out. Degrade gracefully (still redirect) if Supabase env absent.
   - Add subid/u1 parameter to affiliate URLs carrying the click row id, so network
     dashboards can be reconciled to our click log later.

5. WIRE POSTHOG (posthog-js is already a dependency, currently unused):
   - Client provider in app/layout.tsx gated on NEXT_PUBLIC_POSTHOG_KEY.
   - Track exactly these events with clean, documented property schemas:
     session_start, outfit_generated (occasion, budget, source), item_swapped,
     fit_saved, share_card_created, outbound_click (product_id, retailer, surface,
     price_cents), search_performed.
   - No PII in event payloads.

6. HONESTY PASS on copy: remove/replace "AI pass", "AI stylist assist" and fake
   AI loading lines anywhere the deterministic engine runs. New copy: "Styled by
   Sylistly's outfit engine". Keep the editorial tone; drop the fake implication.

7. FTC COMPLIANCE: add a short affiliate disclosure line near shop actions and a
   /disclosure page: "Sylistly may earn a commission when you buy through our links."

Acceptance criteria (verify each, then commit):
- npm run typecheck && npm run build pass.
- curl the image proxy with a non-allowlisted host → 400; with 169.254.169.254 → 400.
- /api/out logs a row (when Supabase envs present) and always redirects.
- No Google Shopping search URL is ever presented as a buy link anywhere in the UI.
- PostHog events fire in dev (verify via network tab or posthog debug).
- Grep confirms zero remaining '__RAKUTEN_ID' placeholders and zero fake-AI copy.
Report: files changed, env vars now used, anything deferred.
```

---

### PHASE 1 — "A launchable product with a monetizable catalog" (2–3 sessions)

**Goal:** rebuild the catalog from affiliate datafeeds (direct links + licensed images), consolidate to the four launch surfaces, make outfit permalinks SEO/Pinterest-grade, deploy to production.

```text
Sylistly Phase 1 (read SYLISTLY_BUSINESS_MASTER_PROMPT.md §3–§5; Phase 0 is merged).
Three workstreams, in order:

WORKSTREAM A — CATALOG REBUILD FROM AFFILIATE DATAFEEDS (highest leverage in the repo):
1. Build scripts/import-affiliate-feed.mts: ingest affiliate product feeds into the
   existing catalog JSON shape (id, brand, name, priceCents, retailerUrl, imageUrl,
   category, tags). Support at minimum:
   - Sovrn Commerce product API or Skimlinks product feed (env-keyed),
   - CSV/TSV datafeeds as exported by Awin / CJ / Rakuten (column-mapping config
     per network in scripts/feed-mappings.ts),
   - Amazon PA-API v5 (env-keyed) as an optional source.
2. Map incoming products into Sylistly's category + tag system, reusing the
   quality-rules vocabulary from lib/catalog.ts and catalog-tag-overrides.json.
   Reject items missing: direct product URL, image, price, or category confidence.
3. Target shape: 600–1,200 items, balanced across the 8 categories and 3 price
   bands (budget <$50, mid $50–150, premium >$150), from affiliate-friendly
   retailers (ASOS, Nordstrom, Revolve, Mango, Uniqlo, Abercrombie, Amazon, etc.).
4. Write output to data/photo-catalog.json (same shape the engine already reads).
   Add npm script "catalog:import". Add a --dry-run report mode (counts per
   category/brand/price-band, rejects with reasons).
5. Add scripts/refresh-catalog.mts for nightly re-pricing/stock-check of existing
   items, and a stalePriceCheckedAt field surfaced in the UI as "price checked
   <relative date>".
   NOTE: if no feed credentials are present in env, build everything against a
   documented sample CSV in scripts/fixtures/ so the pipeline is fully testable;
   the founder will supply real credentials (see master prompt §9).

WORKSTREAM B — SURFACE CONSOLIDATION (per master prompt §4):
1. Nav becomes: Style (home), Lookbook, Saved, Profile (components/BottomNav.tsx).
2. Style = current builder, restructured around: occasion preset chips (Date Night,
   Wedding Guest, Office, Weekend, Trip, Interview) + budget slider + optional
   free-text field → engine → complete look with per-item swap + Shop Look via
   /api/out links + Save + Share card.
3. Lookbook = current feed WITHOUT fake social: delete hardcoded usernames, like
   counts, canned comments from store/social-feed.ts. Byline everything "Curated by
   Sylistly". Keep the vertical-scroll feel. Add occasion/budget filters.
4. Swipe deck moves out of nav: it becomes the onboarding taste-tuner (first-run)
   and is reachable from Profile ("Tune your taste"). Its output must actually bias
   the generator's scoring weights (wire the vibe counters into lib/catalog.ts
   scoring, document the mechanism).
5. Checkout page: rename concept to "Shop this look" everywhere; it is a link list,
   not a checkout. Every link via /api/out. Show the FTC disclosure line.

WORKSTREAM C — PERMALINKS, SEO, DEPLOY:
1. /fit/[id] public pages: server-rendered, with dynamic OG image (the share card),
   title pattern "<Occasion> outfit under $<budget> — Sylistly", meta description
   listing items/brands, schema.org Product/ItemList JSON-LD, canonical URL.
2. Generate 30–50 static editorial Lookbook pages targeting occasion keywords
   ("what to wear to a fall wedding", "first date outfit ideas under $100", etc.)
   from the engine + curated picks; sitemap.ts includes them all.
3. PWA polish: manifest checked, installable, fast on mobile (audit the ~1.7MB of
   JSON imports in data/ — move catalog access server-side or code-split so the
   client bundle doesn't ship megabytes; measure before/after with next build).
4. Prepare Vercel deploy: vercel.json if needed, document all env vars in
   .env.example, verify production build. (Founder connects the actual Vercel
   project + domain.)

Acceptance criteria:
- catalog:import --dry-run produces a sane distribution report from the sample feed.
- Every product surfaced in the UI has a working direct retailer URL through /api/out.
- Zero fake usernames/likes/comments anywhere (grep store/ and app/).
- Lighthouse mobile on / and /fit/[id]: perf ≥ 80, SEO ≥ 95.
- First-load JS for the Style page reduced vs. baseline (report numbers).
- npm run build passes; core flow (occasion → look → shop → save → share) verified
  end-to-end in a real browser.
```

---

### PHASE 2 — "Identity and retention" (1–2 sessions)

**Goal:** users can come back and Sylistly has a reason to bring them back.

```text
Sylistly Phase 2 (Phases 0–1 are live; read master prompt §3.3 and §5).

1. AUTH: Supabase magic-link (email OTP) sign-in. No passwords, no OAuth complexity
   yet. Auth sheet triggered ONLY at value moments (saving a 2nd fit, syncing,
   setting sizes) — never a wall on first use. Wire @supabase/ssr middleware
   properly for App Router. The profiles trigger in the migration already
   auto-creates rows.
2. CLOUD SYNC: saved fits move from localStorage-only to Supabase `fits` (owner_id
   from session), with one-time migration of existing local saves on first login.
   /api/fit gains auth awareness; RLS policies already exist — use them, and stop
   using the service-role client anywhere a user-scoped client works.
3. TASTE PROFILE: persist swipe-tuner results + save/click-derived signals to
   profiles.style_prefs; generator reads them for signed-in users.
4. PRICE-DROP ALERTS (the retention engine):
   - Nightly refresh (Phase 1's refresh-catalog script) diffs prices on items in
     saved fits; write price_drops rows (add a small migration).
   - Email via Resend (env: RESEND_API_KEY): "3 items in your saved looks dropped
     in price" with /api/out links. Double-opt-in on signup; one-click unsubscribe;
     store consent.
   - Vercel Cron (vercel.json) for the nightly job.
5. WEEKLY DIGEST (opt-in): "This week's Lookbook" email, 3 looks, all links tracked.
6. ANALYTICS: funnel dashboards notes in ANALYTICS.md — activation (first outfit
   generated), outbound CTR, D1/D7 return, save rate, email CTR.

Acceptance criteria:
- Full flow: anonymous use → save prompts login → magic link → fits synced →
  visible on second device. Verified end-to-end.
- Price-drop pipeline runs locally against fixture data and writes correct rows.
- Emails render (Resend test mode), include disclosure + unsubscribe.
- RLS verified: user A cannot read user B's fits (test with two accounts).
```

---

### PHASE 3 — "Sylistly Pro" (1–2 sessions)

**Goal:** subscription revenue on top of a proven funnel. **Precondition (do not start otherwise):** D7 retention ≥ 15% and outbound CTR ≥ 25% of sessions, per PostHog.

```text
Sylistly Phase 3 (Phases 0–2 live; preconditions in master prompt §5 met).

1. STRIPE: Checkout + Customer Portal + webhook (app/api/stripe/webhook/route.ts,
   verify signatures with STRIPE_WEBHOOK_SECRET). Products: Pro monthly $5.99,
   Pro yearly $39. subscriptions table migration (user_id, stripe_customer_id,
   status, current_period_end) + entitlement helper lib/entitlements.ts. Handle:
   checkout.session.completed, customer.subscription.updated/deleted,
   invoice.payment_failed (grace period 7 days).
2. AI STYLIST (the Pro hero): chat-style sheet on Style surface. Free-text request
   → Claude (reuse lib/claude.ts patterns; use prompt caching for the system
   prompt; 3-per-day free-tier taste, unlimited Pro) → structured constraints →
   rules engine → look + Claude's one-paragraph styling rationale. Claude
   constrains and explains; the engine selects from the monetizable catalog —
   never let Claude invent products.
3. GATES: saved fits >10 → Pro; price-drop alerts → Pro (grandfather existing
   opt-ins for 30 days); stylist beyond daily taste → Pro. Free outfit generation
   stays UNLIMITED (it powers affiliate + growth — see §3.3; do not gate it).
4. PAYWALL UX: honest, single screen, monthly/yearly toggle, restore purchases via
   Stripe portal link. Track paywall_viewed / trial_started / subscribed events.
5. PRICING PAGE: /pro with the free-vs-pro table and FAQ.

Acceptance criteria:
- Stripe test-mode: subscribe, entitlements flip instantly (webhook), cancel via
  portal, entitlements expire at period end. All verified.
- Stylist E2E: free-text → valid look, every item monetizable, rationale renders.
- Cost guard: stylist calls capped per user per day server-side; caching verified.
- Free tier unchanged for core generation (regression-check the funnel events).
```

---

### PHASE 4 — "Growth machine" (ongoing)

Not one prompt — a menu, prioritized by PostHog data:
- **Dupe finder** ("this look for less"): engine already has price bands; generate each Lookbook outfit at 3 price tiers. Extremely shareable; TikTok-native format.
- Programmatic SEO expansion: occasion × season × budget matrix pages (hundreds), quality-gated.
- Pinterest automation: publish every Lookbook outfit as rich pins with product metadata.
- Share-card upgrade: 9:16 story format with QR/short-link (drives app-less virality).
- Creator seeding: 10–20 micro-creators get custom Lookbook pages with their name and a revenue-share subid. Uses `fit_shares` — the schema already anticipated this.
- Direct affiliate upgrades: replace Sovrn/Skimlinks blended rates with direct Rakuten/Awin/CJ program rates per merchant as volume justifies (often 2× net).
- Native app wrapper (Capacitor) only after $10k MRR.

---

## §6 — Go-to-market playbook

**Pre-launch (during Phase 1):** buy domain; set up Google Search Console, Pinterest Business, TikTok + IG accounts; apply to affiliate networks (§9 — Amazon + Sovrn/Skimlinks approve fast; Awin/CJ/Rakuten want a live site, so apply right after deploy); prepare 20 Lookbook posts.

**Launch channels, in priority order:**
1. **Pinterest (primary).** Outfit-idea search with purchase intent is literally Pinterest's core use. 3–5 pins/day from Lookbook outfits, each linking to its `/fit/[id]` page. Boards per occasion. Compounding, free, and nobody's default plan — which is why it works.
2. **Programmatic SEO.** The occasion pages from Phase 1C. Slow burn, compounding; the only channel that gets cheaper over time.
3. **TikTok/IG Reels.** Format: screen-record "POV: you have a date in 3 hours and $100" → Sylistly generates the look → show the pieces. 3×/week. Expect nothing for 30 days; one hit changes the trajectory.
4. **Reddit/communities** (r/femalefashionadvice etc.): participate honestly, share only when genuinely on-topic; these communities detect and punish astroturf.
5. **Launch posts** (Product Hunt, Hacker News "Show HN") — one-day spikes, good for backlinks and affiliate-network credibility, not a strategy.

**The loop that matters:** content (Pinterest/SEO/TikTok) → occasion page → generate outfit → outbound clicks (affiliate $) → save/email capture → price-drop email → return visit → Pro. Every phase above builds a segment of this loop; GTM is just feeding its top.

---

## §7 — Metrics, targets, kill criteria

**North star: Weekly Shopping Actions (WSA)** = outbound clicks + fits saved per week. It captures both revenue intent and retention intent.

KPI tree (all in PostHog from Phase 0):
- Acquisition: sessions/week by source
- Activation: % of sessions generating ≥1 outfit (target ≥ 60%)
- Shopping intent: outbound CTR per session (target ≥ 25–40%); EPC from network dashboards (target ≥ $0.08 blended)
- Retention: D1 ≥ 20%, D7 ≥ 15% (post-Phase 2); email CTR ≥ 8%
- Revenue: affiliate $/1k sessions (target ≥ $30); Pro conversion ≥ 1.5% of MAU; churn ≤ 6%/mo
- Efficiency: infra+API cost ≤ 20% of revenue

**Kill / pivot criteria — decided now, while sober:**
- 4 weeks post-launch with ≥ 5k sessions: activation < 40% or outbound CTR < 8% after two iteration cycles → the wedge is wrong. Pivot candidates: dupe-finder-first, or occasion-SEO content site with the engine as the interactive widget.
- Month 4: < $100 total affiliate revenue despite ≥ 20k sessions → commerce plumbing or intent problem; audit click logs vs. network dashboards before concluding anything.
- Month 9: Pro conversion < 0.5% after pricing/paywall iteration → subscription isn't the model; double down on affiliate scale + creator rev-share instead.
- Any month infra+API costs exceed 100% of revenue after M2 → freeze paid APIs, catalog-only mode until fixed.

---

## §8 — Legal & compliance checklist

- **FTC affiliate disclosure** near shop links + `/disclosure` page (Phase 0). Also required in every email and on Pinterest/TikTok posts ("commissionable links").
- **Product images:** use only affiliate-network datafeed images (licensed under program T&Cs) — this is a core reason for the Phase 1 catalog rebuild. Stop hotlinking gstatic thumbnails. Keep per-item source attribution in catalog records.
- **Privacy policy + Terms** pages before collecting emails (Phase 2). PostHog configured without session recording initially; honor DNT; cookie/consent banner for EU if targeting EU (initially: US-only targeting keeps this simple).
- **Email:** CAN-SPAM — real postal address in footer, working unsubscribe, honor within 10 days. Double opt-in.
- **Entity & taxes (founder, §9):** LLC before Stripe revenue; affiliate networks require W-9/tax info.
- **Brand:** trademark search on "Sylistly" before spending on brand equity (see Q13).
- **Do not** scrape retailer sites for images/prices outside the affiliate feeds; do not fabricate reviews/engagement (the fake-social teardown is a legal nicety too — the FTC has rules on fake social proof).

---

## §9 — Founder checklist (only you can do these)

**Decisions (make once, this week):**
- [ ] Name: keep "Sylistly" or rename (Q13). Then buy the .com + misspell redirects.
- [ ] Confirm the wedge sentence (§3.1) — everything downstream assumes it.

**Accounts & applications (order matters):**
- [ ] Domain + Vercel project (connect repo, set env vars from `.env.example`).
- [ ] Supabase project (run `supabase/migrations/0001_initial.sql`); PostHog project; Resend account + domain DNS (Phase 2); Anthropic API key.
- [ ] Affiliate — apply in this order: Amazon Associates (instant-ish) and Sovrn Commerce or Skimlinks (fast, blanket coverage) immediately after the site is live with the Lookbook pages; then Rakuten Advertising (Nordstrom, Revolve), Awin (ASOS, Mango), CJ — these review your live site, so apply post-deploy. Save each network's product-feed credentials for the Phase 1 importer.
- [ ] Stripe account (Phase 3) — requires the LLC/tax info.
- [ ] LLC + business bank account before meaningful revenue.
- [ ] Pinterest Business, TikTok, Instagram handles (grab now even if unused).

**Rhythm (solo-founder operating system):**
- [ ] Weekly: 30 min on the PostHog funnel + network dashboards vs. §7 targets; pick the ONE biggest funnel leak as next session's focus.
- [ ] Per phase: paste the §5 prompt, review the report, verify acceptance criteria yourself on your phone (you are the QA department).
- [ ] Monthly: check kill criteria honestly. The criteria exist so the decision is pre-made.

---

## §10 — What NOT to build (the graveyard, so no session resurrects them)

- Universal cart / real checkout (Q7)
- Social network mechanics — follows, comments, DMs, likes (Q1)
- Native iOS/Android before $10k MRR (Q6)
- Live search as the default path (Q3 — it's a Pro/supplement path at most)
- Try-on before Phase 3, and never as a core dependency (Q8)
- Display ads, data selling, dropshipping (§3.3)
- A second redesign of the visual identity — it's good; ship it.

---

*This document supersedes `SYLISTLY_MASTER_PROMPT.md` (referenced by README but not present in this repo) and the product direction implied by the fake-social feed. When code and this document disagree, this document wins until the founder edits it.*
