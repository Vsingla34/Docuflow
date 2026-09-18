import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { today } from './format';

export interface PdfColumn<T> {
  header: string;
  value: (row: T) => string;
}

/** Renders a titled, tabular report to PDF and triggers a browser download. Landscape by default — most of this app's reports run wide. */
export const exportTableToPdf = <T,>(
  fileName: string,
  title: string,
  columns: PdfColumn<T>[],
  rows: T[],
  options: { subtitle?: string; orientation?: 'portrait' | 'landscape' } = {},
): void => {
  const doc = new jsPDF({ orientation: options.orientation || 'landscape', unit: 'pt' });

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 40, 40);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(options.subtitle || `Generated ${today()}`, 40, 58);

  autoTable(doc, {
    startY: 72,
    head: [columns.map(c => c.header)],
    body: rows.map(row => columns.map(c => c.value(row))),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 40, right: 40 },
  });

  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
};
