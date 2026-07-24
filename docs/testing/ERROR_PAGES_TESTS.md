# Error Pages Test Coverage

## Overview
This document summarizes the test coverage for the application's error pages, located at:
- `src/app/error.tsx`
- `src/app/not-found.tsx`
- `src/app/network-error/page.tsx`
- `src/app/transaction-error/page.tsx`

## Test Files
All tests are written with **Vitest** and **React Testing Library (RTL)**.

---

## Page-by-Page Coverage

### 1. `src/app/error.tsx` (500 Internal Server Error)
**Test file**: `src/app/error.test.tsx`

Coverage includes:
- Renders 500 code, heading, and description
- Displays error message and digest
- Shows fallback when error.message is empty
- Fires reset callback when "Try Again" button is clicked
- Validates "Go Home" link points to `/`
- Validates "Report Issue" link points to external URL

### 2. `src/app/not-found.tsx` (404 Not Found)
**Test file**: `src/app/not-found.test.tsx`

Coverage includes:
- Renders 404 code, heading, and description
- Displays search input
- Validates "Go Home" link points to `/`
- Calls `router.back()` when "Go Back" button is clicked

### 3. `src/app/network-error/page.tsx` (Connection Error)
**Test file**: `src/app/network-error/page.test.tsx`

Coverage includes:
- Renders basic page elements
- Displays list of troubleshooting steps
- Shows correct initial status
- Validates "Go Home" link points to `/`
- Toggles retry state when Retry is clicked
- Reloads page on successful connection
- Resets retry state on connection failure

### 4. `src/app/transaction-error/page.tsx` (Transaction Error)
**Test file**: `src/app/transaction-error/page.test.tsx`

Coverage includes:
- Handles all error categories: rejected, timed-out, failed
- Maps error codes to correct categories
- Displays custom messages from `message` param
- Shows transaction hash with copy button
- Shows error code from `code` param
- Displays explorer link when hash is provided
- Calls `router.back()` when "Try Again" button is clicked
- Validates "Go to Dashboard" link points to `/commitments/overview`
- Shows category-specific tips

---

## Accessibility
All tests validate accessible:
- Headings with proper role and name
- Buttons with descriptive aria labels
- Links with correct href attributes
- Interactive elements (buttons, links, inputs)

## Running Tests

To run all error page tests:
```bash
pnpm test
```

To run a specific error page test:
```bash
pnpm test src/app/error.test.tsx
```
