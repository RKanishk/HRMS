'use client';

import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { setUnauthorizedHandler } from '@/lib/api/client';
import { UnknownRoleError } from '@/lib/api/roles';
import type { CurrentUser } from '@/lib/api/types';

interface AuthState {
  user: CurrentUser | null;
  isLoading: boolean;
  /** Set when the backend returned a role this app does not understand. */
  unknownRole: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
export const ME_KEY = ['auth', 'me'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (e) {
        if (e instanceof UnknownRoleError) throw e;
        return null; // 401 or unreachable: treat as signed out
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    setUnauthorizedHandler(() => {
      qc.setQueryData(ME_KEY, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
      router.replace('/login?expired=1');
    });
    return () => setUnauthorizedHandler(null);
  }, [qc, router]);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      qc.clear();
      qc.setQueryData(ME_KEY, null);
      router.replace('/login');
    }
  }, [qc, router]);

  return (
    <AuthContext.Provider
      value={{
        user: data ?? null,
        isLoading,
        unknownRole: error instanceof UnknownRoleError ? error.rawRole : null,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
