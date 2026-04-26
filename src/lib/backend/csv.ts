const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

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

export function buildCsv(headers: string[], rows: Array<Array<string | null | undefined>>): string {
  const csvRows = [headers, ...rows].map((row) => row.map((value) => escapeCsvField(value)).join(','));

  return `${csvRows.join('\r\n')}\r\n`;
}
