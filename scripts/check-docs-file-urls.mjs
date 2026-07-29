#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const defaultDocsRoot = path.resolve(process.cwd(), 'docs')

function isDocsFile(filePath) {
  return filePath.startsWith('docs/') || filePath.startsWith('./docs/') || filePath.startsWith(defaultDocsRoot)
}

function collectTargets() {
  if (args.length > 0) {
    return args.filter((arg) => isDocsFile(arg))
  }

  return []
}

const targets = collectTargets()

if (targets.length === 0) {
  console.log('No documentation files supplied; skipping file:// URL check.')
  process.exit(0)
}

const offenders = []

for (const target of targets) {
  const resolvedPath = path.isAbsolute(target) ? target : path.resolve(process.cwd(), target)

  if (!existsSync(resolvedPath)) {
    continue
  }

  const contents = readFileSync(resolvedPath, 'utf8')
  if (contents.includes('file:///')) {
    offenders.push(resolvedPath)
  }
}

if (offenders.length > 0) {
  console.error('Found file:// links in documentation files:')
  for (const offender of offenders) {
    console.error(`- ${offender}`)
  }
  process.exit(1)
}

console.log('Documentation file URL check passed.')
