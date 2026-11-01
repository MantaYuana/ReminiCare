'use client';

import { useEffect, useRef, useState } from 'react';
import { IkonSuara, IkonHenti } from './ikon';

// Hanya satu klip yang boleh berbunyi pada satu waktu.
let aktif: { audio: HTMLAudioElement; selesai: () => void } | null = null;

/** Memutar klip koreksi asli dari aplikasi. Hanya bunyi saat diketuk, tidak pernah otomatis. */
export default function TombolSuara({ kode, teks, kecil = false }: { kode: string; teks: string; kecil?: boolean }) {
  const [main, setMain] = useState(false);
  const [gagal, setGagal] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (aktif?.audio === audioRef.current) aktif = null;
  }, []);

  async function ketuk() {
    if (main) {
      audioRef.current?.pause();
      setMain(false);
      aktif = null;
      return;
    }
    aktif?.audio.pause();
    aktif?.selesai();
    try {
      const a = audioRef.current ?? new Audio(`/audio/${kode}.mp3`);
      audioRef.current = a;
      a.currentTime = 0;
      const selesai = () => setMain(false);
      a.onended = () => { selesai(); if (aktif?.audio === a) aktif = null; };
      aktif = { audio: a, selesai };
      setGagal(false);
      setMain(true);
      await a.play();
    } catch {
      setMain(false);
      setGagal(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={ketuk}
        aria-pressed={main}
        aria-label={`${main ? 'Hentikan' : 'Dengarkan'} suara: ${teks}`}
        className={`lp-btn lp-btn--suara${kecil ? ' lp-btn--kecil' : ''}`}
      >
        {main ? <IkonHenti className="h-6 w-6" /> : <IkonSuara className="h-6 w-6" />}
        <span aria-hidden="true">{main ? 'Sedang diputar' : 'Dengarkan'}</span>
      </button>
      {gagal && <span role="status" className="lp-galat">Suara tidak bisa diputar di perangkat ini.</span>}
    </>
  );
}
