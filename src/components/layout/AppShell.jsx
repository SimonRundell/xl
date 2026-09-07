/**
 * Authenticated layout: top bar, routed page, and the slide out help drawer.
 *
 * @module components/layout/AppShell
 */

import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import UserMenu from './UserMenu.jsx';
import HelpDrawer from '../help/HelpDrawer.jsx';

/**
 * @returns {import('react').ReactElement}
 */
export default function AppShell() {
  const { user } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/workbooks" className="brand">
          <img src="/favicon.png" alt="" className="brand-logo" />
          <span>XL</span>
        </NavLink>
        <nav>
          <NavLink to="/workbooks" className={({ isActive }) => (isActive ? 'active' : '')}>
            Workbooks
          </NavLink>
          {user.is_admin && (
            <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
              Users
            </NavLink>
          )}
        </nav>
        <div className="spacer" />
        <button type="button" className="btn btn-sm" onClick={() => setHelpOpen(true)}>
          Guides
        </button>
        <UserMenu />
      </header>

      <div className="shell-body">
        <Outlet />
      </div>

      <button type="button" className="help-fab" onClick={() => setHelpOpen(true)}>
        ? Guides
      </button>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
