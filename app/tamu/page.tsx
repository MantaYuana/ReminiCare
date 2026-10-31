'use client';

import { useState } from 'react';
import { suara } from '../../lib/suara';
import Sesi from '../../components/Sesi';
import type { Sisi } from '../../lib/kinematik/tipe';
import { AMBANG_VERSI, SUARA_CONDONG } from '../../lib/kinematik/tipe';

// Catatan: form resep tamu (Task 3) menggantikan pemilihan lengan ini
// setelah FormResep mode="tamu" dari Pindra tersedia.
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
          suara_condong: SUARA_CONDONG,
          ambang_versi: AMBANG_VERSI,
          sisi,
        }}
        simpan={false}
        tamu
        kembali="/tamu"
        onSelesai={() => setSisi(null)}
      />
    );
  }

  return (
    <main className="rc-wrap min-h-screen justify-center">
      <div role="status" className="rc-info text-center">
        Mode tamu: data tidak disimpan
      </div>

      <div>
        <h1 className="rc-judul">Pilih lengan yang dilatih</h1>
        <p className="rc-sub">Anda bisa mencoba latihan tanpa membuat akun.</p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={async () => { await suara.buka(); setSisi('kiri'); }}
          className="rc-btn"
        >
          Lengan kiri
        </button>
        <button
          onClick={async () => { await suara.buka(); setSisi('kanan'); }}
          className="rc-btn"
        >
          Lengan kanan
        </button>
      </div>

      <button onClick={() => window.history.back()} className="rc-tautan self-center">
        Kembali
      </button>
    </main>
  );
}
