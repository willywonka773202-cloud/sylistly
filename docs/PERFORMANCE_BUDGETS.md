# Production route performance budgets

Sylistly enforces First Load JS from completed Next.js production artifacts, not source estimates or `next dev` output.

| Route | Maximum gzip First Load JS |
| --- | ---: |
| Primary For You feed (`/`) | 350 kB |
| Browse (`/browse`) | 400 kB |
| Discover (`/discover`) | 400 kB |
| Remix (`/build`) | 400 kB |
| Saved (`/saved`) | 400 kB |
| Every other page route | 450 kB |

The starting production audit measured roughly 510 kB for the feed, 488 kB for Browse, 568 kB for Discover, 595 kB for Remix, and 499 kB for Saved. These are the regression baseline, not accepted limits.

## Run the gate

```bash
npm run build
npm run test:performance
```

Use `npm run test:performance -- --json` for machine-readable evidence. `npm run test:performance:unit` checks the manifest parser without building the app. The production gate deliberately fails when `.next/BUILD_ID` is absent, so partial or development artifacts cannot be mistaken for a production result.

The checker reads `.next/app-build-manifest.json`, `.next/build-manifest.json`, and `.next/server/app-paths-manifest.json`. For each App Router page, it deduplicates the initial JavaScript assets listed by Next, gzips each at level 9, and sums the compressed bytes. Lazy dynamic-import chunks are not in the initial entry and remain deferred.

Budgets live in `scripts/performance-budgets.json`. The checker refuses policy values above the product goal. There are currently no exceptions. Any future exception must be for one exact built route and include all of the following in the policy:

- a measured temporary maximum;
- a specific reason with measured evidence;
- a specific deferred-loading strategy.

Stale or misspelled exceptions fail the gate. An exception should also be recorded here with the build measurement and removal plan before it is accepted.
