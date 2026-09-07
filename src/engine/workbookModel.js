/**
 * Pure helpers for reading and updating a workbook document.
 *
 * A document looks like:
 * {
 *   version: 1,
 *   settings: { dateFormat, timeFormat, dateTimeFormat, currencySymbol, currencyDecimals },
 *   sheets: [{
 *     id, name, rows, cols,
 *     cells:      { "A1": { v: "raw entry", fmt: "auto", decimals: null, grouping: true,
 *                           negRed: false, style: {...} } },
 *     rowStyles:  { "3": { bg, color, bold, ... } },
 *     colStyles:  { "B": { bg, color, bold, ... } },
 *     colWidths:  { "A": 140 },
 *     rowHeights: { "2": 44 },
 *     merges:     [ [anchorRow, anchorCol, rowSpan, colSpan], ... ],
 *     freeze:     { rows: 0, cols: 0 }
 *   }]
 * }
 *
 * A style patch may contain: bg, color, bold, italic, underline, font, size,
 * align, and border (a subset of the string "trbl" for the sides to draw).
 *
 * @module engine/workbookModel
 */

import { DEFAULT_SETTINGS } from './formats.js';
import { toA1 } from './cellAddress.js';

let sheetSeq = 1;

/**
 * Create an empty single sheet document.
 *
 * @returns {Object}
 */
export function blankDocument() {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    sheets: [newSheet('Sheet1')],
  };
}

/**
 * Build a fresh empty sheet.
 *
 * @param {string} name
 * @param {number} [rows]
 * @param {number} [cols]
 * @returns {Object}
 */
export function newSheet(name, rows = 50, cols = 26) {
  sheetSeq += 1;
  return {
    id: `s${Date.now().toString(36)}${sheetSeq}`,
    name,
    rows,
    cols,
    cells: {},
    rowStyles: {},
    colStyles: {},
    colWidths: {},
    rowHeights: {},
    merges: [],
    freeze: { rows: 0, cols: 0 },
  };
}

/**
 * Make sure a loaded document has every expected field.
 *
 * @param {Object} doc
 * @returns {Object}
 */
export function normaliseDocument(doc) {
  const d = structuredClone(doc);
  d.version = d.version || 1;
  d.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
  d.sheets = (d.sheets || []).map((s) => ({
    id: s.id || newSheet(s.name || 'Sheet').id,
    name: s.name || 'Sheet',
    rows: s.rows || 50,
    cols: s.cols || 26,
    // PHP's json_decode turns an empty {} into [], and setting string keys on
    // an array is silently lost by JSON.stringify. Force plain objects.
    cells: asObject(s.cells),
    rowStyles: asObject(s.rowStyles),
    colStyles: asObject(s.colStyles),
    colWidths: asObject(s.colWidths),
    rowHeights: asObject(s.rowHeights),
    merges: Array.isArray(s.merges) ? s.merges.filter((m) => Array.isArray(m) && m.length === 4) : [],
    freeze: {
      rows: s.freeze && Number(s.freeze.rows) > 0 ? 1 : 0,
      cols: s.freeze && Number(s.freeze.cols) > 0 ? 1 : 0,
    },
  }));
  if (d.sheets.length === 0) {
    d.sheets.push(newSheet('Sheet1'));
  }
  return d;
}

/**
 * Coerce a value to a plain object. Arrays (including the empty array that PHP
 * produces from an empty JSON object) become {} but keep any string keys.
 *
 * @param {*} value
 * @returns {Object}
 */
function asObject(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }
  if (Array.isArray(value)) {
    return { ...value };
  }
  return value;
}

/**
 * Merge the column, row and cell style for one address.
 *
 * @param {Object} sheet
 * @param {string} colLetter
 * @param {number} rowIndex Zero based.
 * @param {string} a1
 * @returns {Object} Combined style patch (may be empty).
 */
export function resolveStyle(sheet, colLetter, rowIndex, a1) {
  const col = sheet.colStyles[colLetter] || {};
  const row = sheet.rowStyles[String(rowIndex)] || {};
  const cell = (sheet.cells[a1] && sheet.cells[a1].style) || {};
  return { ...col, ...row, ...cell };
}

/**
 * Return a shallow working copy for editing.
 *
 * @param {Object} doc
 * @returns {Object}
 */
function clone(doc) {
  return structuredClone(doc);
}

/**
 * Set the raw entry of a single cell.
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {string} a1
 * @param {string} raw
 * @returns {Object} New document.
 */
export function setCellRaw(doc, sheetIdx, a1, raw) {
  const d = clone(doc);
  const sheet = d.sheets[sheetIdx];
  const existing = sheet.cells[a1];
  const value = raw == null ? '' : String(raw);

  if (value === '') {
    if (existing && existing.style && Object.keys(existing.style).length) {
      delete existing.v;
      delete existing.fmt;
      delete existing.decimals;
    } else {
      delete sheet.cells[a1];
    }
  } else {
    sheet.cells[a1] = { ...(existing || {}), v: value };
  }
  return d;
}

/**
 * Apply a format change (fmt and/or decimals) to a list of addresses.
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {string[]} addresses
 * @param {{ fmt?: string, decimals?: number|null, grouping?: boolean, negRed?: boolean }} patch
 * @returns {Object}
 */
export function setCellFormat(doc, sheetIdx, addresses, patch) {
  const d = clone(doc);
  const sheet = d.sheets[sheetIdx];
  addresses.forEach((a1) => {
    const cell = sheet.cells[a1] || {};
    if (patch.fmt !== undefined) {
      cell.fmt = patch.fmt;
    }
    if (patch.decimals !== undefined) {
      cell.decimals = patch.decimals;
    }
    if (patch.grouping !== undefined) {
      if (patch.grouping) {
        delete cell.grouping; // grouping on is the default
      } else {
        cell.grouping = false;
      }
    }
    if (patch.negRed !== undefined) {
      if (patch.negRed) {
        cell.negRed = true;
      } else {
        delete cell.negRed;
      }
    }
    sheet.cells[a1] = cell;
  });
  return d;
}

/**
 * Merge a style patch into a list of cell addresses.
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {string[]} addresses
 * @param {Object} patch Style patch.
 * @returns {Object}
 */
export function setCellStyle(doc, sheetIdx, addresses, patch) {
  const d = clone(doc);
  const sheet = d.sheets[sheetIdx];
  addresses.forEach((a1) => {
    const cell = sheet.cells[a1] || {};
    cell.style = pruneStyle({ ...(cell.style || {}), ...patch });
    if (Object.keys(cell.style).length === 0) {
      delete cell.style;
    }
    sheet.cells[a1] = cell;
    if (!cell.style && cell.v === undefined) {
      delete sheet.cells[a1];
    }
  });
  return d;
}

/**
 * Apply borders to a rectangular block of cells.
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {{ minRow: number, minCol: number, maxRow: number, maxCol: number }} rect
 * @param {'none'|'all'|'box'|'bottom'|'top'} kind
 * @returns {Object}
 */
export function setCellBorders(doc, sheetIdx, rect, kind) {
  const d = clone(doc);
  const sheet = d.sheets[sheetIdx];
  for (let r = rect.minRow; r <= rect.maxRow; r += 1) {
    for (let c = rect.minCol; c <= rect.maxCol; c += 1) {
      const a1 = toA1(r, c);
      let sides = '';
      if (kind === 'all') {
        sides = 'trbl';
      } else if (kind === 'box') {
        if (r === rect.minRow) sides += 't';
        if (r === rect.maxRow) sides += 'b';
        if (c === rect.minCol) sides += 'l';
        if (c === rect.maxCol) sides += 'r';
      } else if (kind === 'bottom' && r === rect.maxRow) {
        sides = 'b';
      } else if (kind === 'top' && r === rect.minRow) {
        sides = 't';
      }
      const cell = sheet.cells[a1] || {};
      const style = { ...(cell.style || {}) };
      if (sides) {
        style.border = sides;
      } else {
        delete style.border;
      }
      cell.style = pruneStyle(style);
      if (Object.keys(cell.style).length === 0) {
        delete cell.style;
      }
      if (cell.style || cell.v !== undefined) {
        sheet.cells[a1] = cell;
      } else {
        delete sheet.cells[a1];
      }
    }
  }
  return d;
}

/**
 * Merge a style patch into a whole row.
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {number} rowIndex Zero based.
 * @param {Object} patch
 * @returns {Object}
 */
export function setRowStyle(doc, sheetIdx, rowIndex, patch) {
  const d = clone(doc);
  const sheet = d.sheets[sheetIdx];
  const key = String(rowIndex);
  sheet.rowStyles[key] = pruneStyle({ ...(sheet.rowStyles[key] || {}), ...patch });
  if (Object.keys(sheet.rowStyles[key]).length === 0) {
    delete sheet.rowStyles[key];
  }
  return d;
}

/**
 * Merge a style patch into a whole column.
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {string} colLetter
 * @param {Object} patch
 * @returns {Object}
 */
export function setColStyle(doc, sheetIdx, colLetter, patch) {
  const d = clone(doc);
  const sheet = d.sheets[sheetIdx];
  sheet.colStyles[colLetter] = pruneStyle({ ...(sheet.colStyles[colLetter] || {}), ...patch });
  if (Object.keys(sheet.colStyles[colLetter]).length === 0) {
    delete sheet.colStyles[colLetter];
  }
  return d;
}

/**
 * Drop style keys that carry no value, so empty styles can be removed.
 *
 * @param {Object} style
 * @returns {Object}
 */
function pruneStyle(style) {
  const out = {};
  Object.entries(style).forEach(([k, v]) => {
    if (v === '' || v === null || v === undefined || v === false) {
      return;
    }
    out[k] = v;
  });
  return out;
}

/**
 * Add rows to a sheet.
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {number} count
 * @returns {Object}
 */
export function addRows(doc, sheetIdx, count) {
  const d = clone(doc);
  d.sheets[sheetIdx].rows += count;
  return d;
}

/**
 * Add columns to a sheet.
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {number} count
 * @returns {Object}
 */
export function addCols(doc, sheetIdx, count) {
  const d = clone(doc);
  d.sheets[sheetIdx].cols += count;
  return d;
}

/**
 * Add a new sheet, returning the new document and the new index.
 *
 * @param {Object} doc
 * @returns {{ doc: Object, index: number }}
 */
export function addSheet(doc) {
  const d = clone(doc);
  const base = 'Sheet';
  let n = d.sheets.length + 1;
  let name = `${base}${n}`;
  const taken = new Set(d.sheets.map((s) => s.name.toLowerCase()));
  while (taken.has(name.toLowerCase())) {
    n += 1;
    name = `${base}${n}`;
  }
  d.sheets.push(newSheet(name));
  return { doc: d, index: d.sheets.length - 1 };
}

/**
 * Rename a sheet. No-ops on a clash with another sheet.
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {string} name
 * @returns {Object}
 */
export function renameSheet(doc, sheetIdx, name) {
  const trimmed = name.trim();
  if (!trimmed) {
    return doc;
  }
  const clash = doc.sheets.some((s, i) => i !== sheetIdx && s.name.toLowerCase() === trimmed.toLowerCase());
  if (clash) {
    return doc;
  }
  const d = clone(doc);
  d.sheets[sheetIdx].name = trimmed;
  return d;
}

/**
 * Remove a sheet (never the last one).
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @returns {Object}
 */
export function removeSheet(doc, sheetIdx) {
  if (doc.sheets.length <= 1) {
    return doc;
  }
  const d = clone(doc);
  d.sheets.splice(sheetIdx, 1);
  return d;
}

/**
 * Update workbook format settings.
 *
 * @param {Object} doc
 * @param {Object} patch
 * @returns {Object}
 */
export function setSettings(doc, patch) {
  const d = clone(doc);
  d.settings = { ...d.settings, ...patch };
  return d;
}

/**
 * Set a column width.
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {string} colLetter
 * @param {number} width
 * @returns {Object}
 */
export function setColWidth(doc, sheetIdx, colLetter, width) {
  const d = clone(doc);
  d.sheets[sheetIdx].colWidths[colLetter] = Math.max(40, Math.round(width));
  return d;
}

/**
 * Set a row height.
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {number} rowIndex Zero based.
 * @param {number} height
 * @returns {Object}
 */
export function setRowHeight(doc, sheetIdx, rowIndex, height) {
  const d = clone(doc);
  d.sheets[sheetIdx].rowHeights[String(rowIndex)] = Math.max(20, Math.round(height));
  return d;
}

/**
 * Find the merge (if any) that covers a cell.
 *
 * @param {Object} sheet
 * @param {number} row Zero based.
 * @param {number} col Zero based.
 * @returns {[number, number, number, number] | null} [anchorRow, anchorCol, rowSpan, colSpan]
 */
export function findMerge(sheet, row, col) {
  const merges = sheet.merges || [];
  for (let i = 0; i < merges.length; i += 1) {
    const [r, c, rs, cs] = merges[i];
    if (row >= r && row < r + rs && col >= c && col < c + cs) {
      return merges[i];
    }
  }
  return null;
}

/**
 * Merge a rectangular block of cells. Any existing merge that overlaps the
 * block is removed first. A 1x1 block is a no-op.
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {number} minRow
 * @param {number} minCol
 * @param {number} maxRow
 * @param {number} maxCol
 * @returns {Object}
 */
export function mergeCells(doc, sheetIdx, minRow, minCol, maxRow, maxCol) {
  const rs = maxRow - minRow + 1;
  const cs = maxCol - minCol + 1;
  if (rs <= 1 && cs <= 1) {
    return doc;
  }
  const d = clone(doc);
  const sheet = d.sheets[sheetIdx];
  sheet.merges = (sheet.merges || []).filter(([r, c, mr, mc]) => {
    const overlap = r < minRow + rs && r + mr > minRow && c < minCol + cs && c + mc > minCol;
    return !overlap;
  });
  sheet.merges.push([minRow, minCol, rs, cs]);
  return d;
}

/**
 * Remove the merge covering a cell.
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {number} row
 * @param {number} col
 * @returns {Object}
 */
export function unmergeCells(doc, sheetIdx, row, col) {
  const d = clone(doc);
  const sheet = d.sheets[sheetIdx];
  sheet.merges = (sheet.merges || []).filter(([r, c, rs, cs]) => {
    return !(row >= r && row < r + rs && col >= c && col < c + cs);
  });
  return d;
}

/**
 * Set the frozen row / column state (0 or 1 of each).
 *
 * @param {Object} doc
 * @param {number} sheetIdx
 * @param {{ rows?: number, cols?: number }} patch
 * @returns {Object}
 */
export function setFreeze(doc, sheetIdx, patch) {
  const d = clone(doc);
  const f = d.sheets[sheetIdx].freeze || { rows: 0, cols: 0 };
  d.sheets[sheetIdx].freeze = {
    rows: patch.rows !== undefined ? (patch.rows ? 1 : 0) : f.rows,
    cols: patch.cols !== undefined ? (patch.cols ? 1 : 0) : f.cols,
  };
  return d;
}
