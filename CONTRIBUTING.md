# Contributing to CommitLabs

First off, thank you for considering contributing to CommitLabs! It's people like you that make this tool great.

Before diving into the code, please read through our [Developer Guide](./DEVELOPER_GUIDE.md) for comprehensive instructions on local setup, coding standards, and system architecture.

## Branching
1. Fork the repository and clone it locally.
2. Ensure your fork is synced with the upstream `master` branch.
3. Create a feature branch off of `master` using standard prefixes: `feat/<description>`, `fix/<description>`, `docs/<description>`, or `test/<description>`.

## Editor Configuration
This repository ships an [`.editorconfig`](./.editorconfig) at the root to keep whitespace, charset, and line endings consistent across editors. Most editors support it natively or via a plugin. It enforces UTF-8, LF line endings, 2-space indentation, a final newline, and trailing-whitespace trimming (Markdown excepted, so hard line breaks are preserved). These rules are aligned with the ESLint config to avoid formatting-only diffs.

## Toolchain
This project pins its toolchain so contributors and CI run a consistent environment:

- **Node.js**: version `20` (see [`.nvmrc`](./.nvmrc); run `nvm use` to switch). The `engines` field in `package.json` enforces `>=20 <21`.
- **Package manager**: `pnpm@9` (declared via `packageManager` and `engines.pnpm`).

`engine-strict=true` is set in `.npmrc`, so installs fail fast on an unsupported Node or pnpm version rather than producing subtle errors later.

## Pull Request Flow
1. Commit your changes logically and with clear, descriptive commit messages.
2. Push your feature branch to your fork.
3. Open a Pull Request (PR) against the `master` branch of the upstream repository.
4. Provide a clear PR description explaining the context, what was changed, and how to verify it.
5. Wait for a review from the maintainers and address any feedback promptly.

## Test and Coverage Expectations
- All new features and bug fixes must be accompanied by appropriate tests (Vitest).
- We require a **minimum of 95% test coverage** on any new or changed logic.
- Before opening your PR, run tests and check coverage locally using `npm run test:coverage` (or `pnpm test:coverage`).
- The build, tests, and linters must pass in CI before the PR can be merged.

## 96-Hour Timeframe Convention
To keep the momentum of the project moving, we enforce a **96-hour timeframe convention**:
- Once an issue is assigned to you, you are expected to submit a draft or open a PR within 96 hours.
- If you receive feedback on your PR, please address it within 96 hours.
- If there is no activity or communication within this window, the issue may be reassigned to another contributor.
