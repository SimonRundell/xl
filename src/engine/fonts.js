/**
 * Google Fonts helper.
 *
 * A curated list of families is offered in the format toolbar. When a family
 * is first used it is loaded by injecting a stylesheet link, so the browser
 * only downloads fonts that are actually needed.
 *
 * @module engine/fonts
 */

/** Families offered in the toolbar. All are on Google Fonts. */
export const FONT_LIST = [
  'Arial',
  'Calibri',
  'Georgia',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Courier New',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Source Sans 3',
  'Inter',
  'Nunito',
  'Work Sans',
  'Merriweather',
  'Playfair Display',
  'PT Serif',
  'Roboto Mono',
  'Roboto Slab',
  'Fira Code',
  'JetBrains Mono',
  'IBM Plex Sans',
  'IBM Plex Mono',
  'Space Mono',
  'Oswald',
  'Raleway',
  'Rubik',
  'Karla',
];

/** Families that ship on most machines and are not on Google Fonts. */
const SYSTEM_FONTS = new Set(['Arial', 'Calibri', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Courier New']);

/** @type {Set<string>} */
const loaded = new Set();

/**
 * Ensure a font family stylesheet is present in the document head.
 *
 * @param {string} family
 * @returns {void}
 */
export function ensureFont(family) {
  if (!family || loaded.has(family) || SYSTEM_FONTS.has(family)) {
    return;
  }
  loaded.add(family);
  const spec = family.trim().replace(/\s+/g, '+');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${spec}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
  link.dataset.font = family;
  document.head.appendChild(link);
}

/**
 * Preload every font referenced by a workbook document.
 *
 * @param {Object} doc Workbook document.
 * @returns {void}
 */
export function preloadDocumentFonts(doc) {
  if (!doc || !Array.isArray(doc.sheets)) {
    return;
  }
  const families = new Set();
  doc.sheets.forEach((sheet) => {
    const collect = (styleMap) => {
      Object.values(styleMap || {}).forEach((entry) => {
        const font = entry && (entry.font || (entry.style && entry.style.font));
        if (font) {
          families.add(font);
        }
      });
    };
    collect(sheet.cells);
    collect(sheet.rowStyles);
    collect(sheet.colStyles);
  });
  families.forEach(ensureFont);
}

/**
 * Build a CSS font-family stack for a chosen family.
 *
 * @param {string} family
 * @returns {string}
 */
export function fontStack(family) {
  if (!family) {
    return '';
  }
  const isMono = /mono|code|courier|consolas/i.test(family);
  return `"${family}", ${isMono ? 'ui-monospace, monospace' : 'system-ui, sans-serif'}`;
}
