# Wallet Connection — High-Fidelity Comps

This folder holds the Figma exports for the wallet connection and signing flow. Same
pattern as [`design/export-reporting/screens/`](../../export-reporting/screens/) and
[`design/iconography/screens/`](../../iconography/screens/).

## Required exports

Each of the **15 states** defined in [`../states.md`](../states.md) ships at three
viewports. A complete deliverable is **45 PNGs**.

### State list

| ID | File suffix |
| :- | :---------- |
| `S1` | `s1-detecting` |
| `S2` | `s2-not-installed` |
| `S3` | `s3-locked` |
| `S4` | `s4-connect-prompt` |
| `S5` | `s5-awaiting-connect` |
| `S6` | `s6-network-mismatch` |
| `S7` | `s7-sign-prompt` |
| `S8` | `s8-awaiting-signature` |
| `S9` | `s9-verifying` |
| `S10` | `s10-connected` |
| `E1` | `e1-rejected-connect` |
| `E2` | `e2-rejected-signature` |
| `E3` | `e3-timeout` |
| `E4` | `e4-extension-error` |
| `E5` | `e5-server-error` |

### Viewport prefixes

* `mobile-` — 360 px wide, 2× density (export at 720 px)
* `tablet-` — 768 px wide, 2× density (export at 1536 px)
* `desktop-` — 1280 px wide, 2× density (export at 2560 px)

### Naming convention

`<viewport>-<state-suffix>.png`

Examples:
* `mobile-s7-sign-prompt.png`
* `desktop-e5-server-error.png`
* `tablet-s2-not-installed.png`

### Optional: flow montage

A single `flow-overview.png` (desktop) showing all happy-path states (`S1 → S4 → S5 → S7 →
S8 → S9 → S10`) tiled left-to-right with arrows between. Useful for review meetings; not
required for handoff.

## Figma source

CommitLabs Design System → **Wallet Connection** page. Frame names mirror the file names
in this folder.

> Figma link will be added here once the page is published. Until then, see the in-repo
> design system reference at
> [`design/iconography/README.md`](../../iconography/README.md#figma-reference).

## Cross-referenced docs

* [`../README.md`](../README.md) — overall flow and principles
* [`../flow-diagram.md`](../flow-diagram.md) — entry points and state machine
* [`../states.md`](../states.md) — per-state visual + content specs
* [`../security-copy.md`](../security-copy.md) — copy bank and tone rules
* [`../errors-and-recovery.md`](../errors-and-recovery.md) — error taxonomy and recovery
* [`../accessibility.md`](../accessibility.md) — A11y QA list
