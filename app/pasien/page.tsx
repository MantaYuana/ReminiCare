'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, cekPeran, pesanGalat } from '../../lib/supabase';
import { bacaResep, simpanResep, bacaRiwayat, hapus } from '../../lib/lokal';
import type { Riwayat } from '../../lib/lokal';
import { jumlahSesi } from '../../lib/antrean';
import { normalKode } from '../../lib/arah';
import { suara } from '../../lib/suara';
import DashboardShell from '../../components/DashboardShell';
import type { ItemNav } from '../../components/DashboardShell';
import BannerSambutan from '../../components/BannerSambutan';
import { IkonBeranda, IkonMain, IkonRiwayat, IkonKeluar, IkonHapus, IkonAkun } from '../../components/ikon';

const KOLOM_RESEP =
  'nama_panggilan, sisi_terdampak, gerakan, repetisi, sesi_per_minggu, toleransi_batang, toleransi_bahu, durasi_persen, mode_koreksi, kalimat_condong';

type Keadaan = 'memuat' | 'terikat' | 'belum_ada_resep';
type RingkasResep = { gerakan: string[]; repetisi: number; sisi: 'kiri' | 'kanan' };

const NAMA_GERAKAN: Record<string, string> = {
  jangkau_depan: 'Jangkau ke depan',
  jangkau_samping: 'Jangkau ke samping',
};

const fmtTanggal = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtHari = new Intl.DateTimeFormat('id-ID', { weekday: 'short' });

function sapaan(): string {
  const j = new Date().getHours();
  if (j < 11) return 'Selamat pagi';
  if (j < 15) return 'Selamat siang';
  if (j < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export default function Page() {
  const router = useRouter();
  const [keadaan, setKeadaan]             = useState<Keadaan>('memuat');
  const [nama, setNama]                   = useState('');
  const [resep, setResep]                 = useState<RingkasResep | null>(null);
  const [riwayat, setRiwayat]             = useState<Riwayat[]>([]);
  const [sesiPerMinggu, setSesiPerMinggu] = useState(0);
  const [antreanCount, setAntreanCount]   = useState(0);
  const [konfirmHapus, setKonfirmHapus]   = useState(false);
  const [pesanHapus, setPesanHapus]       = useState('');
  const [galat, setGalat]                 = useState('');
  const [kode, setKode]                   = useState('');
  const [galatKode, setGalatKode]         = useState('');

  useEffect(() => {
    function muatRiwayat(pasienId: string) {
      setRiwayat(bacaRiwayat(pasienId));
    }

    async function muat() {
      const peran = await cekPeran();

      if (peran.jenis === 'pasien') {
        const { data } = await supabase
          .from('pasien')
          .select(KOLOM_RESEP)
          .eq('id', peran.pasienId)
          .maybeSingle();
        if (data) {
          setNama(data.nama_panggilan ?? '');
          setSesiPerMinggu(data.sesi_per_minggu ?? 3);
          setResep({ gerakan: data.gerakan, repetisi: data.repetisi, sisi: data.sisi_terdampak });
          simpanResep({
            pasien_id: peran.pasienId,
            nama_panggilan: data.nama_panggilan,
            sisi_terdampak: data.sisi_terdampak,
            gerakan: data.gerakan,
            repetisi: data.repetisi,
            sesi_per_minggu: data.sesi_per_minggu,
            toleransi_batang: data.toleransi_batang,
            toleransi_bahu: data.toleransi_bahu,
            durasi_persen: data.durasi_persen,
            mode_koreksi: data.mode_koreksi,
            kalimat_condong: data.kalimat_condong,
          });
          muatRiwayat(peran.pasienId);
          setKeadaan('terikat');
        } else {
          // Baris pasien hilang (mis. fisioterapis mengatur ulang data contoh)
          hapus('rc_resep');
          setKeadaan('belum_ada_resep');
        }
      } else if (peran.jenis === 'luring') {
        const lokal = bacaResep();
        if (!lokal) {
          setGalat('Butuh internet sekali untuk memuat resep.');
          setKeadaan('belum_ada_resep');
        } else {
          setNama(lokal.nama_panggilan ?? '');
          setSesiPerMinggu(lokal.sesi_per_minggu ?? 3);
          setResep({ gerakan: lokal.gerakan, repetisi: lokal.repetisi, sisi: lokal.sisi_terdampak });
          muatRiwayat(lokal.pasien_id);
          setKeadaan('terikat');
        }
      } else if ((peran.jenis as string) === 'pasien_baru') {
        // Peran pasien yang belum terikat ke resep (kontrak V9 dari lib/supabase.ts)
        hapus('rc_resep');
        setKeadaan('belum_ada_resep');
      } else {
        router.replace('/');
        return;
      }

      setAntreanCount(jumlahSesi());
    }
    muat();

    // Antrean bisa selesai terkirim saat halaman terbuka
    const id = setInterval(() => setAntreanCount(jumlahSesi()), 2000);
    return () => clearInterval(id);
  }, [router]);

  const sesiMingguIni = useMemo(() => {
    const batas = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return riwayat.filter(r => new Date(r.mulai).getTime() > batas).length;
  }, [riwayat]);

  // 7 hari terakhir, hari ini paling kanan; penanda bila ada sesi di hari itu
  const hari7 = useMemo(() => {
    const ada = new Set(riwayat.map(r => new Date(r.mulai).toDateString()));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { label: fmtHari.format(d), tgl: d.getDate(), sesi: ada.has(d.toDateString()), hariIni: i === 6 };
    });
  }, [riwayat]);

  async function mulaiLatihan() {
    await suara.buka();                  // harus dari ketukan pengguna
    router.push('/pasien/sesi');
  }

  async function handleHapus() {
    if (!navigator.onLine) {
      setPesanHapus('Butuh internet untuk menghapus. Sambungkan ke internet lalu coba lagi.');
      return;
    }
    const { error } = await supabase.rpc('cabut_persetujuan');
    if (error) { setGalat(pesanGalat(error)); setKonfirmHapus(false); return; }

    hapus('rc_antrean');
    hapus('rc_gagal');
    hapus('rc_resep');
    try {
      Object.keys(globalThis.localStorage ?? {})
        .filter(k => k.startsWith('rc_riwayat:'))
        .forEach(k => hapus(k));
    } catch { /* abaikan */ }

    await supabase.auth.signOut();
    router.replace('/?pesan=dihapus');
  }

  async function handleKeluar() {
    await supabase.auth.signOut();
    hapus('rc_resep');
    router.replace('/');
  }

  function handleHubungkan(e: React.FormEvent) {
    e.preventDefault();
    const k = normalKode(kode);
    if (!k) {
      setGalatKode('Kode terdiri dari 8 huruf atau angka (0–9, A–F).');
      return;
    }
    setGalatKode('');
    router.push('/k/' + k);
  }

  function keBagian(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (keadaan === 'memuat') {
    return (
      <main className="rc-wrap min-h-screen items-center justify-center text-center">
        <p className="rc-sub" role="status">Memuat…</p>
      </main>
    );
  }

  if (konfirmHapus) {
    return (
      <main className="rc-wrap min-h-screen justify-center">
        <h1 className="rc-judul">Hapus semua data?</h1>
        <p className="rc-sub">
          Semua sesi latihan dihapus dan akun Anda dilepas dari data pasien. Tidak bisa dibatalkan.
        </p>
        {pesanHapus && <div role="alert" className="rc-alert">{pesanHapus}</div>}
        <div className="flex gap-3">
          <button onClick={handleHapus} className="rc-btn-bahaya flex-1">Ya, hapus</button>
          <button onClick={() => { setKonfirmHapus(false); setPesanHapus(''); }} className="rc-btn-2 flex-1">
            Batal
          </button>
        </div>
      </main>
    );
  }

  const terikat = keadaan === 'terikat';
  const bisaKeluar = antreanCount === 0;

  const atas: ItemNav[] = terikat
    ? [
        { label: 'Beranda', ikon: <IkonBeranda />, aktif: true, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
        { label: 'Mulai latihan', ikon: <IkonMain />, onClick: mulaiLatihan },
        { label: 'Riwayat', ikon: <IkonRiwayat />, onClick: () => keBagian('riwayat') },
      ]
    : [
        { label: 'Beranda', ikon: <IkonBeranda />, aktif: true, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
        { label: 'Coba tanpa akun', ikon: <IkonAkun />, href: '/tamu' },
      ];

  const bawah: ItemNav[] = [
    { label: 'Keluar', ikon: <IkonKeluar />, onClick: handleKeluar, nonaktif: !bisaKeluar },
    ...(terikat ? [{ label: 'Hapus data saya', ikon: <IkonHapus />, onClick: () => setKonfirmHapus(true), bahaya: true }] : []),
  ];

  const persenMinggu = Math.min(100, Math.round((sesiMingguIni / Math.max(1, sesiPerMinggu)) * 100));

  return (
    <DashboardShell
      judul="Beranda"
      atas={atas}
      bawah={bawah}
      pengguna={{ nama: nama || 'Pasien', peran: 'Pasien' }}
    >
      <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {terikat ? (
            <BannerSambutan
              judul={`${sapaan()}, ${nama || 'Pasien'}`}
              teks={
                sesiMingguIni >= sesiPerMinggu
                  ? 'Target latihan minggu ini sudah tercapai. Lanjutkan kalau badan terasa nyaman.'
                  : `Minggu ini ${sesiMingguIni} dari ${sesiPerMinggu} sesi sudah selesai. Siapkan kursi dan kamera, lalu mulai.`
              }
            >
              <button
                onClick={mulaiLatihan}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 self-start rounded-lg bg-white px-6 text-lg font-semibold text-brand-700 transition-colors hover:bg-brand-50"
              >
                <IkonMain /> Mulai latihan
              </button>
            </BannerSambutan>
          ) : (
            <BannerSambutan
              judul={`${sapaan()}!`}
              teks="Akun Anda belum terhubung ke resep. Minta fisioterapis membuat resep, lalu pindai QR-nya dengan kamera ponsel."
            />
          )}

          {galat && <div role="alert" className="rc-alert">{galat}</div>}
          {antreanCount > 0 && (
            <p className="rc-info" role="status">
              {antreanCount} sesi menunggu dikirim. Tunggu sampai terkirim sebelum keluar, supaya tidak hilang atau terkirim atas nama akun lain.
            </p>
          )}

          {!terikat && (
            <form onSubmit={handleHubungkan} className="rc-card flex flex-col gap-3" noValidate>
              <label htmlFor="kode" className="text-lg font-semibold text-brand-700">
                Atau ketik kode dari fisioterapis
              </label>
              <input
                id="kode"
                value={kode}
                onChange={e => setKode(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={12}
                placeholder="Contoh: 3F9A12CB"
                aria-describedby={galatKode ? 'galat-kode' : undefined}
                className="min-h-[52px] rounded-lg border border-black/30 px-4 text-xl uppercase tracking-widest"
              />
              {galatKode && <p id="galat-kode" role="alert" className="rc-alert">{galatKode}</p>}
              <button type="submit" className="rc-btn">Hubungkan</button>
              <Link href="/tamu" className="rc-tautan self-start">Coba latihan tanpa akun</Link>
            </form>
          )}

          {terikat && resep && (
            <section aria-labelledby="judul-latihan" className="flex flex-col gap-3">
              <h2 id="judul-latihan" className="text-xl font-semibold text-brand-700">Latihan Anda</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {resep.gerakan.map(g => (
                  <li key={g} className="rc-card flex flex-col gap-3 p-3!">
                    <video
                      src={`/video/${g === 'jangkau_samping' ? 'jangkau_samping' : 'jangkau_depan'}.mp4`}
                      autoPlay loop muted playsInline
                      className="aspect-video w-full rounded-lg bg-brand-50 object-cover"
                      style={resep.sisi === 'kiri' ? { transform: 'scaleX(-1)' } : undefined}
                      aria-label={`Contoh gerakan ${NAMA_GERAKAN[g] ?? g}`}
                    />
                    <div className="px-1 pb-1">
                      <p className="text-lg font-semibold">{NAMA_GERAKAN[g] ?? g}</p>
                      <p className="text-base text-muted">
                        {resep.repetisi} repetisi · lengan {resep.sisi}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {terikat && (
            <section id="riwayat" aria-labelledby="judul-riwayat" className="scroll-mt-24">
              <h2 id="judul-riwayat" className="mb-3 text-xl font-semibold text-brand-700">Riwayat sesi</h2>
              {riwayat.length === 0 ? (
                <p className="rc-card text-base text-muted">
                  Belum ada sesi di ponsel ini. Selesaikan satu latihan dan hasilnya akan muncul di sini.
                </p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-base">
                    <thead className="bg-brand-50 text-brand-700">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">Waktu</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Repetisi</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Benar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riwayat.slice(-5).reverse().map(r => (
                        <tr key={r.mulai} className="border-t border-slate-200">
                          <td className="px-4 py-3">{fmtTanggal.format(new Date(r.mulai))}</td>
                          <td className="px-4 py-3 tabular-nums">{r.rep_total}</td>
                          <td className="px-4 py-3 font-semibold tabular-nums">
                            {r.pct_benar === null ? '–' : `${r.pct_benar}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        {terikat && (
          <aside aria-label="Ringkasan minggu ini" className="flex flex-col gap-6">
            <section className="rc-card">
              <h2 className="text-xl font-semibold text-brand-700">Minggu ini</h2>
              <p className="mt-1 text-3xl font-semibold tabular-nums">
                {sesiMingguIni}
                <span className="text-lg font-medium text-muted"> dari {sesiPerMinggu} sesi</span>
              </p>
              <div className="mt-3 h-2.5 rounded-full bg-brand-50" role="img" aria-label={`${persenMinggu} persen dari target sesi mingguan`}>
                <div className="h-2.5 rounded-full bg-brand-600 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${persenMinggu}%` }} />
              </div>

              <ul className="mt-5 grid grid-cols-7 gap-1.5" aria-label="Tujuh hari terakhir">
                {hari7.map((h, i) => (
                  <li
                    key={i}
                    className={`flex flex-col items-center gap-1 rounded-lg py-2 text-base ${
                      h.hariIni ? 'bg-brand-700 text-white' : 'bg-brand-50 text-ink'
                    }`}
                  >
                    <span className="text-[0.72rem] leading-none">{h.label}</span>
                    <span className="font-semibold tabular-nums">{h.tgl}</span>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${h.sesi ? 'bg-brand-600' : 'bg-transparent'}`}
                      role="img"
                      aria-label={h.sesi ? 'Ada sesi' : 'Tidak ada sesi'}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        )}
      </div>
    </DashboardShell>
  );
}
