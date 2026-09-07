/**
 * Workbook picker: list, create, rename, delete, open.
 *
 * @module components/workbook/WorkbooksPage
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiError } from '../../api/client.js';
import { Modal, ConfirmDialog } from '../common/Modal.jsx';

/**
 * Format a MySQL datetime string as a UK date and time.
 *
 * @param {string} iso
 * @returns {string}
 */
const formatWhen = (iso) => new Date(iso.replace(' ', 'T')).toLocaleString('en-GB');

/**
 * @returns {import('react').ReactElement}
 */
export default function WorkbooksPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/workbooks/list.php');
      setItems(data.workbooks);
    } catch (err) {
      setError(apiError(err, 'Could not load your workbooks.'));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * @param {import('react').FormEvent} e
   */
  const create = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post('/workbooks/create.php', { name: newName.trim() });
      navigate(`/workbooks/${data.id}`);
    } catch (err) {
      setError(apiError(err, 'Could not create the workbook.'));
      setBusy(false);
    }
  };

  const doRename = async () => {
    setBusy(true);
    try {
      await api.post('/workbooks/rename.php', { id: renaming.id, name: renaming.name.trim() });
      setRenaming(null);
      await load();
    } catch (err) {
      setError(apiError(err, 'Could not rename.'));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await api.post('/workbooks/delete.php', { id: deleting.id });
      setDeleting(null);
      await load();
    } catch (err) {
      setError(apiError(err, 'Could not delete.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <h1>Your workbooks</h1>

      {error && <div className="form-error">{error}</div>}

      {items === null ? (
        <div className="spinner" />
      ) : (
        <div className="wb-grid">
          <button type="button" className="wb-card new" onClick={() => setCreating(true)}>
            <strong>+ New workbook</strong>
          </button>

          {items.map((wb) => (
            <div className="wb-card" key={wb.id}>
              <h3>{wb.name}</h3>
              <div className="meta">Updated {formatWhen(wb.updated_at)}</div>
              <div className="actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/workbooks/${wb.id}`)}>
                  Open
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setRenaming({ id: wb.id, name: wb.name })}
                >
                  Rename
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleting(wb)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <Modal
          title="New workbook"
          onClose={() => setCreating(false)}
          actions={
            <>
              <button type="button" className="btn" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={busy || !newName.trim()} onClick={create}>
                Create
              </button>
            </>
          }
        >
          <form onSubmit={create}>
            <label className="field">
              <span>Name</span>
              <input
                className="input"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={120}
                placeholder="e.g. Budget practice"
              />
            </label>
          </form>
        </Modal>
      )}

      {renaming && (
        <Modal
          title="Rename workbook"
          onClose={() => setRenaming(null)}
          actions={
            <>
              <button type="button" className="btn" onClick={() => setRenaming(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={doRename}>
                Save
              </button>
            </>
          }
        >
          <label className="field">
            <span>Name</span>
            <input
              className="input"
              autoFocus
              value={renaming.name}
              onChange={(e) => setRenaming((r) => ({ ...r, name: e.target.value }))}
              maxLength={120}
            />
          </label>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete workbook"
          message={`Delete "${deleting.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={doDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
