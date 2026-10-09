import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './Login';
import Otp from './Otp';

import Dashboard from './Dashboard';

// Protect authenticated routes
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// Protect unauthenticated routes (e.g. login)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      <Route path="/login" element={
        <PublicRoute><Login /></PublicRoute>
      } />
      
      <Route path="/register" element={
        <PublicRoute><Login isRegistration={true} /></PublicRoute> // Reuse login UI for demo
      } />
      
      <Route path="/verify" element={
        <PublicRoute><Otp /></PublicRoute>
      } />
      
      <Route path="/dashboard/*" element={
        <PrivateRoute><Dashboard /></PrivateRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
