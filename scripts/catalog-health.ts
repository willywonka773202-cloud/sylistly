import { getCatalogStats } from '../lib/catalog-health';
import { ALL_CATALOG_PRODUCTS } from '../lib/catalog';
import { isRenderableProduct, productImageQualityScore } from '../lib/product-image-quality';

const stats = getCatalogStats();
console.log('Catalog Health Report');
console.log('=====================');
console.log(JSON.stringify(stats, null, 2));

if (stats.unrenderable > 0) {
  console.log('\nUnrenderable Products (Broken/Blocked Images or Bad Data):');
  const unrenderable = ALL_CATALOG_PRODUCTS.filter((p) => {
    const ok: boolean = isRenderableProduct(p);
    return !ok;
  });
  unrenderable.slice(0, 20).forEach((p: any) => {
    console.log(`- [${p.id}] ${p.brand} ${p.name} (Score: ${productImageQualityScore(p)})`);
    if (!p.imageUrl) console.log('  Reason: Missing imageUrl');
    if (p.brand === 'Sylistly') console.log('  Reason: Internal brand name');
  });
  if (unrenderable.length > 20) console.log(`... and ${unrenderable.length - 20} more.`);
}
