'use client';

import { useState } from 'react';
import Link from 'next/link';
import { suara } from '../../lib/suara';
import Sesi from '../../components/Sesi';
import DashboardShell from '../../components/DashboardShell';
import type { ItemNav } from '../../components/DashboardShell';
import BannerSambutan from '../../components/BannerSambutan';
import { IkonBeranda, IkonAkun, IkonKeluar, IkonLengan } from '../../components/ikon';
import type { Sisi } from '../../lib/kinematik/tipe';
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

// Catatan: form resep tamu (Task 3) menggantikan pemilihan lengan ini
// setelah FormResep mode="tamu" dari Pindra tersedia.
export default function Page() {
  const [sisi, setSisi] = useState<Sisi | null>(null);

  async function mulai(s: Sisi) {
    await suara.buka();                  // harus dari ketukan pengguna
    setSisi(s);
  }

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
    <DashboardShell judul="Mode tamu" atas={MENU_ATAS} bawah={MENU_BAWAH} pengguna={{ nama: 'Tamu', peran: 'Tanpa akun' }}>
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <BannerSambutan
          judul="Selamat datang, Tamu"
          teks="Coba latihan lengan dengan panduan kamera dan suara. Di mode tamu, hasil latihan tidak disimpan."
        />

        <section aria-labelledby="judul-lengan" className="flex flex-col gap-3">
          <h2 id="judul-lengan" className="text-xl font-semibold text-brand-700">Pilih lengan yang dilatih</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['kiri', 'kanan'] as Sisi[]).map(s => (
              <button
                key={s}
                onClick={() => mulai(s)}
                className="group flex min-h-[96px] items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-brand-700 hover:bg-brand-50 motion-reduce:transition-none"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 group-hover:bg-white">
                  <IkonLengan className={`h-8 w-8 ${s === 'kiri' ? '-scale-x-100' : ''}`} />
                </span>
                <span>
                  <span className="block text-lg font-semibold">Lengan {s}</span>
                  <span className="block text-base text-muted">Mulai latihan jangkau ke depan</span>
                </span>
              </button>
            ))}
          </div>
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
