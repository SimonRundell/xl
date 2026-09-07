/**
 * Route guard. Redirects to /login when there is no authenticated user.
 *
 * @module components/auth/RequireAuth
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * @param {{ children: import('react').ReactNode }} props
 */
export default function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
