'use client';

import { useEffect, useRef, useState } from 'react';

interface PropsLayarIstirahat {
  durasiMs: number;
  onSelesai(): void;
}

export default function LayarIstirahat({ durasiMs, onSelesai }: PropsLayarIstirahat) {
  const [sisaDetik, setSisaDetik] = useState(Math.ceil(durasiMs / 1000));
  const selesaiRef = useRef(onSelesai);
  selesaiRef.current = onSelesai;

  useEffect(() => {
    if (sisaDetik <= 0) {
      selesaiRef.current();
      return;
    }
    const id = setTimeout(() => setSisaDetik(d => d - 1), 1000);
    return () => clearTimeout(id);
  }, [sisaDetik]);

  return (
    <div className="rc-wrap min-h-[70vh] items-center justify-center text-center">
      <div>
        <h1 className="rc-judul">Istirahat sebentar</h1>
        <p className="rc-sub">Gerakan berikutnya dimulai otomatis.</p>
      </div>

      <div
        className="flex h-44 w-44 items-center justify-center rounded-full border-8 border-brand-100 bg-white text-7xl font-bold tabular-nums text-brand-700"
        role="timer"
        aria-live="off"
        aria-label={`${sisaDetik} detik istirahat tersisa`}
      >
        {sisaDetik}
      </div>

      <p className="text-base text-muted">detik</p>

      <button onClick={() => setSisaDetik(0)} className="rc-btn-2">
        Lewati istirahat
      </button>
    </div>
  );
}
