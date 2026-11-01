'use client';

import { IkonLatihan } from '../ikon';

interface PropsLayarPanduan {
  bantuan: boolean;
  gating: boolean;
}

// Pratinjau kamera dirender oleh Sesi (satu <video> tetap terpasang untuk mesin pose).
const PETUNJUK = [
  'Duduk di kursi bersandaran, tanpa sandaran tangan',
  'Letakkan ponsel setinggi dada, 1,5 sampai 2 meter di depan Anda',
  'Hadap kamera; kepala sampai pangkuan harus terlihat',
  'Posisi lanskap (mendatar) disarankan',
];

export default function LayarPanduan({ bantuan, gating }:PropsLayarPanduan) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="rc-judul">Posisikan Kamera</h2>
        <p className="rc-sub">Pastikan Anda terlihat dengan jelas di pratinjau di atas.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {bantuan && (
            <div role="alert" className="rc-info">
              Kalibrasi belum berhasil beberapa kali. Periksa lagi posisi kamera dan duduk sesuai petunjuk, lalu coba lagi.
            </div>
          )}

          <div role="status" className={gating ? 'rc-info' : 'rc-ok'}>
            {gating
              ? 'Kamera belum melihat Anda dengan jelas. Geser posisi sampai kepala sampai pangkuan masuk bingkai.'
              : 'Posisi terlihat baik. Tetap duduk diam sampai hitungan selesai.'}
          </div>
        </div>

        <section aria-labelledby="judul-petunjuk" className="rounded-2xl border border-slate-200 p-4">
          <h3 id="judul-petunjuk" className="mb-3 text-lg font-semibold">Petunjuk posisi</h3>
          <ul className="flex flex-col gap-3">
            {PETUNJUK.map(t => (
              <li key={t} className="flex gap-3 text-base">
                <IkonLatihan className="h-6 w-6 text-brand-700" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
