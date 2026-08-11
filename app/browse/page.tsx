import { BrowseCatalog } from '@/components/BrowseCatalog';
import { buildCatalogFacets, getPublishedCatalogProducts } from '@/lib/catalog-query';

const INITIAL_PAGE_SIZE = 48;

export default function BrowsePage() {
  const products = getPublishedCatalogProducts();
  return (
    <BrowseCatalog
      initialProducts={products.slice(0, INITIAL_PAGE_SIZE)}
      initialTotal={products.length}
      facets={buildCatalogFacets(products)}
    />
  );
}
