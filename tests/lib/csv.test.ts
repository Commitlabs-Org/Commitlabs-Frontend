import { describe, expect, it } from 'vitest';
import { buildCsv, createCsvStream, escapeCsvField, formatCsvRow } from '@/lib/backend/csv';

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

describe('formatCsvRow', () => {
  it('joins fields with commas and terminates the row with CRLF', () => {
    expect(formatCsvRow(['a', 'b', 'c'])).toBe('a,b,c\r\n');
  });

  it('escapes each field using the same rules as escapeCsvField', () => {
    expect(formatCsvRow(['alpha,beta', 'say "hi"'])).toBe('"alpha,beta","say ""hi"""\r\n');
  });

  it('prevents spreadsheet formula injection for any field in the row', () => {
    expect(formatCsvRow(['safe', '=SUM(A1)', '+1'])).toBe("safe,'=SUM(A1),'+1\r\n");
  });

  it('produces the same output as buildCsv when called per row', () => {
    const headers = ['Name', 'Value'];
    const rows = [
      ['Alice', '=danger'],
      ['Bob', '200'],
    ];

    const composed = [headers, ...rows].map(formatCsvRow).join('');

    expect(composed).toBe(buildCsv(headers, rows));
  });
});

describe('createCsvStream', () => {
  async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = '';

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }

    return result + decoder.decode();
  }

  async function collectChunks(stream: ReadableStream<Uint8Array>): Promise<string[]> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value));
    }

    return chunks;
  }

  it('emits only the header row when there are no data rows', async () => {
    const stream = createCsvStream(['Name', 'Value'], []);

    expect(await readStream(stream)).toBe('Name,Value\r\n');
  });

  it('emits headers and data rows in CSV format', async () => {
    const stream = createCsvStream(
      ['Name', 'Value'],
      [
        ['Alice', '100'],
        ['Bob', '200'],
      ]
    );

    expect(await readStream(stream)).toBe('Name,Value\r\nAlice,100\r\nBob,200\r\n');
  });

  it('emits the header in a separate chunk before any data rows', async () => {
    const stream = createCsvStream(['Name'], [['Alice'], ['Bob']]);

    const chunks = await collectChunks(stream);

    expect(chunks[0]).toBe('Name\r\n');
    expect(chunks.length).toBe(3);
  });

  it('accepts async iterables for paginated or streamed sources', async () => {
    async function* source() {
      yield ['1'];
      yield ['2'];
    }

    const stream = createCsvStream(['id'], source());

    expect(await readStream(stream)).toBe('id\r\n1\r\n2\r\n');
  });

  it('preserves the formula-injection guard for streamed rows', async () => {
    const stream = createCsvStream(
      ['value'],
      [['=SUM(A1)'], ['+1'], ['-10'], ['@cmd']]
    );

    expect(await readStream(stream)).toBe("value\r\n'=SUM(A1)\r\n'+1\r\n'-10\r\n'@cmd\r\n");
  });

  it('forwards errors thrown by the iterable to the stream consumer', async () => {
    async function* failing() {
      yield ['1'];
      throw new Error('upstream failed');
    }

    const stream = createCsvStream(['value'], failing());

    await expect(readStream(stream)).rejects.toThrow('upstream failed');
  });
});