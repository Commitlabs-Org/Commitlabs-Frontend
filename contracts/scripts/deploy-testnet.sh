#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${CONTRACTS_DIR}/.." && pwd)"

MANIFEST_PATH="${COMMITLABS_CONTRACT_MANIFEST:-${CONTRACTS_DIR}/Cargo.toml}"
ENV_FILE="${COMMITLABS_ENV_FILE:-${REPO_ROOT}/.env.local}"
CONTRACT_PACKAGE="${COMMITLABS_CONTRACT_PACKAGE:-}"
WASM_OVERRIDE="${COMMITLABS_WASM_PATH:-}"
CONTRACT_ALIAS="${COMMITLABS_CONTRACT_ALIAS:-}"
DRY_RUN="${DRY_RUN:-0}"

STELLAR_RPC_URL="${STELLAR_RPC_URL:-https://soroban-testnet.stellar.org:443}"
STELLAR_NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
DRY_RUN_CONTRACT_ID="${DRY_RUN_CONTRACT_ID:-CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4}"

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

require_env() {
  local key="$1"
  if [[ -z "${!key:-}" ]]; then
    fail "Required environment variable ${key} is not set."
  fi
}

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    fail "Required command '${command_name}' is not available on PATH."
  fi
}

validate_stellar_address() {
  local value="$1"
  local label="$2"
  if [[ ! "${value}" =~ ^G[A-Z2-7]{55}$ ]]; then
    fail "${label} must be a Stellar public key starting with G."
  fi
}

validate_contract_id() {
  local value="$1"
  local label="$2"
  if [[ ! "${value}" =~ ^C[A-Z2-7]{55}$ ]]; then
    fail "${label} must be a Soroban contract id starting with C."
  fi
}

upsert_env_var() {
  local key="$1"
  local value="$2"
  local dir
  dir="$(dirname "${ENV_FILE}")"
  mkdir -p "${dir}"
  touch "${ENV_FILE}"

  local tmp_file
  tmp_file="$(mktemp "${ENV_FILE}.XXXXXX")"
  grep -v -E "^${key}=" "${ENV_FILE}" > "${tmp_file}" || true
  printf '%s=%s\n' "${key}" "${value}" >> "${tmp_file}"
  mv "${tmp_file}" "${ENV_FILE}"
}

resolve_wasm_path() {
  if [[ -n "${WASM_OVERRIDE}" ]]; then
    [[ -f "${WASM_OVERRIDE}" ]] || fail "COMMITLABS_WASM_PATH points to a missing file: ${WASM_OVERRIDE}"
    printf '%s\n' "${WASM_OVERRIDE}"
    return 0
  fi

  local release_dir="${CONTRACTS_DIR}/target/wasm32-unknown-unknown/release"
  [[ -d "${release_dir}" ]] || fail "Expected build output directory is missing: ${release_dir}"

  mapfile -t wasm_files < <(find "${release_dir}" -maxdepth 1 -type f -name '*.wasm' | sort)

  if [[ "${#wasm_files[@]}" -eq 0 ]]; then
    fail "No wasm artifacts were found in ${release_dir}. Set COMMITLABS_WASM_PATH if your build output lives elsewhere."
  fi

  if [[ "${#wasm_files[@]}" -gt 1 ]]; then
    fail "Multiple wasm artifacts were found in ${release_dir}. Set COMMITLABS_WASM_PATH to choose the escrow contract artifact explicitly."
  fi

  printf '%s\n' "${wasm_files[0]}"
}

build_contract() {
  local build_cmd=(stellar contract build --manifest-path "${MANIFEST_PATH}")

  if [[ -n "${CONTRACT_PACKAGE}" ]]; then
    build_cmd+=(--package "${CONTRACT_PACKAGE}")
  fi

  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '[dry-run] %s\n' "${build_cmd[*]}" >&2
    return 0
  fi

  "${build_cmd[@]}"
}

deploy_contract() {
  local wasm_path="$1"
  local deploy_cmd=(
    stellar contract deploy
    --wasm "${wasm_path}"
    --source-account "${STELLAR_ACCOUNT}"
    --rpc-url "${STELLAR_RPC_URL}"
    --network-passphrase "${STELLAR_NETWORK_PASSPHRASE}"
  )

  if [[ -n "${CONTRACT_ALIAS}" ]]; then
    deploy_cmd+=(--alias "${CONTRACT_ALIAS}")
  fi

  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '[dry-run] %s\n' "${deploy_cmd[*]}" >&2
    printf '%s\n' "${DRY_RUN_CONTRACT_ID}"
    return 0
  fi

  "${deploy_cmd[@]}"
}

initialize_contract() {
  local contract_id="$1"
  local init_cmd=(
    stellar contract invoke
    --id "${contract_id}"
    --source-account "${STELLAR_ACCOUNT}"
    --rpc-url "${STELLAR_RPC_URL}"
    --network-passphrase "${STELLAR_NETWORK_PASSPHRASE}"
    --send yes
    --
    initialize
    --admin "${COMMITLABS_ADMIN_ADDRESS}"
    --token "${COMMITLABS_TOKEN_CONTRACT_ID}"
    --fee_recipient "${COMMITLABS_FEE_RECIPIENT_ADDRESS}"
  )

  if [[ "${DRY_RUN}" == "1" ]]; then
    printf '[dry-run] %s\n' "${init_cmd[*]}" >&2
    return 0
  fi

  "${init_cmd[@]}"
}

main() {
  require_env STELLAR_ACCOUNT
  require_env COMMITLABS_ADMIN_ADDRESS
  require_env COMMITLABS_TOKEN_CONTRACT_ID
  require_env COMMITLABS_FEE_RECIPIENT_ADDRESS

  [[ -f "${MANIFEST_PATH}" ]] || fail "Contract manifest not found at ${MANIFEST_PATH}"

  validate_stellar_address "${COMMITLABS_ADMIN_ADDRESS}" "COMMITLABS_ADMIN_ADDRESS"
  validate_contract_id "${COMMITLABS_TOKEN_CONTRACT_ID}" "COMMITLABS_TOKEN_CONTRACT_ID"
  validate_stellar_address "${COMMITLABS_FEE_RECIPIENT_ADDRESS}" "COMMITLABS_FEE_RECIPIENT_ADDRESS"

  if [[ "${DRY_RUN}" != "1" ]]; then
    require_command stellar
  fi

  printf 'Building contract workspace from %s\n' "${MANIFEST_PATH}"
  build_contract

  local wasm_path
  wasm_path="${WASM_OVERRIDE}"
  if [[ "${DRY_RUN}" != "1" ]]; then
    wasm_path="$(resolve_wasm_path)"
    printf 'Deploying wasm artifact %s\n' "${wasm_path}"
  else
    printf '[dry-run] skipping wasm artifact resolution\n' >&2
  fi

  local contract_id
  contract_id="$(deploy_contract "${wasm_path}")"
  validate_contract_id "${contract_id}" "Deployed contract id"

  printf 'Initializing contract %s\n' "${contract_id}"
  initialize_contract "${contract_id}"

  upsert_env_var NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT "${contract_id}"
  upsert_env_var COMMITMENT_CORE_CONTRACT "${contract_id}"
  upsert_env_var SOROBAN_COMMITMENT_CORE_CONTRACT "${contract_id}"

  printf '\nDeployment complete.\n'
  printf 'NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT=%s\n' "${contract_id}"
  printf 'COMMITMENT_CORE_CONTRACT=%s\n' "${contract_id}"
  printf 'SOROBAN_COMMITMENT_CORE_CONTRACT=%s\n' "${contract_id}"
  printf 'Updated env file: %s\n' "${ENV_FILE}"
}

main "$@"
