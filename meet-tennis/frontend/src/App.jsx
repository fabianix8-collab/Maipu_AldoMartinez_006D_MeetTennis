import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LoginView from './pages/LoginView.jsx';
import RegisterView from './pages/RegisterView.jsx';
import DashboardView from './pages/DashboardView.jsx';
import AvailabilityView from './pages/AvailabilityView.jsx';
import CourtsView from './pages/CourtsView.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/disponibilidad"
          element={
            <ProtectedRoute>
              <AvailabilityView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/canchas"
          element={
            <ProtectedRoute>
              <CourtsView />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginView />} />
        <Route path="/register" element={<RegisterView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
