/**
 * Worksheet tab strip along the bottom of the editor.
 *
 * @module components/workbook/SheetTabs
 */

import { useState } from 'react';

/**
 * @param {{
 *   sheets: { id: string, name: string }[],
 *   activeIndex: number,
 *   onSelect: (index: number) => void,
 *   onAdd: () => void,
 *   onRename: (index: number, name: string) => void,
 *   onRemove: (index: number) => void
 * }} props
 */
export default function SheetTabs({ sheets, activeIndex, onSelect, onAdd, onRename, onRemove }) {
  const [editing, setEditing] = useState(-1);
  const [draft, setDraft] = useState('');

  const startEdit = (i) => {
    setEditing(i);
    setDraft(sheets[i].name);
  };

  const commit = () => {
    if (editing >= 0) {
      onRename(editing, draft);
    }
    setEditing(-1);
  };

  return (
    <div className="sheet-tabs">
      {sheets.map((sheet, i) => (
        <div
          key={sheet.id}
          className={`sheet-tab${i === activeIndex ? ' active' : ''}`}
          onClick={() => onSelect(i)}
          onDoubleClick={() => startEdit(i)}
        >
          {editing === i ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commit();
                } else if (e.key === 'Escape') {
                  setEditing(-1);
                }
              }}
              size={Math.max(6, draft.length)}
            />
          ) : (
            <span>{sheet.name}</span>
          )}
          {sheets.length > 1 && (
            <button
              type="button"
              className="x"
              title="Delete sheet"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(i);
              }}
            >
              &times;
            </button>
          )}
        </div>
      ))}
      <button type="button" className="sheet-add" onClick={onAdd} title="Add sheet">
        + Sheet
      </button>
    </div>
  );
}
