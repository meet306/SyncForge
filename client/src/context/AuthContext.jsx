import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('syncforge_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('syncforge_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      if (token) {
        try {
          const res = await api.auth.getMe();
          setUser(res.user);
          localStorage.setItem('syncforge_user', JSON.stringify(res.user));
        } catch (err) {
          console.warn('[Auth] Session expired or invalid:', err.message);
          setToken(null);
          setUser(null);
          localStorage.removeItem('syncforge_token');
          localStorage.removeItem('syncforge_user');
        }
      }
      setIsLoading(false);
    }
    initAuth();
  }, [token]);

  const handleLogin = async (email, password) => {
    const res = await api.auth.login(email, password);
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('syncforge_token', res.token);
    localStorage.setItem('syncforge_user', JSON.stringify(res.user));
    return res;
  };

  const handleRegister = async (name, email, password) => {
    const res = await api.auth.register(name, email, password);
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('syncforge_token', res.token);
    localStorage.setItem('syncforge_user', JSON.stringify(res.user));
    return res;
  };

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('syncforge_token');
      localStorage.removeItem('syncforge_user');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
