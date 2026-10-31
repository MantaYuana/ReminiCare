'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, cekPeran } from '../../../lib/supabase';
import { bacaResep, simpanResep, keResepLokal, KOLOM_RESEP } from '../../../lib/lokal';
import type { ResepLokal } from '../../../lib/lokal';
import Sesi from '../../../components/Sesi';
import LayarMuat from '../../../components/LayarMuat';
import type { ResepSalinan } from '../../../lib/kinematik/mesin';
import type { Sisi } from '../../../lib/kinematik/tipe';
import { KANDIDAT_CONDONG, SUARA_CONDONG, AMBANG_VERSI } from '../../../lib/kinematik/tipe';

type ResepDenganSisi = ResepSalinan & { sisi: Sisi };

function keResepSesi(r: ResepLokal): ResepDenganSisi {
  return {
    sisi: r.sisi_terdampak,
    gerakan: r.gerakan,
    repetisi: r.repetisi,
    sesi_per_minggu: r.sesi_per_minggu,
    toleransi_batang: r.toleransi_batang,
    toleransi_bahu: r.toleransi_bahu,
    durasi_persen: r.durasi_persen,
    mode_koreksi: r.mode_koreksi,
    kalimat_condong: r.kalimat_condong,
    kandidat_condong: KANDIDAT_CONDONG,
    suara_condong: SUARA_CONDONG,
    ambang_versi: AMBANG_VERSI,
  };
}

export default function Page() {
  const router = useRouter();
  const [resep, setResep]       = useState<ResepDenganSisi | null>(null);
  const [pasienId, setPasienId] = useState<string | undefined>();
  const [galat, setGalat]       = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    function pakai(r: ResepLokal) {
      setResep(keResepSesi(r));
      setPasienId(r.pasien_id);
      setLoading(false);
    }

    async function muat() {
      const peran = await cekPeran();
      let pasienLokal: string | undefined;

      // Daring: resep dari baris pasien yang terikat ke akun ini
      if (peran.jenis === 'pasien') {
        const { data, error } = await supabase
          .from('pasien')
          .select(KOLOM_RESEP)
          .eq('id', peran.pasienId)
          .maybeSingle();
        if (data) {
          const lokal = keResepLokal(data);
          simpanResep(lokal);
          pakai(lokal);
          return;
        }
        // Tanpa galat = baris sudah tidak terikat: kembali ke beranda
        if (!error) { router.replace('/pasien'); return; }
        pasienLokal = peran.pasienId;   // jaringan putus sesaat: lanjut dengan resep di perangkat
      }

      // Luring (atau query di atas gagal): resep tersimpan di perangkat
      if (peran.jenis === 'luring' || pasienLokal) {
        const lokal = bacaResep();
        if (lokal && (!pasienLokal || lokal.pasien_id === pasienLokal)) {
          pakai(lokal);
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
    return <LayarMuat teks="Memuat resep…" />;
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
