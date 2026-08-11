# Accessibility QA

Target: WCAG 2.2 AA, with a product-level 44×44 CSS pixel minimum for primary touch controls. This pass is source-based hardening, not a compliance claim.

## Implemented evidence

- Added a keyboard skip link and focusable main-content destination in the root layout.
- Preserved one clear page heading on For You, Browse, Discover, Drop, Profile, Saved, and Checkout; named filter, result, activity, summary, and saved-action regions.
- Labelled checkout, piece, search, saved-fit, post-viewer, post-composer, and onboarding dialogs. The shared dialog behavior moves focus in, traps Tab/Shift+Tab, closes on Escape, restores focus, and now includes embedded retailer iframes in its focus order.
- Restored focus when onboarding questions, Drop crate views, and Daily Drop reveal phases replace the control that launched them.
- Changed the interactive outfit collage from `role="img"` to a labelled group so its piece controls remain exposed to assistive technology.
- Added keyboard arrow-key positioning to the post composer’s drag interface, with visible instructions and accessible names for each movable piece.
- Added polite status or alert output for catalog loading/results, search errors, copy/open outcomes, saved/share confirmation, withheld links, and visual-only reveal/save feedback.
- Brought inspected close buttons, filter chips, search actions, sheet actions, undo actions, and other primary controls to at least 44 CSS pixels.
- Added progressbar semantics to onboarding, style level, streak, and multi-step daily-goal progress.
- Reduced optional motion for splash/loading/celebration effects and limited hover transforms to motion-safe contexts.
- Corrected small text on the pink `#FF2D6D` action surface: white measured 3.59:1, while the existing dark canvas token measures 5.41:1. Icon-only white marks remain above the 3:1 non-text threshold.

## Browser checks still required

- Run a full keyboard pass at mobile and desktop widths: skip link, navigation order, every sheet/dialog, focus containment, Escape, and trigger focus restoration.
- Test VoiceOver on iOS Safari and macOS Safari for headings, pressed states, product-piece controls, dialog names, result counts, and live announcements without duplication.
- Verify reflow at 200% and 400% zoom and at 320 CSS pixels, especially the Feed tuning panel, Search sheet, checkout actions, profile grids, and saved-fit dialog.
- Inspect all default, hover, focus, disabled, selected, error, and dynamic rarity-color states with a contrast analyzer; image and translucent-overlay states require rendered pixels.
- Enable Reduce Motion at the OS level and confirm the splash, reveal reel, celebrations, hover lifts, and sheet transitions become still without hiding state changes.
- Measure 44×44 touch targets in rendered layout, including dense mobile chips and the bottom navigation, and verify no target overlap.
- Run automated axe/WAVE checks, then manually test high-contrast/forced-colors mode, screen-reader browse mode, retailer iframe behavior, and external-tab announcements.
