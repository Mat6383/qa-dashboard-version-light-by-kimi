/**
 * ================================================
 * tRPC PROVIDER — Frontend
 * ================================================
 * Wraps the app with tRPC + React Query client.
 */

import React from 'react';
import { trpc, trpcClient } from './client';
import { queryClient } from '../lib/queryClient';

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      {children as any}
    </trpc.Provider>
  );
}
