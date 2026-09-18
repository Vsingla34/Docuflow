/** File-attachment helpers. Everything is stored inline as a base64 data URL since this app has no backend. */

/** Browsers choke well before this on a single localStorage value; keep individual files small. */
export const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB

export const ACCEPTED_FILE_TYPES = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx';

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });

/** Triggers a browser download of an already-encoded data URL (or any href) under the given file name. */
export const downloadDataUrl = (dataUrl: string, fileName: string): void => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const ICON_BY_MIME: { test: (mime: string, name: string) => boolean; icon: string }[] = [
  { test: (m, n) => m.includes('pdf') || n.endsWith('.pdf'), icon: '📄' },
  { test: m => m.startsWith('image/'), icon: '🖼️' },
  { test: (m, n) => m.includes('spreadsheet') || n.endsWith('.xls') || n.endsWith('.xlsx'), icon: '📊' },
  { test: (m, n) => m.includes('word') || n.endsWith('.doc') || n.endsWith('.docx'), icon: '📝' },
];

export const iconForFile = (mimeType: string, fileName: string): string =>
  ICON_BY_MIME.find(rule => rule.test(mimeType, fileName))?.icon || '📎';

export const isImageFile = (mimeType: string): boolean => mimeType.startsWith('image/');
