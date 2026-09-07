/**
 * Profile and account settings: screen name, avatar, password.
 *
 * @module components/profile/ProfilePage
 */

import { useRef, useState } from 'react';
import api, { apiError, uploadUrl } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * @returns {import('react').ReactElement}
 */
export default function ProfilePage() {
  const { user, setUser } = useAuth();

  return (
    <div className="page">
      <h1>Profile and settings</h1>
      <AvatarPanel user={user} setUser={setUser} />
      <ScreenNamePanel user={user} setUser={setUser} />
      <PasswordPanel />
    </div>
  );
}

/**
 * @param {{ user: Object, setUser: Function }} props
 */
function AvatarPanel({ user, setUser }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  /**
   * @param {import('react').ChangeEvent<HTMLInputElement>} e
   */
  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      return;
    }
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const body = new FormData();
      body.append('avatar', file);
      const { data } = await api.post('/users/avatar.php', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(data.user);
      setMsg('Avatar updated.');
    } catch (err) {
      setError(apiError(err, 'Could not upload that image.'));
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const url = uploadUrl(user.avatar_path);

  return (
    <div className="panel">
      <h2>Avatar</h2>
      {error && <div className="form-error">{error}</div>}
      {msg && <div className="form-note">{msg}</div>}
      <div className="inline-form">
        <span className="avatar avatar-lg">
          {url ? <img src={url} alt="Your avatar" /> : user.screen_name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} />
          <p className="muted">PNG, JPEG, WebP or GIF, up to 1 MB.</p>
        </div>
      </div>
      {busy && <p className="muted">Uploading...</p>}
    </div>
  );
}

/**
 * @param {{ user: Object, setUser: Function }} props
 */
function ScreenNamePanel({ user, setUser }) {
  const [value, setValue] = useState(user.screen_name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const { data } = await api.post('/users/update_profile.php', { screen_name: value.trim() });
      setUser(data.user);
      setMsg('Screen name saved.');
    } catch (err) {
      setError(apiError(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Screen name</h2>
      {error && <div className="form-error">{error}</div>}
      {msg && <div className="form-note">{msg}</div>}
      <div className="inline-form">
        <label className="field">
          <span>Display name</span>
          <input className="input" value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} />
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !value.trim() || value.trim() === user.screen_name}
          onClick={save}
        >
          Save
        </button>
      </div>
    </div>
  );
}

/**
 * @returns {import('react').ReactElement}
 */
function PasswordPanel() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const bind = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');
    if (form.new_password !== form.confirm) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/users/change_password.php', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setForm({ current_password: '', new_password: '', confirm: '' });
      setMsg('Password changed.');
    } catch (err) {
      setError(apiError(err, 'Could not change password.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Password</h2>
      {error && <div className="form-error">{error}</div>}
      {msg && <div className="form-note">{msg}</div>}
      <form onSubmit={submit}>
        <label className="field">
          <span>Current password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={form.current_password}
            onChange={bind('current_password')}
            required
          />
        </label>
        <label className="field">
          <span>New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.new_password}
            onChange={bind('new_password')}
            required
          />
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={bind('confirm')}
            required
          />
        </label>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={submit}>
          Change password
        </button>
      </form>
    </div>
  );
}
