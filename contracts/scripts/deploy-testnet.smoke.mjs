import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const repoRoot = process.cwd()
const bashPath = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash'
const scriptPath = 'contracts/scripts/deploy-testnet.sh'

function toMsysPath(windowsPath) {
  return windowsPath.replace(/^([A-Za-z]):\\/, (_, drive) => `/${drive.toLowerCase()}/`).replace(/\\/g, '/')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function run() {
  const tempDir = mkdtempSync(join(tmpdir(), 'commitlabs-deploy-test-'))
  const envFile = join(tempDir, '.env.local')
  writeFileSync(envFile, 'NEXT_PUBLIC_USE_MOCKS=true\n', 'utf8')

  try {
    const success = spawnSync(bashPath, [scriptPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        DRY_RUN: '1',
        DRY_RUN_CONTRACT_ID: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
        STELLAR_ACCOUNT: 'deployer',
        COMMITLABS_ADMIN_ADDRESS: 'GBQ6M5OBU64ATKSRH4OKW2IFQCB5R6Q73F4VMK6KQ37C5G6GQ6FJTYA3',
        COMMITLABS_TOKEN_CONTRACT_ID: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
        COMMITLABS_FEE_RECIPIENT_ADDRESS: 'GC3C4X5R7N2X7CII7SPRD4U6ZLKZKAJZDW6N4Q4QAV3FJ7Q3N7GJ5P6L',
        COMMITLABS_SAFE_DEFAULT_PENALTY_BPS: '200',
        COMMITLABS_BALANCED_DEFAULT_PENALTY_BPS: '300',
        COMMITLABS_AGGRESSIVE_DEFAULT_PENALTY_BPS: '500',
        COMMITLABS_ENV_FILE: toMsysPath(envFile),
      },
    })

    assert(success.status === 0, `dry-run deploy failed:\n${success.stderr}`)
    assert(
      success.stdout.includes(
        'NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
      ),
      'dry-run output did not include NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT',
    )
    assert(
      success.stderr.includes('initialize') && success.stderr.includes('--admin'),
      'dry-run output did not include the initialize invoke command',
    )
    assert(
      /--safe_default_penalty_bps\s+200/.test(success.stderr),
      'dry-run initialize invoke did not include --safe_default_penalty_bps',
    )
    assert(
      /--balanced_default_penalty_bps\s+300/.test(success.stderr),
      'dry-run initialize invoke did not include --balanced_default_penalty_bps',
    )
    assert(
      /--aggressive_default_penalty_bps\s+500/.test(success.stderr),
      'dry-run initialize invoke did not include --aggressive_default_penalty_bps',
    )

    const writtenEnv = readFileSync(envFile, 'utf8')
    assert(
      writtenEnv.includes(
        'NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
      ),
      'env file did not contain NEXT_PUBLIC_COMMITMENT_CORE_CONTRACT',
    )
    assert(
      writtenEnv.includes('COMMITMENT_CORE_CONTRACT=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4'),
      'env file did not contain COMMITMENT_CORE_CONTRACT',
    )
    assert(
      writtenEnv.includes(
        'SOROBAN_COMMITMENT_CORE_CONTRACT=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
      ),
      'env file did not contain SOROBAN_COMMITMENT_CORE_CONTRACT',
    )

    const missingInput = spawnSync(bashPath, [scriptPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        DRY_RUN: '1',
        STELLAR_ACCOUNT: 'deployer',
        COMMITLABS_ADMIN_ADDRESS: 'GBQ6M5OBU64ATKSRH4OKW2IFQCB5R6Q73F4VMK6KQ37C5G6GQ6FJTYA3',
        COMMITLABS_FEE_RECIPIENT_ADDRESS: 'GC3C4X5R7N2X7CII7SPRD4U6ZLKZKAJZDW6N4Q4QAV3FJ7Q3N7GJ5P6L',
      },
    })

    assert(missingInput.status !== 0, 'missing-input run should have failed')
    assert(
      missingInput.stderr.includes('COMMITLABS_TOKEN_CONTRACT_ID'),
      'missing-input run did not explain the missing token contract id',
    )

    console.log('deploy-testnet.sh dry-run smoke test passed')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

run()
