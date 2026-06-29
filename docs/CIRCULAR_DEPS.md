# Circular Dependency Check (madge)

Circular imports cause subtle bugs — module-initialization order issues,
`undefined` values at import time, and harder tree-shaking/bundling. The
`src/lib/backend` graph and the many cross-imports across components make this
worth guarding.

The project uses [madge](https://github.com/pahen/madge) to detect import
cycles.

## Running it

```bash
npm run circular        # madge --circular --extensions ts,tsx src
npx madge --circular --image graph.svg --extensions ts,tsx src   # optional visual graph
```

## Configuration

[`.madgerc`](../.madgerc) makes madge resolve the project the way TypeScript does:

- **`tsConfig: tsconfig.json`** — so the `@/*` path alias (and other compiler
  options) resolve correctly.
- **`fileExtensions: ["ts", "tsx"]`** — analyse the TS/TSX sources.
- **`detectiveOptions.skipTypeImports: true`** — ignore `import type { … }`.
  Type-only imports are erased at compile time and cannot cause a runtime cycle,
  so counting them would produce false positives.

## This is a blocking gate

The codebase currently has **zero** circular dependencies, so
[`circular-deps.yml`](../../.github/workflows/circular-deps.yml) runs
`npm run circular` as a **required** check: any PR that introduces a new cycle
fails CI. There is no backlog to baseline.

## How to read and break a reported cycle

madge prints each cycle as a chain, e.g.:

```
1) lib/a.ts > lib/b.ts > lib/a.ts
```

meaning `a` imports `b` which imports `a` (directly or transitively). To break it:

1. **Extract the shared piece.** If `a` and `b` both need a type/constant/helper,
   move it to a third module (e.g. `lib/shared.ts`) that both import — neither
   imports the other.
2. **Invert the dependency.** Have the lower-level module accept what it needs as
   a parameter/callback instead of importing the higher-level one.
3. **Use `import type`** when the import is only for types — it's erased at
   compile time and won't form a runtime cycle (and madge ignores it here).
4. **Split the module** if it has grown to own two responsibilities that
   reference each other.

After refactoring, re-run `npm run circular` to confirm the cycle is gone.

## Generating a graph

For a hard-to-follow cycle, a visual can help (needs Graphviz installed):

```bash
npx madge --circular --image circular.svg --extensions ts,tsx src
```
