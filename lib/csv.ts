export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

const escapeCell = (value: string | number): string => {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

/** Builds CSV text from rows + column definitions and triggers a browser download. */
export const exportToCsv = <T,>(fileName: string, columns: CsvColumn<T>[], rows: T[]): void => {
  const lines = [
    columns.map(c => escapeCell(c.header)).join(','),
    ...rows.map(row => columns.map(c => escapeCell(c.value(row))).join(',')),
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
