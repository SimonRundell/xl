/**
 * Point and click formula reference editing.
 *
 * When a cell formula is being typed and the caret sits where a value is
 * expected, clicking or dragging over other cells should insert (or replace)
 * an A1 reference at the caret rather than ending the edit.
 *
 * @module engine/formulaRefs
 */

import { toA1 } from './cellAddress.js';

/** One A1 reference token, e.g. B2 or $B$2. */
const REF = '\\$?[A-Za-z]{1,3}\\$?\\d{1,7}';
const TRAILING_REF = new RegExp(`(${REF}(?::${REF})?)$`);

/** Characters after which a reference is a valid next token. */
const OPERAND_BEFORE = /[=(,+\-*/^%<>&:]$/;

/**
 * If the caret sits at the end of a reference token that a click should swap
 * out (rather than append to), return that token's start index. Otherwise
 * return the caret unchanged.
 *
 * @param {string} text
 * @param {number} caret
 * @returns {number}
 */
export function replaceableRefStart(text, caret) {
  const before = text.slice(0, caret);
  const match = before.match(TRAILING_REF);
  if (!match) {
    return caret;
  }
  const start = caret - match[0].length;
  const preceding = before.slice(0, start).replace(/\s+$/, '');
  if (start === 0 || !preceding.startsWith('=')) {
    return caret;
  }
  return OPERAND_BEFORE.test(preceding) ? start : caret;
}

/**
 * Would a reference be a valid next token at this caret position?
 *
 * @param {string} text  The formula text (should start with "=").
 * @param {number} caret  Caret index.
 * @returns {boolean}
 */
export function expectsOperand(text, caret) {
  const before = text.slice(0, caret).replace(/\s+$/, '');
  if (!before.startsWith('=')) {
    return false;
  }
  if (OPERAND_BEFORE.test(before)) {
    return true;
  }
  return replaceableRefStart(text, caret) < caret;
}

/**
 * Build an A1 reference (or range) from two zero based cell positions.
 *
 * @param {{ r: number, c: number }} a
 * @param {{ r: number, c: number }} b
 * @returns {string}
 */
export function rangeRef(a, b) {
  const r1 = Math.min(a.r, b.r);
  const r2 = Math.max(a.r, b.r);
  const c1 = Math.min(a.c, b.c);
  const c2 = Math.max(a.c, b.c);
  const from = toA1(r1, c1);
  return r1 === r2 && c1 === c2 ? from : `${from}:${toA1(r2, c2)}`;
}

/**
 * Insert (or replace) a reference at the caret.
 *
 * @param {string} text  Current formula text.
 * @param {number} caret  Caret index.
 * @param {string} ref  Reference text to insert.
 * @returns {{ text: string, caret: number }}
 */
export function insertRefAt(text, caret, ref) {
  const start = replaceableRefStart(text, caret);
  return {
    text: text.slice(0, start) + ref + text.slice(caret),
    caret: start + ref.length,
  };
}
