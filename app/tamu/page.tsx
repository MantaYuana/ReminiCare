'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { suara } from '../../lib/suara';
import { bacaJson, tulisJson } from '../../lib/lokal';
import FormResep from '../../components/FormResep';
import type { JenisGerakan, ResepTamu } from '../../components/FormResep';
import Sesi from '../../components/Sesi';
import DashboardShell from '../../components/DashboardShell';
import type { ItemNav } from '../../components/DashboardShell';
import BannerSambutan from '../../components/BannerSambutan';
import PanelFisioterapis from '../../components/PanelFisioterapis';
import DaftarLatihan, { KartuLatihan } from '../../components/DaftarLatihan';
import { IkonBeranda, IkonLatihan, IkonChat, IkonKeluar, IkonPeringatan } from '../../components/ikon';
import { AMBANG_VERSI, SUARA_CONDONG } from '../../lib/kinematik/tipe';

const LANGKAH = [
  { judul: 'Siapkan kamera', teks: 'Duduk di kursi bersandaran, ponsel setinggi dada, 1,5 sampai 2 meter di depan Anda.' },
  { judul: 'Diam 5 detik', teks: 'Aplikasi mengenali posisi duduk Anda yang nyaman.' },
  { judul: 'Latihan dengan suara', teks: 'Anda dihitung dan dikoreksi lewat suara. Video tidak pernah keluar dari ponsel.' },
];

const GERAKAN_CONTOH: JenisGerakan[] = ['jangkau_depan', 'jangkau_samping'];

const BAWAAN: ResepTamu = {
  sisi_terdampak: 'kanan',
  gerakan: ['jangkau_depan'],
  repetisi: 5,
  toleransi_batang: 'normal',
  toleransi_bahu: 'normal',
  durasi_persen: 30,
  mode_koreksi: 'penuh',
  kalimat_condong: 'sandaran',
};

export default function Page() {
  const [resep, setResep] = useState<ResepTamu | null>(null);
  // Isian terakhir dibaca setelah mount supaya HTML server dan klien sama (tanpa hydration mismatch)
  const [awal, setAwal] = useState<ResepTamu | null | undefined>(undefined);

  useEffect(() => { setAwal(bacaJson<ResepTamu | null>('rc_tamu', null)); }, []);

  function keBagian(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Klik kartu: satu gerakan itu, memakai isian terakhir (atau nilai bawaan)
  function mulaiKartu(g: JenisGerakan) {
    handleKirim({ ...(awal ?? BAWAAN), gerakan: [g] });
  }

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

  const menuAtas: ItemNav[] = [
    { label: 'Beranda', ikon: <IkonBeranda />, aktif: true, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { label: 'Semua Latihan', ikon: <IkonLatihan />, onClick: () => keBagian('latihan') },
    { label: 'Chat', ikon: <IkonChat />, nonaktif: true },
  ];
  const sisi = (awal ?? BAWAAN).sisi_terdampak;
  const repetisi = (awal ?? BAWAAN).repetisi;

  return (
    <DashboardShell
      judul="Beranda mode tamu"
      atas={menuAtas}
      tombol={{ label: 'Kembali Ke Login', ikon: <IkonKeluar />, href: '/' }}
      panel={<PanelFisioterapis terhubung={false} pesanKosong="Mode tamu tidak terhubung dengan fisioterapis" />}
    >
      <BannerSambutan label="Mode tamu !" judul="Sudah Siap Untuk Latihan Bersama ReminiCare Hari ini?" />

      <div role="status" className="flex items-center gap-3 rounded-2xl bg-ink/75 px-4 py-3 text-base font-medium text-white">
        <IkonPeringatan className="h-6 w-6" />
        <span>Anda Saat Ini Dalam Mode Tamu. Hasil latihan tidak disimpan.</span>
      </div>

      <DaftarLatihan id="latihan" judul="Latihan Terbaru Anda">
        {GERAKAN_CONTOH.map(g => (
          <KartuLatihan key={g} gerakan={g} repetisi={repetisi} sisi={sisi} lencana="Contoh" onMulai={() => mulaiKartu(g)} />
        ))}
      </DaftarLatihan>

      <section aria-labelledby="judul-resep" className="flex flex-col gap-3">
        <h2 id="judul-resep" className="text-lg font-semibold">Atur latihan sendiri</h2>
        {awal === undefined
          ? <p className="rc-sub" role="status">Memuat…</p>
          : <FormResep mode="tamu" pasien={awal} onKirim={handleKirim} />}
      </section>

      <section aria-labelledby="judul-langkah" className="flex flex-col gap-3">
        <h2 id="judul-langkah" className="text-lg font-semibold">Yang akan terjadi</h2>
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
    </DashboardShell>
  );
}
