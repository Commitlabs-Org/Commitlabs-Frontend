#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Checking API route coverage against openapi.yaml..."

npx tsx scripts/run-route-coverage-check.ts
