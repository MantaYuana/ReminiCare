'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase, cekPeran, pesanGalat, type Peran } from '../../../lib/supabase';
import { simpanResep } from '../../../lib/lokal';
import LayarSetuju from '../../../components/LayarSetuju';

type TampilLayar = 'memuat' | 'setuju' | 'galat';

export default function Page() {
  const router = useRouter();
  const { kode } = useParams<{ kode: string }>();

  const [tampil, setTampil]   = useState<TampilLayar>('memuat');
  const [galat, setGalat]     = useState('');

  useEffect(() => {
    async function siapkan() {
      const peran = await cekPeran();

      // Terapis tidak boleh klaim
      if (peran.jenis === 'terapis') {
        setGalat(pesanGalat({ message: 'akun_terapis' }));
        setTampil('galat');
        return;
      }

      // Belum ada sesi → sign in anon
      if (peran.jenis === 'keluar') {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) { setGalat(pesanGalat(error)); setTampil('galat'); return; }
      }

      setTampil('setuju');
    }
    siapkan();
  }, []);

  async function handleSetuju(oleh: 'pasien' | 'wali') {
    setGalat('');
    const { data, error } = await supabase.rpc('klaim_pasien', {
      p_kode: kode,
      p_versi: 'F19-v1',
      p_oleh: oleh,
    });

    if (error) { setGalat(pesanGalat(error)); return; }

    // Ambil resep pasien dan simpan lokal
    const { data: pasien } = await supabase
      .from('pasien')
      .select('id, nama_panggilan, sisi_terdampak, gerakan, repetisi, sesi_per_minggu, toleransi_batang, toleransi_bahu, durasi_persen, mode_koreksi, kalimat_condong')
      .eq('id', data)
      .maybeSingle();

    if (pasien) {
      simpanResep({
        pasien_id: pasien.id,
        nama_panggilan: pasien.nama_panggilan,
        sisi_terdampak: pasien.sisi_terdampak,
        gerakan: pasien.gerakan,
        repetisi: pasien.repetisi,
        sesi_per_minggu: pasien.sesi_per_minggu,
        toleransi_batang: pasien.toleransi_batang,
        toleransi_bahu: pasien.toleransi_bahu,
        durasi_persen: pasien.durasi_persen,
        mode_koreksi: pasien.mode_koreksi,
        kalimat_condong: pasien.kalimat_condong,
      });
    }

    router.replace('/pasien');
  }

  if (tampil === 'memuat') {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-base text-gray-500">Memuat…</p>
      </main>
    );
  }

  if (tampil === 'galat') {
    return (
      <main className="flex flex-col items-center justify-center gap-6 min-h-screen p-6">
        <div role="alert" className="w-full max-w-sm bg-red-50 border border-red-300 rounded-xl p-4 text-base">
          {galat}
        </div>
        <button
          onClick={() => router.push('/')}
          className="btn-sekunder bg-gray-100 rounded-xl hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          Kembali ke beranda
        </button>
      </main>
    );
  }

  return (
    <main>
      {galat && (
        <div
          role="alert"
          className="mx-6 mt-6 bg-red-50 border border-red-300 rounded-xl p-4 text-base text-red-700"
        >
          {galat}
        </div>
      )}
      <LayarSetuju onSetuju={handleSetuju} />
    </main>
  );
}
