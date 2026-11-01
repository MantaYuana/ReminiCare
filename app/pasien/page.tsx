'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, cekPeran, pesanGalat } from '../../lib/supabase';
import { bacaResep, simpanResep, bacaRiwayat, hapus, keResepLokal, KOLOM_RESEP } from '../../lib/lokal';
import type { Riwayat, ResepLokal } from '../../lib/lokal';
import { jumlahSesi } from '../../lib/antrean';
import { normalKode } from '../../lib/arah';
import { suara } from '../../lib/suara';
import LayarMuat from '../../components/LayarMuat';
import DashboardShell from '../../components/DashboardShell';
import type { ItemNav } from '../../components/DashboardShell';
import BannerSambutan from '../../components/BannerSambutan';
import PanelFisioterapis from '../../components/PanelFisioterapis';
import PindaiQR from '../../components/PindaiQR';
import DaftarLatihan, { KartuLatihan } from '../../components/DaftarLatihan';
import { IkonBeranda, IkonLatihan, IkonChat, IkonPengaturan, IkonKeluar, IkonHapus } from '../../components/ikon';

type Keadaan = 'memuat' | 'terikat' | 'belum_ada_resep';
type RingkasResep = { gerakan: string[]; repetisi: number; sisi: 'kiri' | 'kanan'; dibuat?: string };

const fmtTanggal = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtLencana = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtHari = new Intl.DateTimeFormat('id-ID', { weekday: 'short' });

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
    function tampilkan(r: ResepLokal, dibuat?: string) {
      setNama(r.nama_panggilan ?? '');
      setSesiPerMinggu(r.sesi_per_minggu ?? 3);
      setResep({ gerakan: r.gerakan, repetisi: r.repetisi, sisi: r.sisi_terdampak, dibuat });
      setRiwayat(bacaRiwayat(r.pasien_id));
      setKeadaan('terikat');
    }

    // Luring, atau query resep gagal: pakai rc_resep (bila pasienId diketahui, harus milik pasien itu)
    function muatLokal(pasienId?: string) {
      const lokal = bacaResep();
      if (lokal && (!pasienId || lokal.pasien_id === pasienId)) { tampilkan(lokal); return; }
      setGalat('Butuh internet sekali untuk memuat resep.');
      setKeadaan('belum_ada_resep');
    }

    async function muat() {
      const peran = await cekPeran();

      if (peran.jenis === 'pasien') {
        const { data, error } = await supabase
          .from('pasien')
          .select(`${KOLOM_RESEP}, dibuat`)
          .eq('id', peran.pasienId)
          .maybeSingle();
        if (data) {
          const lokal = keResepLokal(data);
          simpanResep(lokal);
          tampilkan(lokal, data.dibuat);
        } else if (error) {
          // jaringan putus sesaat: rc_resep jangan dihapus, latihan luring tetap bisa jalan
          muatLokal(peran.pasienId);
        } else {
          // Baris pasien hilang di antara cekPeran dan query ini
          hapus('rc_resep');
          setKeadaan('belum_ada_resep');
        }
      } else if (peran.jenis === 'luring') {
        muatLokal();
      } else if (peran.jenis === 'pasien_baru') {
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

  const handleKodeQR = useCallback((k: string) => router.push('/k/' + k), [router]);

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
    const { error } = await supabase.auth.signOut();
    // Luring: signOut gagal dan sesi tetap tersimpan, jadi rc_resep juga jangan dihapus
    if (error) { setGalat('Butuh internet untuk keluar. Sambungkan ke internet lalu coba lagi.'); return; }
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
    return <LayarMuat />;
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

  const atas: ItemNav[] = [
    { label: 'Beranda', ikon: <IkonBeranda />, aktif: true, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { label: 'Semua Latihan', ikon: <IkonLatihan />, onClick: () => keBagian('latihan'), nonaktif: !terikat },
    { label: 'Chat', ikon: <IkonChat />, nonaktif: true },
  ];

  const bawah: ItemNav[] = [
    { label: 'Settings', ikon: <IkonPengaturan />, nonaktif: true },
    ...(terikat ? [{ label: 'Hapus data saya', ikon: <IkonHapus />, onClick: () => setKonfirmHapus(true), bahaya: true }] : []),
    { label: bisaKeluar ? 'Logout' : `Tunggu ${antreanCount} sesi terkirim dulu`, ikon: <IkonKeluar />, onClick: handleKeluar, nonaktif: !bisaKeluar, bahaya: true },
  ];

  const persenMinggu = Math.min(100, Math.round((sesiMingguIni / Math.max(1, sesiPerMinggu)) * 100));
  const lencana = resep?.dibuat ? fmtLencana.format(new Date(resep.dibuat)) : undefined;

  return (
    <DashboardShell
      judul="Beranda pasien"
      atas={atas}
      bawah={bawah}
      panel={<PanelFisioterapis terhubung={terikat} />}
    >
      <BannerSambutan
        label={terikat && nama ? `Selamat datang ${nama}` : 'Selamat datang'}
        judul="Sudah Siap Untuk Latihan Bersama ReminiCare Hari ini?"
      />

      {galat && <div role="alert" className="rc-alert">{galat}</div>}
      {antreanCount > 0 && (
        <p className="rc-info" role="status">
          {antreanCount} sesi menunggu dikirim. Tunggu sampai terkirim sebelum keluar, supaya tidak hilang atau terkirim atas nama akun lain.
        </p>
      )}

      {!terikat && (
        <section aria-labelledby="judul-hubungkan" className="flex flex-col gap-3">
          <h2 id="judul-hubungkan" className="text-lg font-semibold">Hubungkan Dengan Fisioterapis</h2>
          <form onSubmit={handleHubungkan} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4" noValidate>
            <p className="text-sm">Scan QR</p>
            <PindaiQR onKode={handleKodeQR} />
            <p className="text-center text-sm text-muted">Atau</p>

            <label htmlFor="kode" className="text-sm">Masukkan Kode</label>
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
              className="min-h-[52px] rounded-lg border border-brand-600 px-4 text-xl uppercase tracking-widest"
            />
            {galatKode && <p id="galat-kode" role="alert" className="rc-alert">{galatKode}</p>}
            <button type="submit" className="min-h-[48px] self-start rounded-lg bg-brand-700 px-6 text-base font-semibold text-white transition-colors hover:bg-brand-800">
              Submit
            </button>
            <Link href="/tamu" className="rc-tautan self-start">Coba latihan tanpa akun</Link>
          </form>
        </section>
      )}

      {terikat && resep && (
        <DaftarLatihan id="latihan" judul="Latihan Terbaru Anda">
          {resep.gerakan.map(g => (
            <KartuLatihan key={g} gerakan={g} repetisi={resep.repetisi} sisi={resep.sisi} lencana={lencana} onMulai={mulaiLatihan} />
          ))}
        </DaftarLatihan>
      )}

      {terikat && (
        <section aria-labelledby="judul-minggu" className="flex flex-col gap-3">
          <h2 id="judul-minggu" className="text-lg font-semibold">Minggu ini</h2>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-3xl font-semibold tabular-nums">
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
          </div>
        </section>
      )}

      {terikat && (
        <section id="riwayat" aria-labelledby="judul-riwayat" className="scroll-mt-4">
          <h2 id="judul-riwayat" className="mb-3 text-lg font-semibold">Riwayat sesi</h2>
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
    </DashboardShell>
  );
}
