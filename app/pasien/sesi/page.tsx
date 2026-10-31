'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, cekPeran } from '../../../lib/supabase';
import { bacaResep } from '../../../lib/lokal';
import { suara } from '../../../lib/suara';
import Sesi from '../../../components/Sesi';
import type { ResepSalinan } from '../../../lib/kinematik/mesin';
import type { Sisi } from '../../../lib/kinematik/tipe';

type ResepDenganSisi = ResepSalinan & { sisi: Sisi };

function KontenSesi() {
  const router       = useRouter();
  const [resep, setResep]     = useState<ResepDenganSisi | null>(null);
  const [pasienId, setPasienId] = useState<string | undefined>();
  const [kembali, setKembali]  = useState('/pasien');
  const [galat, setGalat]     = useState('');
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    async function muat() {
      const peran = await cekPeran();

      // Pasien biasa
      if (peran.jenis === 'pasien') {
        const { data } = await supabase
          .from('pasien')
          .select('id, sisi_terdampak, gerakan, repetisi, sesi_per_minggu, toleransi_batang, toleransi_bahu, durasi_persen, mode_koreksi, kalimat_condong, kandidat_condong, suara_condong, ambang_versi')
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
            kandidat_condong: data.kandidat_condong,
            suara_condong: data.suara_condong,
            ambang_versi: data.ambang_versi ?? 'v1',
          });
          setPasienId(peran.pasienId);
          setLoading(false);
          return;
        }
      }

      // Luring — pakai resep lokal
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
          } as ResepDenganSisi);
          setPasienId(lokal.pasien_id);
          setLoading(false);
          return;
        }
      }

      setGalat('Resep tidak ditemukan, hubungkan ke internet sekali untuk memuat resep.');
      setLoading(false);
    }

    muat();
  }, [router]);

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-base text-gray-500">Memuat resep…</p>
      </main>
    );
  }

  if (galat) {
    return (
      <main className="flex flex-col items-center justify-center gap-6 min-h-screen p-6">
        <div role="alert" className="w-full max-w-sm bg-red-50 border border-red-300 rounded-xl p-4 text-base">
          {galat}
        </div>
        <button
          onClick={() => router.push('/pasien')}
          className="btn-sekunder bg-gray-100 rounded-xl hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-400"
        >
          Kembali ke beranda
        </button>
      </main>
    );
  }

  if (!resep) return null;

  return (
    <Sesi
      resep={resep}
      pasienId={pasienId}
      simpan={true}
      kembali={kembali}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-base text-gray-500">Memuat resep…</p>
      </main>
    }>
      <KontenSesi />
    </Suspense>
  );
}
