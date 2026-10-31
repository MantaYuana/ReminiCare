'use client';

import { useEffect, useState } from 'react';

interface PropsLayarIstirahat {
  durasiMs: number;
  onSelesai(): void;
}

export default function LayarIstirahat({ durasiMs, onSelesai }: PropsLayarIstirahat) {
  const [sisaDetik, setSisaDetik] = useState(Math.ceil(durasiMs / 1000));

  useEffect(() => {
    if (sisaDetik <= 0) {
      onSelesai();
      return;
    }
    const id = setTimeout(() => setSisaDetik(d => d - 1), 1000);
    return () => clearTimeout(id);
  }, [sisaDetik, onSelesai]);

  return (
    <div className="flex flex-col items-center justify-center gap-8 p-6 min-h-[60vh]">
      <h1 className="text-2xl font-bold">Istirahat</h1>
      <p className="text-base text-gray-600">Gerakan berikutnya dimulai dalam</p>

      <div
        className="text-9xl font-bold text-blue-600 tabular-nums"
        aria-live="polite"
        aria-label={`${sisaDetik} detik istirahat tersisa`}
      >
        {sisaDetik}
      </div>

      <p className="text-base text-gray-500">detik</p>
    </div>
  );
}
