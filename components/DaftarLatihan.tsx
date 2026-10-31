'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { IkonPanahKanan, IkonPanahKiri } from './ikon';
import { NAMA_GERAKAN, perkiraanMenit, videoGerakan } from '../lib/latihan';

export type KartuProps = {
  gerakan: string;
  repetisi: number;
  sisi: 'kiri' | 'kanan';
  /** Mis. "1 November 2026" atau "Contoh"; kosong = tanpa badge. */
  lencana?: string;
  onMulai: () => void;
};

/** Kartu latihan; seluruh kartu adalah tombol yang memulai sesi. */
export function KartuLatihan({ gerakan, repetisi, sisi, lencana, onMulai }: KartuProps) {
  const nama = NAMA_GERAKAN[gerakan] ?? gerakan;
  return (
    <li className="w-64 shrink-0 snap-start sm:w-72">
      <button
        type="button"
        onClick={onMulai}
        aria-label={`Mulai latihan ${nama}`}
        className="flex w-full flex-col gap-2 rounded-3xl bg-white p-3 text-left shadow-[0_4px_20px_rgba(20,24,25,0.10)] transition-shadow hover:shadow-[0_6px_24px_rgba(20,24,25,0.16)] motion-reduce:transition-none"
      >
        <video
          src={videoGerakan(gerakan)}
          autoPlay loop muted playsInline
          aria-hidden="true"
          className="aspect-video w-full rounded-2xl bg-brand-50 object-cover"
          style={sisi === 'kiri' ? { transform: 'scaleX(-1)' } : undefined}
        />
        {lencana && (
          <span className="self-start rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-medium uppercase text-ink">{lencana}</span>
        )}
        <span className="text-lg font-semibold leading-snug">{nama}</span>
        <span className="flex gap-4 text-sm text-muted">
          <span>{repetisi} Reps</span>
          <span>≈ {perkiraanMenit(repetisi)} Menit</span>
          <span>Lengan {sisi}</span>
        </span>
      </button>
    </li>
  );
}

/** Baris kartu yang bisa digeser, dengan tombol panah kiri dan kanan. */
export default function DaftarLatihan({ id, judul, children }: { id?: string; judul: string; children: React.ReactNode }) {
  const baris = useRef<HTMLUListElement>(null);
  const [bisaKiri, setBisaKiri] = useState(false);
  const [bisaKanan, setBisaKanan] = useState(false);

  const hitung = useCallback(() => {
    const el = baris.current;
    if (!el) return;
    setBisaKiri(el.scrollLeft > 4);
    setBisaKanan(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    hitung();
    window.addEventListener('resize', hitung);
    return () => window.removeEventListener('resize', hitung);
  }, [hitung, children]);

  function geser(arah: 1 | -1) {
    const el = baris.current;
    if (!el) return;
    el.scrollBy({ left: arah * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  const tombol = 'flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-ink transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <section id={id} aria-labelledby={`${id ?? 'latihan'}-judul`} className="flex scroll-mt-4 flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id={`${id ?? 'latihan'}-judul`} className="text-lg font-semibold">{judul}</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => geser(-1)} disabled={!bisaKiri} aria-label="Geser ke kiri" className={tombol}>
            <IkonPanahKiri className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => geser(1)} disabled={!bisaKanan} aria-label="Geser ke kanan" className={tombol}>
            <IkonPanahKanan className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ul
        ref={baris}
        onScroll={hitung}
        className="-m-2 flex snap-x gap-4 overflow-x-auto p-2 pb-4"
      >
        {children}
      </ul>
    </section>
  );
}
