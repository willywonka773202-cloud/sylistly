import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Runs the generator variety simulation as a child process so the existing
// jiti toolchain resolves all internal `./` imports correctly, then parses
// the machine-readable SUMMARY_JSON line and fails on any regression of
// outfit-completeness invariants.
//
// Invariants enforced (any non-zero ⇒ fail):
//   - missingRequiredRuns
//   - missingTop / missingBottom / missingShoes
//   - genderMismatches
//   - offFrame
//   - vibeContradictions
//
// Soft floor:
//   - completionRateTopBottomShoes must be 1.0 (100%).

const ROOT = process.cwd();
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

interface Summary {
  totalOutfits: number;
  uniqueProducts: number;
  totalPicks: number;
  missingRequiredRuns: number;
  missingTop: number;
  missingBottom: number;
  missingShoes: number;
  completionRateTopBottomShoes: number;
  genderMismatches: number;
  categoryMismatches: number;
  offFrame: number;
  vibeContradictions: number;
}

const result = spawnSync(NPX, ['jiti', path.join('scripts', 'test-generator-variety.ts')], {
  cwd: ROOT,
  encoding: 'utf8',
  shell: true,
  stdio: 'pipe',
});

if (result.error) {
  console.error('Outfit completeness: harness spawn failed:', result.error.message);
  process.exit(1);
}

const output = `${result.stdout || ''}${result.stderr || ''}`;
const match = output.match(/SUMMARY_JSON:\s*(\{.*\})/);
if (!match) {
  console.error('Outfit completeness: SUMMARY_JSON line not found in generator output.');
  console.error('--- last 20 lines ---');
  console.error(output.split(/\r?\n/).slice(-20).join('\n'));
  process.exit(1);
}

let summary: Summary;
try {
  summary = JSON.parse(match[1]) as Summary;
} catch (error) {
  console.error('Outfit completeness: failed to parse SUMMARY_JSON:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const failures: string[] = [];

if (summary.missingRequiredRuns > 0) {
  failures.push(
    `missingRequiredRuns=${summary.missingRequiredRuns} (must be 0). Top:${summary.missingTop} Bottom:${summary.missingBottom} Shoes:${summary.missingShoes}`,
  );
}
if (summary.missingTop > 0) failures.push(`missingTop=${summary.missingTop} (must be 0)`);
if (summary.missingBottom > 0) failures.push(`missingBottom=${summary.missingBottom} (must be 0)`);
if (summary.missingShoes > 0) failures.push(`missingShoes=${summary.missingShoes} (must be 0)`);
if (summary.completionRateTopBottomShoes < 1) {
  failures.push(`completionRateTopBottomShoes=${(summary.completionRateTopBottomShoes * 100).toFixed(1)}% (must be 100%)`);
}
if (summary.genderMismatches > 0) failures.push(`genderMismatches=${summary.genderMismatches} (must be 0)`);
if (summary.offFrame > 0) failures.push(`offFrame=${summary.offFrame} (must be 0)`);
if (summary.vibeContradictions > 0) failures.push(`vibeContradictions=${summary.vibeContradictions} (must be 0)`);

if (failures.length) {
  console.error('Outfit completeness: FAILED');
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(`  raw summary: ${JSON.stringify(summary)}`);
  process.exit(1);
}

console.log(
  `Outfit completeness: PASS (${summary.totalOutfits} outfits, top+bottom+shoes 100% — missingTop=0 missingBottom=0 missingShoes=0 vibeContradictions=0 genderMismatches=0 offFrame=0).`,
);
