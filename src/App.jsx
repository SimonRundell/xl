/**
 * Route table and top level layout.
 *
 * @module App
 */

import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppShell from './components/layout/AppShell.jsx';
import RequireAuth from './components/auth/RequireAuth.jsx';
import LoginPage from './components/auth/LoginPage.jsx';
import RegisterPage from './components/auth/RegisterPage.jsx';
import WorkbooksPage from './components/workbook/WorkbooksPage.jsx';
import ProfilePage from './components/profile/ProfilePage.jsx';
import AdminPage from './components/admin/AdminPage.jsx';
import CMFloatAd from './cmFloatAd.jsx';

// The editor pulls in HyperFormula and the grid, so load it on demand.
const WorkbookPage = lazy(() => import('./components/workbook/WorkbookPage.jsx'));

/**
 * @returns {import('react').ReactElement}
 */
export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="full-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/workbooks" replace />} />
          <Route path="/workbooks" element={<WorkbooksPage />} />
          <Route
            path="/workbooks/:id"
            element={
              <Suspense fallback={<div className="center-fill"><div className="spinner" /></div>}>
                <WorkbookPage />
              </Suspense>
            }
          />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <CMFloatAd />
    </>
  );
}
