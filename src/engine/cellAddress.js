/**
 * Helpers for converting between A1 style cell addresses and zero based
 * row / column indexes.
 *
 * @module engine/cellAddress
 */

/**
 * Convert a zero based column index to letters (0 => A, 25 => Z, 26 => AA).
 *
 * @param {number} col
 * @returns {string}
 */
export function colToLetters(col) {
  let n = col;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/**
 * Convert column letters to a zero based index (A => 0, AA => 26).
 *
 * @param {string} letters
 * @returns {number}
 */
export function lettersToCol(letters) {
  let n = 0;
  const up = letters.toUpperCase();
  for (let i = 0; i < up.length; i += 1) {
    n = n * 26 + (up.charCodeAt(i) - 64);
  }
  return n - 1;
}

/**
 * Build an A1 address from zero based row / column indexes.
 *
 * @param {number} row
 * @param {number} col
 * @returns {string}
 */
export function toA1(row, col) {
  return `${colToLetters(col)}${row + 1}`;
}

/**
 * Parse an A1 address into zero based indexes, or null if it is not one.
 *
 * @param {string} a1
 * @returns {{ row: number, col: number } | null}
 */
export function fromA1(a1) {
  const m = /^([A-Za-z]+)(\d+)$/.exec(a1.trim());
  if (!m) {
    return null;
  }
  return { row: Number(m[2]) - 1, col: lettersToCol(m[1]) };
}

/**
 * Produce the ordered list of column letters for a sheet width.
 *
 * @param {number} cols
 * @returns {string[]}
 */
export function columnLetters(cols) {
  const out = [];
  for (let c = 0; c < cols; c += 1) {
    out.push(colToLetters(c));
  }
  return out;
}
