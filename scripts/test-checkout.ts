import { isExactProductUrl } from '../lib/checkout.ts';

function test() {
  const cases = [
    // Happy paths
    { url: 'https://example.com/product/123', expected: true },
    { url: 'https://www.retailer.com/item/abc-def', expected: true },

    // Pathname checks
    { url: 'https://example.com/', expected: false },
    { url: 'https://example.com/search', expected: false },
    { url: 'https://example.com/SEARCH', expected: false },
    { url: 'https://example.com/s/query', expected: false },
    { url: 'https://example.com/some-search-result', expected: false },

    // Search params checks
    { url: 'https://example.com/product?q=test', expected: false },
    { url: 'https://example.com/product?query=test', expected: false },
    { url: 'https://example.com/product?search=test', expected: false },
    { url: 'https://example.com/product?searchTerm=test', expected: false },
    { url: 'https://example.com/product?text=test', expected: false },
    { url: 'https://example.com/product?keyword=test', expected: false },

    // Invalid URL (triggers catch block)
    { url: 'not a url', expected: false },
    { url: '', expected: false },
  ];

  let failedCount = 0;
  for (const { url, expected } of cases) {
    const result = isExactProductUrl(url);
    if (result !== expected) {
      console.error(`FAIL: isExactProductUrl("${url}") expected ${expected}, but got ${result}`);
      failedCount++;
    } else {
      console.log(`PASS: isExactProductUrl("${url}") === ${expected}`);
    }
  }

  if (failedCount > 0) {
    console.error(`\nTest failed: ${failedCount} case(s) failed.`);
    process.exit(1);
  } else {
    console.log('\nAll tests passed!');
  }
}

test();
