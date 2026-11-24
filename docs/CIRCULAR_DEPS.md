# Circular Dependency Checks

CommitLabs Frontend enforces a **zero circular dependency** policy under `src/`. Any new import cycle fails the CI gate in [`.github/workflows/circular-deps.yml`](../.github/workflows/circular-deps.yml).

## What the Check Runs

Run the check locally with:

```bash
npm run circular
```

This executes the `circular` script in [`package.json`](../package.json):

```bash
madge --circular --extensions ts,tsx src
```

`madge` builds the static module dependency graph for all `.ts` and `.tsx` files under `src/` and exits with a non-zero status code if any cycle is detected.

## Reading the Output

When the codebase is clean, `madge` prints:

```text
No circular dependency found!
```

When a cycle exists, `madge` lists each cycle as a numbered chain of relative paths from `src/`:

```text
Found 1 circular dependency!

1) lib/foo.ts > lib/bar.ts
```

This means `src/lib/foo.ts` imports `src/lib/bar.ts`, which (directly or transitively) imports `src/lib/foo.ts` back. Longer cycles appear as `a.ts > b.ts > c.ts`, where `c.ts` imports `a.ts`.

## How to Break a Cycle

1. **Extract shared types, constants, or pure helpers into a leaf module.**
   If `a.ts` and `b.ts` only depend on each other for shared interfaces, enums, or constants, move those declarations into a third module (for example, `src/lib/soroban/dispute.ts` holds shared dispute types/constants separately from `src/lib/soroban/escrow.ts`) that neither depends on the other.
2. **Invert the dependency.**
   Pass callbacks, functions, or data as parameters instead of importing the caller back from a lower-level module.
3. **Avoid importing through barrel files (`index.ts`) across sibling modules.**
   Importing from `./index` inside a directory that `index.ts` re-exports is a common source of accidental cycles; import directly from the specific module instead.

After refactoring, re-run `npm run circular` and `npm run typecheck` to confirm the cycle is resolved and types remain valid.
