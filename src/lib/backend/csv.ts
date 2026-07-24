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
 * Shared by `buildCsv` and `createCsvStream` so the injection guard
 * (see `escapeCsvField`) is applied identically in both code paths.
 */
export function formatCsvRow(row: CsvRow): string {
  return `${row.map(escapeCsvField).join(',')}\r\n`;
}

export function buildCsv(headers: string[], rows: CsvRow[]): string {
  return [headers, ...rows].map(formatCsvRow).join('');
}

/**
 * Returns a ReadableStream that emits the CSV header row first, then one
 * chunk per data row. Accepts a sync or async iterable so callers can pass
 * an in-memory array today or a paginated/streamed source in the future
 * without changing this helper.
 *
 * Errors thrown by the iterable are forwarded to `controller.error`, which
 * aborts the response. The client will see a truncated download; the caller
 * is responsible for ensuring upstream errors are surfaced before streaming
 * starts when possible.
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
        for await (const row of rows as AsyncIterable<CsvRow>) {
          controller.enqueue(encoder.encode(formatCsvRow(row)));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}