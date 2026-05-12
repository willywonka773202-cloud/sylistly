# Sylistly Expansion Pack Notes

**Status:** PENDING MANUAL REVIEW — Not merged into live catalog  
**Created:** 2026-05-12  
**Total packs:** 15  
**Total candidates:** 237  

---

## Packs Created

| Pack | File | Theme | Candidates | Priority |
|------|------|-------|------------|----------|
| 01 | pack-01-shoes-gym.json | Athletic & Gym Shoes | 16 | High |
| 02 | pack-02-shoes-streetwear.json | Lifestyle & Streetwear Sneakers | 16 | High |
| 03 | pack-03-jewelry-clean.json | Minimal & Clean Jewelry | 15 | Medium |
| 04 | pack-04-eyewear-sunglasses.json | Sunglasses & Eyewear | 15 | Medium |
| 05 | pack-05-bags-campus.json | Campus & Everyday Bags | 15 | High |
| 06 | pack-06-techwear.json | Technical Outerwear & Techwear | 15 | Medium |
| 07 | pack-07-vacation-resort.json | Vacation & Resort Wear | 15 | Medium |
| 08 | pack-08-date-night.json | Date Night Pieces | 15 | High |
| 09 | pack-09-old-money.json | Prep & Heritage / Old Money | 15 | Medium |
| 10 | pack-10-campus-basics.json | Student Basics | 15 | High |
| 11 | pack-11-gym-fits.json | Gym Fits & Activewear | 15 | High |
| 12 | pack-12-budget-under-100.json | Budget Under $100 | 15 | High |
| 13 | pack-13-premium-splurge.json | Premium Splurge Pieces | 15 | Low |
| 14 | pack-14-fem-trending.json | Fem Trending 2025 | 15 | High |
| 15 | pack-15-masc-trending.json | Masc Trending 2025 | 15 | High |

---

## Strongest Categories Added

- **Shoes (packs 01 + 02):** 32 total candidates covering gym, trail, court, running, and lifestyle silhouettes. Nike, Adidas, New Balance, ASICS, On, Hoka, Salomon, Vans, Converse all represented. Best coverage of any category across the packs.
- **Activewear / Gym (pack 11):** Lululemon Align, Alo Yoga Airbrush, Gymshark seamless, BYLT drop-cut, On Cloudflow, Hoka Kawana — strong fem + masc coverage with brand diversity.
- **Trending Tops (packs 14 + 15):** Covers 2025 Gen-Z and millennial trends — wide-leg trousers, barrel-fit jeans, biker shorts, oversized blazers, baseball jerseys, cargo pants. Both masc and fem represented.
- **Budget (pack 12):** 15 products all under $100 covering every category (top, bottom, outer, shoes, hat, bag, eyewear, jewelry). Fills the student market gap.
- **Date Night (pack 08):** Strong mix of fem and androgynous pieces across clean, elevated, and minimalist aesthetics — very few similar products in the existing catalog.

---

## Weakest Categories (Still Need Work)

- **Jewelry:** Pack 03 covers minimal jewelry well but lacks statement pieces, chain necklaces for masc builds, and earrings above budget/mid tiers. Need a masc-jewelry pack.
- **Hats:** Only 2–3 hat candidates across all 15 packs. No dedicated hat pack. Especially missing: beanies (winter), dad caps (non-Nike), baseball caps from Supreme/Palace/Stussy.
- **Dresses:** No `dress` category in the schema — dress products are forced into `top` or `bottom`. Several fem candidates (mini dress, satin slip) are mislabeled. Schema update needed.
- **Swimwear:** No swimwear products in any pack. Vacation pack (07) covers resort coverups but not actual swim. Missing Cupshe, Frankies Bikinis, Speedo.
- **Work/Office:** Old money (pack 09) partially covers this but no dedicated work-to-office pack. Missing blazers, trousers, oxfords, button-downs from dedicated work vibe.
- **Socks & Underwear:** Zero candidates across all packs. Considered too accessory-level but could fill UX gaps in full outfit generation.

---

## Products Requiring Manual Review

### High Duplicate Risk
- **Vans Old Skool Black/White** (pack-02, pack-12) — Same product in two packs. If both are accepted, deduplicate before catalog merge.
- **Converse Chuck 70 Black** (pack-02) vs **Converse Chuck Taylor All Star Black** (pack-12) — Different products, both acceptable. Verify IDs are distinct.
- **Herschel Classic Backpack** (pack-12) vs **Herschel Little America** (pack-05) — Different models, different price points. Both acceptable but review side by side.
- **Uniqlo Airism Tee** (pack-12) vs **Uniqlo Supima Cotton Tee** (pack-10) — Different fabric lines, both acceptable. Keep both if they don't duplicate existing catalog entries.

### Luxury Pricing — Budget Tier Mismatch
These products are labeled `premium` but may need a new `luxury` tier:
- Rolex Submariner Date Black — $9,500 (pack-13)
- Cartier Love Bracelet Yellow Gold — $6,750 (pack-13)
- Loro Piana Baby Cashmere Turtleneck — $4,800 (pack-13)
- Dior Oblique Saddle Bag Beige — $5,200 (pack-13)
- The Row Margaux 15 Tote — $2,390 (pack-13)
- Bottega Veneta Cassette Bag Intrecciato — $3,500 (pack-13)
**Action needed:** Either add a `luxury` budget tier to the schema or cap pack-13 at $1,500 and split into `premium` vs `luxury`.

### Category Schema Issues
- **Dresses / bodysuits** tagged as `top` or `bottom`: several fem trending candidates in pack-14 (satin slip dress, wrap mini dress, bodysuit). These need a `dress` or `bodysuit` category if the schema is extended.
- **Sports bras as tops:** Lululemon Free to Be Serene Bra (pack-11) is categorized as `top` since it functions as a standalone top. This is intentional but reviewers should verify the FE handles it correctly.

### imageUrl Status — ALL PACKS
**Every imageUrl in all 15 packs is a Google Shopping search intent URL**, not a real product thumbnail CDN URL. Format:
```
https://www.google.com/search?q=[encoded-product-name]&gl=us&hl=en&udm=28
```
**These URLs will not render as images.** Before any pack is merged into the live catalog, all imageUrls must be replaced with real SearchAPI-fetched thumbnails or brand CDN URLs. New Balance Scene7 URLs are the only CDN imageUrls provided (for NB products in pack-01 and pack-15).

---

## Pack-Specific Review Notes

**Pack 01 (Gym Shoes):** ASICS Gel-Nimbus 26 and Saucony Endorphin Speed 4 are niche running shoes — verify they fit the Sylistly demographic before accepting.  
**Pack 06 (Techwear):** Acronym and Nemen pieces are very niche ($800–$2,800). Arc'teryx and Stone Island are more accessible. Verify vibe tag `techwear` exists in the active vibe schema.  
**Pack 08 (Date Night):** Reformation Midi Dress ($278) and Theory Precision Pants ($325) are strong fem date pieces but need imageUrl before review. Also contains Rolex — see luxury pricing note above.  
**Pack 09 (Old Money):** Ralph Lauren Purple Label and Loro Piana items are extremely high-end. Verify these match the target user demographic. Brooks Brothers OCBD ($120) is the most accessible item in the pack and the highest priority.  
**Pack 13 (Premium Splurge):** Lowest priority pack — most items are luxury tier and unlikely to be purchased via affiliate links. Useful for aspirational styling only. Consider adding a `wishlist` flag to the schema for aspirational products.  
**Pack 14 (Fem Trending):** Barrel-fit jeans (Agolde Ren, Levi's 94 Baggy) and wide-leg trousers are the highest-priority additions — these are the dominant fem silhouette in 2025 and likely missing from the current catalog.  
**Pack 15 (Masc Trending):** Aimé Leon Dore and Norse Projects fill the "elevated streetwear" gap. Adidas Samba OG is the highest-traffic masc sneaker search term in 2025 and should be prioritized.

---

## Integration Checklist (Before Any Pack Merge)

- [ ] Replace all Google Shopping search intent imageUrls with real SearchAPI thumbnails
- [ ] Deduplicate against existing `data/photo-catalog.json` and `data/generated-catalog.json`
- [ ] Deduplicate cross-pack (Vans Old Skool appears in 2 packs)
- [ ] Verify vibe tags match active vibe schema in `lib/vibes.ts`
- [ ] Verify category values match active schema
- [ ] Consider adding `luxury` budget tier if pack-13 is merged
- [ ] Consider adding `dress` category if fem dress candidates are merged
- [ ] Run `npm run qa` after any merge

---

## What Was NOT Touched

- `app/` — no UI files modified  
- `components/` — no component files modified  
- `store/` — no store files modified  
- `lib/catalog.ts` — not touched  
- `lib/catalog-health.ts` — not touched  
- `lib/product-image-quality.ts` — not touched  
- `lib/vibes.ts` — not touched  
- `data/photo-catalog.json` — not modified  
- `data/generated-catalog.json` — not modified  
- `data/searchapi-catalog-reviewed-expansion.json` — not modified  
- `package.json` — not touched  
- `.env.local` — not touched  
- Any scripts — not touched  
