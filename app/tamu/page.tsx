'use client';

import { useState } from 'react';
import { suara } from '../../lib/suara';
import Sesi from '../../components/Sesi';
import type { Sisi } from '../../lib/kinematik/tipe';

// Nilai placeholder — akan diganti konstanta dari mesin asli saat integrasi
const AMBANG_VERSI = 'v1';

export default function Page() {
  const [sisi, setSisi] = useState<Sisi | null>(null);

  if (sisi) {
    return (
      <Sesi
        resep={{
          gerakan: ['jangkau_depan'],
          repetisi: 5,
          sesi_per_minggu: 3,
          toleransi_batang: 'normal',
          toleransi_bahu: 'normal',
          durasi_persen: 30,
          mode_koreksi: 'penuh',
          kalimat_condong: 'sandaran',
          kandidat_condong: 'a',
          suara_condong: false,
          ambang_versi: AMBANG_VERSI,
          sisi,
        }}
        simpan={false}
        tamu
        kembali="/"
      />
    );
  }

  return (
    <main className="flex flex-col items-center justify-center gap-8 min-h-screen p-6">
      {/* Spanduk tamu */}
      <div
        role="status"
        className="w-full max-w-sm bg-yellow-50 border border-yellow-300 rounded-xl p-4 text-base text-center"
      >
        Mode tamu: data tidak disimpan
      </div>

      <h1 className="text-2xl font-bold">Pilih lengan yang dilatih</h1>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <button
          onClick={async () => {
            await suara.buka();
            setSisi('kiri');
          }}
          className="btn-utama bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Lengan kiri
        </button>

        <button
          onClick={async () => {
            await suara.buka();
            setSisi('kanan');
          }}
          className="btn-utama bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Lengan kanan
        </button>
      </div>

      <button
        onClick={() => window.history.back()}
        className="btn-sekunder text-gray-600 underline focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
      >
        Kembali
      </button>
    </main>
  );
}
