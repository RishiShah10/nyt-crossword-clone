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
    isLoading: true,
    isNewUser: false,
  });

  // On mount: check if we have a valid session via httpOnly cookie
  useEffect(() => {
    authApi.getMe()
      .then((user: User) => {
        SavesManager.setAuthenticated(true);
        setState({ user, isLoading: false, isNewUser: false });
      })
      .catch(() => {
        SavesManager.setAuthenticated(false);
        setState({ user: null, isLoading: false, isNewUser: false });
      });
  }, []);

  // Listen for 401 events from axios interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      SavesManager.setAuthenticated(false);
      setState({ user: null, isLoading: false, isNewUser: false });
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = useCallback(async (googleCredential: string) => {
    const response = await authApi.loginWithGoogle(googleCredential);
    // Cookie is set by the backend response (httpOnly, not accessible from JS)
    SavesManager.setAuthenticated(true);
    setState({
      user: response.user,
      isLoading: false,
      isNewUser: response.user.is_new_user,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Cookie may already be gone
    }
    SavesManager.setAuthenticated(false);
    setState({ user: null, isLoading: false, isNewUser: false });
  }, []);

  const clearNewUserFlag = useCallback(() => {
    setState(prev => ({ ...prev, isNewUser: false }));
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    clearNewUserFlag,
    isAuthenticated: state.user !== null,
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
