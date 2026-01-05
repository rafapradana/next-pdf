"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = api.getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const response = await api.getMe();
    if (response.data) {
      setUser({
        id: response.data.id,
        email: response.data.email,
        full_name: response.data.full_name,
        avatar_url: response.data.avatar_url,
      });
    } else {
      // Try to refresh token
      const refreshResponse = await api.refresh();
      if (refreshResponse.data) {
        const meResponse = await api.getMe();
        if (meResponse.data) {
          setUser({
            id: meResponse.data.id,
            email: meResponse.data.email,
            full_name: meResponse.data.full_name,
            avatar_url: meResponse.data.avatar_url,
          });
        } else {
          setUser(null);
          api.setAccessToken(null);
        }
      } else {
        setUser(null);
        api.setAccessToken(null);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    if (response.data) {
      setUser(response.data.user);
      return { success: true };
    }
    return { success: false, error: response.error?.message || 'Login failed' };
  };

  const register = async (email: string, password: string, fullName: string) => {
    const response = await api.register(email, password, fullName);
    if (response.data) {
      // Auto-login after registration
      return login(email, password);
    }
    return { success: false, error: response.error?.message || 'Registration failed' };
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
