/**
 * Commitlint configuration enforcing Conventional Commits.
 * See docs/COMMIT_CONVENTION.md for accepted types and scopes.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allowed commit types (scope is optional).
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    // Keep the subject readable; do not block long bodies.
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [0, 'always', Infinity],
  },
  // Allow merge/revert commits and dependabot to bypass the rules.
  ignores: [
    (message) => /^Merge /.test(message),
    (message) => /^Revert /.test(message),
  ],
};
