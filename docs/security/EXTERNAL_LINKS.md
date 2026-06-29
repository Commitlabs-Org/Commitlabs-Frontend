# External Link & Subresource Security Policy

CommitLabs renders links to external sites (the Stellar block explorer, wallet,
social, and docs). Unsafe external links create two concrete risks:

- **Tab-nabbing** — a `target="_blank"` link without `rel="noopener"` gives the
  opened page access to `window.opener`, which it can use to redirect the
  original tab to a phishing page.
- **Referrer leakage / open redirect** — sending the full referrer to third
  parties, or building an explorer URL from unvalidated input that lets an
  attacker point the link at an arbitrary host.

This policy and its automated guards keep those closed.

## Rules

1. **Every `target="_blank"` anchor must carry `rel="noopener noreferrer"`.**
   This is enforced by lint (see [Lint guard](#lint-guard)) — it is not optional
   and not a matter of review vigilance.
2. **Build explorer links through the helper, never by hand.** Use
   [`buildExplorerUrl` / `openExplorerUrl`](../../src/utils/explorerLinks.ts);
   do not interpolate user/chain data into an explorer URL string. The helper
   validates the identifier and pins the host, so untrusted input cannot change
   where the link points.
3. **Programmatic opens use safe window features.** `openExplorerUrl` calls
   `window.open(url, '_blank', 'noopener,noreferrer')`.
4. **Only link to known hosts.** New external destinations should come from the
   allow-list below; adding a host is a deliberate change, reviewed as such.

## Allowed external hosts

| Host | Used for |
| ---- | -------- |
| `stellar.expert` | Block explorer (accounts, contracts, transactions, assets) — via `explorerLinks.ts` |
| `stellar.org` / `rpc-mainnet.stellar.org` | Stellar org pages and RPC |
| `www.freighter.app` | Freighter wallet install/help |
| `discord.gg` | Community / "Report issue" |
| `github.com` | Source repository |
| `twitter.com` | Social |
| `commitlabs.com` | First-party canonical/OG URLs |

Adding a host here should be paired with the reason and the component that uses
it.

## Lint guard

`react/jsx-no-target-blank` is enabled as an **error** in
[`.eslintrc.json`](../../.eslintrc.json):

```json
"react/jsx-no-target-blank": [
  "error",
  { "allowReferrer": false, "enforceDynamicLinks": "always", "warnOnSpreadAttributes": true }
]
```

This fails CI (`npm run lint`) on any `target="_blank"` anchor — including ones
with a dynamic `href` or a spread `{...props}` — that lacks
`rel="noopener noreferrer"`.

## The explorer link helper

[`src/utils/explorerLinks.ts`](../../src/utils/explorerLinks.ts) is the single
safe path for explorer links:

- validates the identifier against per-kind patterns (`account` `G…`,
  `contract` `C…`, `tx` 64-hex, `token`) and rejects anything that does not
  match — so a value cannot smuggle in a scheme, host, or path traversal;
- constructs the URL against a fixed `https://stellar.expert` origin, so the host
  can never be attacker-controlled;
- returns `null` for invalid input (`buildExplorerUrl`) / does nothing and
  returns `false` (`openExplorerUrl`), so callers fail closed.

## Adding a new external link safely

- **In JSX:** `<a href="…" target="_blank" rel="noopener noreferrer">`. The lint
  rule will reject it otherwise.
- **To the explorer:** call `buildExplorerUrl(kind, id, network)` /
  `openExplorerUrl(...)` — never hand-build the URL.
- **New host:** add it to [Allowed external hosts](#allowed-external-hosts) in
  the same PR.

## Testing

- [`src/utils/__tests__/explorerLinks.policy.test.ts`](../../src/utils/__tests__/explorerLinks.policy.test.ts)
  asserts the policy invariants: built URLs stay on the allow-listed host over
  `https`, malicious identifiers (other host/scheme, path traversal, embedded
  credentials, trailing junk) are rejected, and `openExplorerUrl` opens with
  `noopener,noreferrer` (and opens nothing for rejected input).
- [`src/utils/__tests__/explorerLinks.test.ts`](../../src/utils/__tests__/explorerLinks.test.ts)
  covers the functional behaviour.
