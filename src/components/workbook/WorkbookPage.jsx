/**
 * Workbook editor. Ties together the engine, the grid, the sheet tabs, the
 * formula bar, the formatting toolbar and saving.
 *
 * @module components/workbook/WorkbookPage
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { apiError } from '../../api/client.js';
import { createEngine, structuralKey } from '../../engine/formulaEngine.js';
import { colToLetters, fromA1, toA1 } from '../../engine/cellAddress.js';
import { preloadDocumentFonts } from '../../engine/fonts.js';
import {
  addCols,
  addRows,
  addSheet as addSheetToDoc,
  deleteCol,
  deleteRow,
  findMerge,
  mergeCells,
  normaliseDocument,
  removeSheet as removeSheetFromDoc,
  renameSheet as renameSheetInDoc,
  resolveStyle,
  setCellBorders,
  setCellFormat,
  setCellRaw,
  setCellStyle,
  setColStyle,
  setColWidth,
  setFreeze,
  setRowHeight,
  setRowStyle,
  setSettings,
  unmergeCells,
} from '../../engine/workbookModel.js';
import Grid from './Grid.jsx';
import SheetTabs from './SheetTabs.jsx';
import FormulaBar from './FormulaBar.jsx';
import FormatToolbar from './FormatToolbar.jsx';
import { Modal } from '../common/Modal.jsx';

/**
 * @returns {import('react').ReactElement}
 */
export default function WorkbookPage() {
  const { id } = useParams();
  const workbookId = Number(id);

  const [doc, setDoc] = useState(null);
  const [name, setName] = useState('');
  const [loadError, setLoadError] = useState('');
  const [sheetIndex, setSheetIndex] = useState(0);
  const [activeCell, setActiveCell] = useState(null);
  const [selection, setSelection] = useState([]);
  const [scope, setScope] = useState('cell');
  const [calcTick, setCalcTick] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Latest document, for the async save handler. Updated after render.
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  // -- load ----------------------------------------------------------------
  useEffect(() => {
    let active = true;
    setDoc(null);
    setLoadError('');
    (async () => {
      try {
        const { data } = await api.get('/workbooks/get.php', { params: { id: workbookId } });
        if (!active) {
          return;
        }
        const normalised = normaliseDocument(data.workbook.document);
        preloadDocumentFonts(normalised);
        setDoc(normalised);
        setName(data.workbook.name);
        setSheetIndex(0);
        setActiveCell(null);
        setSelection([]);
        setDirty(false);
      } catch (err) {
        if (active) {
          setLoadError(apiError(err, 'Could not open that workbook.'));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [workbookId]);

  // -- engine ------------------------------------------------------------
  // Rebuilt only when the structure changes (sheet added / removed / renamed /
  // resized). Cell edits mutate the same instance through engine.setCell.
  const structKey = doc ? structuralKey(doc) : '';
  const engine = useMemo(
    () => (doc ? createEngine(doc) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structKey],
  );
  useEffect(() => () => engine && engine.destroy(), [engine]);
  useEffect(() => {
    if (engine) {
      setCalcTick((t) => t + 1);
    }
  }, [engine]);

  // -- unsaved guard ---------------------------------------------------
  useEffect(() => {
    /** @param {BeforeUnloadEvent} e */
    const onBeforeUnload = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const sheet = doc ? doc.sheets[Math.min(sheetIndex, doc.sheets.length - 1)] : null;
  const safeSheetIndex = doc ? Math.min(sheetIndex, doc.sheets.length - 1) : 0;

  // -- editing ---------------------------------------------------------
  const applyCellChanges = useCallback(
    (changes) => {
      if (!engine || !sheet) {
        return;
      }
      setDoc((prev) => {
        let d = prev;
        changes.forEach(({ a1, raw }) => {
          d = setCellRaw(d, safeSheetIndex, a1, raw);
        });
        return d;
      });
      changes.forEach(({ a1, raw }) => {
        const pos = fromA1(a1);
        if (pos) {
          engine.setCell(sheet.name, pos.row, pos.col, raw);
        }
      });
      setCalcTick((t) => t + 1);
      setDirty(true);
    },
    [engine, sheet, safeSheetIndex],
  );

  /**
   * Expand the current target into a list of addresses, honouring the scope.
   *
   * @returns {string[]}
   */
  const targetAddresses = useCallback(() => {
    if (!sheet) {
      return [];
    }
    const base = selection.length ? selection : activeCell ? [activeCell] : [];
    if (base.length === 0) {
      return [];
    }
    if (scope === 'row') {
      const rowSet = new Set(base.map((a) => fromA1(a).row));
      const out = [];
      rowSet.forEach((r) => {
        for (let c = 0; c < sheet.cols; c += 1) {
          out.push(toA1(r, c));
        }
      });
      return out;
    }
    if (scope === 'column') {
      const colSet = new Set(base.map((a) => fromA1(a).col));
      const out = [];
      colSet.forEach((c) => {
        for (let r = 0; r < sheet.rows; r += 1) {
          out.push(toA1(r, c));
        }
      });
      return out;
    }
    return base;
  }, [sheet, selection, activeCell, scope]);

  const applyStyle = useCallback(
    (patch) => {
      if (!sheet) {
        return;
      }
      const base = selection.length ? selection : activeCell ? [activeCell] : [];
      if (base.length === 0) {
        return;
      }
      setDoc((prev) => {
        let d = prev;
        if (scope === 'row') {
          const rowSet = new Set(base.map((a) => fromA1(a).row));
          rowSet.forEach((r) => {
            d = setRowStyle(d, safeSheetIndex, r, patch);
          });
        } else if (scope === 'column') {
          const colSet = new Set(base.map((a) => colToLetters(fromA1(a).col)));
          colSet.forEach((c) => {
            d = setColStyle(d, safeSheetIndex, c, patch);
          });
        } else {
          d = setCellStyle(d, safeSheetIndex, base, patch);
        }
        return d;
      });
      setCalcTick((t) => t + 1);
      setDirty(true);
    },
    [sheet, selection, activeCell, scope, safeSheetIndex],
  );

  const applyFormat = useCallback(
    (patch) => {
      const addresses = targetAddresses();
      if (addresses.length === 0) {
        return;
      }
      setDoc((prev) => setCellFormat(prev, safeSheetIndex, addresses, patch));
      setCalcTick((t) => t + 1);
      setDirty(true);
    },
    [targetAddresses, safeSheetIndex],
  );

  /**
   * Bounding rectangle (zero based) of the current selection / active cell.
   *
   * @returns {{ minRow: number, minCol: number, maxRow: number, maxCol: number } | null}
   */
  const selectionRect = useCallback(() => {
    const base = selection.length ? selection : activeCell ? [activeCell] : [];
    if (base.length === 0) {
      return null;
    }
    let minRow = Infinity;
    let minCol = Infinity;
    let maxRow = -Infinity;
    let maxCol = -Infinity;
    base.forEach((a) => {
      const p = fromA1(a);
      minRow = Math.min(minRow, p.row);
      maxRow = Math.max(maxRow, p.row);
      minCol = Math.min(minCol, p.col);
      maxCol = Math.max(maxCol, p.col);
    });
    return { minRow, minCol, maxRow, maxCol };
  }, [selection, activeCell]);

  const applyBorder = useCallback(
    (kind) => {
      const rect = selectionRect();
      if (!rect) {
        return;
      }
      setDoc((prev) => setCellBorders(prev, safeSheetIndex, rect, kind));
      setCalcTick((t) => t + 1);
      setDirty(true);
    },
    [selectionRect, safeSheetIndex],
  );

  const handleColWidth = useCallback(
    (letter, width) => {
      setDoc((prev) => setColWidth(prev, safeSheetIndex, letter, width));
      setDirty(true);
    },
    [safeSheetIndex],
  );

  const handleRowHeight = useCallback(
    (rowIndex, height) => {
      setDoc((prev) => setRowHeight(prev, safeSheetIndex, rowIndex, height));
      setDirty(true);
    },
    [safeSheetIndex],
  );

  const handleMerge = useCallback(() => {
    const rect = selectionRect();
    if (!rect) {
      return;
    }
    setDoc((prev) =>
      mergeCells(prev, safeSheetIndex, rect.minRow, rect.minCol, rect.maxRow, rect.maxCol),
    );
    setCalcTick((t) => t + 1);
    setDirty(true);
  }, [selectionRect, safeSheetIndex]);

  const handleUnmerge = useCallback(() => {
    const rect = selectionRect();
    if (!rect) {
      return;
    }
    setDoc((prev) => unmergeCells(prev, safeSheetIndex, rect.minRow, rect.minCol));
    setCalcTick((t) => t + 1);
    setDirty(true);
  }, [selectionRect, safeSheetIndex]);

  // These mutate the live formula engine (so formula references get rewritten
  // correctly), which is a side effect that must run exactly once. That rules
  // out the setDoc(prev => ...) updater form: React (Strict Mode in
  // development, and potentially concurrent rendering) may invoke an updater
  // function more than once per call. Compute the next document from the doc
  // already in scope instead, and hand setDoc a plain value.
  const handleDeleteRow = useCallback(
    (rowIndex) => {
      if (!engine || !doc) {
        return;
      }
      setDoc(deleteRow(doc, safeSheetIndex, rowIndex, engine));
      setActiveCell(null);
      setSelection([]);
      setCalcTick((t) => t + 1);
      setDirty(true);
    },
    [doc, engine, safeSheetIndex],
  );

  const handleDeleteColumn = useCallback(
    (colIndex) => {
      if (!engine || !doc) {
        return;
      }
      setDoc(deleteCol(doc, safeSheetIndex, colIndex, engine));
      setActiveCell(null);
      setSelection([]);
      setCalcTick((t) => t + 1);
      setDirty(true);
    },
    [doc, engine, safeSheetIndex],
  );

  const handleFreeze = useCallback(
    (patch) => {
      setDoc((prev) => setFreeze(prev, safeSheetIndex, patch));
      setDirty(true);
    },
    [safeSheetIndex],
  );

  // -- sheets --------------------------------------------------------
  const handleAddSheet = () => {
    if (!doc) {
      return;
    }
    const { doc: next, index } = addSheetToDoc(doc);
    setDoc(next);
    setSheetIndex(index);
    setActiveCell(null);
    setSelection([]);
    setDirty(true);
  };

  const handleRenameSheet = (index, newName) => {
    setDoc((prev) => renameSheetInDoc(prev, index, newName));
    setDirty(true);
  };

  const handleRemoveSheet = (index) => {
    setDoc((prev) => removeSheetFromDoc(prev, index));
    setSheetIndex((i) => Math.max(0, i >= index ? i - 1 : i));
    setDirty(true);
  };

  const handleSelectSheet = (index) => {
    setSheetIndex(index);
    setActiveCell(null);
    setSelection([]);
  };

  // -- save --------------------------------------------------------
  const save = useCallback(async () => {
    if (!docRef.current || saving) {
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await api.post('/workbooks/save.php', {
        id: workbookId,
        name: name.trim() || 'Untitled',
        document: docRef.current,
      });
      setDirty(false);
    } catch (err) {
      setSaveError(apiError(err, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  }, [workbookId, name, saving]);

  useEffect(() => {
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // -- render -----------------------------------------------------
  if (loadError) {
    return (
      <div className="page">
        <div className="form-error">{loadError}</div>
        <Link className="btn" to="/workbooks">
          Back to workbooks
        </Link>
      </div>
    );
  }

  if (!doc || !engine || !sheet) {
    return (
      <div className="center-fill">
        <div className="spinner" />
      </div>
    );
  }

  const activePos = activeCell ? fromA1(activeCell) : null;
  const activeStyle = activePos
    ? resolveStyle(sheet, colToLetters(activePos.col), activePos.row, activeCell)
    : {};
  const activeCellData = activeCell ? sheet.cells[activeCell] : null;
  const activeFormat = {
    fmt: (activeCellData && activeCellData.fmt) || 'auto',
    decimals: activeCellData && activeCellData.decimals != null ? activeCellData.decimals : null,
    grouping: !(activeCellData && activeCellData.grouping === false),
    negRed: !!(activeCellData && activeCellData.negRed),
  };
  const activeRaw = activeCellData && activeCellData.v != null ? activeCellData.v : '';

  const rect = selectionRect();
  const activeMerge = activePos ? findMerge(sheet, activePos.row, activePos.col) : null;
  const canMerge =
    !!rect && (rect.maxRow > rect.minRow || rect.maxCol > rect.minCol) && !activeMerge;
  const freezeState = sheet.freeze || { rows: 0, cols: 0 };

  return (
    <div className="editor">
      <div className="editor-bar">
        <input
          className="wb-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          maxLength={120}
          aria-label="Workbook name"
        />
        <span className={`save-state${dirty ? ' dirty' : ''}`}>
          {saving ? 'Saving...' : dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
          Save
        </button>
        <div className="spacer" />
        <button type="button" className="btn btn-sm" onClick={() => setDoc((d) => addRows(d, safeSheetIndex, 20))}>
          + 20 rows
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setDoc((d) => addCols(d, safeSheetIndex, 5))}>
          + 5 columns
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setShowSettings(true)}>
          Formats
        </button>
        <Link className="btn btn-sm" to="/workbooks">
          Close
        </Link>
      </div>

      {saveError && <div className="form-error bar-error">{saveError}</div>}

      <FormatToolbar
        disabled={!activeCell && selection.length === 0}
        scope={scope}
        onScopeChange={setScope}
        activeStyle={activeStyle}
        activeFormat={activeFormat}
        onStyle={applyStyle}
        onFormat={applyFormat}
        onBorder={applyBorder}
        canMerge={canMerge}
        isMerged={!!activeMerge}
        onMerge={handleMerge}
        onUnmerge={handleUnmerge}
        freeze={freezeState}
        onFreeze={handleFreeze}
      />

      <FormulaBar
        address={activeCell}
        raw={activeRaw}
        onCommit={(raw) => applyCellChanges([{ a1: activeCell, raw }])}
      />

      <Grid
        doc={doc}
        sheetIndex={safeSheetIndex}
        engine={engine}
        calcTick={calcTick}
        activeCell={activeCell}
        onCellChanges={applyCellChanges}
        onActiveCell={setActiveCell}
        onSelection={setSelection}
        onColWidth={handleColWidth}
        onRowHeight={handleRowHeight}
        onDeleteRow={handleDeleteRow}
        onDeleteColumn={handleDeleteColumn}
      />

      <SheetTabs
        sheets={doc.sheets}
        activeIndex={safeSheetIndex}
        onSelect={handleSelectSheet}
        onAdd={handleAddSheet}
        onRename={handleRenameSheet}
        onRemove={handleRemoveSheet}
      />

      {showSettings && (
        <SettingsModal
          settings={doc.settings}
          onClose={() => setShowSettings(false)}
          onSave={(patch) => {
            setDoc((d) => setSettings(d, patch));
            setDirty(true);
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Workbook format settings dialog.
 *
 * @param {{
 *   settings: Object,
 *   onClose: () => void,
 *   onSave: (patch: Object) => void
 * }} props
 */
function SettingsModal({ settings, onClose, onSave }) {
  const [form, setForm] = useState({ ...settings });
  const bind = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal
      title="Workbook formats"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              onSave({
                dateFormat: form.dateFormat,
                timeFormat: form.timeFormat,
                dateTimeFormat: form.dateTimeFormat,
                currencySymbol: form.currencySymbol,
                currencyDecimals: Number(form.currencyDecimals) || 0,
              })
            }
          >
            Apply
          </button>
        </>
      }
    >
      <label className="field">
        <span>Date format</span>
        <input className="input" value={form.dateFormat} onChange={bind('dateFormat')} />
      </label>
      <label className="field">
        <span>Time format</span>
        <input className="input" value={form.timeFormat} onChange={bind('timeFormat')} />
      </label>
      <label className="field">
        <span>Date and time format</span>
        <input className="input" value={form.dateTimeFormat} onChange={bind('dateTimeFormat')} />
      </label>
      <label className="field">
        <span>Currency symbol</span>
        <input className="input" value={form.currencySymbol} onChange={bind('currencySymbol')} maxLength={3} />
      </label>
      <label className="field">
        <span>Currency decimal places</span>
        <input
          className="input"
          type="number"
          min={0}
          max={4}
          value={form.currencyDecimals}
          onChange={bind('currencyDecimals')}
        />
      </label>
      <p className="muted">
        Tokens: <span className="code">dd MM yyyy HH mm ss</span> (also <span className="code">d M yy h tt</span>).
      </p>
    </Modal>
  );
}
