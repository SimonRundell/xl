/**
 * The spreadsheet grid.
 *
 * Rendering, selection, keyboard navigation and copy / paste are handled by
 * react-datasheet-grid. Values are computed by the shared HyperFormula engine.
 *
 * The engine, the current sheet and the workbook settings are passed to the
 * cell components through React context rather than through DataSheetGrid's
 * column data, because DataSheetGrid memoises column data and would otherwise
 * keep showing stale styles after a formatting change.
 *
 * Point and click formula building: while a cell formula is being typed and
 * the caret sits where a value is expected, a mousedown / drag over other
 * cells inserts an A1 reference into the formula instead of ending the edit.
 * A window level capture listener intercepts those clicks before DataSheetGrid
 * sees them.
 *
 * @module components/workbook/Grid
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DataSheetGrid } from 'react-datasheet-grid';
import { columnLetters, colToLetters, fromA1, lettersToCol, toA1 } from '../../engine/cellAddress.js';
import { formatValue } from '../../engine/formats.js';
import { findMerge, resolveStyle } from '../../engine/workbookModel.js';
import { styleToCss } from '../../engine/styleCss.js';
import { expectsOperand, insertRefAt, rangeRef } from '../../engine/formulaRefs.js';
import { useElementSize } from '../../hooks/useElementSize.js';

const ROW_HEIGHT = 30;
const GUTTER_WIDTH = 44;
const DEFAULT_COL_WIDTH = 104;

/**
 * Build a CSS block that pins every column to its configured width by cell
 * position. DataSheetGrid computes widths from a ResizeObserver measurement,
 * which is unreliable in some embedded browsers; these rules make the widths
 * deterministic regardless.
 *
 * @param {string[]} letters
 * @param {Object} colWidths
 * @param {string} scopeClass
 * @returns {string}
 */
function columnWidthCss(letters, colWidths, scopeClass) {
  const rules = [
    `.${scopeClass} .dsg-cell:nth-child(1),.${scopeClass} .dsg-cell-header:nth-child(1)` +
      `{width:${GUTTER_WIDTH}px!important;min-width:${GUTTER_WIDTH}px!important;left:0!important}`,
  ];
  let left = GUTTER_WIDTH;
  letters.forEach((L, i) => {
    const w = colWidths[L] || DEFAULT_COL_WIDTH;
    const n = i + 2;
    rules.push(
      `.${scopeClass} .dsg-cell:nth-child(${n}),.${scopeClass} .dsg-cell-header:nth-child(${n})` +
        `{width:${w}px!important;min-width:${w}px!important;left:${left}px!important}`,
    );
    left += w;
  });
  rules.push(
    `.${scopeClass} .dsg-row,.${scopeClass} .dsg-row-header,.${scopeClass} .dsg-container > div{width:${left}px!important}`,
  );
  return rules.join('\n');
}

/**
 * Freeze panes: a scroll synced strip that keeps row 1 and / or column A in
 * view. DataSheetGrid has no native freeze support, so this renders read only
 * copies of those cells over the grid and translates them to match its scroll
 * position. Clicking a frozen cell selects the real one.
 *
 * @param {{
 *   gridEl: HTMLElement,
 *   sheet: Object,
 *   engine: Object,
 *   settings: Object,
 *   onPick: (a1: string) => void
 * }} props
 */
function FrozenPanes({ gridEl, sheet, engine, settings, onPick }) {
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [geom, setGeom] = useState(null);

  useEffect(() => {
    const scroller = gridEl.querySelector('.dsg-container');
    if (!scroller) {
      return undefined;
    }
    const onScroll = () => setScroll({ left: scroller.scrollLeft, top: scroller.scrollTop });
    const measure = () => {
      const corner = gridEl.querySelector('.dsg-cell-header');
      const box = gridEl.getBoundingClientRect();
      if (corner) {
        const r = corner.getBoundingClientRect();
        setGeom({
          x: r.left - box.left,
          y: r.top - box.top,
          gutter: r.width,
          header: r.height,
        });
      }
      onScroll();
    };
    measure();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    const timers = [60, 250, 700].map((ms) => setTimeout(measure, ms));
    window.addEventListener('resize', measure);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      timers.forEach(clearTimeout);
    };
  }, [gridEl, sheet]);

  if (!geom) {
    return null;
  }

  const colWidth = (c) => sheet.colWidths[colToLetters(c)] || DEFAULT_COL_WIDTH;
  const rowHeight = (r) => sheet.rowHeights[String(r)] || ROW_HEIGHT;
  const freezeRow = sheet.freeze && sheet.freeze.rows;
  const freezeCol = sheet.freeze && sheet.freeze.cols;

  const cellNode = (r, c, key) => {
    const a1 = toA1(r, c);
    const merge = findMerge(sheet, r, c);
    if (merge && !(merge[0] === r && merge[1] === c)) {
      return null; // covered by a merge whose anchor is rendered elsewhere
    }
    const value = engine.getValue(sheet.name, r, c);
    const cell = sheet.cells[a1];
    const style = resolveStyle(sheet, colToLetters(c), r, a1);
    const css = styleToCss(style);
    css.width = merge
      ? Array.from({ length: merge[3] }, (_, i) => colWidth(c + i)).reduce((a, b) => a + b, 0)
      : colWidth(c);
    css.height = rowHeight(r);
    const display = formatValue(value, {
      format: (cell && cell.fmt) || 'auto',
      decimals: cell && cell.decimals != null ? cell.decimals : null,
      grouping: !(cell && cell.grouping === false),
      settings,
      raw: cell && cell.v != null ? String(cell.v) : '',
    });
    if (cell && cell.negRed && typeof value === 'number' && value < 0) {
      css.color = '#c0392b';
    }
    return (
      <div key={key} className="xl-frozen-cell" style={css} onMouseDown={() => onPick(a1)}>
        {display}
      </div>
    );
  };

  const stripTop = geom.y + geom.header;
  const stripLeft = geom.x + geom.gutter;
  const corner = geom.gutter + colWidth(0);

  return (
    <div className="xl-frozen-layer">
      {freezeRow && (
        <div
          className="xl-frozen-strip xl-frozen-row"
          style={{ left: stripLeft, top: stripTop, right: 0, height: rowHeight(0) }}
        >
          <div className="xl-frozen-scroll" style={{ transform: `translateX(${-scroll.left}px)` }}>
            {Array.from({ length: sheet.cols }, (_, c) => cellNode(0, c, `r${c}`))}
          </div>
        </div>
      )}
      {freezeCol && (
        <div
          className="xl-frozen-strip xl-frozen-col"
          style={{ left: geom.x, top: stripTop, bottom: 0, width: corner }}
        >
          <div className="xl-frozen-scroll" style={{ transform: `translateY(${-scroll.top}px)` }}>
            {Array.from({ length: sheet.rows }, (_, r) => (
              <div key={`c${r}`} className="xl-frozen-rownum" style={{ height: rowHeight(r) }}>
                <span className="xl-frozen-gutter">{r + 1}</span>
                {cellNode(r, 0, `cc${r}`)}
              </div>
            ))}
          </div>
        </div>
      )}
      {freezeRow && freezeCol && (
        <div
          className="xl-frozen-corner"
          style={{ left: geom.x, top: stripTop, width: corner, height: rowHeight(0) }}
        >
          <span className="xl-frozen-gutter">1</span>
          {cellNode(0, 0, 'corner')}
        </div>
      )}
    </div>
  );
}

/**
 * @typedef {Object} FormulaEditorApi
 * @property {() => boolean} expectsOperand
 * @property {(ref: string) => void} insertReference
 * @property {() => void} refocus
 */

/**
 * @type {import('react').Context<{
 *   engine: Object,
 *   sheet: Object,
 *   settings: Object,
 *   registerFormulaEditor: (api: FormulaEditorApi) => void,
 *   unregisterFormulaEditor: (api: FormulaEditorApi) => void
 * } | null>}
 */
const GridContext = createContext(null);

/**
 * A single grid cell.
 *
 * While the cell is not being edited it renders a plain div showing the
 * formatted, computed value. Double click, Enter or F2 starts editing, which
 * swaps in a text input bound to the raw entry.
 *
 * @param {Object} props DSG cell props.
 */
function CellView({ rowData, setRowData, focus, rowIndex, columnData }) {
  const { letter } = columnData;
  const { engine, sheet, settings, activeCell, registerFormulaEditor, unregisterFormulaEditor } =
    useContext(GridContext);
  const a1 = `${letter}${rowIndex + 1}`;
  const colIndex = lettersToCol(letter);
  const raw = rowData && rowData[letter] != null ? String(rowData[letter]) : '';

  const inputRef = useRef(null);
  const prevFocus = useRef(false);
  const cancelled = useRef(false);
  const pendingCaret = useRef(null);
  // The reference most recently inserted by pointing, and not yet typed over.
  // While it is pending, another point / drag replaces it (rather than the
  // click ending the edit).
  const pointing = useRef(null);

  const [draft, setDraft] = useState(raw);

  // Latest render values, updated once per render in a passive effect so they
  // are not read during render. The focus effect below only reacts to focus
  // changes, but when it fires it needs the current raw entry and draft; this
  // mirrors the "async ref" that react-datasheet-grid's own text cell keeps.
  const latest = useRef({ raw, draft, rowData, setRowData, letter });
  useEffect(() => {
    latest.current = { raw, draft, rowData, setRowData, letter };
  });

  const commit = useCallback((next) => {
    const l = latest.current;
    if (next !== l.raw) {
      l.setRowData({ ...l.rowData, [l.letter]: next });
    }
  }, []);

  useLayoutEffect(() => {
    if (focus && !prevFocus.current) {
      prevFocus.current = true;
      cancelled.current = false;
      setDraft(latest.current.raw);
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    } else if (!focus && prevFocus.current) {
      prevFocus.current = false;
      if (!cancelled.current) {
        commit(latest.current.draft);
      }
    }
  }, [focus, commit]);

  // Restore the caret after a point and click reference insert (a controlled
  // input otherwise drops the caret to the end).
  useLayoutEffect(() => {
    if (pendingCaret.current != null && inputRef.current) {
      const pos = pendingCaret.current;
      pendingCaret.current = null;
      inputRef.current.focus();
      try {
        inputRef.current.setSelectionRange(pos, pos);
      } catch {
        /* input not ready */
      }
    }
  });

  const insertReference = useCallback((ref) => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    let caret = el.selectionStart != null ? el.selectionStart : el.value.length;
    let value = el.value;
    // If a pointed reference is still pending at the caret, replace exactly it.
    const p = pointing.current;
    if (p && caret === p.end && value.slice(p.start, p.end) === p.text) {
      value = value.slice(0, p.start) + value.slice(p.end);
      caret = p.start;
    }
    const result = insertRefAt(value, caret, ref);
    pointing.current = { start: result.caret - ref.length, end: result.caret, text: ref };
    pendingCaret.current = result.caret;
    latest.current = { ...latest.current, draft: result.text };
    setDraft(result.text);
  }, []);

  const expectsOperandNow = useCallback(() => {
    const el = inputRef.current;
    if (!el) {
      return false;
    }
    const caret = el.selectionStart != null ? el.selectionStart : el.value.length;
    const p = pointing.current;
    if (p && caret === p.end && el.value.slice(p.start, p.end) === p.text) {
      return true; // a pointed reference is pending, so a click replaces it
    }
    return expectsOperand(el.value, caret);
  }, []);

  const isFormula = focus && /^\s*=/.test(draft);
  useEffect(() => {
    if (!isFormula) {
      return undefined;
    }
    const api = {
      expectsOperand: expectsOperandNow,
      insertReference,
      refocus: () => inputRef.current && inputRef.current.focus(),
    };
    registerFormulaEditor(api);
    return () => unregisterFormulaEditor(api);
  }, [isFormula, expectsOperandNow, insertReference, registerFormulaEditor, unregisterFormulaEditor]);

  if (focus) {
    return (
      <input
        ref={inputRef}
        className="xl-cell-input"
        value={draft}
        onChange={(e) => {
          pointing.current = null; // typing ends any pending pointed reference
          setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            cancelled.current = true;
            pointing.current = null;
            setDraft(latest.current.raw);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
            pointing.current = null; // moving the caret ends pointing mode
          }
          // Enter and Tab are handled by DataSheetGrid, which ends editing;
          // that flips the focus prop and the layout effect commits the draft.
        }}
      />
    );
  }

  const value = engine.getValue(sheet.name, rowIndex, colIndex);
  const cell = sheet.cells[a1];
  const display = formatValue(value, {
    format: (cell && cell.fmt) || 'auto',
    decimals: cell && cell.decimals != null ? cell.decimals : null,
    grouping: !(cell && cell.grouping === false),
    settings,
    raw,
  });
  const style = resolveStyle(sheet, letter, rowIndex, a1);
  const numeric = typeof value === 'number' && !(cell && cell.fmt === 'string') && !style.align;

  const css = styleToCss(style);
  if (numeric) {
    css.justifyContent = 'flex-end';
  }
  if (cell && cell.negRed && typeof value === 'number' && value < 0) {
    css.color = '#c0392b';
  }

  // -- merged cells ----------------------------------------------------
  const merge = findMerge(sheet, rowIndex, colIndex);
  if (merge) {
    const [mr, mc, rs, cs] = merge;
    const isAnchor = rowIndex === mr && colIndex === mc;
    if (!isAnchor) {
      // Covered by a merge - render nothing (the anchor's overlay covers it).
      return <div className="xl-cell xl-merged-hidden" data-xl-cell="" data-r={rowIndex} data-c={colIndex} />;
    }
    let width = 0;
    for (let c = mc; c < mc + cs; c += 1) {
      width += sheet.colWidths[colToLetters(c)] || 104;
    }
    let height = 0;
    for (let r = mr; r < mr + rs; r += 1) {
      height += sheet.rowHeights[String(r)] || ROW_HEIGHT;
    }
    const activePos = activeCell ? fromA1(activeCell) : null;
    const mergeActive =
      activePos &&
      activePos.row >= mr &&
      activePos.row < mr + rs &&
      activePos.col >= mc &&
      activePos.col < mc + cs;
    const overlayCss = { ...css, width, height };
    if (!style.align) {
      overlayCss.justifyContent = 'center';
    }
    return (
      <div className="xl-cell xl-cell--anchor" data-xl-cell="" data-r={rowIndex} data-c={colIndex}>
        <div className={`xl-merge${mergeActive ? ' xl-merge--active' : ''}`} style={overlayCss} title={typeof display === 'string' ? display : ''}>
          {display}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`xl-cell${numeric ? ' num' : ''}`}
      style={css}
      title={typeof display === 'string' ? display : ''}
      data-xl-cell=""
      data-r={rowIndex}
      data-c={colIndex}
    >
      {display}
    </div>
  );
}

/**
 * @param {{
 *   doc: Object,
 *   sheetIndex: number,
 *   engine: Object,
 *   calcTick: number,
 *   activeCell: string | null,
 *   onCellChanges: (changes: { a1: string, raw: string }[]) => void,
 *   onActiveCell: (a1: string | null) => void,
 *   onSelection: (addresses: string[]) => void,
 *   onColWidth: (colLetter: string, width: number) => void,
 *   onRowHeight: (rowIndex: number, height: number) => void
 * }} props
 */
export default function Grid({
  doc,
  sheetIndex,
  engine,
  calcTick,
  activeCell,
  onCellChanges,
  onActiveCell,
  onSelection,
  onColWidth,
  onRowHeight,
  onDeleteRow,
  onDeleteColumn,
}) {
  const sheet = doc.sheets[sheetIndex];
  const settings = doc.settings;
  const [boxRef, size] = useElementSize();

  const rowHeightAt = useCallback(
    (i) => sheet.rowHeights[String(i)] || ROW_HEIGHT,
    [sheet.rowHeights],
  );

  // DataSheetGrid caches computed row heights and never invalidates them, and
  // its column widths only update on remount, so fold the layout into the key.
  const layoutKey = useMemo(() => {
    const w = Object.entries(sheet.colWidths || {}).sort().join();
    const h = Object.entries(sheet.rowHeights || {}).sort().join();
    const f = `${sheet.freeze ? sheet.freeze.rows : 0}${sheet.freeze ? sheet.freeze.cols : 0}`;
    return `${w}|${h}|${f}`;
  }, [sheet.colWidths, sheet.rowHeights, sheet.freeze]);

  const letters = useMemo(() => columnLetters(sheet.cols), [sheet.cols]);

  // -- point and click formula reference building -----------------------
  /** @type {import('react').MutableRefObject<FormulaEditorApi | null>} */
  const formulaEditorRef = useRef(null);
  const registerFormulaEditor = useCallback((api) => {
    formulaEditorRef.current = api;
  }, []);
  const unregisterFormulaEditor = useCallback((api) => {
    if (formulaEditorRef.current === api) {
      formulaEditorRef.current = null;
    }
  }, []);

  useEffect(() => {
    const gridEl = boxRef.current;
    if (!gridEl) {
      return undefined;
    }

    let dragging = false;
    let anchor = null;

    const cellAt = (x, y) => {
      const nodes = gridEl.querySelectorAll('[data-xl-cell]');
      for (let i = 0; i < nodes.length; i += 1) {
        const rect = nodes[i].getBoundingClientRect();
        if (x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom) {
          return { r: Number(nodes[i].dataset.r), c: Number(nodes[i].dataset.c) };
        }
      }
      return null;
    };

    const clearHint = () => {
      gridEl.querySelectorAll('.xl-ref-hint').forEach((n) => n.classList.remove('xl-ref-hint'));
    };

    const paintHint = (a, b) => {
      const r1 = Math.min(a.r, b.r);
      const r2 = Math.max(a.r, b.r);
      const c1 = Math.min(a.c, b.c);
      const c2 = Math.max(a.c, b.c);
      gridEl.querySelectorAll('[data-xl-cell]').forEach((n) => {
        const r = Number(n.dataset.r);
        const c = Number(n.dataset.c);
        n.classList.toggle('xl-ref-hint', r >= r1 && r <= r2 && c >= c1 && c <= c2);
      });
    };

    const onMove = (e) => {
      if (!dragging || !anchor) {
        return;
      }
      const cell = cellAt(e.clientX, e.clientY);
      if (!cell) {
        return;
      }
      e.preventDefault();
      paintHint(anchor, cell);
      const fe = formulaEditorRef.current;
      if (fe) {
        fe.insertReference(rangeRef(anchor, cell));
      }
    };

    const onUp = () => {
      dragging = false;
      anchor = null;
      clearHint();
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      const fe = formulaEditorRef.current;
      if (fe) {
        fe.refocus();
      }
    };

    const onDown = (e) => {
      const fe = formulaEditorRef.current;
      if (!fe || e.button !== 0) {
        return;
      }
      // A click inside the editor input is normal text cursor placement.
      if (e.target.closest && e.target.closest('.xl-cell-input')) {
        return;
      }
      const cell = cellAt(e.clientX, e.clientY);
      if (!cell) {
        return; // not a grid cell - let the click through so the edit commits
      }
      if (!fe.expectsOperand()) {
        return; // the formula does not want a reference here - let it commit
      }
      e.preventDefault(); // keep the editor input focused
      e.stopPropagation(); // stop DataSheetGrid's own mousedown handler
      dragging = true;
      anchor = cell;
      paintHint(cell, cell);
      fe.insertReference(rangeRef(cell, cell));
      window.addEventListener('mousemove', onMove, true);
      window.addEventListener('mouseup', onUp, true);
    };

    window.addEventListener('mousedown', onDown, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
      clearHint();
    };
  }, [boxRef]);

  // -- column width / row height drag on the header borders -------------
  useEffect(() => {
    const gridEl = boxRef.current;
    if (!gridEl) {
      return undefined;
    }
    const EDGE = 5;
    let drag = null;

    const colEdgeAt = (x, y) => {
      const heads = gridEl.querySelectorAll('.dsg-cell-header');
      for (let i = 0; i < heads.length; i += 1) {
        const r = heads[i].getBoundingClientRect();
        const label = heads[i].textContent.trim();
        if (
          /^[A-Z]+$/.test(label) &&
          r.width > 0 &&
          y >= r.top &&
          y <= r.bottom &&
          Math.abs(x - r.right) <= EDGE
        ) {
          return { letter: label, width: r.width, right: r.right };
        }
      }
      return null;
    };

    const rowEdgeAt = (x, y) => {
      const gutters = gridEl.querySelectorAll('.dsg-cell-gutter');
      for (let i = 0; i < gutters.length; i += 1) {
        const r = gutters[i].getBoundingClientRect();
        const label = gutters[i].textContent.trim();
        if (
          /^\d+$/.test(label) &&
          r.height > 0 &&
          x >= r.left &&
          x <= r.right &&
          Math.abs(y - r.bottom) <= EDGE
        ) {
          return { rowIndex: Number(label) - 1, height: r.height, bottom: r.bottom };
        }
      }
      return null;
    };

    const guide = (kind, screenPos) => {
      let el = gridEl.querySelector('.xl-resize-guide');
      if (!el) {
        el = document.createElement('div');
        el.className = 'xl-resize-guide';
        gridEl.appendChild(el);
      }
      const box = gridEl.getBoundingClientRect();
      if (kind === 'col') {
        el.style.cssText = `left:${screenPos - box.left}px;top:0;bottom:0;width:2px`;
      } else {
        el.style.cssText = `top:${screenPos - box.top}px;left:0;right:0;height:2px`;
      }
    };
    const hideGuide = () => {
      const el = gridEl.querySelector('.xl-resize-guide');
      if (el) {
        el.remove();
      }
    };

    const onHover = (e) => {
      if (drag) {
        return;
      }
      if (colEdgeAt(e.clientX, e.clientY)) {
        gridEl.style.cursor = 'col-resize';
      } else if (rowEdgeAt(e.clientX, e.clientY)) {
        gridEl.style.cursor = 'row-resize';
      } else {
        gridEl.style.cursor = '';
      }
    };

    const onDrag = (e) => {
      if (!drag) {
        return;
      }
      e.preventDefault();
      if (drag.kind === 'col') {
        drag.size = Math.max(40, drag.startSize + (e.clientX - drag.startPos));
        guide('col', drag.edge + (drag.size - drag.startSize));
      } else {
        drag.size = Math.max(20, drag.startSize + (e.clientY - drag.startPos));
        guide('row', drag.edge + (drag.size - drag.startSize));
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onDrag, true);
      window.removeEventListener('mouseup', onUp, true);
      document.body.style.cursor = '';
      hideGuide();
      if (drag) {
        if (drag.kind === 'col') {
          onColWidth(drag.key, drag.size);
        } else {
          onRowHeight(drag.key, drag.size);
        }
      }
      drag = null;
    };

    const onDown = (e) => {
      if (e.button !== 0) {
        return;
      }
      const ce = colEdgeAt(e.clientX, e.clientY);
      const re = ce ? null : rowEdgeAt(e.clientX, e.clientY);
      if (!ce && !re) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      drag = ce
        ? { kind: 'col', key: ce.letter, startPos: e.clientX, startSize: ce.width, size: ce.width, edge: ce.right }
        : { kind: 'row', key: re.rowIndex, startPos: e.clientY, startSize: re.height, size: re.height, edge: re.bottom };
      document.body.style.cursor = drag.kind === 'col' ? 'col-resize' : 'row-resize';
      window.addEventListener('mousemove', onDrag, true);
      window.addEventListener('mouseup', onUp, true);
    };

    const onDbl = (e) => {
      const ce = colEdgeAt(e.clientX, e.clientY);
      if (ce) {
        e.preventDefault();
        e.stopPropagation();
        const idx = lettersToCol(ce.letter);
        let widest = 64;
        gridEl.querySelectorAll(`[data-xl-cell][data-c="${idx}"]`).forEach((n) => {
          widest = Math.max(widest, n.scrollWidth + 18);
        });
        onColWidth(ce.letter, Math.min(420, widest));
        return;
      }
      const re = rowEdgeAt(e.clientX, e.clientY);
      if (re) {
        e.preventDefault();
        e.stopPropagation();
        onRowHeight(re.rowIndex, ROW_HEIGHT);
      }
    };

    gridEl.addEventListener('mousemove', onHover, true);
    gridEl.addEventListener('mousedown', onDown, true);
    gridEl.addEventListener('dblclick', onDbl, true);
    return () => {
      gridEl.removeEventListener('mousemove', onHover, true);
      gridEl.removeEventListener('mousedown', onDown, true);
      gridEl.removeEventListener('dblclick', onDbl, true);
      window.removeEventListener('mousemove', onDrag, true);
      window.removeEventListener('mouseup', onUp, true);
      hideGuide();
    };
  }, [boxRef, onColWidth, onRowHeight]);

  // -- right click context menu on a row / column header -----------------
  const [ctxMenu, setCtxMenu] = useState(null);

  useEffect(() => {
    const gridEl = boxRef.current;
    if (!gridEl) {
      return undefined;
    }

    const colHeaderAt = (x, y) => {
      const heads = gridEl.querySelectorAll('.dsg-cell-header');
      for (let i = 0; i < heads.length; i += 1) {
        const label = heads[i].textContent.trim();
        if (!/^[A-Z]+$/.test(label)) {
          continue;
        }
        const r = heads[i].getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return lettersToCol(label);
        }
      }
      return null;
    };

    const rowGutterAt = (x, y) => {
      const gutters = gridEl.querySelectorAll('.dsg-cell-gutter');
      for (let i = 0; i < gutters.length; i += 1) {
        const label = gutters[i].textContent.trim();
        if (!/^\d+$/.test(label)) {
          continue;
        }
        const r = gutters[i].getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return Number(label) - 1;
        }
      }
      return null;
    };

    const onContextMenu = (e) => {
      const col = colHeaderAt(e.clientX, e.clientY);
      const row = col == null ? rowGutterAt(e.clientX, e.clientY) : null;
      if (col == null && row == null) {
        return;
      }
      e.preventDefault();
      setCtxMenu(
        col != null
          ? { kind: 'col', index: col, x: e.clientX, y: e.clientY }
          : { kind: 'row', index: row, x: e.clientX, y: e.clientY },
      );
    };

    gridEl.addEventListener('contextmenu', onContextMenu);
    return () => gridEl.removeEventListener('contextmenu', onContextMenu);
  }, [boxRef]);

  const ctxMenuRef = useRef(null);

  useEffect(() => {
    if (!ctxMenu) {
      return undefined;
    }
    const onDown = (e) => {
      if (ctxMenuRef.current && ctxMenuRef.current.contains(e.target)) {
        return;
      }
      setCtxMenu(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setCtxMenu(null);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [ctxMenu]);

  // Context value: rebuilt whenever the sheet content or a recalculation changes.
  const contextValue = useMemo(
    () => ({ engine, sheet, settings, activeCell, registerFormulaEditor, unregisterFormulaEditor }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, sheet, settings, activeCell, calcTick, registerFormulaEditor, unregisterFormulaEditor],
  );

  const rows = useMemo(() => {
    const out = [];
    for (let r = 0; r < sheet.rows; r += 1) {
      const row = {};
      for (let c = 0; c < sheet.cols; c += 1) {
        const cell = sheet.cells[toA1(r, c)];
        if (cell && cell.v != null && cell.v !== '') {
          row[letters[c]] = cell.v;
        }
      }
      out.push(row);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, letters, calcTick]);

  // Snapshot of the rows as DataSheetGrid last saw them, used to diff its
  // onChange payload. Updated after render so it is never read during render.
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const columns = useMemo(
    () =>
      letters.map((L) => ({
        id: L,
        title: L,
        basis: sheet.colWidths[L] || 104,
        grow: 0,
        shrink: 0,
        minWidth: 46,
        component: CellView,
        columnData: { letter: L },
        copyValue: ({ rowData }) => (rowData && rowData[L] != null ? String(rowData[L]) : ''),
        pasteValue: ({ rowData, value }) => ({
          ...rowData,
          [L]: value == null ? '' : String(value).replace(/\r?\n$/, ''),
        }),
        deleteValue: ({ rowData }) => {
          const next = { ...rowData };
          delete next[L];
          return next;
        },
        isCellEmpty: ({ rowData }) => !rowData || rowData[L] == null || rowData[L] === '',
      })),
    [letters, sheet.colWidths],
  );

  const handleChange = useCallback(
    (next) => {
      const prev = rowsRef.current;
      const changes = [];
      const limit = Math.max(prev.length, next.length);
      for (let r = 0; r < limit; r += 1) {
        const a = prev[r] || {};
        const b = next[r] || {};
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        keys.forEach((L) => {
          const before = a[L] == null ? '' : String(a[L]);
          const after = b[L] == null ? '' : String(b[L]);
          if (before !== after) {
            changes.push({ a1: `${L}${r + 1}`, raw: after });
          }
        });
      }
      if (changes.length) {
        onCellChanges(changes);
      }
    },
    [onCellChanges],
  );

  const handleActive = useCallback(
    ({ cell }) => {
      if (!cell) {
        // DataSheetGrid reports a null active cell whenever the grid loses
        // focus, for example when the user reaches for the format toolbar.
        // Keep the last cell as the formatting target (Excel and Sheets do the
        // same); sheet switches and workbook loads clear it explicitly.
        return;
      }
      // Selecting inside a merge reports the merge's anchor cell.
      const merge = findMerge(sheet, cell.row, cell.col);
      if (merge) {
        onActiveCell(toA1(merge[0], merge[1]));
        return;
      }
      onActiveCell(toA1(cell.row, cell.col));
    },
    [onActiveCell, sheet],
  );

  const handleSelection = useCallback(
    ({ selection }) => {
      if (!selection) {
        onSelection([]);
        return;
      }
      const { min, max } = selection;
      const list = [];
      for (let r = min.row; r <= max.row; r += 1) {
        for (let c = min.col; c <= max.col; c += 1) {
          list.push(toA1(r, c));
        }
      }
      onSelection(list);
    },
    [onSelection],
  );

  const widthCss = useMemo(
    () => columnWidthCss(letters, sheet.colWidths, 'xl-sized'),
    [letters, sheet.colWidths],
  );

  const hasFreeze = sheet.freeze && (sheet.freeze.rows || sheet.freeze.cols);

  return (
    <div className="grid-area xl-sized" ref={boxRef}>
      <style>{widthCss}</style>
      <GridContext.Provider value={contextValue}>
        <DataSheetGrid
          key={`${sheet.id}:${layoutKey}`}
          value={rows}
          onChange={handleChange}
          columns={columns}
          height={size.height || 420}
          rowHeight={({ rowIndex }) => rowHeightAt(rowIndex)}
          lockRows
          addRowsComponent={false}
          onActiveCellChange={handleActive}
          onSelectionChange={handleSelection}
        />
      </GridContext.Provider>
      {hasFreeze && boxRef.current && (
        <FrozenPanes
          gridEl={boxRef.current}
          sheet={sheet}
          engine={engine}
          settings={settings}
          onPick={onActiveCell}
        />
      )}
      {ctxMenu && (
        <div
          ref={ctxMenuRef}
          className="xl-ctx-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
        >
          {ctxMenu.kind === 'row' ? (
            <button
              type="button"
              className="xl-ctx-menu-item"
              disabled={sheet.rows <= 1}
              onClick={() => {
                onDeleteRow(ctxMenu.index);
                setCtxMenu(null);
              }}
            >
              Delete row {ctxMenu.index + 1}
            </button>
          ) : (
            <button
              type="button"
              className="xl-ctx-menu-item"
              disabled={sheet.cols <= 1}
              onClick={() => {
                onDeleteColumn(ctxMenu.index);
                setCtxMenu(null);
              }}
            >
              Delete column {colToLetters(ctxMenu.index)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
