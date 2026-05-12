# Expansion Pack — Next Steps

**Status:** Partial merge complete. 9 of 227 candidates promoted to live catalog.

## What was merged this session
The 9 New Balance candidates with real `nb.scene7.com` CDN imageUrls and real `newbalance.com` productUrls were verified, written to `data/catalog-reviewed-additions.json`, loaded by `lib/expansion-catalog.ts`, and appended to `ALL_CATALOG_PRODUCTS` via the new `EXPANSION_REVIEWED_PRODUCTS` source.

| Pack | Candidate ID | Title | Category | Vibes |
|------|-------------|-------|----------|-------|
| pack-01 | ep01-nb-fresh-foam-1080v13-wht | NB Fresh Foam X 1080v13 White | shoes | gym, athletic, clean |
| pack-01 | ep01-nb-minimus-tr-blk | NB Minimus TR V1 Training Black | shoes | gym, athletic |
| pack-01 | ep01-nb-fuelcell-rebel-v3-masc | NB FuelCell Rebel v3 Neon Yellow | shoes | gym, athletic |
| pack-02 | ep02-nb-574-grey | NB 574 Core Grey | shoes | streetwear, campus |
| pack-02 | ep02-nb-990v6-grey | NB 990v6 Made in USA Grey | shoes | streetwear, clean, premium |
| pack-02 | ep02-nb-327-grey-green | NB 327 Grey Green | shoes | streetwear |
| pack-10 | ep10-new-balance-574-beige | NB 574 Beige | shoes | campus, clean |
| pack-14 | ep14-new-balance-2002r-white | NB 2002R Sea Salt | shoes | streetwear, clean |
| pack-15 | ep15-new-balance-9060-grey | NB 9060 Rain Cloud | shoes | streetwear, techwear |

**Net effect**: catalog shoes 57 → 66 (+9). Gym/vacation/techwear repeat rates dropped further (see final report).

## What was NOT merged
**218 of 227 candidates remain blocked** by `invalidSearchIntentImage` status. These have Google Shopping search-intent URLs (`https://www.google.com/search?q=...&udm=28`) as `imageUrl` values that will not render as images.

| Status | Count |
|--------|-------|
| valid (merged this session) | 9 |
| invalidSearchIntentImage | 218 |
| needsRealImage | 0 |
| needsRealProductUrl | 0 |
| duplicateRisk | 0 |
| rejected | 0 |

## Path forward for the remaining 218

To safely merge the rest, each candidate needs a **real direct CDN imageUrl** — not a search-intent URL. Two options:

1. **SearchAPI resolution** (requires user authorization): Query SearchAPI for each candidate's brand+title and extract the first `thumbnail` field from the Google Shopping response.
2. **Manual brand CDN lookup**: For known retailers (Nike, Adidas, Lululemon, Aritzia, etc.), construct the CDN URL pattern from the brand's product page URL.

**Hard rules unchanged:**
- Do NOT invent image URLs.
- Do NOT use `https://www.google.com/search?...` as `imageUrl`.
- Do NOT use `data:` URLs.
- Do NOT add candidates with weak titles or unresolved merchants.

## Output files this session
- `data/expansion-packs/EXPANSION_PACK_REVIEW_REPORT.json` — categorized status per candidate
- `data/expansion-packs/EXPANSION_PACK_NEXT_STEPS.md` — this file
- `data/catalog-reviewed-additions.json` — 9 candidate Products in catalog-compatible shape
- `lib/expansion-catalog.ts` — strict-safety loader for the additions file
