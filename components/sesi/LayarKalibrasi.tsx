'use client';

import { useEffect, useState } from 'react';

interface PropsLayarKalibrasi {
  onSelesai(ok?: boolean): void;
}

const HITUNG_MUNDUR = 5; // detik

export default function LayarKalibrasi({ onSelesai }: PropsLayarKalibrasi) {
  const [detik, setDetik] = useState(HITUNG_MUNDUR);

  useEffect(() => {
    if (detik <= 0) {
      onSelesai(true);
      return;
    }
    const id = setTimeout(() => setDetik(d => d - 1), 1000);
    return () => clearTimeout(id);
  }, [detik, onSelesai]);

  return (
    <div className="flex flex-col items-center justify-center gap-8 p-6 min-h-[60vh]">
      <h1 className="text-2xl font-bold">Kalibrasi</h1>
      <p className="text-base text-gray-600 text-center">
        Tetap diam dalam posisi yang nyaman
      </p>

      {/* Hitung mundur besar */}
      <div
        className="text-9xl font-bold text-blue-600 tabular-nums"
        aria-live="polite"
        aria-label={`${detik} detik tersisa`}
      >
        {detik}
      </div>

      <p className="text-base text-gray-500">detik tersisa</p>
    </div>
  );
}
