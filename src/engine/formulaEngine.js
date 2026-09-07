/**
 * Thin wrapper around HyperFormula.
 *
 * One engine instance holds every sheet in a workbook. Cross sheet references
 * such as =Sheet2!A1 work because each sheet is registered by name.
 *
 * HyperFormula is dual licensed (AGPL v3 / commercial). We pass the
 * 'gpl-v3' key, which is appropriate for a freely shared educational tool.
 *
 * @module engine/formulaEngine
 */

import { HyperFormula } from 'hyperformula';
import { toA1 } from './cellAddress.js';

/** Curated list of supported functions, shown in the help drawer / autocomplete. */
export const SUPPORTED_FUNCTIONS = [
  'SUM', 'AVERAGE', 'COUNT', 'COUNTA', 'COUNTBLANK', 'MAX', 'MIN', 'MEDIAN',
  'COUNTIF', 'COUNTIFS', 'SUMIF', 'SUMIFS', 'AVERAGEIF',
  'IF', 'IFS', 'IFERROR', 'AND', 'OR', 'NOT', 'ISBLANK', 'ISNUMBER', 'ISTEXT',
  'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH', 'CHOOSE',
  'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'INT', 'ABS', 'MOD', 'POWER', 'SQRT',
  'CONCATENATE', 'LEFT', 'RIGHT', 'MID', 'LEN', 'TRIM', 'UPPER', 'LOWER', 'PROPER', 'TEXT',
  'TODAY', 'NOW', 'DATE', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'WEEKDAY',
];

const BASE_CONFIG = {
  licenseKey: 'gpl-v3',
  dateFormats: ['DD/MM/YYYY', 'DD/MM/YY', 'D/M/YYYY'],
  timeFormats: ['HH:mm:ss', 'HH:mm'],
  smartRounding: true,
  useArrayArithmetic: true,
};

/**
 * @typedef {Object} Engine
 * @property {import('hyperformula').HyperFormula} hf
 * @property {(sheetName: string) => number} sheetId
 * @property {(sheetName: string, row: number, col: number) => *} getValue
 * @property {(sheetName: string, row: number, col: number, raw: string) => void} setCell
 * @property {() => void} destroy
 */

/**
 * Build an engine from a workbook document.
 *
 * @param {Object} doc Workbook document ({ sheets: [...] }).
 * @returns {Engine}
 */
export function createEngine(doc) {
  const hf = HyperFormula.buildEmpty(BASE_CONFIG);

  // Excel accepts the bare words TRUE and FALSE as boolean literals (for
  // example the last argument of VLOOKUP). HyperFormula only knows TRUE() and
  // FALSE(), so register the bare words as named values.
  try {
    hf.addNamedExpression('TRUE', true);
    hf.addNamedExpression('FALSE', false);
  } catch {
    // Already registered on a shared instance - safe to ignore.
  }

  /** @type {Record<string, number>} */
  const ids = {};

  doc.sheets.forEach((sheet) => {
    const actualName = hf.addSheet(sheet.name);
    const id = hf.getSheetId(actualName);
    ids[sheet.name] = id;

    const grid = [];
    for (let r = 0; r < sheet.rows; r += 1) {
      const row = new Array(sheet.cols).fill(null);
      for (let c = 0; c < sheet.cols; c += 1) {
        const cell = sheet.cells ? sheet.cells[toA1(r, c)] : null;
        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
          row[c] = cell.v;
        }
      }
      grid.push(row);
    }
    hf.setSheetContent(id, grid);
  });

  return {
    hf,
    sheetId: (name) => ids[name],
    getValue: (name, row, col) => {
      const id = ids[name];
      if (id === undefined) {
        return null;
      }
      return hf.getCellValue({ sheet: id, row, col });
    },
    setCell: (name, row, col, raw) => {
      const id = ids[name];
      if (id === undefined) {
        return;
      }
      const value = raw === '' || raw === null || raw === undefined ? null : raw;
      hf.setCellContents({ sheet: id, row, col }, value);
    },
    destroy: () => hf.destroy(),
  };
}

/**
 * A structural signature. When it changes the engine must be rebuilt
 * (sheet added / removed / renamed / resized). Cell edits do not change it.
 *
 * @param {Object} doc
 * @returns {string}
 */
export function structuralKey(doc) {
  return doc.sheets.map((s) => `${s.name}:${s.rows}x${s.cols}`).join('|');
}
