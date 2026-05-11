import { getCatalogStats } from '../lib/catalog-health';

const stats = getCatalogStats();
console.log(JSON.stringify(stats, null, 2));
