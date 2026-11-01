'use client';

import { useMemo, useState } from 'react';
import { useTerapis } from '../../../components/terapis/useTerapis';
import KerangkaTerapis from '../../../components/terapis/KerangkaTerapis';
import TabelPasien from '../../../components/terapis/TabelPasien';

export default function SemuaPasienPage() {
  const t = useTerapis();
  const [cari, setCari] = useState('');
  const { daftarPasien, galat, sudahMuat, sedangMemuat } = t;

  const tersaring = useMemo(() => {
    const k = cari.trim().toLowerCase();
    return k ? daftarPasien.filter(p => p.nama_panggilan.toLowerCase().includes(k)) : daftarPasien;
  }, [daftarPasien, cari]);

  const kosong = sudahMuat && !galat && !sedangMemuat && tersaring.length === 0;

  return (
    <KerangkaTerapis t={t} halaman="pasien" judul="Semua pasien" cari={cari} onCari={setCari}>
      {galat && (
        <div role="alert" className="rc-alert">
          <p className="font-semibold">Gagal Memuat Data Pasien</p>
          <p>{galat}</p>
        </div>
      )}

      <section aria-labelledby="judul-pasien" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 id="judul-pasien" className="text-lg font-semibold">List Pasien</h1>
          <button
            type="button"
            onClick={t.muatData}
            disabled={sedangMemuat}
            className="min-h-[44px] px-2 text-base font-medium text-brand-700 underline underline-offset-4 disabled:opacity-50"
          >
            {sedangMemuat ? 'Memuat…' : 'Muat ulang'}
          </button>
        </div>

        {kosong ? (
          <div className="rc-card text-center">
            <p className="text-lg font-semibold">
              {cari.trim() ? `Tidak ada pasien dengan nama "${cari.trim()}"` : 'Belum ada pasien terdaftar'}
            </p>
          </div>
        ) : (
          <TabelPasien daftar={tersaring} />
        )}
      </section>
    </KerangkaTerapis>
  );
}
