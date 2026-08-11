/**
 * Heavy, interaction-only catalog engine for the Remix route.
 *
 * This boundary intentionally owns both generated JSON imports. Consumers must
 * load it with `import()` so neither the catalog nor the outfit library enters
 * the Build route's First Load JS.
 */
export {
  buildCatalogLook,
  getClientCatalogProducts,
  hydrateItemsFromCatalog,
} from '@/lib/client-catalog';
export { getLibraryLook } from '@/lib/outfit-library';
