import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const manifestPath = path.resolve('.next/app-build-manifest.json');
const budgetPath = path.resolve('performance-budgets.json');
const outputDirectory = path.resolve('.next');
const FREIGHTER_MARKER = 'FREIGHTER_EXTERNAL_MSG_REQUEST';

export function getFirstLoadFiles(appManifest, route, buildManifest = appManifest) {
  const routeKey = route === '/' ? '/page' : `${route}/page`;
  const routeFiles = appManifest.pages?.[routeKey];
  if (!Array.isArray(buildManifest.rootMainFiles) || !Array.isArray(routeFiles)) {
    throw new Error(`Build manifest is missing the first-load assets for route "${route}".`);
  }

  return [
    ...new Set([...buildManifest.rootMainFiles, ...routeFiles].filter((file) => file.endsWith('.js'))),
  ];
}

export function measureGzipBytes(files, readAsset) {
  return files.reduce((total, file) => total + gzipSync(readAsset(file), { level: 9 }).byteLength, 0);
}

export function assertWithinBudget(route, actualBytes, maxBytes) {
  if (actualBytes > maxBytes) {
    throw new Error(
      `Route "${route}" first-load JavaScript is ${actualBytes} gzip bytes, over its ${maxBytes}-byte budget.`,
    );
  }
}

export function assertFreighterIsLazy(files, readAsset) {
  const includedFiles = files.filter((file) => readAsset(file).toString().includes(FREIGHTER_MARKER));
  if (includedFiles.length > 0) {
    throw new Error(
      `Freighter API is included in "/" first-load JavaScript: ${includedFiles.join(', ')}`,
    );
  }
}

function readBuildAsset(file) {
  const assetPath = path.resolve(outputDirectory, file);
  const relativePath = path.relative(outputDirectory, assetPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Build manifest contains an invalid asset path: "${file}".`);
  }
  if (!statSync(assetPath).isFile()) {
    throw new Error(`Build manifest asset is not a file: "${file}".`);
  }
  return readFileSync(assetPath);
}

function checkBudgets() {
  const appManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const buildManifest = JSON.parse(readFileSync(path.resolve('.next/build-manifest.json'), 'utf8'));
  const { routes } = JSON.parse(readFileSync(budgetPath, 'utf8'));
  let failed = false;

  for (const [route, budget] of Object.entries(routes)) {
    const files = getFirstLoadFiles(appManifest, route, buildManifest);
    const actualBytes = measureGzipBytes(files, readBuildAsset);
    try {
      assertWithinBudget(route, actualBytes, budget.maxBytes);
      console.log(
        `PASS ${route}: ${actualBytes} gzip bytes (budget ${budget.maxBytes}; baseline ${budget.baselineBytes})`,
      );
    } catch (error) {
      console.error(`FAIL ${error.message}`);
      failed = true;
    }

    if (route === '/') {
      try {
        assertFreighterIsLazy(files, readBuildAsset);
        console.log('PASS /: Freighter API is not in first-load JavaScript');
      } catch (error) {
        console.error(`FAIL ${error.message}`);
        failed = true;
      }
    }
  }

  if (failed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    checkBudgets();
  } catch (error) {
    console.error(`Bundle budget check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
