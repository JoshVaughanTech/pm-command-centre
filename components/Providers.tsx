'use client';

import { SessionProvider } from 'next-auth/react';
import { ErrorBoundary } from './ErrorBoundary';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ErrorBoundary>{children}</ErrorBoundary>
    </SessionProvider>
  );
}
