import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsvField } from '@/lib/backend/csv';

describe('escapeCsvField', () => {
  it('passes through basic fields', () => {
    expect(escapeCsvField('plain text')).toBe('plain text');
  });

  it('wraps fields containing commas', () => {
    expect(escapeCsvField('alpha,beta')).toBe('"alpha,beta"');
  });

  it('escapes embedded double quotes and wraps the field', () => {
    expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
  });

  it('wraps fields containing newlines', () => {
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"');
  });

  it('wraps fields with leading or trailing whitespace', () => {
    expect(escapeCsvField(' value ')).toBe('" value "');
  });

  it('treats null and undefined as empty strings', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('prevents spreadsheet formula injection', () => {
    expect(escapeCsvField('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(escapeCsvField('+123')).toBe("'+123");
    expect(escapeCsvField('-10')).toBe("'-10");
    expect(escapeCsvField('@cmd')).toBe("'@cmd");
  });
});

describe('buildCsv', () => {
  it('returns only the header row when there are no data rows', () => {
    expect(buildCsv(['Name', 'Value'], [])).toBe('Name,Value\r\n');
  });

  it('returns headers and data rows in CSV format', () => {
    expect(
      buildCsv(
        ['Name', 'Value'],
        [
          ['Alice', '100'],
          ['Bob', '200'],
        ]
      )
    ).toBe('Name,Value\r\nAlice,100\r\nBob,200\r\n');
  });

  it('uses CRLF line endings throughout the document', () => {
    const csv = buildCsv(['Name'], [['Alice'], ['Bob']]);

    expect(csv).toContain('\r\nAlice\r\nBob\r\n');
    expect(csv).not.toContain('Name\nAlice');
  });
});
