/**
 * QR code generation utilities.
 * Wraps the `qrcode` npm package into promise-based helpers.
 */
import QRCode from 'qrcode';

/**
 * Generates a QR code data-URL (PNG) for the given text.
 * Used to encode asset tags so they can be embedded in print labels.
 */
export const generateQrDataUrl = (text: string): Promise<string> =>
  QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: 256,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  });

/**
 * Returns the canonical URL-safe lookup URL for an asset tag.
 * When the QR is scanned the browser opens this path so the app
 * can deep-link directly to the asset lookup page.
 */
export const assetLookupUrl = (assetTag: string): string =>
  `${window.location.origin}${window.location.pathname}#lookup/${encodeURIComponent(assetTag)}`;
