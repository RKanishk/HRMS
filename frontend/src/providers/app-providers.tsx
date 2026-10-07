'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MOCKS_ENABLED } from '@/lib/env';
import { installMocks } from '@/lib/mocks/adapter';
import { installBackendAdapter } from '@/lib/backend/adapter';
import { AuthProvider } from './auth-provider';
import { ToastProvider } from './toast-provider';

if (MOCKS_ENABLED) installMocks();
else installBackendAdapter();

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
