# Style what I own: product-URL flow

Sylistly Remix accepts an exact retailer product URL and builds a complete, buyable look around the verified piece. The result is stored locally in the current fit and Saved looks; the owned piece is locked while catalog-backed complements are composed around it.

## Resolution order

1. Canonicalize the HTTPS URL and remove known tracking parameters.
2. Match the exact URL against the published client catalog. A match is reused only while that row still has fresh positive availability evidence, then wrapped in a stable `owned-*` snapshot that retains the source catalog ID and evidence timestamp for audit.
3. For an unknown exact URL, allow a request only when its normalized host has at least one currently publishable Sylistly product. Host admission is reevaluated at request time instead of being frozen when a server instance starts.
4. Read JSON-LD `Product` data only. OpenGraph tags, page prose, CSS, scripts, and visual guesses are never treated as product facts.
5. Require one explicit supported category, brand, name, one unambiguous USD price, schema `InStock` availability, a matching canonical product URL, and a reachable structured image on an existing retailer/image host.
6. Mark every successful pasted item as a temporary verified-owned product, lock it, compose exact-linked catalog complements, enforce the current whole-look budget, and save the completed look on the device. The owned anchor remains visible but is omitted from purchase CTAs and checkout lists; only catalog-backed complements are sent through the attributed outbound route.

If any required fact cannot be verified, the API returns a specific rejection and the builder leaves the current outfit unchanged. It does not infer a missing field.

## Network safety

`POST /api/style-from-url` is Node-runtime only and uses these controls:

- HTTPS only; credentials and nonstandard ports are rejected.
- Product-page and image hosts are allowlisted from the published catalog; arbitrary hosts are never fetched.
- DNS is resolved before each request, every answer must be public, and the selected public address is pinned into the TLS request to limit DNS-rebinding exposure.
- Loopback, private, link-local, cloud-metadata, CGNAT, benchmark, documentation, multicast, reserved, IPv4-mapped IPv6, and local hostnames are rejected.
- Redirects are handled manually, revalidated at each hop, cycle-checked, and capped at two.
- Retailer HTML is limited to 512 KiB by default and must be HTML. Image verification checks an allowlisted endpoint and supported image content type without downloading the full image.
- Requests time out after 4.5 seconds by default, responses are `no-store`, request bodies are capped at 4 KiB, and the route applies a small per-instance rolling rate limit with a bounded identity table.

Optional server-only environment values:

```bash
STYLE_FROM_URL_TIMEOUT_MS=4500          # clamped to 1,000–10,000 ms
STYLE_FROM_URL_MAX_HTML_BYTES=524288    # clamped to 64 KiB–1 MiB
```

## Deliberate limitations

- Only retailers and image hosts already represented by published products are eligible. Supporting a new retailer begins in the catalog pipeline, not at this endpoint.
- Only unambiguous USD prices are accepted because the current builder presents dollar totals. Aggregate or variant-dependent prices are rejected when one exact price cannot be established.
- Only explicit schema `InStock` is accepted. A successful HTTP response is not stock proof.
- The merchant image is kept as a verified original for the local canvas; it is not mislabeled as a reviewed editorial cutout.
- Photo upload is not available. The existing stack has no dependable garment-recognition boundary, so the UI says product URLs only instead of pretending a photo was understood.
- Local state is device-specific until the user chooses a future cross-device account path.

## Verification

Run the focused policy/persistence checks with:

```bash
npm run test:style-owned
```

The checks cover URL canonicalization, exact-page discrimination, dangerous address ranges, conservative structured category/price/availability normalization, and the marker required for a verified owned item to survive local persistence.
