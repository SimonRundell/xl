/**
 * Formula bar: shows the address of the active cell and lets the user edit its
 * raw entry (a literal or a formula).
 *
 * @module components/workbook/FormulaBar
 */

import { useEffect, useState } from 'react';

/**
 * @param {{
 *   address: string | null,
 *   raw: string,
 *   onCommit: (raw: string) => void
 * }} props
 */
export default function FormulaBar({ address, raw, onCommit }) {
  const [value, setValue] = useState(raw);

  useEffect(() => {
    setValue(raw);
  }, [raw, address]);

  const commit = () => {
    if (address && value !== raw) {
      onCommit(value);
    }
  };

  return (
    <div className="formula-bar">
      <div className="addr">{address || ''}</div>
      <div className="fx">fx</div>
      <input
        value={value}
        disabled={!address}
        placeholder={address ? 'Enter a value or a formula that starts with =' : 'Select a cell'}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setValue(raw);
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}
