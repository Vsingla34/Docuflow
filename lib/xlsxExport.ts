/**
 * Formatted (.xlsx) export helper for the Reports page.
 *
 * lib/csvExport.ts already covers plain CSV, which is what most of the app's "Export" buttons
 * use — fine for re-importing data elsewhere, but not what someone means by a "formatted,
 * designed" report to hand to an auditor or management: a bare CSV opens in Excel as an
 * unstyled grid with no title, no currency formatting, no visual separation between the header
 * and the data. This builds an actual styled workbook with exceljs (already a dependency, not
 * previously wired up to anything) — a title banner with the company name and report period, a
 * colored header row, right-aligned currency columns with proper number formatting, zebra-striped
 * rows, a bold totals row, a frozen header, and auto-filtering — then downloads it as .xlsx.
 */
import ExcelJS from 'exceljs';

export type XlsxColumnType = 'text' | 'number' | 'currency' | 'date';

export interface XlsxColumn<T> {
    header: string;
    value: (row: T) => string | number | null | undefined;
    type?: XlsxColumnType;
    width?: number;
}

export interface XlsxTotalsSpec<T> {
    /** Column headers (must match an XlsxColumn's `header`) to sum into the totals row. */
    columns: string[];
    label?: string; // shown in the first column of the totals row; defaults to "Total"
}

export interface DownloadFormattedXlsxOptions<T> {
    filename: string;
    sheetName?: string;
    reportTitle: string;
    companyName: string;
    /** Short lines shown under the title — e.g. "Financial Year 2025-26", "Period: ... to ...". */
    subtitleLines?: string[];
    generatedAt?: Date;
    columns: XlsxColumn<T>[];
    rows: T[];
    totals?: XlsxTotalsSpec<T>;
}

// A single brand color drives the whole design so it reads as one consistent, deliberately
// designed sheet rather than Excel's defaults — easy to swap for an org's own brand color later.
const BRAND = { argb: 'FF4F46E5' }; // matches the app's primary indigo
const BRAND_DARK = { argb: 'FF312E81' };
const HEADER_TEXT = { argb: 'FFFFFFFF' };
const ZEBRA = { argb: 'FFF8FAFC' };
const BORDER_COLOR = { argb: 'FFE2E8F0' };

const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: BORDER_COLOR },
    left: { style: 'thin', color: BORDER_COLOR },
    bottom: { style: 'thin', color: BORDER_COLOR },
    right: { style: 'thin', color: BORDER_COLOR },
};

const numberFormatFor = (type?: XlsxColumnType): string | undefined => {
    switch (type) {
        case 'currency':
            // en-IN style grouping isn't a built-in Excel format, but ₹ with 2-decimal thousands
            // grouping and a parenthesized-negative convention reads as "accounting" at a glance.
            return '₹#,##0.00;[Red](₹#,##0.00)';
        case 'number':
            return '#,##0';
        case 'date':
            return 'dd-mmm-yyyy';
        default:
            return undefined;
    }
};

/**
 * Builds and downloads a styled .xlsx workbook. Generic over the row type so both the Assets
 * Register (rows of Asset) and the Depreciation Report (rows of DepRow) can share this one
 * implementation instead of each hand-rolling their own formatting.
 */
export async function downloadFormattedXlsx<T>(opts: DownloadFormattedXlsxOptions<T>): Promise<void> {
    const {
        filename, sheetName = 'Report', reportTitle, companyName, subtitleLines = [],
        generatedAt = new Date(), columns, rows, totals,
    } = opts;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = companyName;
    workbook.created = generatedAt;

    const sheet = workbook.addWorksheet(sheetName, {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    const colCount = columns.length;

    // --- Title banner -------------------------------------------------------------------------
    let rowIdx = 1;
    sheet.mergeCells(rowIdx, 1, rowIdx, colCount);
    const titleCell = sheet.getCell(rowIdx, 1);
    titleCell.value = companyName;
    titleCell.font = { bold: true, size: 16, color: HEADER_TEXT };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND_DARK };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(rowIdx).height = 28;
    rowIdx += 1;

    sheet.mergeCells(rowIdx, 1, rowIdx, colCount);
    const subtitleCell = sheet.getCell(rowIdx, 1);
    subtitleCell.value = reportTitle;
    subtitleCell.font = { bold: true, size: 12, color: { argb: 'FF1E293B' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    sheet.getRow(rowIdx).height = 20;
    rowIdx += 1;

    for (const line of subtitleLines) {
        sheet.mergeCells(rowIdx, 1, rowIdx, colCount);
        const cell = sheet.getCell(rowIdx, 1);
        cell.value = line;
        cell.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        rowIdx += 1;
    }

    sheet.mergeCells(rowIdx, 1, rowIdx, colCount);
    const generatedCell = sheet.getCell(rowIdx, 1);
    generatedCell.value = `Generated ${generatedAt.toLocaleString('en-IN')}`;
    generatedCell.font = { italic: true, size: 8, color: { argb: 'FF94A3B8' } };
    generatedCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    rowIdx += 1;

    rowIdx += 1; // blank spacer row before the table

    // --- Header row -----------------------------------------------------------------------------
    const headerRowIndex = rowIdx;
    const headerRow = sheet.getRow(headerRowIndex);
    columns.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.header;
        cell.font = { bold: true, color: HEADER_TEXT, size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: BRAND };
        cell.alignment = { vertical: 'middle', horizontal: col.type === 'currency' || col.type === 'number' ? 'right' : 'left', wrapText: true };
        cell.border = thinBorder;
    });
    headerRow.height = 22;
    rowIdx += 1;

    // --- Data rows --------------------------------------------------------------------------------
    const firstDataRow = rowIdx;
    rows.forEach((row, rIdx) => {
        const excelRow = sheet.getRow(rowIdx);
        const isZebra = rIdx % 2 === 1;
        columns.forEach((col, cIdx) => {
            const cell = excelRow.getCell(cIdx + 1);
            const raw = col.value(row);
            if (col.type === 'date' && typeof raw === 'string' && raw) {
                const d = new Date(raw);
                cell.value = Number.isNaN(d.getTime()) ? raw : d;
            } else {
                cell.value = raw ?? '';
            }
            const fmt = numberFormatFor(col.type);
            if (fmt) cell.numFmt = fmt;
            cell.alignment = { vertical: 'middle', horizontal: col.type === 'currency' || col.type === 'number' ? 'right' : (col.type === 'date' ? 'center' : 'left') };
            cell.border = thinBorder;
            if (isZebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: ZEBRA };
            cell.font = { size: 10 };
        });
        rowIdx += 1;
    });
    const lastDataRow = rowIdx - 1;

    // --- Totals row (optional) -------------------------------------------------------------------
    if (totals && rows.length > 0) {
        const totalsRow = sheet.getRow(rowIdx);
        columns.forEach((col, i) => {
            const cell = totalsRow.getCell(i + 1);
            if (i === 0) {
                cell.value = totals.label || 'Total';
                cell.alignment = { vertical: 'middle', horizontal: 'left' };
            } else if (totals.columns.includes(col.header)) {
                const colLetter = sheet.getColumn(i + 1).letter;
                cell.value = { formula: `SUM(${colLetter}${firstDataRow}:${colLetter}${lastDataRow})` };
                cell.numFmt = numberFormatFor(col.type) || '#,##0.00';
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
            }
            cell.font = { bold: true, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
            cell.border = { ...thinBorder, top: { style: 'double', color: { argb: 'FF4F46E5' } } };
        });
        totalsRow.height = 20;
        rowIdx += 1;
    }

    // --- Layout polish ----------------------------------------------------------------------------
    columns.forEach((col, i) => {
        sheet.getColumn(i + 1).width = col.width ?? Math.max(col.header.length + 4, 12);
    });
    sheet.autoFilter = { from: { row: headerRowIndex, column: 1 }, to: { row: headerRowIndex, column: colCount } };
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRowIndex }];
    // Keep the first column from scrolling out of view on very wide reports too.
    sheet.getColumn(1).width = Math.max(sheet.getColumn(1).width || 12, 16);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}