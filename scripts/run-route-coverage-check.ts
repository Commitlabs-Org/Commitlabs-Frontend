import { join, resolve } from 'node:path';
import { checkRouteCoverage, formatUndocumentedReport } from './routeCoverage';

const ROOT = resolve(__dirname, '..');
const apiRoot = join(ROOT, 'src/app/api');
const openApiPath = join(ROOT, 'openapi.yaml');

const { undocumented } = checkRouteCoverage(apiRoot, openApiPath);

console.log(formatUndocumentedReport(undocumented));

if (undocumented.length > 0) {
  process.exit(1);
}
