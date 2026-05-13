# Expansion Pack — Next Steps

**Status:** Partial merge complete. 9 of 227 candidates promoted to live catalog. 1 candidate resolved via SearchAPI pipeline test.

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

## SearchAPI Image Resolution Pipeline

The `scripts/resolve-expansion-images.ts` script has been created to safely process the remaining 217 blocked candidates. 

It queries the Google Shopping API via SearchAPI to find valid `https://` thumbnail images for candidates currently blocked by search-intent URLs.

### Usage

**Dry Run Mode**
```bash
$env:SEARCHAPI_DRY_RUN="true"; npm run resolve:expansion-images; Remove-Item Env:\SEARCHAPI_DRY_RUN
```

**Live Run (Example: max 1 query)**
```bash
$env:SEARCHAPI_MAX_QUERIES="1"; npm run resolve:expansion-images; Remove-Item Env:\SEARCHAPI_MAX_QUERIES
```

## Next Steps

1. Run the `resolve:expansion-images` script across all packs (removing the `MAX_QUERIES` limit) to resolve the remaining 217 candidates.
2. Review the resulting modified `pack-*.json` files.
3. Consolidate newly valid candidates into `data/catalog-reviewed-additions.json`.
4. Validate the catalog health.
