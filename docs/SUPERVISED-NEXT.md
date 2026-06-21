# Supervised next-session specs (turnkey)

These are the items I deliberately did NOT do autonomously (high regression risk on
critical paths, need device/aesthetic judgment, or need accounts/keys). Each is
spec'd so it can be executed fast with you watching. Ordered by value.

---

## 0. 💰 Turn on revenue (5 min, your action)
Set in Vercel → Project → Settings → Environment Variables (Production):
- `NEXT_PUBLIC_SKIMLINKS_PUBLISHER_ID` = your Skimlinks publisher id
- `NEXT_PUBLIC_RAKUTEN_AFFILIATE_ID` = your Rakuten affiliate id
Then in `lib/affiliate.ts`, replace the `__RAKUTEN_ID_*__` placeholders with real
advertiser ids from your Rakuten dashboard (nordstrom/shopbop/revolve/end/ssense).
Redeploy. Verify: a shop link on /checkout should become a `go.skimresources.com`
or `click.linksynergy.com` URL. Code is already leak-free — every shop CTA wraps.

---

## 1. Critical-path perf (medium risk — verify pager + spin after each)
- **WornFlatlay memoize** (components/WornFlatlay.tsx): `computeCollage()` + the
  `staggered` array recompute every render. Memoize keyed by a STABLE content key
  (sorted product ids), not the `items` prop (its identity changes per render).
  Must move hooks above the `if (products.length < 3) return null` early return.
  Verify: feed still snaps one-card-per-swipe; pieces still settle on activate.
- **DailyDrop reel preload dedup** (components/DailyDrop.tsx ~142–186): module-level
  `Set<string>` of warmed URLs; skip `new Image()` for already-warmed ones so
  switching crates doesn't re-warm 40 images. Low user impact (browser caches), do
  only if profiling shows it matters.
- **Off-screen animation pause**: browsers already throttle bg-tab rAF/animations,
  so this is marginal — skip unless battery profiling flags it.

## 2. paste-a-link-to-style (server work)
A `/api/style-from-url` route that fetches a product URL server-side, parses
og:image/price/brand (cheerio or a vision pass), creates a Product, locks it into
the feed (reuse PENDING_LOCK_KEY). Risks: SSRF (reuse the /api/image allow-list
pattern), parse fragility per retailer. Needs an input affordance on the feed/builder.

## 3. weather/occasion mode (geo + API)
Geolocation (permission) → a weather API (key) → bias generation toward
warm/cold/rain-appropriate categories. Honest framing ("styled for 48°F & rain").
Needs a key + a clear opt-in. Medium build.

## 4. Real subscription/paywall (only if you want it)
None exists today (revenue is affiliate-only). If you want $/mo: add Stripe (or
Lemon Squeezy) checkout + a gated feature set + accounts. This is a real project,
not a polish task — scope it deliberately.

## 5. Bigger dramatic visual swings (need your eyes on-device)
- View-Transition route morphs (Next experimental viewTransition) — premium but can
  break navigation; needs device testing.
- WebGL aurora backdrop behind the feed (gated/lazy) — heavier, aesthetic gamble.
- Heat-tier reveal: a bigger gold celebration on the rarest Drop pulls.
All of these are "ship a draft → you react on your phone" candidates.

---
_Authored autonomously 2026-06-16 during the /goal run. The visual arsenal +
audit fixes are already live + verified; this is what's left and why it waited._
