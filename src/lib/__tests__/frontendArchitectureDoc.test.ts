import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const DOC_PATH = path.resolve(__dirname, '../../../docs/FRONTEND_ARCHITECTURE.md')
const SRC_DIR = path.resolve(__dirname, '../../..')
const APP_DIR = path.resolve(SRC_DIR, 'src/app')
const COMPONENTS_DIR = path.resolve(SRC_DIR, 'src/components')

interface DocRoute {
  routePath: string
  pageFile: string
}

function parseDocRoutes(): DocRoute[] {
  const content = fs.readFileSync(DOC_PATH, 'utf-8')
  const routeTableSection = content
    .split('## Routes & Page Components')[1]
    ?.split('##')[0]
  if (!routeTableSection) throw new Error('Could not find route table section in doc')

  const routes: DocRoute[] = []
  const rowRegex = /^\|\s*`([^`]+)`[^|]*\|\s*`([^`]+)`/gm
  let match: RegExpExecArray | null
  while ((match = rowRegex.exec(routeTableSection)) !== null) {
    routes.push({ routePath: match[1], pageFile: match[2] })
  }
  return routes
}

describe('FRONTEND_ARCHITECTURE.md page routes exist on disk', () => {
  const routes = parseDocRoutes()

  it.each(routes)('page file for route $routePath exists at $pageFile', ({ pageFile }) => {
    const fullPath = path.resolve(SRC_DIR, pageFile)
    expect(fs.existsSync(fullPath)).toBe(true)
  })

  it('documents at least the core routes', () => {
    const documentedRoutes = routes.map((r) => r.routePath)
    expect(documentedRoutes).toContain('/')
    expect(documentedRoutes).toContain('/create')
    expect(documentedRoutes).toContain('/marketplace')
    expect(documentedRoutes).toContain('/commitments')
    expect(documentedRoutes).toContain('/settings')
  })
})

describe('FRONTEND_ARCHITECTURE.md API routes exist on disk', () => {
  it('every API route mentioned in the tree section matches a directory under src/app/api', () => {
    const content = fs.readFileSync(DOC_PATH, 'utf-8')
    const apiTreeSection = content
      .split('## API Route Tree')[1]
      ?.split('##')[0]
    if (!apiTreeSection) throw new Error('Could not find API route tree section')

    const apiRouteMatches: string[] = []
    const lineRegex = /^`([^`]+)`/gm
    let m: RegExpExecArray | null
    while ((m = lineRegex.exec(apiTreeSection)) !== null) {
      const parts = m[1].split(/ {2,}/)
      if (parts.length >= 2) {
        apiRouteMatches.push(parts[0])
      }
    }

    apiRouteMatches.forEach((routeMethod) => {
      const routeFile = routeMethod.replace(/^│\s*/, '').trim()
      if (!routeFile || routeFile.startsWith('#')) return
      const fullPath = path.resolve(APP_DIR, routeFile)
      expect(fs.existsSync(fullPath)).toBe(true)
    })
  })
})

describe('FRONTEND_ARCHITECTURE.md component references exist', () => {
  it('all component directory paths in the doc exist', () => {
    const content = fs.readFileSync(DOC_PATH, 'utf-8')
    const componentPaths: string[] = []
    const componentRefRegex = /src\/components\/[\w/.-]+/g
    let match: RegExpExecArray | null
    while ((match = componentRefRegex.exec(content)) !== null) {
      componentPaths.push(match[0])
    }

    componentPaths.forEach((refPath) => {
      const fullPath = path.resolve(SRC_DIR, refPath)
      const exists =
        fs.existsSync(fullPath) ||
        fs.existsSync(fullPath + '.tsx') ||
        fs.existsSync(fullPath + '.ts') ||
        fs.existsSync(fullPath + '/index.ts') ||
        fs.existsSync(fullPath + '/index.tsx')
      expect(exists).toBe(true)
    })
  })
})
