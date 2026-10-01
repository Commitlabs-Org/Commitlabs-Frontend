const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

export type CsvRow = Array<string | null | undefined>;

export function escapeCsvField(value: string | null | undefined): string {
  const normalizedValue = value == null ? '' : String(value);
  const safeValue = FORMULA_PREFIX_PATTERN.test(normalizedValue)
    ? `'${normalizedValue}`
    : normalizedValue;
  const escapedValue = safeValue.replace(/"/g, '""');
  const shouldWrap =
    escapedValue.includes(',') ||
    escapedValue.includes('"') ||
    escapedValue.includes('\n') ||
    /^[\s]|[\s]$/.test(escapedValue);

  return shouldWrap ? `"${escapedValue}"` : escapedValue;
}

/**
 * Formats a single CSV row and terminates it with CRLF.
 */
export function formatCsvRow(row: CsvRow): string {
  return `${row.map(escapeCsvField).join(',')}\r\n`;
}

export function buildCsv(headers: string[], rows: CsvRow[]): string {
  return [headers, ...rows].map(formatCsvRow).join('');
}

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value;
}

/**
 * Streams a CSV with a deterministic header first, then row-by-row chunks.
 * The caller should bound the number of rows before calling this helper so the
 * response cannot grow without a defined upper bound.
 */
export function createCsvStream(
  headers: string[],
  rows: Iterable<CsvRow> | AsyncIterable<CsvRow>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(formatCsvRow(headers)));

        const iterator = isAsyncIterable<CsvRow>(rows)
          ? rows[Symbol.asyncIterator]()
          : rows[Symbol.iterator]();

        for await (const row of {
          next: iterator.next.bind(iterator),
          [Symbol.asyncIterator]() {
            return this;
          },
        }) {
          controller.enqueue(encoder.encode(formatCsvRow(row)));
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
