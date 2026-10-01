import { describe, it, expect } from 'vitest';
import { groupShortcuts, type ShortcutEntry } from '@/lib/shortcuts';

describe('groupShortcuts', () => {
  it('groups entries by their group field, preserving order within each group', () => {
    const entries: ShortcutEntry[] = [
      { keys: 'A', description: 'a', group: 'X' },
      { keys: 'B', description: 'b', group: 'Y' },
      { keys: 'C', description: 'c', group: 'X' },
    ];

    const grouped = groupShortcuts(entries);

    expect(Array.from(grouped.keys())).toEqual(['X', 'Y']);
    expect(grouped.get('X')?.map((e) => e.keys)).toEqual(['A', 'C']);
    expect(grouped.get('Y')?.map((e) => e.keys)).toEqual(['B']);
  });

  it('returns an empty map for an empty list', () => {
    expect(groupShortcuts([]).size).toBe(0);
  });
});
