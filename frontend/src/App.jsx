import React, { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import getTheme from './theme';
import { authAPI } from './api';
import LoginPage from './pages/LoginPage';
import MailLayout from './components/MailLayout';

// Auth Context
export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('themeMode') || 'dark';
  });

  const theme = useMemo(() => getTheme(themeMode), [themeMode]);

  const toggleTheme = useCallback(() => {
    setThemeMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('themeMode', next);
      return next;
    });
  }, []);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await authAPI.getMe();
      setUser(res.data.user);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const res = await authAPI.login(email, password);
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // ignore
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: theme.palette.background.default,
          color: theme.palette.primary.main,
          fontSize: '1.25rem',
          fontFamily: '"Google Sans", sans-serif',
        }}>
          Loading BaknusMail...
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthContext.Provider value={{ user, login, logout, updateUser, themeMode, toggleTheme }}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
            <Route path="/*" element={user ? <MailLayout /> : <Navigate to="/login" />} />
          </Routes>
        </BrowserRouter>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

export default App;
