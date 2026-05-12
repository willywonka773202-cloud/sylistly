import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

type Check = {
  name: string;
  passed: boolean;
  detail?: string;
};

const ROOT = process.cwd();
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const RUNTIME_DIRS = ['app', 'components', 'lib', 'store', 'scripts'];
const ROUTE_FILES = [
  'app/page.tsx',
  'app/feed/page.tsx',
  'app/build/page.tsx',
  'app/wardrobe/page.tsx',
  'app/discover/page.tsx',
  'app/profile/page.tsx',
  'app/saved/page.tsx',
  'app/try-on/page.tsx',
  'app/checkout/page.tsx',
];
const REQUIRED_SCRIPTS = ['catalog:health', 'catalog:test-generator', 'import:catalog', 'qa'];
const DANGEROUS_PATTERNS: Array<{ label: string; pattern: RegExp; allow?: (file: string, line: string) => boolean }> = [
  { label: 'broken template string', pattern: /return\s+\$\$\{/ },
  { label: 'invalid currentItems spread', pattern: /\.\.\.currentItems:\s*lockedItems/ },
  {
    label: 'fake product label',
    pattern: /\bProduct A\b|\bSample Item\b|\bPlaceholder Top\b|\bPlaceholder Shoes\b|placeholder product/i,
    allow: (file) =>
      file.endsWith('scripts\\qa-check.ts')
      || file.endsWith('scripts/qa-check.ts')
      || file.endsWith('lib\\product-image-quality.ts')
      || file.endsWith('lib/product-image-quality.ts'),
  },
  {
    label: 'placeholder SearchAPI key in runtime',
    pattern: /your_key_here/,
    allow: (file) => file.endsWith('.env.example') || file.endsWith('scripts\\qa-check.ts') || file.endsWith('scripts/qa-check.ts'),
  },
  { label: 'black letter product fallback', pattern: /bg-black\s+text-white/ },
  {
    label: 'fallback initial variable',
    pattern: /fallbackInitial/,
    allow: (file) => file.endsWith('scripts\\qa-check.ts') || file.endsWith('scripts/qa-check.ts'),
  },
];

function run(command: string, args: string[]): Check {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    stdio: 'pipe',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}${result.error ? `\n${result.error.message}` : ''}`.trim();
  return {
    name: `${command} ${args.join(' ')}`,
    passed: result.status === 0,
    detail: output.split(/\r?\n/).slice(-8).join('\n'),
  };
}

function walk(dir: string): string[] {
  const absolute = path.join(ROOT, dir);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).flatMap((entry) => {
    const file = path.join(absolute, entry);
    const stat = statSync(file);
    if (stat.isDirectory()) {
      if (['node_modules', '.next', '.git'].includes(entry)) return [];
      return walk(path.relative(ROOT, file));
    }
    if (!/\.(ts|tsx|js|jsx|mts|mjs)$/.test(file)) return [];
    return [file];
  });
}

function scanDangerousStrings(): Check {
  const hits: string[] = [];
  for (const file of RUNTIME_DIRS.flatMap(walk)) {
    const relative = path.relative(ROOT, file);
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of DANGEROUS_PATTERNS) {
        if (!rule.pattern.test(line)) continue;
        if (rule.allow?.(relative, line)) continue;
        hits.push(`${relative}:${index + 1} ${rule.label}`);
      }
    });
  }

  return {
    name: 'dangerous runtime string scan',
    passed: hits.length === 0,
    detail: hits.slice(0, 20).join('\n') || 'no dangerous runtime strings found',
  };
}

function checkRouteFiles(): Check {
  const missing = ROUTE_FILES.filter((file) => !existsSync(path.join(ROOT, file)));
  return {
    name: 'route file existence',
    passed: missing.length === 0,
    detail: missing.length ? `Missing: ${missing.join(', ')}` : `${ROUTE_FILES.length} route files present`,
  };
}

function checkPackageScripts(): Check {
  const packageJson = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
  const missing = REQUIRED_SCRIPTS.filter((script) => !packageJson.scripts?.[script]);
  return {
    name: 'package script existence',
    passed: missing.length === 0,
    detail: missing.length ? `Missing scripts: ${missing.join(', ')}` : `${REQUIRED_SCRIPTS.join(', ')} present`,
  };
}

function main() {
  const checks: Check[] = [
    run(NPM, ['run', 'typecheck']),
    run(NPM, ['run', 'catalog:health']),
    run(NPM, ['run', 'catalog:test-generator']),
    scanDangerousStrings(),
    checkRouteFiles(),
    checkPackageScripts(),
  ];

  for (const check of checks) {
    console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}`);
    if (check.detail) console.log(check.detail);
    console.log('');
  }

  const failed = checks.filter((check) => !check.passed);
  console.log(`QA summary: ${checks.length - failed.length}/${checks.length} checks passed.`);
  if (failed.length) process.exitCode = 1;
}

main();
