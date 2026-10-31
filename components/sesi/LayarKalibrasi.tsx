'use client';

import { useEffect, useRef, useState } from 'react';
import { suara } from '../../lib/suara.ts';
import type { KodeKlip } from '../../lib/suara.ts';

interface PropsLayarKalibrasi {
  onSelesai(): void;
}

const HITUNG_MUNDUR = 5; // detik

// Dipasang ulang (key) oleh Sesi tiap percobaan, jadi hitung mundur mulai dari 5 lagi.
export default function LayarKalibrasi({ onSelesai }: PropsLayarKalibrasi) {
  const [detik, setDetik] = useState(HITUNG_MUNDUR);
  const selesaiRef = useRef(onSelesai);
  selesaiRef.current = onSelesai;
  const sudahRef = useRef(false);

  useEffect(() => {
    if (detik <= 0) {
      if (!sudahRef.current) {
        sudahRef.current = true;
        selesaiRef.current();
      }
      return;
    }
    suara.ucap(`N-${detik}` as KodeKlip);
    const id = setTimeout(() => setDetik(d => d - 1), 1000);
    return () => clearTimeout(id);
  }, [detik]);

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div>
        <h2 className="rc-judul">Diam sebentar</h2>
        <p className="rc-sub">Duduk tenang dan jangan bergerak sampai hitungan selesai.</p>
      </div>

      <div
        className="flex h-40 w-40 items-center justify-center rounded-full border-8 border-brand-700 bg-white text-7xl font-bold tabular-nums text-brand-700"
        role="timer"
        aria-live="polite"
        aria-label={`${detik} detik tersisa`}
      >
        {detik}
      </div>

      <p className="text-base text-muted">detik tersisa</p>
    </div>
  );
}
