import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import {
  evaluateRouteBudgets,
  measureProductionRouteBundles,
  normalizeAppRoute,
  validateBudgetPolicy,
} from './check-route-bundles.mjs';

const validPolicy = {
  kilobyteBytes: 1000,
  defaultMaxKb: 450,
  routeMaxKb: {
    '/': 350,
    '/browse': 400,
    '/discover': 400,
    '/build': 400,
    '/saved': 400,
  },
  exceptions: {},
};

function makeProductionFixture() {
  const dist = mkdtempSync(join(tmpdir(), 'sylistly-route-bundles-'));
  mkdirSync(join(dist, 'server'), { recursive: true });
  mkdirSync(join(dist, 'static/chunks/app/browse'), { recursive: true });
  mkdirSync(join(dist, 'static/chunks/app'), { recursive: true });

  const runtime = Buffer.from('runtime();'.repeat(70));
  const feed = Buffer.from('feed();'.repeat(100));
  const browse = Buffer.from('browse();'.repeat(130));
  writeFileSync(join(dist, 'BUILD_ID'), 'fixture-build\n');
  writeFileSync(join(dist, 'static/chunks/runtime.js'), runtime);
  writeFileSync(join(dist, 'static/chunks/app/page.js'), feed);
  writeFileSync(join(dist, 'static/chunks/app/browse/page.js'), browse);
  writeFileSync(join(dist, 'build-manifest.json'), JSON.stringify({ pages: { '/_app': [] } }));
  writeFileSync(join(dist, 'app-build-manifest.json'), JSON.stringify({
    pages: {
      '/layout': ['static/chunks/runtime.js'],
      '/page': ['static/chunks/runtime.js', 'static/chunks/app/page.js'],
      '/browse/page': ['static/chunks/runtime.js', 'static/chunks/app/browse/page.js'],
      '/api/ping/route': ['static/chunks/runtime.js'],
    },
  }));
  writeFileSync(join(dist, 'server/app-paths-manifest.json'), JSON.stringify({
    '/page': 'app/page.js',
    '/browse/page': 'app/browse/page.js',
    '/api/ping/route': 'app/api/ping/route.js',
  }));

  return { dist, runtime, feed, browse };
}

test('normalizes App Router groups, parallel segments, and page leaves', () => {
  assert.equal(normalizeAppRoute('/page'), '/');
  assert.equal(normalizeAppRoute('/(shopping)/browse/page'), '/browse');
  assert.equal(normalizeAppRoute('/look/[id]/page'), '/look/[id]');
  assert.equal(normalizeAppRoute('/@modal/(.)look/[id]/page'), '/(.)look/[id]');
});

test('measures each distinct initial JS asset once per production route', () => {
  const fixture = makeProductionFixture();
  try {
    const report = measureProductionRouteBundles(fixture.dist);
    assert.equal(report.buildId, 'fixture-build');
    assert.deepEqual(report.routes.map(({ route }) => route), ['/', '/browse']);
    const feed = report.routes.find(({ route }) => route === '/');
    const browse = report.routes.find(({ route }) => route === '/browse');
    const runtimeGzip = gzipSync(fixture.runtime, { level: 9 }).byteLength;
    assert.equal(feed.gzipBytes, runtimeGzip + gzipSync(fixture.feed, { level: 9 }).byteLength);
    assert.equal(browse.gzipBytes, runtimeGzip + gzipSync(fixture.browse, { level: 9 }).byteLength);
    assert.equal(feed.assets.length, 2);
  } finally {
    rmSync(fixture.dist, { recursive: true, force: true });
  }
});

test('rejects dev or interrupted artifacts without a production BUILD_ID', () => {
  const fixture = makeProductionFixture();
  try {
    rmSync(join(fixture.dist, 'BUILD_ID'));
    assert.throws(() => measureProductionRouteBundles(fixture.dist), /No production BUILD_ID/);
  } finally {
    rmSync(fixture.dist, { recursive: true, force: true });
  }
});

test('enforces primary, named-route, and all-route ceilings', () => {
  const report = evaluateRouteBudgets({
    buildId: 'fixture',
    distPath: '/tmp/fixture',
    routes: [
      { route: '/', gzipBytes: 350_001, rawBytes: 0, assets: [] },
      { route: '/browse', gzipBytes: 400_000, rawBytes: 0, assets: [] },
      { route: '/privacy', gzipBytes: 450_001, rawBytes: 0, assets: [] },
    ],
  }, validPolicy);
  assert.equal(report.passed, false);
  assert.equal(report.routes.find(({ route }) => route === '/').passed, false);
  assert.equal(report.routes.find(({ route }) => route === '/browse').passed, true);
  assert.equal(report.routes.find(({ route }) => route === '/privacy').passed, false);
});

test('will not accept weakened policy or undocumented exceptions', () => {
  assert.throws(
    () => validateBudgetPolicy({ ...validPolicy, defaultMaxKb: 451 }),
    /cannot weaken the 450 kB all-route ceiling/,
  );
  assert.throws(
    () => validateBudgetPolicy({
      ...validPolicy,
      exceptions: { '/legacy': { maxKb: 470, reason: 'too large' } },
    }),
    /specific reason/,
  );
});
