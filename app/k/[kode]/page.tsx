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
      <main className="rc-wrap min-h-screen items-center justify-center text-center">
        <p className="rc-sub" role="status">Memuat…</p>
      </main>
    );
  }

  if (tampil === 'galat') {
    return (
      <main className="rc-wrap min-h-screen justify-center">
        <div role="alert" className="rc-alert">{galat}</div>
        <button onClick={() => router.push('/')} className="rc-btn-2">
          Kembali ke beranda
        </button>
      </main>
    );
  }

  return (
    <main>
      {galat && (
        <div role="alert" className="rc-alert mx-5 mt-6">{galat}</div>
      )}
      <LayarSetuju onSetuju={handleSetuju} />
    </main>
  );
}
