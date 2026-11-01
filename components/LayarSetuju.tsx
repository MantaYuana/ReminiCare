'use client';

import { useEffect, useRef, useState } from 'react';
import { teksSetuju } from '../lib/naskah';
import { suara } from '../lib/suara';
import type { KodeKlip } from '../lib/suara';
import { Logo } from './AuthLayout';
import { IkonBerhenti, IkonSuara } from './ikon';

type PihakSetuju = 'pasien' | 'wali';
type TampilLayar = 'setuju' | 'tolak';

interface PropsLayarSetuju {
  onSetuju(oleh: PihakSetuju): void;
  /** Mencegah ketukan ganda selama klaim berjalan. */
  sibuk?: boolean;
}

function Kerangka({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="flex justify-center px-5 pt-6 md:justify-start md:px-10">
        <Logo />
      </header>
      {children}
    </div>
  );
}

export default function LayarSetuju({ onSetuju, sibuk = false }: PropsLayarSetuju) {
  const paragraf = teksSetuju();
  const [pihak, setPihak]   = useState<PihakSetuju | null>(null);
  const [tampil, setTampil] = useState<TampilLayar>('setuju');
  const [dibaca, setDibaca] = useState<number | null>(null);   // indeks paragraf yang sedang disuarakan
  const batalRef = useRef(false);

  // Suara berhenti bila layar ditinggalkan
  useEffect(() => () => { batalRef.current = true; suara.hentikan(); }, []);

  async function handleDengarkan() {
    batalRef.current = false;
    await suara.buka();
    for (let i = 1; i <= paragraf.length; i++) {
      if (batalRef.current) return;
      setDibaca(i - 1);
      await suara.ucap(`I-SETUJU-${i}` as KodeKlip);
    }
    if (!batalRef.current) setDibaca(null);
  }

  function handleBerhenti() {
    batalRef.current = true;
    suara.hentikan();
    setDibaca(null);
  }

  if (tampil === 'tolak') {
    return (
      <Kerangka>
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
          <h1 className="rc-judul">Persetujuan diperlukan</h1>
          <p className="rc-sub">Tanpa persetujuan, aplikasi tidak bisa dipakai. Hubungi fisioterapis Anda.</p>
          <button onClick={() => setTampil('setuju')} className="rc-btn-2 mt-2">
            Kembali
          </button>
        </div>
      </Kerangka>
    );
  }

  return (
    <Kerangka>
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-8 md:px-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="judul-setuju" className="flex flex-col gap-5">
          <div>
            <h1 id="judul-setuju" className="rc-judul">Persetujuan penggunaan</h1>
            <p className="rc-sub mt-1">Baca dengan teliti, atau ketuk Dengarkan untuk mendengarnya.</p>
          </div>

          <button
            type="button"
            onClick={dibaca === null ? handleDengarkan : handleBerhenti}
            className="rc-btn-2 self-start"
          >
            {dibaca === null
              ? <><IkonSuara className="h-5 w-5" /> Dengarkan</>
              : <><IkonBerhenti className="h-5 w-5" /> Berhenti</>}
          </button>

          <ol className="flex flex-col gap-3">
            {paragraf.map((teks, i) => (
              <li
                key={i}
                aria-current={dibaca === i ? 'true' : undefined}
                className={`flex gap-4 rounded-2xl border p-4 transition-colors motion-reduce:transition-none ${
                  dibaca === i ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white"
                >
                  {i + 1}
                </span>
                <p className="text-base">{teks}</p>
              </li>
            ))}
          </ol>
        </section>

        <aside className="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-[0_8px_32px_rgba(20,24,25,0.10)] lg:sticky lg:top-8">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-lg font-semibold">Siapa yang menyetujui?</legend>
            {(['pasien', 'wali'] as PihakSetuju[]).map(p => (
              <label
                key={p}
                className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 transition-colors ${
                  pihak === p ? 'border-brand-700 bg-brand-50' : 'border-slate-300 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="pihak"
                  value={p}
                  checked={pihak === p}
                  onChange={() => setPihak(p)}
                  className="h-5 w-5 accent-brand-700"
                />
                <span className="text-base font-medium">
                  {p === 'pasien' ? 'Saya pasien' : 'Saya wali atas nama pasien'}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => pihak && onSetuju(pihak)}
              disabled={!pihak || sibuk}
              className="rc-btn"
            >
              {sibuk ? 'Memproses…' : 'Setuju'}
            </button>
            <button onClick={() => setTampil('tolak')} disabled={sibuk} className="rc-btn-2">
              Tidak setuju
            </button>
          </div>
        </aside>
      </div>
    </Kerangka>
  );
}
