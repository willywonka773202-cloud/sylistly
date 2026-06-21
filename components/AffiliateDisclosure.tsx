/**
 * FTC affiliate disclosure — a single source of truth for the legal copy so it
 * stays consistent (and compliant) across every shop surface. Rendered near the
 * outbound "Shop" actions (PiecePeek, CheckoutSheet, checkout, shared look) so
 * the material connection is clear and conspicuous before a user clicks out.
 *
 * Honest by design — matches the app's no-fake-mechanics ethos: these are real
 * affiliate links, the buyer never pays extra, and we say so plainly.
 */
export function AffiliateDisclosure({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[10px] leading-relaxed text-muted ${className}`}>
      Sylistly may earn a commission from purchases made through these links — never at extra cost to you.
    </p>
  );
}
