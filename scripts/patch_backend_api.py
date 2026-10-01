#!/usr/bin/env python3
"""One-time backend API patch script.

This script exists to apply a specific set of route-handler source files that were
written during an earlier migration/recovery effort. It is not invoked by any
`package.json` script and it is not part of the normal development or CI workflow.

Danger:
    Running this script without care will overwrite entire route files with the
    embedded (now potentially stale) content. On a post-migration codebase this
    can silently revert real fixes.

Safety guards:
    - By default the script runs in dry-run mode and prints a unified diff for each
      target file. Nothing is written to disk.
    - Writing requires the explicit `--force` flag.
    - A `--dry-run` flag is also accepted for explicitness.

Usage:
    python scripts/patch_backend_api.py             # dry-run (default)
    python scripts/patch_backend_api.py --dry-run
    python scripts/patch_backend_api.py --force       # writes files to disk
python scripts/patch_backend_api.py --force --file src/app/api/marketplace/listings/route.ts
"""
from __future__ import annotations

import argparse
import difflib
import sys
import textwrap
from pathlib import Path


REPLACEMENTS: dict[str, str] = {
    "src/app/api/marketplace/listings/route.ts": '''import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { getMarketplaceListings } from '@/lib/backend/marketplace';

export const GET = withApiHandler(async (_req: NextRequest) => {
  const listings = await getMarketplaceListings();
  return NextResponse.json({ listings });
});
''',
    "src/app/api/marketplace/listings/[id]/route.ts": '''import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { getMarketplaceListing } from '@/lib/backend/marketplace';

export const GET = withApiHandler(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const listing = await getMarketplaceListing(params.id);
  if (!listing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ listing });
});
''',
    "src/app/api/commitments/route.ts": '''import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { listCommitments, createCommitment } from '@/lib/backend/commitments';

export const GET = withApiHandler(async (_req: NextRequest) => {
  const commitments = await listCommitments();
  return NextResponse.json({ commitments });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const commitment = await createCommitment(body);
  return NextResponse.json({ commitment }, { status: 201 });
});
''',
    "src/app/api/commitments/[id]/route.ts": '''
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { getCommitment } from '@/lib/backend/commitments';

export const GET = withApiHandler(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const commitment = await getCommitment(params.id);
  if (!commitment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ commitment });
});
''',
}


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            'Apply the one-time backend API route-handler patch. '
            'Defaults to a dry run that prints a diff.'
        ),
        epilog=(
            'This script is intended for targeted migration or recovery work only. '
            'It overwrites entire route files with embedded content and should '
            'not be run against a post-migration codebase without reviewing '
            'the diff first.'
        ),
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Write files to disk. Without this flag the script only prints a diff.',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Explicitly request a dry run (the default).',
    )
    parser.add_argument(
        '--file',
        action='append',
        default=[],
        metavar='PATH',
        help='Limit the patch to the given repository-relative file path.',
    )
    return parser


def _resolve_targets(repo_root: Path, selected: list[str]) -> dict[str, str]:
    if not selected:
        return dict(REPLACEMENTS)

    unknown = [path for path in selected if path not in REPLACEMENTS]
    if unknown:
        joined = ', '.join(unknown)
        raise SystemExit(f'Unknown target file(s): {joined}')

    return {path: REPLACEMENTS[path] for path in selected}


def _print_diff(rel_path: str, current: str, desired: str) -> bool:
    if current == desired:
        print(f'--- {rel_path}: already up to date')
        return False

    diff = difflib.unified_diff(
        current.splitlines(keepends=True),
        desired.splitlines(keepends=True),
        fromfile=f,'a/{rel_path}',
        tofile=f,'b/{rel_path}',
    )
    print(''.join(diff))
    return True


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    repo_root = Path(__file__).resolve().parent.parent
    targets = _resolve_targets(repo_root, args.file)

    write_mode = bool(args.force) and not bool(args.dry_run)
    if args.force and args.dry_run:
        print('Note: --force and --dry-run were both passed; dry run wins.')

    mode = 'write' if write_mode else 'dry-run'
    print(f'[patch_backend_api] mode={mode} targets={len(targets)}')
    print('-' * 72)

    changed = 0
    for rel_path, desired in sorted(targets.items()):
        abs_path = repo_root / rel_path
        current = abs_path.read_text(encoding='utf-8') if abs_path.exists() else ''
        differs = _print_diff(rel_path, current, desired)
        if not differs:
            continue
        changed += 1
        if write_mode:
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            abs_path.write_text(desired, encoding='utf-8')
            print(f'[write] {rel_path}')

    print('-' * 72)
    if write_mode:
        print(f'Applied {changed} file change(s).')
    else:
        print(
            textwrap.fill(
                f'Dry run: would update {changed} file(s). '
                'Re-run with --force to write these changes to disk.',
                width=72,
            )
        )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
