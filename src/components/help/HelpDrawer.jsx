/**
 * Slide out guide drawer.
 *
 * Phase one ships a short starter set of guides. Phase two will replace the
 * STEPS array with a full, sequenced course (cells and sheets, then COUNT and
 * SUM, then lookups and beyond).
 *
 * @module components/help/HelpDrawer
 */

import { useEffect } from 'react';

/** Starter guide content. Keep each step short and task focused. */
const STEPS = [
  {
    title: 'What is a cell?',
    body: [
      'A spreadsheet is a grid. Each box is a cell.',
      'Columns are letters (A, B, C). Rows are numbers (1, 2, 3).',
      'The cell where column B meets row 3 is called B3.',
      'Task: click cell A1, type your name, press Enter.',
    ],
  },
  {
    title: 'Worksheets and tabs',
    body: [
      'A workbook can hold several worksheets, shown as tabs along the bottom.',
      'Use the plus button to add a sheet. Double click a tab to rename it.',
      'Task: add a sheet called Prices.',
    ],
  },
  {
    title: 'Typing numbers and text',
    body: [
      'Type text and it lines up on the left. Type a number and it lines up on the right.',
      'Use the format menu in the toolbar to show a value as currency, a date, or a time.',
      'Task: in B1 type 1500, then set its format to Currency.',
    ],
  },
  {
    title: 'Your first formula: SUM',
    body: [
      'A formula always starts with an equals sign.',
      'Put numbers in A1, A2 and A3. In A4 type =SUM(A1:A3) and press Enter.',
      'A1:A3 means "the range from A1 to A3".',
    ],
  },
  {
    title: 'Picking cells with the mouse',
    body: [
      'You do not have to type cell names. Start the formula, for example =SUM(',
      'then click and drag across the cells you want. The range appears in the formula.',
      'Type the closing bracket ) and press Enter to finish. Press Escape to cancel.',
    ],
  },
  {
    title: 'Counting: COUNT and COUNTA',
    body: [
      '=COUNT(A1:A10) counts how many cells hold a number.',
      '=COUNTA(A1:A10) counts how many cells are not empty.',
      '=COUNTIF(A1:A10, ">10") counts cells that match a rule.',
    ],
  },
  {
    title: 'Referring to another sheet',
    body: [
      'Point at a cell on another sheet with SheetName!Cell.',
      'Example: =Prices!B2 pulls the value from B2 on the Prices sheet.',
      'This is how a summary sheet reads from your data sheets.',
    ],
  },
  {
    title: 'Lookup tables: VLOOKUP',
    body: [
      'VLOOKUP finds a row by its first column, then returns a value from that row.',
      '=VLOOKUP("Apple", Prices!A2:C20, 3, FALSE)',
      'Read it as: find "Apple" in the first column of that range, give me column 3, exact match.',
    ],
  },
  {
    title: 'Making it look right',
    body: [
      'Select a cell (or drag across several) and use the toolbar to set colours, bold, a font, borders, and how numbers show (currency, a percentage, decimal places).',
      'Task: put a heading in A1, make it bold, and give the row a fill colour.',
    ],
  },
  {
    title: 'Column width, row height, merging',
    body: [
      'Drag the line between two column letters to make a column wider. Drag between two row numbers for height. Double click a column line to fit the width to the text.',
      'Select a block of cells and press Merge to join them into one, which is handy for a title across the top.',
      'Freeze row keeps row 1 in view as you scroll down; Freeze col keeps column A in view as you scroll across.',
    ],
  },
];

/**
 * @param {{ open: boolean, onClose: () => void }} props
 */
export default function HelpDrawer({ open, onClose }) {
  useEffect(() => {
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (open) {
      document.addEventListener('keydown', onKey);
    }
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="drawer-overlay" onClick={onClose} />}
      <aside className={`drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <header>
          <h2>Step by step guides</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="drawer-content">
          {STEPS.map((step, i) => (
            <section key={step.title}>
              <h3>
                {i + 1}. {step.title}
              </h3>
              {step.body.map((line, j) => (
                <p key={j}>{line}</p>
              ))}
            </section>
          ))}
          <p className="muted">More guides arrive in the next update.</p>
        </div>
      </aside>
    </>
  );
}
