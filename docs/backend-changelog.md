# Backend API Changelog

This document tracks **breaking backend API changes** that may impact this frontend. Keep entries brief, actionable, and linked to implementation artifacts.

## Purpose

- Provide a single source of truth for backend API breaking changes.
- Help frontend engineers plan migrations before backend deploys.
- Record rollout status and required frontend action.

## When to Add an Entry

Add an entry when any backend change can break existing clients, including:

- Endpoint path or HTTP method changes.
- Required request field changes (rename, type change, removal).
- Response contract changes (field removal/rename/type change).
- Auth, permission, or signature requirements that invalidate prior calls.
- Error code/shape changes relied on by clients.

## Process (Lightweight)

1. Open a changelog entry **in the same PR** as the backend breaking change.
2. Mark `Status` as `Planned`, then update to `Released` when deployed.
3. Link migration notes and owning team.
4. Frontend owner updates `Frontend Impact` and marks `Frontend Ready`.

## Entry Template

Copy this block for each new change:

```md
## YYYY-MM-DD — <Short Change Title>

- **Status:** Planned | Released | Rolled Back
- **Effective Date:** YYYY-MM-DD
- **API Surface:** <endpoint(s) / webhook(s) / contract area>
- **Change Type:** Breaking
- **Owner:** <team/person>
- **Tracking:** <PR/issue/incident link>

### What Changed

- <concise list of contract-level changes>

### Frontend Impact

- <what breaks and where in frontend>

### Required Frontend Action

- [ ] <migration step 1>
- [ ] <migration step 2>

### Migration Notes

- <request/response before/after summary>
- <fallback/rollout notes if any>
```

---

## 2026-02-25 — Backend API changelog process introduced

- **Status:** Released
- **Effective Date:** 2026-02-25
- **API Surface:** Process / Documentation
- **Change Type:** Breaking-change governance
- **Owner:** Frontend + Backend maintainers
- **Tracking:** docs/backend-changelog.md

### What Changed

- Added a dedicated process for recording backend API breaking changes.
- Standardized a single entry template for migration planning.

### Frontend Impact

- None to runtime behavior.
- Future breaking backend updates now require this document to be updated.

### Required Frontend Action

- [x] Add changelog process documentation.
- [ ] Enforce changelog updates in backend PR template (follow-up).

### Migration Notes

- This is a non-runtime governance entry that establishes the baseline process.

## 2026-02-25 — Initial baseline: no pending breaking backend changes

- **Status:** Released
- **Effective Date:** 2026-02-25
- **API Surface:** Existing documented frontend-consumed APIs
- **Change Type:** Baseline
- **Owner:** Frontend + Backend maintainers
- **Tracking:** docs/backend-changelog.md

### What Changed

- Recorded the starting point for changelog adoption.

### Frontend Impact

- No known pending breaking changes at the time of baseline creation.

### Required Frontend Action

- [x] Use this baseline as reference for all future breaking-change entries.

### Migration Notes

- First true backend contract break after this date must be added as a new dated entry.
