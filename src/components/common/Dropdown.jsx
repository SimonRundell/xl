/**
 * Custom dropdown (listbox) control.
 *
 * A drop in replacement for a native <select> that renders its own popup in
 * the DOM. Native <select> popups are painted by the operating system and do
 * not appear in every browser or embedded view; this control always shows.
 * It also lets each option carry its own inline font, which is how the font
 * picker previews every typeface.
 *
 * Keyboard: Enter, Space or ArrowDown opens the list. While open, ArrowUp and
 * ArrowDown move the highlight, Home and End jump to the ends, Enter or Space
 * choose the highlighted option, Escape closes without changing anything.
 *
 * @module components/common/Dropdown
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * @typedef {Object} DropdownOption
 * @property {string|number} value    value passed back to onChange
 * @property {string} label           text shown in the row and, when chosen, the button
 * @property {import('react').CSSProperties} [style]  inline style for the row and button label
 * @property {string} [hint]          small muted text shown after the label
 */

/**
 * @param {{
 *   value: string|number,
 *   options: DropdownOption[],
 *   onChange: (value: string|number) => void,
 *   disabled?: boolean,
 *   placeholder?: string,
 *   ariaLabel: string,
 *   title?: string,
 *   className?: string,
 *   menuClassName?: string,
 *   buttonStyle?: import('react').CSSProperties,
 *   onOpen?: () => void
 * }} props
 */
export default function Dropdown({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Select',
  ariaLabel,
  title,
  className = '',
  menuClassName = '',
  buttonStyle,
  onOpen,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const selectedIndex = useMemo(
    () => options.findIndex((o) => String(o.value) === String(value)),
    [options, value],
  );
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const close = useCallback(() => setOpen(false), []);

  const openMenu = useCallback(() => {
    if (disabled) {
      return;
    }
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
    if (onOpen) {
      onOpen();
    }
  }, [disabled, selectedIndex, onOpen]);

  const choose = useCallback(
    (index) => {
      const opt = options[index];
      if (opt) {
        onChange(opt.value);
      }
      setOpen(false);
      // Only pull focus back to the button when the control was being driven by
      // the keyboard. For a mouse click we leave focus where it was (typically
      // the grid) so the current cell selection is not lost.
      const root = rootRef.current;
      if (root && root.contains(document.activeElement)) {
        const btn = root.querySelector('.dropdown-button');
        if (btn) {
          btn.focus();
        }
      }
    },
    [options, onChange],
  );

  // Close when focus or a click leaves the control.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    /** @param {MouseEvent} e */
    const onDocDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    /** @param {FocusEvent} e */
    const onFocusIn = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      document.removeEventListener('mousedown', onDocDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [open]);

  // Keep the highlighted row in view.
  useEffect(() => {
    if (!open || !listRef.current) {
      return;
    }
    const row = listRef.current.children[active];
    if (row && row.scrollIntoView) {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [open, active]);

  /** @param {import('react').KeyboardEvent} e */
  const onButtonKey = (e) => {
    if (disabled) {
      return;
    }
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Tab') {
      close();
    }
  };

  return (
    <div className={`dropdown${open ? ' open' : ''} ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className="dropdown-button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={title || ariaLabel}
        style={{ ...buttonStyle, ...(selected && selected.style) }}
        onMouseDown={(e) => {
          // Keep focus (and therefore the grid's cell selection) where it is,
          // rather than letting the button take focus and blur the grid.
          e.preventDefault();
          if (open) {
            close();
          } else {
            openMenu();
          }
        }}
        onKeyDown={onButtonKey}
      >
        <span className="dropdown-value">{selected ? selected.label : placeholder}</span>
        <span className="dropdown-caret" aria-hidden="true">
          &#9662;
        </span>
      </button>
      {open && (
        <ul className={`dropdown-menu ${menuClassName}`.trim()} role="listbox" aria-label={ariaLabel} id={listId} ref={listRef}>
          {options.map((opt, i) => (
            <li
              key={String(opt.value)}
              role="option"
              aria-selected={i === selectedIndex}
              className={`dropdown-option${i === active ? ' active' : ''}${i === selectedIndex ? ' selected' : ''}`}
              style={opt.style}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(i);
              }}
            >
              <span className="dropdown-option-label">{opt.label}</span>
              {opt.hint && <span className="dropdown-option-hint">{opt.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
