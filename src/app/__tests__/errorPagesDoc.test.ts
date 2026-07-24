import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'

type ErrorSurface = {
  filePath: string
  routePath: string
}

const ROOT = resolve(process.cwd())
const APP_DIR = join(ROOT, 'src/app')
const DOC_PATH = join(ROOT, 'ERROR_PAGES_README.md')
const README_PATH = join(ROOT, 'README.md')

const DOCUMENTED_SURFACES = [
  { filePath: 'src/app/error.tsx', routePath: '/error' },
  { filePath: 'src/app/not-found.tsx', routePath: '/not-found' },
  { filePath: 'src/app/network-error/page.tsx', routePath: '/network-error' },
  { filePath: 'src/app/transaction-error/page.tsx', routePath: '/transaction-error' },
] as const

const TRANSACTION_MODAL_PATH = 'src/app/TransactionProgressModal.tsx'

function readWorkspaceFile(filePath: string): string {
  return readFileSync(join(ROOT, filePath), 'utf8')
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function discoverErrorSurfaces(dirPath: string): ErrorSurface[] {
  const surfaces: ErrorSurface[] = []

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = join(dirPath, entry.name)

    if (entry.isDirectory()) {
      surfaces.push(...discoverErrorSurfaces(entryPath))
      continue
    }

    const relativePath = relative(ROOT, entryPath).replace(/\\/g, '/')

    if (relativePath === 'src/app/error.tsx') {
      surfaces.push({ filePath: relativePath, routePath: '/error' })
      continue
    }

    if (relativePath === 'src/app/not-found.tsx') {
      surfaces.push({ filePath: relativePath, routePath: '/not-found' })
      continue
    }

    if (relativePath.endsWith('/page.tsx')) {
      const routeFolder = basename(dirname(entryPath))

      if (routeFolder.includes('error')) {
        surfaces.push({ filePath: relativePath, routePath: `/${routeFolder}` })
      }
    }
  }

  return surfaces
}

function expectSourceContainsAll(sourceText: string, labels: string[]) {
  for (const label of labels) {
    expect(sourceText).toContain(label)
  }
}

describe('error pages documentation drift guard', () => {
  it('keeps the documented error-page files present at the expected paths', () => {
    for (const surface of DOCUMENTED_SURFACES) {
      expect(existsSync(join(ROOT, surface.filePath))).toBe(true)
    }

    expect(existsSync(join(ROOT, TRANSACTION_MODAL_PATH))).toBe(true)
  })

  it('documents each known error surface and links the main README', () => {
    const docText = readWorkspaceFile('ERROR_PAGES_README.md')
    const readmeText = readWorkspaceFile('README.md')

    expect(readmeText).toContain('[Error Page Recovery Flows](ERROR_PAGES_README.md)')
    expect(normalizeText(readmeText)).toContain('Error Page Recovery Flows')

    for (const surface of DOCUMENTED_SURFACES) {
      expect(docText).toContain(surface.filePath)
      expect(docText).toContain(surface.routePath)
    }

    expect(docText).toContain('src/app/TransactionProgressModal.tsx')
    expect(docText).toContain('There is no countdown timer in the current implementation')
  })

  it('keeps the documented recovery CTA labels in sync with the actual components', () => {
    const errorPageText = readWorkspaceFile('src/app/error.tsx')
    const notFoundText = readWorkspaceFile('src/app/not-found.tsx')
    const networkErrorText = readWorkspaceFile('src/app/network-error/page.tsx')
    const transactionErrorText = readWorkspaceFile('src/app/transaction-error/page.tsx')
    const transactionModalText = readWorkspaceFile(TRANSACTION_MODAL_PATH)

    expectSourceContainsAll(errorPageText, ['Try Again', 'Go Home', 'Report Issue'])
    expectSourceContainsAll(notFoundText, ['Go Home', 'Go Back'])
    expectSourceContainsAll(networkErrorText, ['Retry', 'Go Home', 'Checking connection...', 'Retrying...'])
    expectSourceContainsAll(transactionErrorText, ['Try Again', 'Go to Dashboard', 'Check Explorer', 'View on Explorer'])
    expectSourceContainsAll(transactionModalText, [
      'USER_REJECTED',
      'INSUFFICIENT_BALANCE',
      'NETWORK_CONGESTION',
      'RPC_TIMEOUT',
      'SLIPPAGE_EXCEEDED',
      'CONTRACT_REVERTED',
      'UNKNOWN_ERROR',
      'Try Again',
      'Fund Wallet',
      'Check Explorer ↗',
      'Update Price',
      'View Details',
      'Contact Support',
    ])
  })

  it('flags new undocumented error routes under src/app', () => {
    const discoveredSurfaces = discoverErrorSurfaces(APP_DIR)
    const documentedFilePaths = new Set(DOCUMENTED_SURFACES.map((surface) => surface.filePath))
    const documentedRoutePaths = new Set(DOCUMENTED_SURFACES.map((surface) => surface.routePath))

    expect(discoveredSurfaces.map((surface) => surface.filePath).sort()).toEqual(
      [...documentedFilePaths].sort(),
    )

    for (const surface of discoveredSurfaces) {
      expect(documentedRoutePaths.has(surface.routePath)).toBe(true)
    }
  })

  it('covers the helper branches used for route discovery and file validation', () => {
    expect(existsSync(DOC_PATH)).toBe(true)
    expect(existsSync(README_PATH)).toBe(true)
    expect(normalizeText(readWorkspaceFile('ERROR_PAGES_README.md'))).toContain('Error Pages Recovery Flows')
  })
})