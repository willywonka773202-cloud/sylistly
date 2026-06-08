# UI BACKLOG — Pinterest-style redesign

Goal: evolve the app toward the Pinterest / Fits-style reference layout the owner shared — masonry feed, mixed card types, editorial polish. Work top-down; one small, verified, reversible change per cycle. Verify each: `npx tsc --noEmit` clean + `npm run build` exit 0 + headless screenshot before deploy. Never deploy a red build.

## Done
- [x] Feed → 2-column masonry grid (variable-height flat-lay cards, creator + hearts + category/price chips, tap → FitViewer). Replaced the full-screen one-fit-per-screen layout.

## Backlog (top = next)
- [ ] **Mixed card types.** The refs mix flat-lay collages with single model-photo cards and "model + product strip" cards (e.g. "Street layers", softrebels). Add card-type variety so the masonry isn't all flat-lays: render a model/hero-product card for posts with a strong model image, a thumb-strip card for others.
- [ ] **Hero / trending featured card.** A large card at the top of "For You"/"Trending" with title + caption + "See details" + saved-by avatars (ref image 2).
- [ ] **Caption line on cards.** Add the short creator caption under the handle ("Sport energy", "Contrast is calm", "Quiet luxury") seen in ref image 4.
- [ ] **Real avatar images** on cards instead of the single-letter initial chip.
- [ ] **Story-ring rail polish.** Tighter spacing, clearer labels, active state; matches the ref ring rail.
- [ ] **Search + filter affordances.** The refs show a search icon + filter button in the header; wire the existing SearchSheet / a filter sheet.
- [ ] **Mood-board collage cards.** Multi-image collage cards ("Mood Board: Milan", "City minimalism") for variety.
- [ ] **3-column dense option** for the masonry (ref image 3 is 3-col).
- [ ] **Card chip styling pass.** Category + price + "shoppable" chips: rhythm, contrast, consistency.
- [ ] **Discover / Closet / You** surfaces: bring them to the same masonry/editorial standard.

## Notes
- Cards reuse `OutfitLookCard` (flatlay) + open `FitViewer` on tap. Feed data = `useSocialFeed` (client-side, instant, $0).
- Builder serves the pre-generated `data/outfit-library.json` (15k gendered, coordinated fits). Feed still composes live via `buildCatalogLook`.
- Headless screenshots have a paint-timing quirk — verify image loading via DOM (`naturalWidth>0`) not just the screenshot.

## Progress log (newest first)
### <date> — Feed masonry
- Converted feed to 2-col masonry; verified 58/58 images load on prod; matches the reference layout.
