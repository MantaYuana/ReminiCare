'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, cekPeran } from '../../../lib/supabase';
import { bacaResep } from '../../../lib/lokal';
import Sesi from '../../../components/Sesi';
import type { ResepSalinan } from '../../../lib/kinematik/mesin';
import type { Sisi } from '../../../lib/kinematik/tipe';
import { KANDIDAT_CONDONG, SUARA_CONDONG, AMBANG_VERSI } from '../../../lib/kinematik/tipe';

type ResepDenganSisi = ResepSalinan & { sisi: Sisi };

const KOLOM_RESEP =
  'id, sisi_terdampak, gerakan, repetisi, sesi_per_minggu, toleransi_batang, toleransi_bahu, durasi_persen, mode_koreksi, kalimat_condong';

export default function Page() {
  const router = useRouter();
  const [resep, setResep]       = useState<ResepDenganSisi | null>(null);
  const [pasienId, setPasienId] = useState<string | undefined>();
  const [galat, setGalat]       = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function muat() {
      const peran = await cekPeran();

      // Daring: resep dari baris pasien yang terikat ke akun ini
      if (peran.jenis === 'pasien') {
        const { data } = await supabase
          .from('pasien')
          .select(KOLOM_RESEP)
          .eq('id', peran.pasienId)
          .maybeSingle();
        if (data) {
          setResep({
            sisi: data.sisi_terdampak,
            gerakan: data.gerakan,
            repetisi: data.repetisi,
            sesi_per_minggu: data.sesi_per_minggu,
            toleransi_batang: data.toleransi_batang,
            toleransi_bahu: data.toleransi_bahu,
            durasi_persen: data.durasi_persen,
            mode_koreksi: data.mode_koreksi,
            kalimat_condong: data.kalimat_condong,
            kandidat_condong: KANDIDAT_CONDONG,
            suara_condong: SUARA_CONDONG,
            ambang_versi: AMBANG_VERSI,
          });
          setPasienId(peran.pasienId);
          setLoading(false);
          return;
        }
      }

      // Luring: resep tersimpan di perangkat
      if (peran.jenis === 'luring') {
        const lokal = bacaResep();
        if (lokal) {
          setResep({
            sisi: lokal.sisi_terdampak,
            gerakan: lokal.gerakan,
            repetisi: lokal.repetisi,
            sesi_per_minggu: lokal.sesi_per_minggu,
            toleransi_batang: lokal.toleransi_batang,
            toleransi_bahu: lokal.toleransi_bahu,
            durasi_persen: lokal.durasi_persen,
            mode_koreksi: lokal.mode_koreksi,
            kalimat_condong: lokal.kalimat_condong,
            kandidat_condong: KANDIDAT_CONDONG,
            suara_condong: SUARA_CONDONG,
            ambang_versi: AMBANG_VERSI,
          });
          setPasienId(lokal.pasien_id);
          setLoading(false);
          return;
        }
        setGalat('Resep belum tersimpan di ponsel ini. Sambungkan ke internet sekali untuk memuat resep.');
        setLoading(false);
        return;
      }

      // Belum terikat ke resep, atau bukan akun pasien: kembali ke beranda
      router.replace('/pasien');
    }

    muat();
  }, [router]);

  if (loading) {
    return (
      <main className="rc-wrap min-h-screen items-center justify-center text-center">
        <p className="rc-sub" role="status">Memuat resep…</p>
      </main>
    );
  }

  if (galat) {
    return (
      <main className="rc-wrap min-h-screen justify-center">
        <div role="alert" className="rc-alert">{galat}</div>
        <button onClick={() => router.push('/pasien')} className="rc-btn-2">
          Kembali ke beranda
        </button>
      </main>
    );
  }

  if (!resep) return null;

  return <Sesi resep={resep} pasienId={pasienId} simpan kembali="/pasien" />;
}
