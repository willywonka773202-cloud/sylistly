# Catalog Expansion Plan (Low-cost MVP)

## Strategy
- Keep runtime generation powered by stored catalog data (no per-user paid search).
- Use periodic ingestion (manual + scripts) into JSON/Supabase, then ship cached catalog snapshots.
- Maintain a strict required schema and validation before merge/import.

## Required product schema
```json
{
  "id": "catalog-brand-slug",
  "brand": "Brand",
  "name": "Product name",
  "category": "top",
  "frameBias": "androgynous",
  "priceCents": 6500,
  "currency": "USD",
  "imageUrl": "https://...",
  "productUrl": "https://...",
  "retailer": "Retailer",
  "source": "affiliate_feed|manual|retailer_feed",
  "colorTags": ["black"],
  "styleTags": ["clean", "minimal"],
  "vibeTags": ["clean"],
  "popularityScore": 0.62,
  "dateAdded": "2026-05-01"
}
```

## Validation gates
- Reject missing `imageUrl`, `priceCents`, `category`.
- Reject invalid/empty product URLs.
- Reject duplicate `id` and duplicate normalized `(brand + name + retailer)`.
- Warn on suspicious placeholders and non-http image URLs.

## Cheapest expansion methods
1. **Manual AI-assisted JSON batches** (free, best control).
2. **Affiliate/retailer feeds** (large volume, usually free; needs mapping).
3. **Periodic script ingestion** to local JSON + optional Supabase table.
4. **Public datasets** for starter breadth; clean before use.

## Future paid options (optional)
- Cloudinary/remove.bg/rembg API as post-processing layer, not per-user generation dependency.
- Paid live search should remain fallback tooling for admins only.

## Anti-cost guardrails
- Never call paid search APIs in user request path by default.
- Build outfits from cached catalog; refresh catalog offline (daily/weekly).
- Keep outbound URLs source-first; Google Shopping only as final fallback.
