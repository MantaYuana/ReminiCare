'use client';

import { useEffect } from 'react';
import { kirim } from '../lib/antrean';

// Invisible component that triggers queue flush on mount, online event,
// and visibilitychange (visible). Placed in layout so it runs on every page.
export default function PemicuAntrean() {
  useEffect(() => {
    kirim();

    function handleOnline() { kirim(); }
    function handleVisibility() {
      if (document.visibilityState === 'visible') kirim();
    }

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return null;
}
