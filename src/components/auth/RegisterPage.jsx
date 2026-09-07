/**
 * Open registration screen.
 *
 * @module components/auth/RegisterPage
 */

import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { apiError } from '../../api/client.js';

/**
 * @returns {import('react').ReactElement}
 */
export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ screen_name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to="/workbooks" replace />;
  }

  /**
   * @param {string} key
   * @returns {(e: import('react').ChangeEvent<HTMLInputElement>) => void}
   */
  const bind = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  /**
   * @param {import('react').FormEvent} e
   */
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      await register({
        screen_name: form.screen_name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/workbooks', { replace: true });
    } catch (err) {
      setError(apiError(err, 'Could not register.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1 className="auth-title">
          <img src="/favicon.png" alt="" className="brand-logo" />
          Create an account
        </h1>
        <p className="sub">Pick a screen name your class will recognise.</p>

        {error && <div className="form-error">{error}</div>}

        <label className="field">
          <span>Screen name</span>
          <input className="input" value={form.screen_name} onChange={bind('screen_name')} required maxLength={80} />
        </label>

        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="username" value={form.email} onChange={bind('email')} required />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={bind('password')}
            required
          />
        </label>

        <label className="field">
          <span>Confirm password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={bind('confirm')}
            required
          />
        </label>

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Creating...' : 'Create account'}
        </button>

        <p className="auth-switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
