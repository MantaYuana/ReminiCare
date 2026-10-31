'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, cekPeran, pesanGalat } from '../../lib/supabase';
import { bacaResep, simpanResep, bacaRiwayat, hapus } from '../../lib/lokal';
import { jumlahSesi } from '../../lib/antrean';
import { normalKode } from '../../lib/arah';
import { suara } from '../../lib/suara';

const KOLOM_RESEP =
  'nama_panggilan, sisi_terdampak, gerakan, repetisi, sesi_per_minggu, toleransi_batang, toleransi_bahu, durasi_persen, mode_koreksi, kalimat_condong';

type Keadaan = 'memuat' | 'terikat' | 'belum_ada_resep';

export default function Page() {
  const router = useRouter();
  const [keadaan, setKeadaan]             = useState<Keadaan>('memuat');
  const [nama, setNama]                   = useState('');
  const [sesiMingguIni, setSesiMingguIni] = useState(0);
  const [sesiPerMinggu, setSesiPerMinggu] = useState(0);
  const [antreanCount, setAntreanCount]   = useState(0);
  const [konfirmHapus, setKonfirmHapus]   = useState(false);
  const [pesanHapus, setPesanHapus]       = useState('');
  const [galat, setGalat]                 = useState('');
  const [kode, setKode]                   = useState('');
  const [galatKode, setGalatKode]         = useState('');

  useEffect(() => {
    function hitungMingguIni(pasienId: string) {
      const tujuhHariLalu = Date.now() - 7 * 24 * 60 * 60 * 1000;
      setSesiMingguIni(bacaRiwayat(pasienId).filter(r => new Date(r.mulai).getTime() > tujuhHariLalu).length);
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
          hitungMingguIni(peran.pasienId);
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
          hitungMingguIni(lokal.pasien_id);
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

  const tombolKeluar = (
    <div className="flex flex-col gap-1">
      <button onClick={handleKeluar} disabled={antreanCount > 0} className="rc-btn-2 self-start">
        Keluar
      </button>
      {antreanCount > 0 && (
        <p className="text-base text-muted" role="status">
          Tunggu {antreanCount} sesi terkirim dulu, supaya tidak hilang atau terkirim atas nama akun lain.
        </p>
      )}
    </div>
  );

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

  if (keadaan === 'belum_ada_resep') {
    return (
      <main className="rc-wrap min-h-screen">
        <div>
          <h1 className="rc-judul">Belum ada resep</h1>
          <p className="rc-sub">
            Minta fisioterapis Anda membuat resep, lalu pindai QR-nya dengan kamera ponsel.
          </p>
        </div>

        {galat && <div role="alert" className="rc-alert">{galat}</div>}

        <form onSubmit={handleHubungkan} className="rc-card flex flex-col gap-3" noValidate>
          <label htmlFor="kode" className="text-base font-semibold">
            Atau ketik kode dari fisioterapis
          </label>
          <input
            id="kode"
            value={kode}
            onChange={e => setKode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            maxLength={12}
            placeholder="Contoh: 3F9A12CB"
            aria-describedby={galatKode ? 'galat-kode' : undefined}
            className="min-h-[56px] rounded-xl border border-slate-300 px-4 text-xl uppercase tracking-widest"
          />
          {galatKode && (
            <p id="galat-kode" role="alert" className="rc-alert">{galatKode}</p>
          )}
          <button type="submit" className="rc-btn">Hubungkan</button>
        </form>

        <Link href="/tamu" className="rc-tautan self-start">Coba latihan tanpa akun</Link>
        {tombolKeluar}
      </main>
    );
  }

  return (
    <main className="rc-wrap min-h-screen">
      <div>
        <p className="rc-chip">Beranda pasien</p>
        <h1 className="rc-judul mt-2">Halo, {nama || 'Pasien'}</h1>
      </div>

      {galat && <div role="alert" className="rc-alert">{galat}</div>}

      <div className="rc-card">
        <p className="text-base text-muted">7 hari terakhir</p>
        <p className="text-5xl font-bold tabular-nums text-brand-700">
          {sesiMingguIni}
          <span className="text-xl font-medium text-muted"> dari {sesiPerMinggu} sesi</span>
        </p>
        <div className="mt-3 h-2.5 rounded-full bg-slate-200" aria-hidden="true">
          <div
            className="h-2.5 rounded-full bg-brand-700"
            style={{ width: `${Math.min(100, Math.round((sesiMingguIni / Math.max(1, sesiPerMinggu)) * 100))}%` }}
          />
        </div>
      </div>

      {antreanCount > 0 && (
        <p className="rc-info" role="status">{antreanCount} sesi menunggu dikirim</p>
      )}

      <button
        onClick={async () => {
          await suara.buka();
          router.push('/pasien/sesi');
        }}
        className="rc-btn"
      >
        Mulai latihan
      </button>

      <div className="flex flex-col gap-4 border-t border-slate-200 pt-5">
        {tombolKeluar}
        <button onClick={() => setKonfirmHapus(true)} className="rc-btn-bahaya self-start">
          Hapus data saya
        </button>
      </div>
    </main>
  );
}
