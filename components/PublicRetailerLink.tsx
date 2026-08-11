'use client';

import { ExternalLink } from 'lucide-react';
import type { SyntheticEvent } from 'react';
import { buildRetailerClickPath } from '@/lib/retailer-attribution';

interface PublicRetailerLinkProps {
  initialHref: string;
  productId: string;
  lookId: string;
  className?: string;
}

/** Public look pages render on the server, where browser/session identity does
 * not exist. Refresh the first-party redirect URL inside the activating client
 * event so `/api/out` receives the visitor's anonymous and session ids without
 * ever exposing or trusting a raw retailer destination in the browser. */
export function PublicRetailerLink({
  initialHref,
  productId,
  lookId,
  className,
}: PublicRetailerLinkProps) {
  function attachClientIdentity(event: SyntheticEvent<HTMLAnchorElement>) {
    event.currentTarget.href = buildRetailerClickPath({
      productId,
      lookId,
      surface: 'shared-look',
      campaign: 'shared',
      subId: productId,
    });
  }

  return (
    <a
      href={initialHref}
      target="_blank"
      rel="noreferrer sponsored"
      onPointerDown={attachClientIdentity}
      onFocus={attachClientIdentity}
      onClick={attachClientIdentity}
      onContextMenu={attachClientIdentity}
      className={className}
    >
      Shop
      <ExternalLink size={11} />
    </a>
  );
}
