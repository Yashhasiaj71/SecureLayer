import React, { createContext, useState, useEffect, useContext } from 'react';
import api from './api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Silent refresh on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await api.post('/auth/refresh');
        if (res.data?.success) {
          setUser(res.data.data.user);
          api.defaults.headers.common['Authorization'] = `Bearer ${res.data.data.accessToken}`;
        }
      } catch (e) {
        // Not authenticated, just clear
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = (userData, accessToken) => {
    setUser(userData);
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {} // best effort
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
