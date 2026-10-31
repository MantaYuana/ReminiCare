'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { suara } from '../../lib/suara';
import { bacaJson, tulisJson } from '../../lib/lokal';
import FormResep from '../../components/FormResep';
import type { ResepTamu } from '../../components/FormResep';
import Sesi from '../../components/Sesi';
import DashboardShell from '../../components/DashboardShell';
import type { ItemNav } from '../../components/DashboardShell';
import BannerSambutan from '../../components/BannerSambutan';
import { IkonBeranda, IkonAkun, IkonKeluar } from '../../components/ikon';
import { AMBANG_VERSI, SUARA_CONDONG } from '../../lib/kinematik/tipe';

const LANGKAH = [
  { judul: 'Siapkan kamera', teks: 'Duduk di kursi bersandaran, ponsel setinggi dada, 1,5 sampai 2 meter di depan Anda.' },
  { judul: 'Diam 5 detik', teks: 'Aplikasi mengenali posisi duduk Anda yang nyaman.' },
  { judul: 'Latihan dengan suara', teks: 'Anda dihitung dan dikoreksi lewat suara. Video tidak pernah keluar dari ponsel.' },
];

const MENU_ATAS: ItemNav[] = [
  { label: 'Beranda tamu', ikon: <IkonBeranda />, aktif: true },
  { label: 'Buat akun', ikon: <IkonAkun />, href: '/daftar' },
];
const MENU_BAWAH: ItemNav[] = [
  { label: 'Kembali ke login', ikon: <IkonKeluar />, href: '/' },
];

export default function Page() {
  const [resep, setResep] = useState<ResepTamu | null>(null);
  // Isian terakhir dibaca setelah mount supaya HTML server dan klien sama (tanpa hydration mismatch)
  const [awal, setAwal] = useState<ResepTamu | null | undefined>(undefined);

  useEffect(() => { setAwal(bacaJson<ResepTamu | null>('rc_tamu', null)); }, []);

  function handleKirim(r: ResepTamu) {
    void suara.buka();                     // sinkron dari ketukan; jangan ada await sebelumnya
    tulisJson('rc_tamu', r);
    setAwal(r);
    setResep(r);
  }

  if (resep) {
    return (
      <Sesi
        resep={{
          ...resep,
          sesi_per_minggu: 3,
          kandidat_condong: 'a',
          suara_condong: SUARA_CONDONG,
          ambang_versi: AMBANG_VERSI,
          sisi: resep.sisi_terdampak,
        }}
        simpan={false}
        tamu
        kembali="/tamu"
        onSelesai={() => setResep(null)}
      />
    );
  }

  return (
    <DashboardShell judul="Mode tamu" atas={MENU_ATAS} bawah={MENU_BAWAH} pengguna={{ nama: 'Tamu', peran: 'Tanpa akun' }}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <BannerSambutan
          judul="Selamat datang, Tamu"
          teks="Atur latihan, lalu coba dengan panduan kamera dan suara. Di mode tamu, hasil latihan tidak disimpan."
        />

        <section aria-labelledby="judul-resep" className="flex flex-col gap-3">
          <h2 id="judul-resep" className="text-xl font-semibold text-brand-700">Atur latihan</h2>
          {awal === undefined
            ? <p className="rc-sub" role="status">Memuat…</p>
            : <FormResep mode="tamu" pasien={awal} onKirim={handleKirim} />}
        </section>

        <section aria-labelledby="judul-langkah" className="flex flex-col gap-3">
          <h2 id="judul-langkah" className="text-xl font-semibold text-brand-700">Yang akan terjadi</h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {LANGKAH.map((l, i) => (
              <li key={l.judul} className="rc-card flex flex-col gap-2">
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-base font-semibold text-white">
                  {i + 1}
                </span>
                <p className="text-lg font-semibold">{l.judul}</p>
                <p className="text-base text-muted">{l.teks}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-brand-50 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-brand-700">Ingin hasilnya tersimpan?</h2>
            <p className="text-base text-muted">Buat akun, lalu minta fisioterapis menghubungkan resep latihan Anda.</p>
          </div>
          <Link href="/daftar" className="rc-btn-2 shrink-0 bg-white">Buat akun</Link>
        </section>
      </div>
    </DashboardShell>
  );
}
