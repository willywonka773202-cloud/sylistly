import fs from 'node:fs';
import path from 'node:path';

type ImageUrlSource = 'merchantCdn' | 'googleThumbnailProxy' | 'searchIntent' | 'dataUrl' | 'invalid' | 'unknown';
type MergeStatus = 'liveMergeReady' | 'reviewOnly' | 'blocked';

// Define expected candidate type
interface Candidate {
  id: string;
  title: string;
  merchant: string;
  category: string;
  gender: string;
  vibeTags: string[];
  budgetTier: string;
  price?: number;
  imageUrl: string;
  productUrl: string;
  colorTags?: string[];
  seasonTags?: string[];
  fitNotes?: string;
  reasonForInclusion?: string;
  qualityScore?: number;
  possibleDuplicateRisk?: string;
  imageUrlStatus?: string;
  imageUrlNote?: string;
  imageUrlSource?: ImageUrlSource;
  mergeStatus?: MergeStatus;
  resolutionSource?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

interface Pack {
  packName: string;
  purpose: string;
  createdFor: string;
  doNotAutoMerge: boolean;
  candidates: Candidate[];
  packSummary: Record<string, unknown>;
}

const PACKS_DIR = path.join(process.cwd(), 'data/expansion-packs');

const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY;
const DRY_RUN = process.env.SEARCHAPI_DRY_RUN === 'true';
const MAX_QUERIES = parseInt(process.env.SEARCHAPI_MAX_QUERIES || '0', 10) || Infinity;

if (!SEARCHAPI_KEY && !DRY_RUN) {
  console.error('ERROR: SEARCHAPI_KEY environment variable is required unless SEARCHAPI_DRY_RUN=true.');
  process.exit(1);
}

function classifyImageUrl(url: string): ImageUrlSource {
  if (!url) return 'invalid';
  const normalized = url.trim().toLowerCase();
  if (normalized.startsWith('data:')) return 'dataUrl';
  if (
    normalized.includes('google.com/search')
    || normalized.includes('google.com/shopping')
    || normalized.includes('shopping.google')
    || normalized.includes('#oshopproduct')
  ) return 'searchIntent';
  if (normalized.includes('encrypted-tbn') || normalized.includes('gstatic.com') || normalized.includes('google.com')) return 'googleThumbnailProxy';
  if (normalized.startsWith('https://')) return 'merchantCdn';
  return 'invalid';
}

function classifyMergeStatus(candidate: Candidate, source: ImageUrlSource): MergeStatus {
  if (!candidate.productUrl) return 'blocked';
  
  const productUrlClass = classifyImageUrl(candidate.productUrl);
  if (productUrlClass === 'searchIntent') return 'blocked';
  
  if (!candidate.title || candidate.title.toLowerCase().includes('placeholder') || candidate.title.length < 3) {
    return 'blocked';
  }

  if (source === 'merchantCdn') return 'liveMergeReady';
  if (source === 'googleThumbnailProxy') return 'reviewOnly';

  return 'blocked';
}

function hasUsableImageUrl(url: string): boolean {
  const source = classifyImageUrl(url);
  return source === 'merchantCdn' || source === 'googleThumbnailProxy';
}

async function fetchGoogleShoppingImage(query: string): Promise<string | null> {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would search for: "${query}"`);
    return null;
  }

  const searchParams = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    api_key: SEARCHAPI_KEY || '',
    gl: 'us',
    hl: 'en',
  });

  try {
    const response = await fetch(`https://www.searchapi.io/api/v1/search?${searchParams.toString()}`);
    
    if (response.status === 401) {
      console.error('ERROR: Invalid SearchAPI key (401 Unauthorized).');
      process.exit(1);
    }
    
    if (response.status === 429) {
      console.error('ERROR: SearchAPI rate limit exceeded (429 Too Many Requests).');
      process.exit(1);
    }

    if (!response.ok) {
      console.warn(`  [WARN] API request failed with status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.shopping_results && data.shopping_results.length > 0) {
       for (const result of data.shopping_results) {
           if (hasUsableImageUrl(result.thumbnail)) {
                return result.thumbnail;
           }
       }
    }
    return null;
  } catch (error) {
    console.error(`  [ERROR] Request failed:`, error);
    return null;
  }
}

async function main() {
  console.log('--- Sylistly SearchAPI Image Resolver ---');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (!DRY_RUN && SEARCHAPI_KEY) {
    console.log(`API Key ending in: ...${SEARCHAPI_KEY.slice(-4)}`);
  }
  if (MAX_QUERIES !== Infinity) {
    console.log(`Max queries limit: ${MAX_QUERIES}`);
  }
  console.log('-----------------------------------------');

  const files = fs.readdirSync(PACKS_DIR).filter((f) => f.endsWith('.json') && f.startsWith('pack-'));
  
  let totalScanned = 0;
  let skippedValid = 0;
  let attempted = 0;
  let resolved = 0;
  let unresolved = 0;

  let resolvedMerchantCdn = 0;
  let resolvedGoogleThumbnail = 0;
  
  let liveMergeReadyCount = 0;
  let reviewOnlyCount = 0;
  let blockedCount = 0;

  const resultsByPack: Record<string, { total: number; valid: number; needsResolution: number }> = {};
  const resultsByCategory: Record<string, { total: number; valid: number; needsResolution: number }> = {};
  const resultsByMerchant: Record<string, { total: number; valid: number; needsResolution: number }> = {};
  const exampleMerchantCdn: Candidate[] = [];
  const exampleGoogleThumbnail: Candidate[] = [];
  const exampleBlocked: Candidate[] = [];

  for (const file of files) {
    const filePath = path.join(PACKS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    let pack: Pack;
    
    try {
      pack = JSON.parse(content);
    } catch (e) {
      console.warn(`Skipping ${file}: Invalid JSON.`);
      continue;
    }

    let packModified = false;
    console.log(`\nProcessing ${file}...`);
    
    const packKey = file.replace('.json', '');
    resultsByPack[packKey] = { total: 0, valid: 0, needsResolution: 0 };

    for (const candidate of pack.candidates) {
      totalScanned++;
      resultsByPack[packKey].total++;
      if (!resultsByCategory[candidate.category]) {
        resultsByCategory[candidate.category] = { total: 0, valid: 0, needsResolution: 0 };
      }
      resultsByCategory[candidate.category].total++;
      const merchantKey = candidate.merchant?.trim() || 'unknown';
      if (!resultsByMerchant[merchantKey]) {
        resultsByMerchant[merchantKey] = { total: 0, valid: 0, needsResolution: 0 };
      }
      resultsByMerchant[merchantKey].total++;

      let currentSource = classifyImageUrl(candidate.imageUrl);
      
      let willAttempt = false;
      if (candidate.imageUrlStatus === 'valid' && currentSource === 'merchantCdn') {
        skippedValid++;
        resultsByPack[packKey].valid++;
        resultsByCategory[candidate.category].valid++;
        resultsByMerchant[merchantKey].valid++;
      } else if (attempted >= MAX_QUERIES) {
        resultsByPack[packKey].needsResolution++;
        resultsByCategory[candidate.category].needsResolution++;
        resultsByMerchant[merchantKey].needsResolution++;
      } else {
        willAttempt = true;
        attempted++;
        resultsByPack[packKey].needsResolution++;
        resultsByCategory[candidate.category].needsResolution++;
        resultsByMerchant[merchantKey].needsResolution++;
      }

      if (willAttempt) {
        const query = `${candidate.merchant} ${candidate.title} ${candidate.category}`;
        console.log(`- Resolving [${candidate.id}]: ${query}`);

        if (!DRY_RUN) {
            await new Promise(r => setTimeout(r, 1000));
        }

        const newImageUrl = await fetchGoogleShoppingImage(query);

        if (newImageUrl) {
          console.log(`  -> RESOLVED: ${newImageUrl}`);
          currentSource = classifyImageUrl(newImageUrl);
          candidate.imageUrl = newImageUrl;
          candidate.imageUrlStatus = 'valid';
          candidate.resolutionSource = 'SearchAPI Google Shopping';
          candidate.resolvedAt = new Date().toISOString();
          
          if (currentSource === 'merchantCdn') {
             resolvedMerchantCdn++;
             candidate.resolutionNotes = 'Resolved to Merchant CDN.';
          } else {
             resolvedGoogleThumbnail++;
             candidate.resolutionNotes = 'Resolved to Google Thumbnail Proxy.';
          }
          
          delete candidate.imageUrlNote;
          resolved++;
          packModified = true;
        } else {
          console.log(`  -> FAILED to resolve image.`);
          candidate.imageUrlStatus = 'needsRealImage';
          candidate.imageUrlNote = 'SearchAPI resolution failed to find a valid direct image URL.';
          unresolved++;
          packModified = true;
        }
      }

      // Update classification fields
      candidate.imageUrlSource = currentSource;
      candidate.mergeStatus = classifyMergeStatus(candidate, currentSource);

      if (candidate.mergeStatus === 'liveMergeReady') {
        liveMergeReadyCount++;
        if (exampleMerchantCdn.length < 2) exampleMerchantCdn.push({...candidate});
      } else if (candidate.mergeStatus === 'reviewOnly') {
        reviewOnlyCount++;
        if (exampleGoogleThumbnail.length < 2) exampleGoogleThumbnail.push({...candidate});
      } else {
        blockedCount++;
        if (exampleBlocked.length < 2) exampleBlocked.push({...candidate});
      }
    }

    if (packModified && !DRY_RUN) {
      // Backup original
      fs.copyFileSync(filePath, `${filePath}.bak`);
      // Save updated pack
      fs.writeFileSync(filePath, JSON.stringify(pack, null, 2));
      console.log(`Saved updates to ${file}. Backup created as ${file}.bak`);
    }
  }

  const report = {
    totalScanned,
    skippedAlreadyValid: skippedValid,
    attemptedResolution: attempted,
    successfullyResolved: resolved,
    resolvedMerchantCdnImages: resolvedMerchantCdn,
    resolvedGoogleThumbnailProxyImages: resolvedGoogleThumbnail,
    unresolvedBlocked: unresolved,
    finalClassification: {
      liveMergeReadyCount,
      reviewOnlyCount,
      blockedCount
    },
    resultsByPack,
    resultsByCategory,
    resultsByMerchant,
    examples: {
      liveMergeReady: exampleMerchantCdn.slice(0, 2).map(c => ({ id: c.id, imageUrlSource: c.imageUrlSource, productUrl: c.productUrl })),
      reviewOnly: exampleGoogleThumbnail.slice(0, 2).map(c => ({ id: c.id, imageUrlSource: c.imageUrlSource, productUrl: c.productUrl })),
      blocked: exampleBlocked.slice(0, 2).map(c => ({ id: c.id, imageUrlSource: c.imageUrlSource, productUrl: c.productUrl }))
    }
  };

  const reportPath = path.join(PACKS_DIR, 'EXPANSION_PACK_IMAGE_RESOLUTION_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${reportPath}`);

  console.log('\n--- Final Summary ---');
  console.log(`Total scanned: ${totalScanned}`);
  console.log(`Skipped (already valid): ${skippedValid}`);
  console.log(`Attempted resolution: ${attempted}`);
  console.log(`Successfully resolved: ${resolved}`);
  console.log(`Unresolved: ${unresolved}`);
  console.log(`Live Merge Ready: ${liveMergeReadyCount}`);
  console.log(`Review Only: ${reviewOnlyCount}`);
  console.log(`Blocked: ${blockedCount}`);
  
  if (DRY_RUN) {
      console.log('\nThis was a DRY RUN. No pack files were modified and no real API calls were made.');
  } else {
      console.log('\nNOTE: Run `npm run typecheck` and `npm run qa` to ensure pack integrity.');
  }
}

main().catch(console.error);
