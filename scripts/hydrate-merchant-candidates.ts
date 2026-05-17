// Merchant candidate hydration - no SearchAPI calls.
//
// Reads candidate-only SearchAPI output and tries to find merchant product image
// URLs from already-discovered merchant/product pages. It never mutates the live
// catalog and never stores raw HTML.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

type ImageUrlType = 'merchantCdn' | 'merchantImage' | 'googleThumbnailProxy' | 'unsafe' | 'missing';
type HydrationStatus = 'hydrated' | 'noImageFound' | 'fetchFailed' | 'blocked' | 'timeout';
type CutoutReadiness = 'high' | 'medium' | 'low' | 'reviewOnly' | 'blocked';

interface CliFlags {
  input: string;
  limit: number;
  json: boolean;
  dryRun: boolean;
  timeoutMs: number;
}

interface SearchApiCandidate {
  id: string;
  title: string;
  brand?: string;
  retailer?: string;
  productUrl?: string;
  merchantUrl?: string;
  googleShoppingUrl?: string;
  targetCategory?: string;
  targetFrame?: string;
  targetVibe?: string;
  replacementProductId?: string;
  planType?: string;
  query?: string;
  linkType?: string;
}

interface HydratedCandidate {
  originalCandidateId: string;
  title: string;
  merchant: string;
  domain: string;
  productUrl: string;
  targetCategory: string;
  targetFrame: string;
  targetVibe: string;
  replacementProductId: string;
  extractedImageUrl: string;
  extractedImageSource: string;
  imageUrlType: ImageUrlType;
  hydrationStatus: HydrationStatus;
  cutoutReadiness: CutoutReadiness;
  qualityFlags: string[];
  httpStatus: number;
  error: string;
}

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, 'data', 'catalog', 'reports');
const CANDIDATE_DIR = join(ROOT, 'data', 'catalog', 'candidates');
const execFileAsync = promisify(execFile);

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = { input: '', limit: 5, json: false, dryRun: false, timeoutMs: 10000 };
  for (const arg of argv) {
    if (arg === '--json') flags.json = true;
    else if (arg === '--dry-run') flags.dryRun = true;
    else if (arg.startsWith('--input=')) flags.input = arg.slice('--input='.length);
    else if (arg.startsWith('--limit=')) {
      const n = Number.parseInt(arg.slice('--limit='.length), 10);
      if (Number.isFinite(n) && n > 0) flags.limit = Math.min(n, 200);
    } else if (arg.startsWith('--timeout-ms=')) {
      const n = Number.parseInt(arg.slice('--timeout-ms='.length), 10);
      if (Number.isFinite(n) && n >= 1000) flags.timeoutMs = Math.min(n, 30000);
    }
  }
  return flags;
}

function latestSearchApiCandidateFile(): string {
  if (!existsSync(CANDIDATE_DIR)) return '';
  const files = readdirSync(CANDIDATE_DIR)
    .filter((name) => /^searchapi-results-.+\.json$/.test(name))
    .map((name) => join(CANDIDATE_DIR, name))
    .sort((a, b) => basename(b).localeCompare(basename(a)));
  return files[0] || '';
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isSafeFetchUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  const host = safeHostname(url);
  if (!host) return false;
  const blockedHosts = ['google.', 'youtube.com', 'youtu.be', 'pinterest.', 'instagram.', 'facebook.', 'tiktok.', 'x.com', 'twitter.'];
  return !blockedHosts.some((blocked) => host.includes(blocked));
}

function isUnsafeImageUrl(url: string): boolean {
  const lowered = url.toLowerCase();
  return !/^https?:\/\//i.test(url)
    || lowered.startsWith('data:')
    || lowered.includes('${')
    || lowered.includes('%7b')
    || lowered.includes('%7d')
    || lowered.includes('placeholder')
    || lowered.includes('/logo')
    || lowered.includes('logo_')
    || lowered.endsWith('.svg')
    || lowered.includes('/svg');
}

function classifyImageUrl(url: string, pageUrl: string): ImageUrlType {
  if (!url) return 'missing';
  if (isUnsafeImageUrl(url)) return 'unsafe';
  const host = safeHostname(url);
  if (host.includes('googleusercontent.com') || host.includes('gstatic.com') || host.includes('encrypted-tbn')) {
    return 'googleThumbnailProxy';
  }
  const pageHost = safeHostname(pageUrl);
  return host === pageHost || host.endsWith(`.${pageHost}`) ? 'merchantImage' : 'merchantCdn';
}

function absoluteUrl(raw: string, pageUrl: string): string {
  const value = decodeHtml(raw.trim());
  if (!value) return '';
  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return '';
  }
}

function readAttr(tag: string, attr: string): string {
  const pattern = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i');
  return decodeHtml(tag.match(pattern)?.[1] || '');
}

function metaImage(html: string, pageUrl: string, names: string[], source: string): { url: string; source: string } | null {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metaTags) {
    const property = `${readAttr(tag, 'property')} ${readAttr(tag, 'name')} ${readAttr(tag, 'itemprop')}`.toLowerCase();
    if (!names.some((name) => property.includes(name))) continue;
    const content = readAttr(tag, 'content');
    const url = absoluteUrl(content, pageUrl);
    if (url) return { url, source };
  }
  return null;
}

function collectJsonLdImages(value: unknown, images: string[]): void {
  if (!value) return;
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) images.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdImages(item, images);
    return;
  }
  if (typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const type = String(record['@type'] || record.type || '').toLowerCase();
  if (type.includes('product')) {
    collectJsonLdImages(record.image, images);
    collectJsonLdImages(record.images, images);
    collectJsonLdImages(record.thumbnailUrl, images);
  }
  collectJsonLdImages(record['@graph'], images);
}

function jsonLdProductImage(html: string, pageUrl: string): { url: string; source: string } | null {
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scripts) {
    const body = decodeHtml(script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim());
    try {
      const parsed = JSON.parse(body);
      const images: string[] = [];
      collectJsonLdImages(parsed, images);
      const url = images.map((image) => absoluteUrl(image, pageUrl)).find(Boolean);
      if (url) return { url, source: 'jsonLdProductImage' };
    } catch {
      // Ignore malformed merchant JSON-LD.
    }
  }
  return null;
}

function schemaProductImage(html: string, pageUrl: string): { url: string; source: string } | null {
  const productSections = html.match(/<[^>]+itemtype=["'][^"']*schema\.org\/Product[^"']*["'][\s\S]*?(?:<\/div>|<\/section>|<\/main>)/gi) || [];
  for (const section of productSections) {
    const imageTag = section.match(/<[^>]+itemprop=["']image["'][^>]*>/i)?.[0] || '';
    const raw = readAttr(imageTag, 'content') || readAttr(imageTag, 'src') || readAttr(imageTag, 'data-src');
    const url = absoluteUrl(raw, pageUrl);
    if (url) return { url, source: 'schemaProductImage' };
  }
  return null;
}

function htmlProductImage(html: string, pageUrl: string, title: string): { url: string; source: string } | null {
  const titleWords = title.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3).slice(0, 6);
  const pageParts = pageUrl.toLowerCase().split(/[^a-z0-9]+/).filter((part) => /^[a-z]?\d{4,}[a-z0-9]*$/.test(part));
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  for (const tag of imgTags) {
    const alt = readAttr(tag, 'alt').toLowerCase();
    const className = readAttr(tag, 'class').toLowerCase();
    const srcset = readAttr(tag, 'srcset');
    const src = readAttr(tag, 'src') || readAttr(tag, 'data-src') || srcset.split(',').pop()?.trim().split(/\s+/)[0] || '';
    const signalText = `${alt} ${className}`;
    const looksProduct = signalText.includes('product') || titleWords.some((word) => signalText.includes(word));
    const url = absoluteUrl(src, pageUrl);
    if (looksProduct && url && classifyImageUrl(url, pageUrl) !== 'unsafe') {
      return { url, source: 'htmlProductImage' };
    }
  }
  const rawUrls = (html.match(/https?:\/\/[^"'<>\\\s]+(?:jpg|jpeg|png|webp)[^"'<>\\\s]*/gi) || [])
    .map((url) => absoluteUrl(url, pageUrl))
    .filter(Boolean)
    .filter((url) => classifyImageUrl(url, pageUrl) !== 'unsafe');
  const scored = rawUrls.map((url) => {
    const lowered = decodeHtml(url).toLowerCase();
    let score = 0;
    if (lowered.includes('master-catalog')) score += 40;
    if (lowered.includes('/products/') || lowered.includes('/product/') || lowered.includes('/images/')) score += 20;
    if (lowered.includes('/nav-') || lowered.includes('push-navigation') || lowered.includes('lookbook')) score -= 50;
    if (lowered.includes('logo')) score -= 100;
    for (const word of titleWords) if (lowered.includes(word)) score += 8;
    for (const part of pageParts) if (lowered.includes(part)) score += 60;
    return { url: decodeHtml(url), score };
  }).sort((a, b) => b.score - a.score);
  const best = scored.find((entry) => entry.score > 0);
  if (best) return { url: best.url, source: 'htmlProductImage' };
  return null;
}

function extractImage(html: string, pageUrl: string, title: string): { url: string; source: string } | null {
  return jsonLdProductImage(html, pageUrl)
    || schemaProductImage(html, pageUrl)
    || htmlProductImage(html, pageUrl, title)
    || metaImage(html, pageUrl, ['og:image'], 'og:image')
    || metaImage(html, pageUrl, ['twitter:image'], 'twitter:image');
}

function pickUrl(candidate: SearchApiCandidate): string {
  return candidate.productUrl || candidate.merchantUrl || '';
}

function candidatePriority(candidate: SearchApiCandidate): number {
  let score = 0;
  if (candidate.productUrl) score += 100;
  if (candidate.replacementProductId) score += 50;
  if (candidate.planType === 'existing-catalog-replacement') score += 25;
  if (candidate.planType === 'vibe-category-expansion') score += 10;
  if (safeHostname(pickUrl(candidate)).includes('youtube')) score -= 200;
  return score;
}

function loadCandidates(inputPath: string): SearchApiCandidate[] {
  const payload = JSON.parse(readFileSync(inputPath, 'utf8'));
  const candidates = Array.isArray(payload.candidates) ? payload.candidates as SearchApiCandidate[] : [];
  return candidates
    .filter((candidate) => candidate && pickUrl(candidate))
    .sort((a, b) => candidatePriority(b) - candidatePriority(a));
}

function classifyReadiness(imageType: ImageUrlType, status: HydrationStatus, candidate: SearchApiCandidate): CutoutReadiness {
  if (status !== 'hydrated' || imageType === 'unsafe' || imageType === 'missing' || imageType === 'googleThumbnailProxy') return 'blocked';
  if (candidate.productUrl && candidate.replacementProductId && (imageType === 'merchantCdn' || imageType === 'merchantImage')) return 'high';
  if (candidate.productUrl && (imageType === 'merchantCdn' || imageType === 'merchantImage')) return 'medium';
  return 'reviewOnly';
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown fetch error';
  const cause = error.cause as { code?: string; message?: string } | undefined;
  return cause?.code || cause?.message ? `${error.message}: ${cause.code || ''} ${cause.message || ''}`.trim() : error.message;
}

async function fetchHtmlWithPowerShell(url: string, timeoutMs: number): Promise<{ status: HydrationStatus; httpStatus: number; html: string; error: string }> {
  if (process.platform !== 'win32') {
    return { status: 'fetchFailed', httpStatus: 0, html: '', error: 'PowerShell fallback is only available on Windows' };
  }
  const command = [
    '$ProgressPreference="SilentlyContinue";',
    '$uri=$env:SYLISTLY_HYDRATE_URL;',
    '$timeout=[int]$env:SYLISTLY_HYDRATE_TIMEOUT;',
    '$r=Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec $timeout -MaximumRedirection 5;',
    'Write-Output ("__STATUS__" + $r.StatusCode);',
    'Write-Output ("__CONTENTTYPE__" + (($r.Headers["Content-Type"]) -join ";"));',
    'Write-Output "__HTML__";',
    'Write-Output $r.Content;',
  ].join(' ');
  try {
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      {
        timeout: timeoutMs + 5000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, SYLISTLY_HYDRATE_URL: url, SYLISTLY_HYDRATE_TIMEOUT: String(Math.ceil(timeoutMs / 1000)) },
      },
    );
    const status = Number.parseInt(stdout.match(/__STATUS__(\d+)/)?.[1] || '0', 10);
    const contentType = stdout.match(/__CONTENTTYPE__(.*)/)?.[1] || '';
    const html = stdout.slice(stdout.indexOf('__HTML__') + '__HTML__'.length).trim();
    if (!status || status >= 400) return { status: 'fetchFailed', httpStatus: status, html: '', error: `PowerShell HTTP ${status || 0}` };
    if (!contentType.toLowerCase().includes('text/html')) return { status: 'blocked', httpStatus: status, html: '', error: `Non-HTML content-type: ${contentType}` };
    return { status: 'hydrated', httpStatus: status, html, error: '' };
  } catch (error) {
    return { status: 'fetchFailed', httpStatus: 0, html: '', error: `PowerShell fallback failed: ${errorMessage(error)}` };
  }
}

async function fetchHtml(url: string, timeoutMs: number): Promise<{ status: HydrationStatus; httpStatus: number; html: string; error: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'SylistlyCatalogHydrator/1.0 (+candidate-review; no-cookies)',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) return { status: 'fetchFailed', httpStatus: response.status, html: '', error: `HTTP ${response.status}` };
    if (!contentType.includes('text/html')) return { status: 'blocked', httpStatus: response.status, html: '', error: `Non-HTML content-type: ${contentType}` };
    return { status: 'hydrated', httpStatus: response.status, html: await response.text(), error: '' };
  } catch (error) {
    const message = errorMessage(error);
    if (message.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE')) {
      const fallback = await fetchHtmlWithPowerShell(url, timeoutMs);
      if (fallback.status === 'hydrated') return fallback;
      return { ...fallback, error: `${message}; ${fallback.error}` };
    }
    return { status: message.toLowerCase().includes('abort') ? 'timeout' : 'fetchFailed', httpStatus: 0, html: '', error: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function hydrateCandidate(candidate: SearchApiCandidate, timeoutMs: number, dryRun: boolean): Promise<HydratedCandidate> {
  const url = pickUrl(candidate);
  const domain = safeHostname(url);
  const base: HydratedCandidate = {
    originalCandidateId: candidate.id,
    title: candidate.title || '',
    merchant: candidate.retailer || candidate.brand || domain,
    domain,
    productUrl: url,
    targetCategory: candidate.targetCategory || '',
    targetFrame: candidate.targetFrame || '',
    targetVibe: candidate.targetVibe || '',
    replacementProductId: candidate.replacementProductId || '',
    extractedImageUrl: '',
    extractedImageSource: '',
    imageUrlType: 'missing',
    hydrationStatus: 'blocked',
    cutoutReadiness: 'blocked',
    qualityFlags: [],
    httpStatus: 0,
    error: '',
  };

  if (!isSafeFetchUrl(url)) {
    return { ...base, hydrationStatus: 'blocked', error: 'URL is not safe for merchant hydration', qualityFlags: ['blocked-url'] };
  }
  if (dryRun) {
    return { ...base, hydrationStatus: 'blocked', error: 'dry-run: fetch skipped', qualityFlags: ['dry-run'] };
  }

  const fetched = await fetchHtml(url, timeoutMs);
  if (fetched.status !== 'hydrated') {
    return { ...base, hydrationStatus: fetched.status, httpStatus: fetched.httpStatus, error: fetched.error, qualityFlags: [fetched.status] };
  }

  const image = extractImage(fetched.html, url, candidate.title || '');
  if (!image?.url) {
    return { ...base, hydrationStatus: 'noImageFound', httpStatus: fetched.httpStatus, error: 'No product image metadata found', qualityFlags: ['missing-image'] };
  }

  const imageType = classifyImageUrl(image.url, url);
  const status: HydrationStatus = imageType === 'unsafe' ? 'blocked' : 'hydrated';
  const readiness = classifyReadiness(imageType, status, candidate);
  const flags = [
    image.source,
    imageType,
    candidate.productUrl ? 'direct-product-url' : 'merchant-url',
    candidate.replacementProductId ? 'existing-catalog-replacement' : '',
  ].filter(Boolean);

  return {
    ...base,
    extractedImageUrl: image.url,
    extractedImageSource: image.source,
    imageUrlType: imageType,
    hydrationStatus: status,
    cutoutReadiness: readiness,
    qualityFlags: flags,
    httpStatus: fetched.httpStatus,
  };
}

function countBy<T extends string>(items: HydratedCandidate[], key: (item: HydratedCandidate) => T): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const item of items) counts[key(item)] = (counts[key(item)] || 0) + 1;
  return counts;
}

function writeOutputs(inputPath: string, limit: number, items: HydratedCandidate[]) {
  mkdirSync(REPORT_DIR, { recursive: true });
  mkdirSync(CANDIDATE_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, 'Z');
  const hydratedFile = join(CANDIDATE_DIR, `merchant-hydrated-candidates-${stamp}.json`);
  const report = {
    generatedAt: new Date().toISOString(),
    input: inputPath,
    limit,
    attempted: items.length,
    hydratedCount: items.filter((item) => item.hydrationStatus === 'hydrated').length,
    merchantImageCount: items.filter((item) => item.imageUrlType === 'merchantCdn' || item.imageUrlType === 'merchantImage').length,
    highOrMediumCutoutReady: items.filter((item) => item.cutoutReadiness === 'high' || item.cutoutReadiness === 'medium').length,
    replacementCandidateCount: items.filter((item) => item.replacementProductId).length,
    statusCounts: countBy(items, (item) => item.hydrationStatus),
    imageUrlTypeCounts: countBy(items, (item) => item.imageUrlType),
    cutoutReadinessCounts: countBy(items, (item) => item.cutoutReadiness),
    outputFile: hydratedFile,
    notes: [
      'No SearchAPI calls are made by this script.',
      'No raw HTML is stored.',
      'Hydrated candidates are review-only until manually approved.',
    ],
    items,
  };
  writeFileSync(join(REPORT_DIR, 'merchant-hydration-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(hydratedFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const inputPath = flags.input || latestSearchApiCandidateFile();
  if (!inputPath || !existsSync(inputPath)) throw new Error(`Candidate input not found: ${inputPath || '(none)'}`);
  const candidates = loadCandidates(inputPath).slice(0, flags.limit);
  const items: HydratedCandidate[] = [];
  for (const candidate of candidates) {
    items.push(await hydrateCandidate(candidate, flags.timeoutMs, flags.dryRun));
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const report = writeOutputs(inputPath, flags.limit, items);
  if (flags.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log('Merchant Candidate Hydration');
    console.log('============================');
    console.log(`Input: ${inputPath}`);
    console.log(`Attempted: ${report.attempted}`);
    console.log(`Hydrated: ${report.hydratedCount}`);
    console.log(`Merchant/CDN images: ${report.merchantImageCount}`);
    console.log(`High/medium cutout-ready: ${report.highOrMediumCutoutReady}`);
    console.log(`Output: ${report.outputFile}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Merchant hydration failed');
  process.exit(1);
});
