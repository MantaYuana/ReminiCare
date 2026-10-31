'use client';

import { useState } from 'react';
import { teksSetuju } from '../lib/naskah';
import { suara } from '../lib/suara';
import type { KodeKlip } from '../lib/suara';

type PihakSetuju = 'pasien' | 'wali';
type TampilLayar = 'setuju' | 'tolak';

interface PropsLayarSetuju {
  onSetuju(oleh: PihakSetuju): void;
}

export default function LayarSetuju({ onSetuju }: PropsLayarSetuju) {
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
      <div className="flex flex-col items-center justify-center gap-6 p-6 min-h-[60vh] max-w-lg mx-auto text-center">
        <p className="text-base">
          Tanpa persetujuan aplikasi tidak bisa dipakai. Hubungi fisioterapis Anda.
        </p>
        <button
          onClick={() => setTampil('setuju')}
          className="btn-sekunder bg-gray-100 rounded-xl hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          Kembali
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Persetujuan penggunaan</h1>

      {/* Paragraf persetujuan */}
      <div className="flex flex-col gap-3">
        {paragraf.map((teks, i) => (
          <p key={i} className="text-base text-gray-700">{teks}</p>
        ))}
      </div>

      {/* Tombol dengarkan */}
      <button
        onClick={handleDengarkan}
        className="btn-sekunder bg-gray-100 rounded-xl hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-400 self-start"
      >
        🔊 Dengarkan
      </button>

      {/* Pilih pihak */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-base font-medium mb-1">Siapa yang menyetujui?</legend>
        {(['pasien', 'wali'] as PihakSetuju[]).map(p => (
          <label
            key={p}
            className="flex items-center gap-3 cursor-pointer btn-sekunder bg-gray-50 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-300"
          >
            <input
              type="radio"
              name="pihak"
              value={p}
              checked={pihak === p}
              onChange={() => setPihak(p)}
              className="w-5 h-5 accent-blue-600"
            />
            <span className="text-base">
              {p === 'pasien' ? 'Saya pasien' : 'Saya wali atas nama pasien'}
            </span>
          </label>
        ))}
      </fieldset>

      {/* Tombol aksi */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => pihak && onSetuju(pihak)}
          disabled={!pihak}
          className="btn-utama bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Setuju
        </button>
        <button
          onClick={() => setTampil('tolak')}
          className="btn-sekunder bg-gray-100 rounded-xl hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          Tidak setuju
        </button>
      </div>
    </div>
  );
}
