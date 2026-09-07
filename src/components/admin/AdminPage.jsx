/**
 * Admin panel: list every account and control admin status, active status and
 * deletion. Admin only (also guarded server side).
 *
 * @module components/admin/AdminPage
 */

import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api, { apiError, uploadUrl } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ConfirmDialog } from '../common/Modal.jsx';

/**
 * Format a MySQL datetime string as a UK date.
 *
 * @param {string} iso
 * @returns {string}
 */
const formatJoined = (iso) => new Date(iso.replace(' ', 'T')).toLocaleDateString('en-GB');

/**
 * @returns {import('react').ReactElement}
 */
export default function AdminPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busyId, setBusyId] = useState(0);

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get('/users/list.php');
      setRows(data.users);
    } catch (err) {
      setError(apiError(err, 'Could not load users.'));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!user.is_admin) {
    return <Navigate to="/workbooks" replace />;
  }

  /**
   * @param {string} endpoint
   * @param {Object} body
   */
  const act = async (endpoint, body) => {
    setBusyId(body.user_id);
    setError('');
    try {
      await api.post(endpoint, body);
      await load();
    } catch (err) {
      setError(apiError(err, 'That action failed.'));
    } finally {
      setBusyId(0);
    }
  };


  return (
    <div className="page">
      <h1>Users</h1>
      {error && <div className="form-error">{error}</div>}

      <div className="panel">
        {rows === null ? (
          <div className="spinner" />
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Workbooks</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const self = r.id === user.id;
                const disabled = busyId === r.id;
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="inline-form">
                        <span className="avatar">
                          {uploadUrl(r.avatar_path) ? (
                            <img src={uploadUrl(r.avatar_path)} alt="" />
                          ) : (
                            r.screen_name.slice(0, 2).toUpperCase()
                          )}
                        </span>
                        <span>
                          {r.screen_name}
                          {self && <span className="muted"> (you)</span>}
                        </span>
                      </div>
                    </td>
                    <td>{r.email}</td>
                    <td>{r.workbook_count}</td>
                    <td>{formatJoined(r.created_at)}</td>
                    <td>
                      {r.is_admin && <span className="pill admin">Admin</span>}{' '}
                      {!r.is_active && <span className="pill off">Disabled</span>}
                      {!r.is_admin && r.is_active && <span className="muted">Active</span>}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={disabled || self}
                          onClick={() => act('/users/set_admin.php', { user_id: r.id, is_admin: !r.is_admin })}
                        >
                          {r.is_admin ? 'Remove admin' : 'Make admin'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={disabled || self}
                          onClick={() => act('/users/set_active.php', { user_id: r.id, is_active: !r.is_active })}
                        >
                          {r.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          disabled={disabled || self}
                          onClick={() => setConfirm(r)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          title="Delete account"
          message={`Delete ${confirm.screen_name} (${confirm.email}) and all of their workbooks? This cannot be undone.`}
          confirmLabel="Delete account"
          danger
          onConfirm={() => {
            const target = confirm;
            setConfirm(null);
            act('/users/delete.php', { user_id: target.id });
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
