/**
 * Formatting toolbar.
 *
 * Applies style and value-format changes to the current selection, or to the
 * whole active row / column when the scope selector is switched. Also carries
 * the borders, merge and freeze controls.
 *
 * The pickers use the custom {@link Dropdown} control rather than a native
 * <select> so that the popup always renders (an OS drawn <select> list does
 * not show in every browser or embedded view) and so the font picker can
 * preview each typeface.
 *
 * @module components/workbook/FormatToolbar
 */

import Dropdown from '../common/Dropdown.jsx';
import { CELL_FORMATS, NUMERIC_FORMATS } from '../../engine/formats.js';
import { FONT_LIST, ensureFont, fontStack } from '../../engine/fonts.js';

const SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];

const SCOPE_OPTIONS = [
  { value: 'cell', label: 'Selected cells' },
  { value: 'row', label: 'Entire row' },
  { value: 'column', label: 'Entire column' },
];

const BORDER_OPTIONS = [
  { value: 'none', label: 'No border' },
  { value: 'box', label: 'Outline' },
  { value: 'all', label: 'All borders' },
  { value: 'bottom', label: 'Bottom edge' },
  { value: 'top', label: 'Top edge' },
];

const FONT_OPTIONS = [
  { value: '', label: 'Default font' },
  ...FONT_LIST.map((f) => ({ value: f, label: f, style: { fontFamily: fontStack(f) } })),
];

const SIZE_OPTIONS = [
  { value: '', label: 'Size' },
  ...SIZES.map((n) => ({ value: n, label: String(n) })),
];

/**
 * @param {{
 *   disabled: boolean,
 *   scope: 'cell' | 'row' | 'column',
 *   onScopeChange: (scope: string) => void,
 *   activeStyle: Object,
 *   activeFormat: { fmt: string, decimals: number | null, grouping: boolean, negRed: boolean },
 *   onStyle: (patch: Object) => void,
 *   onFormat: (patch: Object) => void,
 *   onBorder: (kind: string) => void,
 *   canMerge: boolean,
 *   isMerged: boolean,
 *   onMerge: () => void,
 *   onUnmerge: () => void,
 *   freeze: { rows: number, cols: number },
 *   onFreeze: (patch: Object) => void
 * }} props
 */
export default function FormatToolbar({
  disabled,
  scope,
  onScopeChange,
  activeStyle,
  activeFormat,
  onStyle,
  onFormat,
  onBorder,
  canMerge,
  isMerged,
  onMerge,
  onUnmerge,
  freeze,
  onFreeze,
}) {
  const s = activeStyle || {};
  const fmt = activeFormat || { fmt: 'auto', decimals: null, grouping: true, negRed: false };
  const hasDecimals = NUMERIC_FORMATS.has(fmt.fmt);
  const numeric = hasDecimals || fmt.fmt === 'auto';

  const formatOptions = CELL_FORMATS.map((f) => ({ value: f.id, label: f.label }));

  /**
   * @param {string} key
   */
  const toggle = (key) => onStyle({ [key]: !s[key] });

  return (
    <div className="fmt-toolbar" aria-disabled={disabled}>
      <div className="group">
        <Dropdown
          className="scope-select"
          ariaLabel="Formatting scope"
          title="What the toolbar changes"
          disabled={disabled}
          value={scope}
          options={SCOPE_OPTIONS}
          onChange={(v) => onScopeChange(v)}
        />
      </div>

      <div className="group">
        <button type="button" className={`fmt-btn b${s.bold ? ' on' : ''}`} disabled={disabled} onClick={() => toggle('bold')} title="Bold">
          B
        </button>
        <button type="button" className={`fmt-btn i${s.italic ? ' on' : ''}`} disabled={disabled} onClick={() => toggle('italic')} title="Italic">
          I
        </button>
        <button type="button" className={`fmt-btn u${s.underline ? ' on' : ''}`} disabled={disabled} onClick={() => toggle('underline')} title="Underline">
          U
        </button>
      </div>

      <div className="group">
        <button type="button" className={`fmt-btn${!s.align || s.align === 'left' ? ' on' : ''}`} disabled={disabled} onClick={() => onStyle({ align: 'left' })} title="Align left">
          &#8676;
        </button>
        <button type="button" className={`fmt-btn${s.align === 'center' ? ' on' : ''}`} disabled={disabled} onClick={() => onStyle({ align: 'center' })} title="Align centre">
          &#8596;
        </button>
        <button type="button" className={`fmt-btn${s.align === 'right' ? ' on' : ''}`} disabled={disabled} onClick={() => onStyle({ align: 'right' })} title="Align right">
          &#8677;
        </button>
      </div>

      <div className="group">
        <label className="color-field" title="Text colour">
          A
          <input type="color" disabled={disabled} value={s.color || '#1f2933'} onChange={(e) => onStyle({ color: e.target.value })} aria-label="Text colour" />
        </label>
        <button type="button" className="fmt-btn" disabled={disabled} title="Clear text colour" onClick={() => onStyle({ color: '' })}>
          &#10005;
        </button>
        <label className="color-field" title="Fill colour">
          Fill
          <input type="color" disabled={disabled} value={s.bg || '#ffffff'} onChange={(e) => onStyle({ bg: e.target.value })} aria-label="Fill colour" />
        </label>
        <button type="button" className="fmt-btn" disabled={disabled} title="Clear fill colour" onClick={() => onStyle({ bg: '' })}>
          &#10005;
        </button>
      </div>

      <div className="group">
        <Dropdown
          className="font-select"
          menuClassName="font-menu"
          ariaLabel="Font"
          title="Font"
          disabled={disabled}
          value={s.font || ''}
          options={FONT_OPTIONS}
          buttonStyle={s.font ? { fontFamily: fontStack(s.font) } : undefined}
          onOpen={() => FONT_LIST.forEach(ensureFont)}
          onChange={(v) => {
            if (v) {
              ensureFont(v);
            }
            onStyle({ font: v });
          }}
        />
        <Dropdown
          className="size-select"
          ariaLabel="Font size"
          title="Font size"
          disabled={disabled}
          value={s.size || ''}
          options={SIZE_OPTIONS}
          onChange={(v) => onStyle({ size: v ? Number(v) : '' })}
        />
      </div>

      <div className="group">
        <Dropdown
          className="border-select"
          ariaLabel="Borders"
          title="Borders"
          placeholder="Borders"
          disabled={disabled}
          value={s.border || ''}
          options={BORDER_OPTIONS}
          onChange={(v) => onBorder(v || 'none')}
        />
      </div>

      <div className="group">
        <Dropdown
          className="format-select"
          ariaLabel="Value format"
          title="Value format"
          disabled={disabled}
          value={fmt.fmt}
          options={formatOptions}
          onChange={(v) => onFormat({ fmt: v })}
        />
        <input
          type="number"
          min={0}
          max={8}
          disabled={disabled || !hasDecimals}
          value={fmt.decimals == null ? '' : fmt.decimals}
          placeholder="dp"
          title="Decimal places"
          aria-label="Decimal places"
          onChange={(e) => onFormat({ decimals: e.target.value === '' ? null : Number(e.target.value) })}
        />
        <button
          type="button"
          className={`fmt-btn${fmt.grouping ? ' on' : ''}`}
          disabled={disabled || !numeric}
          title="Thousands separator"
          onClick={() => onFormat({ grouping: !fmt.grouping })}
        >
          ,
        </button>
        <button
          type="button"
          className={`fmt-btn${fmt.negRed ? ' on' : ''}`}
          disabled={disabled || !numeric}
          title="Show negative numbers in red"
          onClick={() => onFormat({ negRed: !fmt.negRed })}
        >
          &minus;
        </button>
      </div>

      <div className="group">
        <button
          type="button"
          className={`fmt-btn wide${isMerged ? ' on' : ''}`}
          disabled={disabled || (!canMerge && !isMerged)}
          title={isMerged ? 'Unmerge cells' : 'Merge selected cells'}
          onClick={isMerged ? onUnmerge : onMerge}
        >
          {isMerged ? 'Unmerge' : 'Merge'}
        </button>
      </div>

      <div className="group">
        <button
          type="button"
          className={`fmt-btn wide${freeze && freeze.rows ? ' on' : ''}`}
          title="Keep the top row visible while scrolling down"
          onClick={() => onFreeze({ rows: freeze && freeze.rows ? 0 : 1 })}
        >
          Freeze row
        </button>
        <button
          type="button"
          className={`fmt-btn wide${freeze && freeze.cols ? ' on' : ''}`}
          title="Keep the first column visible while scrolling across"
          onClick={() => onFreeze({ cols: freeze && freeze.cols ? 0 : 1 })}
        >
          Freeze col
        </button>
      </div>
    </div>
  );
}
