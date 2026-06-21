# Sylistly — Investor Strategy & Moat (working doc, 2026-06-20)

> What makes an investor lean in: a product people *use* + a moat that compounds.
> Sylistly's wedge is "TikTok-scroll meets a personal stylist meets one-tap shop."
> The moat is **a self-growing catalog where every product added = more revenue.**

## The one-liner
An endless scroll of **complete, coordinated, shoppable outfits** — swipe to love,
remix any piece, shop the whole fit. Affiliate-monetized, AI-styled, and the
catalog grows itself.

---

## The 3 things that make investors lean in

### 1. A moat that compounds: self-growing catalog = self-growing revenue
Most affiliate/discovery apps hand-curate products (doesn't scale) or dump a flat
feed (no taste). Sylistly now has an **auto-ingestion pipeline** (`scripts/ingest/`)
that pulls shoppable products from **any retailer** and normalizes them into the
catalog — proven tonight by ingesting **481 real products from one Shopify store
with zero credentials**. Plug in affiliate-network feeds (Impact, Awin, Rakuten)
and the catalog — and the commission base — grows automatically, nightly.
**Growth = revenue, with no marginal human cost.** That's the line that gets a term sheet.

- Data layer: Impact/Awin/Rakuten feeds + Shopify long-tail + aggregators.
- Money layer: every link is commissionable (network deep link, or Skimlinks-wrapped).
- **Revenue is NOT gated on AI visuals.** A cutout is only needed for the premium
  worn-flatlay feed; an ingested product is *shoppable* with its native image. So
  a native-image "Explore / Shop Brands" surface earns commission the day
  ingestion is wired (Path B), while the Higgsfield cutout pipeline (Path A) is
  reserved for the hero feed's editorial polish. Growth → revenue starts now, not
  after the visual pipeline. (See `scripts/ingest/README.md` → "Two paths to live".)
- Detail: `scripts/ingest/README.md`.

### 2. Taste, not just a feed: genuinely smart outfit selection
The product isn't a product grid — it's *coordinated outfits*. Tonight the
generator got materially smarter: a tested `colorHarmonyScore` (`lib/color-harmony.ts`)
now enforces real color theory — neutral-anchored palettes, tonal cohesion, and a
hard penalty on busy >2-accent clashes — so the fits read *styled*, not random.
This layers on existing formality/season/frame coherence. Next layers (formality
variance, silhouette balance, pattern limits) are scoped and in progress.
**The differentiator vs a Pinterest board: every look is a complete, shoppable,
coordinated outfit a human stylist would sign off on.**

### 3. Monetization that's already built (just needs switches flipped)
- Affiliate wrapping is live in code (`lib/affiliate.ts`, Skimlinks + Rakuten).
  Revenue starts the moment `NEXT_PUBLIC_SKIMLINKS_PUBLISHER_ID` /
  `RAKUTEN_AFFILIATE_ID` are set in Vercel.
- Honest mechanics throughout (no fake scarcity / fake discounts — verified in the
  test suite). Retention via the Daily Drop (streaks, XP, quests — real-action XP only).
- Analytics ready (PostHog) — flip `NEXT_PUBLIC_POSTHOG_KEY` to start proving
  engagement/retention/CTR to investors with real numbers.

---

## Competitive positioning (researched 2026-06-20)
Sylistly is **already competitive on the core** — swipe discovery, smarter-every-
swipe personalization, seamless shop, share-to-grow, wardrobe. The deltas vs
best-in-class are roadmap bets, not gaps in the core:

| Capability | Sylistly today | Best-in-class | Bet |
|---|---|---|---|
| Swipe outfit discovery | ✅ FitDeck | The Yes, Looklike | core ✓ |
| Coordinated AI outfits | ✅ (smarter tonight) | Stylitics | strengthen |
| Auto-grown catalog | ✅ pipeline built | (rare — most curate) | **moat** |
| Affiliate monetization | ✅ code-ready | LTK, ShopMy | flip switches |
| **On-body visualization** | ✗ (vitrine flatlay) | Looklike "on you" | **biggest bet** |
| Weather/calendar planning | ✗ | many | high-ROI, needs API |
| Community/peer feed | partial (share) | Pinterest | later |

## Roadmap (ranked by investor impact)
1. **On-body try-on** — show the outfit on the user's body/avatar. The single
   biggest "wow". Needs camera + body model (Higgsfield avatars are a path).
2. **Higgsfield premium visuals at scale** — re-shoot ingested products into
   premium studio cutouts so the feed stays editorial as the catalog explodes.
   Pipeline exists; run owner-supervised (credits + product-accuracy review).
3. **Weather/calendar "what to wear today"** — decision-fatigue hook; needs a
   weather API + calendar. Self-contained once a key is added.
4. **Smart-selection v2** — formality/silhouette/pattern layers (in progress).

## Owner switches to turn this into a fundraise-ready demo
1. `NEXT_PUBLIC_POSTHOG_KEY` → measure (you can't pitch traction you didn't track).
2. `NEXT_PUBLIC_SKIMLINKS_PUBLISHER_ID` + `RAKUTEN_AFFILIATE_ID` → monetize.
3. Impact + Awin publisher signup → set `IMPACT_*` / `AWIN_FEED_URL`, schedule the
   ingest job → the catalog (and the revenue story) compounds nightly.
4. Run one Higgsfield batch (supervised) to show the premium-visual ceiling.
