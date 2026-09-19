/**
 * Lightweight, zero-dependency utility to convert tabular data into RFC 4180 compliant CSV.
 */
export function generateCsv(
  columns: Array<{ header: string; key: string }>,
  rows: Array<Record<string, any>>,
): string {
  const escapeCell = (val: any): string => {
    if (val === null || val === undefined) {
      return '';
    }
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = columns.map((col) => escapeCell(col.header)).join(',');
  const rowLines = rows.map((row) =>
    columns.map((col) => escapeCell(row[col.key])).join(','),
  );

  return [headerLine, ...rowLines].join('\r\n');
}
