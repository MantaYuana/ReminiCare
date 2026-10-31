'use client';

import Link from 'next/link';
import { useTerapis } from '../../components/terapis/useTerapis';
import KerangkaTerapis from '../../components/terapis/KerangkaTerapis';
import TabelPasien from '../../components/terapis/TabelPasien';
import BannerSambutan from '../../components/BannerSambutan';
import { IkonAkun, IkonTambah } from '../../components/ikon';

const PRATINJAU = 6;

export default function DasborTerapisPage() {
  const t = useTerapis();
  const { daftarPasien, galat, sudahMuat, sedangMemuat } = t;
  const nama = t.peran?.nama;

  return (
    <KerangkaTerapis t={t} halaman="beranda" judul="Beranda fisioterapis">
      <BannerSambutan
        label={nama ? `Selamat datang ${nama}` : 'Selamat datang'}
        judul="Ayo Cek Perkembangan Pasien Pasienmu Hari ini !"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_4px_20px_rgba(20,24,25,0.08)]">
          <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white">
            <IkonAkun className="h-7 w-7" />
          </span>
          <div className="leading-tight">
            <p className="text-2xl font-semibold tabular-nums">{daftarPasien.length}</p>
            <p className="text-sm font-medium">Total Pasien</p>
          </div>
        </div>

        <Link
          href="/terapis/pasien/baru"
          className="flex min-h-[64px] flex-1 items-center gap-3 rounded-2xl bg-brand-700 px-6 text-lg font-semibold text-white transition-colors hover:bg-brand-800"
        >
          <IkonTambah />
          Tambahkan Pasien
        </Link>
      </div>

      {galat && (
        <div role="alert" className="rc-alert">
          <p className="font-semibold">Gagal Memuat Data Pasien</p>
          <p>{galat}</p>
        </div>
      )}

      <section aria-labelledby="judul-pasien" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="judul-pasien" className="text-lg font-semibold">List Pasien</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={t.muatData}
              disabled={sedangMemuat}
              className="min-h-[44px] px-2 text-base font-medium text-brand-700 underline underline-offset-4 disabled:opacity-50"
            >
              {sedangMemuat ? 'Memuat…' : 'Muat ulang'}
            </button>
            <Link href="/terapis/pasien" className="rc-tautan">See All</Link>
          </div>
        </div>

        {sudahMuat && !galat && !sedangMemuat && daftarPasien.length === 0 ? (
          <div className="rc-card space-y-3 text-center">
            <p className="text-xl font-semibold">Belum ada pasien terdaftar</p>
            <p className="mx-auto max-w-lg text-base text-muted">
              Tambahkan pasien baru untuk mengatur resep latihan dan membuat kode klaim perangkat, atau isi data contoh dari menu Settings.
            </p>
          </div>
        ) : (
          <TabelPasien daftar={daftarPasien.slice(0, PRATINJAU)} />
        )}
      </section>
    </KerangkaTerapis>
  );
}
