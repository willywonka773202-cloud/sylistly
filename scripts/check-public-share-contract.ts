import { readFileSync } from 'node:fs';
import clientCatalogData from '../data/client-catalog.json';
import { buildRetailerClickPath } from '../lib/retailer-attribution';
import { decodeCompleteLookSlug } from '../lib/share-code-contract';
import { encodeLookSlug, productShareCode } from '../lib/share-code-encode';
import { getStyleIdentityById } from '../lib/style-identity';
import type { Category, Product } from '../lib/types';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

function productIn(category: Category, offset = 0): Product {
  const matches = (clientCatalogData as Product[]).filter((product) => product.category === category);
  const product = matches[offset];
  if (!product) throw new Error(`Missing ${category} catalog fixture ${offset}`);
  return product;
}

const top = productIn('top');
const secondTop = productIn('top', 1);
const bottom = productIn('bottom');
const shoes = productIn('shoes');
const outer = productIn('outer');
const complete = { top, bottom, shoes } satisfies Partial<Record<Category, Product>>;
const completeSlug = encodeLookSlug(complete);
const productByCode = new Map((clientCatalogData as Product[]).map((product) => [productShareCode(product.id), product]));
const decode = (slug: string) => decodeCompleteLookSlug(slug, (code) => productByCode.get(code));
const decoded = completeSlug ? decode(completeSlug) : null;

check('complete top + bottom + shoes composition encodes', Boolean(completeSlug));
check('complete share slug decodes all required categories', Boolean(
  decoded?.top?.id === top.id
  && decoded.bottom?.id === bottom.id
  && decoded.shoes?.id === shoes.id,
));
check(
  'three-piece non-core composition is not shareable',
  encodeLookSlug({ top, outer, shoes }) === null,
);
check(
  'any device-only owned anchor withholds the entire share',
  encodeLookSlug({
    ...complete,
    bag: { ...top, id: 'owned-device-only', category: 'bag' },
  }) === null,
);
check(
  'unknown code fails closed instead of decoding a surviving subset',
  Boolean(completeSlug) && decode(`${completeSlug}.unknowncode`) === null,
);
check(
  'duplicate decoded categories fail closed',
  decode(`c-${[
    productShareCode(top.id),
    productShareCode(secondTop.id),
    productShareCode(bottom.id),
    productShareCode(shoes.id),
  ].join('.')}`) === null,
);

check('known identity resolves through own-property lookup', getStyleIdentityById('noir-edge')?.id === 'noir-edge');
check('Object.prototype identity ids do not resolve',
  getStyleIdentityById('toString') === null && getStyleIdentityById('__proto__') === null);

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
};
(globalThis as { window?: unknown }).window = {
  localStorage: memoryStorage(),
  sessionStorage: memoryStorage(),
};
const identifiedClick = new URL(buildRetailerClickPath({
  productId: top.id,
  lookId: 'public-look-test',
  surface: 'shared-look',
}), 'https://www.sylistly.com');
check('client-built public click includes anonymous identity', /^a_[a-zA-Z0-9]{8,64}$/.test(identifiedClick.searchParams.get('aid') || ''));
check('client-built public click includes session identity', /^s_[a-zA-Z0-9]{8,64}$/.test(identifiedClick.searchParams.get('sid') || ''));

const lookPage = readFileSync('app/look/[id]/page.tsx', 'utf8');
const stylePage = readFileSync('app/style/[id]/page.tsx', 'utf8');
const publicLink = readFileSync('components/PublicRetailerLink.tsx', 'utf8');
check('public look route declares its own canonical', lookPage.includes('alternates: { canonical: canonicalPath }'));
check('public style route declares its own canonical', stylePage.includes('alternates: { canonical: canonicalPath }'));
check('shared-look product links attach identity in a client event',
  lookPage.includes('<PublicRetailerLink')
  && publicLink.includes('buildRetailerClickPath')
  && publicLink.includes('onClick={attachClientIdentity}'));
check('style desktop columns fit the post-sidebar lg content width',
  stylePage.includes('lg:grid-cols-[minmax(250px,.72fr)_minmax(360px,1.28fr)]'));

console.log(`\nPublic share checks: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
