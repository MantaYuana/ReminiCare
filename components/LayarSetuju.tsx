'use client';

import { useState } from 'react';
import { teksSetuju } from '../lib/naskah';
import { suara } from '../lib/suara';
import type { KodeKlip } from '../lib/suara';

type PihakSetuju = 'pasien' | 'wali';
type TampilLayar = 'setuju' | 'tolak';

interface PropsLayarSetuju {
  onSetuju(oleh: PihakSetuju): void;
  /** Mencegah ketukan ganda selama klaim berjalan. */
  sibuk?: boolean;
}

export default function LayarSetuju({ onSetuju, sibuk = false }: PropsLayarSetuju) {
  const paragraf = teksSetuju();
  const [pihak, setPihak]   = useState<PihakSetuju | null>(null);
  const [tampil, setTampil] = useState<TampilLayar>('setuju');

  async function handleDengarkan() {
    await suara.buka();
    for (let i = 1; i <= paragraf.length; i++) {
      await suara.ucap(`I-SETUJU-${i}` as KodeKlip);
    }
  }

  if (tampil === 'tolak') {
    return (
      <div className="rc-wrap min-h-[70vh] justify-center text-center">
        <h1 className="rc-judul">Persetujuan diperlukan</h1>
        <p className="rc-sub">Tanpa persetujuan, aplikasi tidak bisa dipakai. Hubungi fisioterapis Anda.</p>
        <button onClick={() => setTampil('setuju')} className="rc-btn-2 self-center">
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="rc-wrap">
      <div>
        <h1 className="rc-judul">Persetujuan penggunaan</h1>
        <p className="rc-sub">Baca dengan teliti, atau ketuk Dengarkan untuk mendengarnya.</p>
      </div>

      <div className="rc-card flex flex-col gap-3">
        {paragraf.map((teks, i) => (
          <p key={i} className="text-base">{teks}</p>
        ))}
      </div>

      <button type="button" onClick={handleDengarkan} className="rc-btn-2 self-start">
        <span aria-hidden="true">🔊</span> Dengarkan
      </button>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-base font-semibold">Siapa yang menyetujui?</legend>
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
    </div>
  );
}
