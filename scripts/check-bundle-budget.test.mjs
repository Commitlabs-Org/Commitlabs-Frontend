import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFreighterIsLazy,
  assertWithinBudget,
  getFirstLoadFiles,
  measureGzipBytes,
} from './check-bundle-budget.mjs';

const manifest = {
  rootMainFiles: ['static/chunks/shared.js', 'static/chunks/runtime.js'],
  pages: {
    '/page': ['static/chunks/shared.js', 'static/chunks/home.js'],
    '/create/page': ['static/chunks/shared.js', 'static/chunks/create.js'],
  },
};

const assets = new Map([
  ['static/chunks/shared.js', Buffer.from('shared JavaScript')],
  ['static/chunks/runtime.js', Buffer.from('runtime JavaScript')],
  ['static/chunks/home.js', Buffer.from('home route JavaScript')],
  ['static/chunks/create.js', Buffer.from('create route JavaScript')],
]);

test('passes when route first-load JavaScript is within budget', () => {
  const files = getFirstLoadFiles(manifest, '/');
  const actualBytes = measureGzipBytes(files, (file) => assets.get(file));

  assert.doesNotThrow(() => assertWithinBudget('/', actualBytes, actualBytes));
  assert.deepEqual(files, [
    'static/chunks/shared.js',
    'static/chunks/runtime.js',
    'static/chunks/home.js',
  ]);
});

test('fails when route first-load JavaScript exceeds its budget', () => {
  const files = getFirstLoadFiles(manifest, '/create');
  const actualBytes = measureGzipBytes(files, (file) => assets.get(file));

  assert.throws(
    () => assertWithinBudget('/create', actualBytes, actualBytes - 1),
    /over its .*byte budget/,
  );
});

test('fails when the build manifest does not contain a configured route', () => {
  assert.throws(
    () => getFirstLoadFiles(manifest, '/dashboard'),
    /missing the first-load assets/,
  );
});

test('detects Freighter API markers in first-load assets', () => {
  assert.throws(
    () =>
      assertFreighterIsLazy(
        ['static/chunks/freighter.js'],
        () => Buffer.from('FREIGHTER_EXTERNAL_MSG_REQUEST'),
      ),
    /Freighter API is included in "\/" first-load JavaScript/,
  );
});