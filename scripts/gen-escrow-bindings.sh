#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTRACTS_DIR="${REPO_ROOT}/contracts"
OUTPUT_DIR="${REPO_ROOT}/packages/escrow-client"

STELLAR_CMD="${STELLAR_CMD:-stellar}"

echo "Building Soroban smart contracts..."
(cd "${CONTRACTS_DIR}" && ${STELLAR_CMD} contract build)

WASM_FILE="${CONTRACTS_DIR}/target/wasm32v1-none/release/commitlabs_escrow.wasm"
if [ ! -f "${WASM_FILE}" ]; then
  WASM_FILE="${CONTRACTS_DIR}/target/wasm32-unknown-unknown/release/commitlabs_escrow.wasm"
fi

if [ ! -f "${WASM_FILE}" ]; then
  WASM_FILE="$(find "${CONTRACTS_DIR}/target" -name "commitlabs_escrow.wasm" ! -path "*/deps/*" 2>/dev/null | head -n 1 || true)"
fi

if [ -z "${WASM_FILE}" ] || [ ! -f "${WASM_FILE}" ]; then
  echo "Error: Could not find compiled commitlabs_escrow.wasm in ${CONTRACTS_DIR}/target" >&2
  exit 1
fi

echo "Found WASM at: ${WASM_FILE}"
echo "Generating TypeScript bindings into: ${OUTPUT_DIR}"

${STELLAR_CMD} contract bindings typescript \
  --wasm "${WASM_FILE}" \
  --output-dir "${OUTPUT_DIR}" \
  --overwrite

echo "Bindings generation complete."
