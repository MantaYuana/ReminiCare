'use client';

import { useEffect, useRef, useState } from 'react';
import { suara } from '../../lib/suara.ts';
import type { KodeKlip } from '../../lib/suara.ts';

interface PropsLayarKalibrasi {
  onSelesai(): void;
}

const HITUNG_MUNDUR = 5; // detik

// Overlay di atas pratinjau kamera (dirender di dalam pembungkus <video> oleh Sesi).
// Dipasang ulang (key) oleh Sesi tiap percobaan dan tiap posisi hilang, jadi hitung mundur mulai dari 5 lagi.
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
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/45 text-center text-white"
      role="timer"
      aria-live="polite"
      aria-label={`${detik} detik tersisa`}
    >
      <p className="text-2xl font-semibold sm:text-4xl">Diam sebentar</p>
      <div className="text-[7rem] font-bold leading-none tabular-nums sm:text-[12rem]">{detik}</div>
    </div>
  );
}
