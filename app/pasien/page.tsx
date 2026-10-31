'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, cekPeran, pesanGalat } from '../../lib/supabase';
import { bacaResep, simpanResep, bacaRiwayat, hapus } from '../../lib/lokal';
import { kirim, jumlahSesi } from '../../lib/antrean';
import { suara } from '../../lib/suara';

export default function Page() {
  const router = useRouter();
  const [nama, setNama]               = useState('');
  const [sesiMingguIni, setSesiMingguIni] = useState(0);
  const [sesiPerMinggu, setSesiPerMinggu] = useState(0);
  const [antreanCount, setAntreanCount]   = useState(0);
  const [loading, setLoading]         = useState(true);
  const [konfirmHapus, setKonfirmHapus]   = useState(false);
  const [pesanHapus, setPesanHapus]   = useState('');
  const [galat, setGalat]             = useState('');

  useEffect(() => {
    async function muat() {
      const peran = await cekPeran();

      if (peran.jenis === 'pasien') {
        const { data } = await supabase
          .from('pasien')
          .select('nama_panggilan, sisi_terdampak, gerakan, repetisi, sesi_per_minggu, toleransi_batang, toleransi_bahu, durasi_persen, mode_koreksi, kalimat_condong')
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
          // Hitung sesi 7 hari dari riwayat lokal
          const tujuhHariLalu = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const riwayat = bacaRiwayat(peran.pasienId);
          setSesiMingguIni(riwayat.filter(r => new Date(r.mulai).getTime() > tujuhHariLalu).length);
        }
      } else if (peran.jenis === 'luring') {
        const lokal = bacaResep();
        if (lokal) {
          setNama(lokal.nama_panggilan ?? '');
          setSesiPerMinggu(lokal.sesi_per_minggu ?? 3);
          const tujuhHariLalu = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const riwayat = bacaRiwayat(lokal.pasien_id);
          setSesiMingguIni(riwayat.filter(r => new Date(r.mulai).getTime() > tujuhHariLalu).length);
        }
      } else {
        router.replace('/');
        return;
      }

      setAntreanCount(jumlahSesi());
      setLoading(false);
    }
    muat();
  }, [router]);

  async function handleHapus() {
    if (!navigator.onLine) {
      setPesanHapus('Butuh internet untuk menghapus. Sambungkan ke internet lalu coba lagi.');
      return;
    }
    const { error } = await supabase.rpc('cabut_persetujuan');
    if (error) { setGalat(pesanGalat(error)); setKonfirmHapus(false); return; }

    // Hapus semua data lokal
    hapus('rc_antrean');
    hapus('rc_gagal');
    hapus('rc_resep');
    // Hapus semua kunci riwayat (iterasi localStorage)
    try {
      const kunci = Object.keys(globalThis.localStorage ?? {}).filter(k => k.startsWith('rc_riwayat:'));
      kunci.forEach(k => hapus(k));
    } catch { /* abaikan */ }

    await supabase.auth.signOut();
    router.replace('/?pesan=hapus');
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-base text-gray-500">Memuat…</p>
      </main>
    );
  }

  if (konfirmHapus) {
    return (
      <main className="flex flex-col items-center justify-center gap-6 min-h-screen p-6 max-w-sm mx-auto">
        <h1 className="text-xl font-bold text-center">Hapus semua data?</h1>
        <p className="text-base text-gray-600 text-center">
          Semua sesi latihan dihapus dan perangkat dilepas. Tidak bisa dibatalkan.
        </p>
        {pesanHapus && (
          <div role="alert" className="w-full bg-red-50 border border-red-300 rounded-xl p-3 text-base">
            {pesanHapus}
          </div>
        )}
        <div className="flex gap-3 w-full">
          <button
            onClick={handleHapus}
            className="btn-sekunder flex-1 bg-red-600 text-white rounded-xl hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Ya, hapus
          </button>
          <button
            onClick={() => { setKonfirmHapus(false); setPesanHapus(''); }}
            className="btn-sekunder flex-1 bg-gray-100 rounded-xl hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            Batal
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6 p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Halo, {nama || 'Pasien'}</h1>

      {galat && (
        <div role="alert" className="bg-red-50 border border-red-300 rounded-xl p-3 text-base">
          {galat}
        </div>
      )}

      {/* Kartu kepatuhan */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-base text-gray-600">7 hari terakhir</p>
        <p className="text-3xl font-bold text-blue-700">
          {sesiMingguIni} <span className="text-lg font-normal text-gray-500">dari {sesiPerMinggu} sesi</span>
        </p>
      </div>

      {antreanCount > 0 && (
        <p className="text-base text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
          {antreanCount} sesi menunggu dikirim
        </p>
      )}

      {/* Tombol utama ≥ 64px */}
      <button
        onClick={async () => {
          await suara.buka();
          router.push('/pasien/sesi');
        }}
        className="btn-utama bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Mulai latihan
      </button>

      {/* Tombol sekunder ≥ 44px */}
      <button
        onClick={() => setKonfirmHapus(true)}
        className="btn-sekunder text-red-600 border border-red-200 rounded-xl hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-400 self-start"
      >
        Hapus data saya
      </button>
    </main>
  );
}
