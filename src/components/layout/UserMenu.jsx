/**
 * Avatar button in the top bar with a dropdown for profile / admin / sign out.
 *
 * @module components/layout/UserMenu
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { uploadUrl } from '../../api/client.js';

/**
 * @returns {import('react').ReactElement}
 */
export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    /** @param {MouseEvent} e */
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const avatar = uploadUrl(user.avatar_path);
  const initials = user.screen_name.slice(0, 2).toUpperCase();

  return (
    <div className="usermenu" ref={ref}>
      <button
        type="button"
        className="avatar"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.screen_name}
      >
        {avatar ? <img src={avatar} alt="" /> : initials}
      </button>

      {open && (
        <div className="dropdown" role="menu">
          <div className="who">
            <strong>{user.screen_name}</strong>
            <br />
            <span className="muted">{user.email}</span>
          </div>
          <Link to="/profile" role="menuitem" onClick={() => setOpen(false)}>
            Profile and settings
          </Link>
          {user.is_admin && (
            <Link to="/admin" role="menuitem" onClick={() => setOpen(false)}>
              Manage users
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
