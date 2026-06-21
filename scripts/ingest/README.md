# Auto-ingestion — "integrate every seller, grow the catalog forever"

The growth engine + the moat. This turns Sylistly from a fixed curated catalog
into a system that **automatically pulls shoppable products from any retailer**,
so the database (and therefore the affiliate revenue) grows without manual work.
**Growth = revenue**: every product ingested is a product that can be sold.

Built + proven 2026-06-20: `ingest-catalog.ts` pulled **481 real products from a
live Shopify store (allbirds.com) with zero credentials** — normalized, deduped,
staged. The same job pulls from affiliate networks once their keys are set.

---

## The one architectural truth

**Catalog DATA and affiliate COMMISSION are two separate layers.** Almost
nothing gives both for free at scale. The pattern:

> Pull structured product data (image, brand, name, price, category, URL) →
> normalize → at click-out, the URL must be a **commission-earning** link.

A link is already commissionable two ways:
1. **It came from an affiliate network you're approved with** (Impact / Awin /
   Rakuten / CJ) — the feed's link is pre-tracked.
2. **You wrap any raw URL with Skimlinks/Sovrn** at output (Sylistly already does
   this in `lib/affiliate.ts` / `wrapSkimlinks` here).

Second truth: pulling *commissionable* data from a network requires being
**approved per-advertiser**. No one hands you a global catalog on day one. The
networks differ in signup friction + delivery model, not in this rule.

---

## Source plan (ranked)

### Tier 1 — data + commission together (build on these)
| # | Source | Auth / access | Delivery | Notes |
|---|--------|---------------|----------|-------|
| 1 | **Impact.com Catalog API** | `IMPACT_ACCOUNT_SID` + `IMPACT_AUTH_TOKEN` (HTTP Basic) | `Catalogs/ItemSearch` query API | Best docs; largest DTC/premium roster (Target/Walmart/Nordstrom route here). `Url` field is already a deep link. **Start here.** |
| 2 | **Awin Product Feeds** | `AWIN_FEED_URL` (built feed incl. feed key) | CSV/XML bulk download | Easiest bulk ingest (refundable $5 deposit). `aw_deep_link` pre-tracked. |
| 3 | **Rakuten Product Search** | token | query API | Premium fashion breadth, *growing* (inheriting the ShopStyle/Collective Voice ecosystem). |
| 4 | **CJ Affiliate GraphQL** | PAT + CID | `https://ads.api.cj.com/query` | Secondary roster / fill-in. |

### Tier 2 — monetization catch-all (no data)
- **Skimlinks / Sovrn link wrapper** — turns ANY raw URL into a commission link
  across ~48,500 merchants, zero per-merchant approval. This is how Tier-3 data
  earns. Already wired (`NEXT_PUBLIC_SKIMLINKS_PUBLISHER_ID`). **Note:**
  Skimlinks' *Product/Merchant API* is managed-tier-only — use it to WRAP, not to
  source.

### Tier 3 — data breadth (must wrap to earn)
- **Shopify `/products.json`** — public, no auth, runnable today (the proven
  path). `https://{domain}/products.json?limit=250&page=N`. Discover fashion
  Shopify stores via BuiltWith / the Skimlinks merchant list. Wrap the raw URL.
- **Aggregators** — PriceAPI, Datafiniti, **Channel3** (fashion-specific, claims
  affiliate-ready URLs + a free tier — worth a direct eval).

### Kill list (do NOT build on)
- **ShopStyle / Collective Voice** — shutting down; links die **Mar 31 2026**.
- **Amazon PA-API 5.0** — retires **May 15 2026**; new app can't meet the
  Creators-API 10-sales gate anyway. (Walmart via Impact has no such gate.)
- **Google Shopping scraping** (incl. SerpApi) — active litigation (Google v.
  SerpApi, Dec 2025). Use PriceAPI/Datafiniti for data instead.

---

## Run it

```bash
# Shopify long-tail (no credentials):
npx jiti scripts/ingest/ingest-catalog.ts --shopify=store1.com,store2.com

# Affiliate networks auto-run when their env vars are set:
IMPACT_ACCOUNT_SID=… IMPACT_AUTH_TOKEN=… AWIN_FEED_URL=… \
  npx jiti scripts/ingest/ingest-catalog.ts
```

Output → `data/ingested-staging.json` (gitignored — retailer data, never
committed). The orchestrator pulls every enabled source in parallel, normalizes
to one `IngestRecord`, dedupes GTIN-first (keeping the higher-commission source
on conflict), and prints a by-source / by-category report.

## Promote to live (the quality gate)

Staging is **not** the live catalog, on purpose: raw retailer images are
lifestyle/model shots, not the feed's premium cutouts. Before a staged product
ships it must clear:
1. **Image → Higgsfield cutout** — `media_import → marketing_studio_image(2k,4:5)
   → remove_background → self-host` (see `sylistly-higgsfield-studio-pipeline`),
   producing `imageTransparentUrl`.
2. **Quality gate** — `isCleanClientCatalogProduct` (transparent cutout + real
   commerce link + not a multi-item set).
3. **Map → `Product`** + merge into `data/client-catalog.json`, then
   `npm run catalog:client`.

That gate is why the live feed stays editorial-grade even as ingestion scales.

## What's left for the owner (turns this from infra → revenue)
1. **Sign up as a publisher on Impact + Awin**, apply to fashion advertisers, set
   the env vars above. (Lowest friction; both yield pre-tracked links.)
2. Set `NEXT_PUBLIC_SKIMLINKS_PUBLISHER_ID` so Shopify/long-tail URLs earn.
3. Schedule this job (cron) → nightly catalog growth.

> Confidence note: Impact/Awin/Shopify endpoints + auth are well-corroborated and
> Shopify is proven live. Rakuten/CJ field names are reconstructed from secondary
> sources (their portals are JS-rendered) — verify against the live portal once
> you have publisher accounts.
