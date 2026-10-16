/**
 * Generic CSV export helper, meant to back an "Export CSV" button on any list page. Part of the
 * Week 2-4 remediation backlog (export/reporting): before this, the only CSV-writing code in the
 * app was the bulk-upload template on Asset Register, and it just joined values with commas — fine
 * for its fixed example rows, but unsafe for real data, where an asset name, vendor, or remark
 * containing a comma or a quote would silently corrupt the file's column alignment. This escapes
 * per RFC 4180: any field containing a comma, quote, or newline is wrapped in quotes with internal
 * quotes doubled.
 */
export interface CsvColumn<T> {
    header: string;
    value: (row: T) => string | number | null | undefined;
}

const escapeCsvField = (value: string | number | null | undefined): string => {
    const s = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
};

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
    const header = columns.map(c => escapeCsvField(c.header)).join(',');
    const lines = rows.map(row => columns.map(c => escapeCsvField(c.value(row))).join(','));
    return [header, ...lines].join('\r\n');
}

/**
 * Triggers a browser download of `rows` as a CSV file named `filename` (".csv" is appended if
 * missing). Prefixes a UTF-8 BOM so Excel — still the most common tool these reports get opened
 * in — renders non-ASCII characters (₹, accented names) correctly instead of mangling them.
 */
export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
    const csv = rowsToCsv(rows, columns);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}