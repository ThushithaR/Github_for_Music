'use client';

import { GoodwinsunProvider } from '@/context/GoodwinsunContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <GoodwinsunProvider>{children}</GoodwinsunProvider>;
}
