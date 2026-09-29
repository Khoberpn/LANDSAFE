import React, { createContext, useContext, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGetMe, getGetMeQueryKey, User } from '@workspace/api-client-react';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => {
    const saved = localStorage.getItem('landsafe_token');
    localStorage.removeItem('landsafe_demo_user');
    if (saved?.startsWith('demo-token-')) {
      localStorage.removeItem('landsafe_token');
      return null;
    }
    return saved;
  });

  const { data: user, isLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), enabled: !!token, retry: false },
  });

  const login = (newToken: string, _user: User) => {
    queryClient.clear();
    localStorage.setItem('landsafe_token', newToken);
    setToken(newToken);
  };

  const logout = async () => {
    const currentToken = token;
    localStorage.removeItem('landsafe_token');
    setToken(null);
    queryClient.clear();
    if (!currentToken) return;
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + currentToken },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Local session is cleared even when the API is unavailable.
    }
  };

  return <AuthContext.Provider value={{ user: user ?? null, isLoading: isLoading && !!token, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}