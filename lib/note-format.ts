/**
 * Tidy a styling note for display.
 *
 * Pure + dependency-free (no `@/` imports) so it's unit-testable via the jiti
 * runner. Most notes end cleanly, but ~10 of the baked AI notes were hard-cut to
 * exactly 240 chars mid-word (a naive `.slice(0, 240)` in the styling pipeline),
 * e.g. "…oversized frames complete the edgy minim", and one carries a stray
 * "/>" markup fragment. A note ending mid-thought reads as broken on the feed —
 * the app's AI styling rationale is a key differentiator, so it must look
 * finished. We trim any note that doesn't end on terminal punctuation back to
 * its last complete clause/sentence (the truncated tail was incomplete anyway).
 */
export function tidyNote(note: string): string {
  // Strip a stray trailing markup fragment a couple notes carry (e.g. '."/>').
  const n = note.trim().replace(/["']?\s*\/?>+\s*$/, '').trim();
  // Already a complete sentence — leave it.
  if (/[.!?]$/.test(n)) return n;
  // Truncated mid-thought: trim back to the last clause/sentence boundary so it
  // reads as a finished thought, then close with a period.
  const cut = Math.max(n.lastIndexOf('. '), n.lastIndexOf('; '), n.lastIndexOf(', '));
  if (cut >= 40) return `${n.slice(0, cut).replace(/[,;:]+\s*$/, '')}.`;
  // No usable boundary — drop the partial last word and ellipsize.
  const sp = n.lastIndexOf(' ');
  return `${(sp >= 20 ? n.slice(0, sp) : n).replace(/[,;:]+\s*$/, '')}…`;
}
