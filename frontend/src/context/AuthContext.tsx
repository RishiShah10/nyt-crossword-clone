import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { User, AuthState } from '../types/auth';
import { authApi } from '../api/authApi';
import SavesManager from '../utils/savesManager';

interface AuthContextType extends AuthState {
  login: (googleCredential: string) => Promise<void>;
  logout: () => void;
  clearNewUserFlag: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isNewUser: false,
  });

  // On mount: check for stored token
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Set token on SavesManager immediately
      SavesManager.setAuthToken(token);

      authApi.getMe()
        .then((user: User) => {
          setState({ user, token, isLoading: false, isNewUser: false });
        })
        .catch(() => {
          localStorage.removeItem('auth_token');
          SavesManager.setAuthToken(null);
          setState({ user: null, token: null, isLoading: false, isNewUser: false });
        });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Listen for 401 events from axios interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem('auth_token');
      SavesManager.setAuthToken(null);
      setState({ user: null, token: null, isLoading: false, isNewUser: false });
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (googleCredential: string) => {
    const response = await authApi.loginWithGoogle(googleCredential);
    localStorage.setItem('auth_token', response.token);
    SavesManager.setAuthToken(response.token);
    setState({
      user: response.user,
      token: response.token,
      isLoading: false,
      isNewUser: response.user.is_new_user,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    SavesManager.setAuthToken(null);
    setState({ user: null, token: null, isLoading: false, isNewUser: false });
  }, []);

  const clearNewUserFlag = useCallback(() => {
    setState(prev => ({ ...prev, isNewUser: false }));
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    clearNewUserFlag,
    isAuthenticated: state.user !== null && state.token !== null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
