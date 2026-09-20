import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  let user = null;

  try {
    user = JSON.parse(localStorage.getItem('meettennis_auth') || 'null');
  } catch {
    user = null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;