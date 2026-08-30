#!/usr/bin/env node

/**
 * Smoke Test Runner for Settle and Early Exit Endpoints
 *
 * This script runs the comprehensive smoke tests for the settle and early exit endpoints
 * and generates a coverage report to ensure the 95% coverage requirement is met.
 *
 * Usage:
 *   node scripts/run-smoke-tests.js
 *
 * Requirements:
 *   - Node.js installed
 *   - Dependencies installed (pnpm install)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Running Backend Smoke Tests for Settle and Early Exit Endpoints\n');

// Check if node_modules exists
if (!fs.existsSync(path.join(__dirname, '../node_modules'))) {
  console.log('❌ node_modules not found. Installing dependencies...');
  try {
    execSync('pnpm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('✅ Dependencies installed successfully\n');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

try {
  // Run the specific smoke tests
  console.log('🔍 Running settle and early exit endpoint tests...');
  execSync(
    'pnpm run test tests/api/settle.test.ts tests/api/settle-preview.test.ts tests/api/early-exit.test.ts tests/api/early-exit-preview.test.ts',
    { stdio: 'inherit', cwd: path.join(__dirname, '..') },
  );

  console.log('\n📊 Generating coverage report...');
  execSync(
    'pnpm run test:coverage tests/api/settle.test.ts tests/api/settle-preview.test.ts tests/api/early-exit.test.ts tests/api/early-exit-preview.test.ts',
    { stdio: 'inherit', cwd: path.join(__dirname, '..') },
  );

  console.log('\n✅ All smoke tests completed successfully!');
  console.log('📈 Coverage report generated in coverage/ directory');
  console.log('🔗 Open coverage/index.html in your browser to view detailed coverage');
} catch (error) {
  console.error('\n❌ Smoke tests failed:', error.message);
  console.log('\n🔧 Troubleshooting:');
  console.log('1. Ensure all dependencies are installed: pnpm install');
  console.log(
    '2. Check that the test files exist: tests/api/settle.test.ts, tests/api/settle-preview.test.ts, tests/api/early-exit.test.ts, tests/api/early-exit-preview.test.ts',
  );
  console.log('3. Verify all mocked dependencies are properly configured');
  console.log('4. Check for any TypeScript compilation errors');

  process.exit(1);
}
