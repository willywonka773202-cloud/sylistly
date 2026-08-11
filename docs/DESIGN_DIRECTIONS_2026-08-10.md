# Sylistly product design directions — 2026-08-10

## Brief

Redesign the primary complete-look experience around one decision: **show me a complete outfit I like, inside my budget, that I can buy now, then let me replace one piece without breaking it.** The directions preserve Sylistly's noir, champagne, hot-pink, editorial-serif, and real-cutout identity. They are grounded in the live 390×844 capture at `docs/audit/evidence/2026-08-10-live-baseline/01-mobile-home-390x844.jpg`.

## Exactly three directions

| Direction | Product framing | Premium | Legibility | Shoppability | Responsive potential | Speed potential | Distinctiveness |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **1. Editorial Lookbook** | One dramatic outfit, then a restrained commerce decision area | 5/5 | 5/5 | 4/5 | 4/5 | 5/5 | 4/5 |
| **2. Stylist Canvas** | The outfit itself is editable; select or replace a piece without leaving the look | 5/5 | 4/5 | 5/5 | 5/5 | 4/5 | 5/5 |
| **3. Champagne Atelier** | Light editorial spread with a visible item rail and budget-first filters | 4/5 | 5/5 | 5/5 | 4/5 | 4/5 | 5/5 |

Artifacts:

- `docs/design/2026-08-10/01-editorial-lookbook.png`
- `docs/design/2026-08-10/02-stylist-canvas-selected.png`
- `docs/design/2026-08-10/03-champagne-atelier.png`

## Selected direction

**Direction 2 — Stylist Canvas** is the strongest. It makes Sylistly's differentiator—the ability to keep the look while replacing one piece—visible in the primary experience, retains the recognizable dark editorial identity, and converts naturally into a true desktop layout with an outfit canvas beside a piece/replacement rail.

Implementation corrections to the generated concept:

- Remove the artificial “93% match” score; use a short evidence-based recommendation reason instead.
- Show “Complete” only after exact-link, availability, required-slot, and budget validation succeeds.
- Treat the budget as a whole-look ceiling, not a per-item filter.
- Make **Shop items** the primary action and **Remix** secondary; never imply a single in-app checkout across retailers.
- Keep save, dislike, and share quiet and progressive.
- Use existing reviewed retailer cutouts and the existing Sylistly font/icon system rather than generated production assets.
- On desktop, use a left navigation rail, a large central outfit canvas, and a right piece/replacement commerce panel—never a centered phone shell.
