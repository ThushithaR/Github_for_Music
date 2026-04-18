'use client';

import React, { createContext, useContext } from 'react';
import { useGoodwinsunInternal } from '@/hooks/useGoodwinsun';

// Infer the return type of the hook
type GoodwinsunContextType = ReturnType<typeof useGoodwinsunInternal>;

const GoodwinsunContext = createContext<GoodwinsunContextType | null>(null);

export function GoodwinsunProvider({ children }: { children: React.ReactNode }) {
  const value = useGoodwinsunInternal();
  return (
    <GoodwinsunContext.Provider value={value}>
      {children}
    </GoodwinsunContext.Provider>
  );
}

export function useGoodwinsun(): GoodwinsunContextType {
  const ctx = useContext(GoodwinsunContext);
  if (!ctx) {
    throw new Error('useGoodwinsun must be used within a GoodwinsunProvider');
  }
  return ctx;
}
