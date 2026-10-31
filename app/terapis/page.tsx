'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, cekPeran, pesanGalat, type Peran } from '../../lib/supabase';

export type BarisPrioritas = {
  pasien_id: string;
  nama_panggilan: string;
  is_sintetis: boolean;
  sesi_per_minggu: number;
  eskalasi_terbuka: boolean;
  nyeri_terakhir: number | null;
  lencana_nyeri: boolean;
  sesi_7_hari: number;
  kepatuhan_7h: number | null;
  jarang: boolean;
  pct_terakhir: number | null;
  sesi_terakhir: string | null;
};

export default function DasborTerapisPage() {
  const router = useRouter();

  const [peranTerapis, setPeranTerapis] = useState<Extract<Peran, { jenis: 'terapis' }> | null>(null);
  const [sedangMemeriksa, setSedangMemeriksa] = useState<boolean>(true);
  const [daftarPasien, setDaftarPasien] = useState<BarisPrioritas[]>([]);
  const [sedangMemuat, setSedangMemuat] = useState<boolean>(false);
  const [sudahMuat, setSudahMuat] = useState<boolean>(false);
  const [galat, setGalat] = useState<string | null>(null);

  // Pengaman urutan permintaan dan status unmount
  const seqRef = useRef<number>(0);
  const aktifRef = useRef<boolean>(true);

  useEffect(() => {
    aktifRef.current = true;
    return () => {
      aktifRef.current = false;
    };
  }, []);

  const muatData = useCallback(async () => {
    const seq = ++seqRef.current;
    setSedangMemuat(true);
    setGalat(null);

    try {
      const { data, error } = await supabase
        .from('v_prioritas')
        .select('*')
        .order('eskalasi_terbuka', { ascending: false })
        .order('lencana_nyeri', { ascending: false })
        .order('jarang', { ascending: false })
        .order('pct_terakhir', { ascending: false, nullsFirst: false });

      if (!aktifRef.current || seqRef.current !== seq) {
        return;
      }

      if (error) {
        setGalat(pesanGalat(error));
        setSedangMemuat(false);
        setSudahMuat(true);
        return;
      }

      setDaftarPasien((data as BarisPrioritas[]) || []);
      setSudahMuat(true);
    } catch (err: unknown) {
      if (!aktifRef.current || seqRef.current !== seq) {
        return;
      }
      setGalat(pesanGalat(err as { message?: string }));
    } finally {
      if (aktifRef.current && seqRef.current === seq) {
        setSedangMemuat(false);
        setSudahMuat(true);
      }
    }
  }, []);

  // Guard halaman: cekPeran() harus 'terapis'; selain itu router.replace('/')
  useEffect(() => {
    let aktif = true;

    async function verifikasiAkses() {
      const peran = await cekPeran();
      if (!aktif) return;

      if (peran.jenis !== 'terapis') {
        router.replace('/');
        return;
      }

      setPeranTerapis(peran);
      setSedangMemeriksa(false);
    }

    verifikasiAkses();

    return () => {
      aktif = false;
    };
  }, [router]);

  // Muat data awal setelah peran terverifikasi
  useEffect(() => {
    if (!sedangMemeriksa && peranTerapis) {
      muatData();
    }
  }, [sedangMemeriksa, peranTerapis, muatData]);

  // Muat ulang saat window focus dan document visibilitychange (visible)
  useEffect(() => {
    if (sedangMemeriksa || !peranTerapis) return;

    const handleFocus = () => {
      muatData();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        muatData();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sedangMemeriksa, peranTerapis, muatData]);

  const handleKeluar = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  if (sedangMemeriksa) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-lg">
        <div className="p-8 bg-white border border-gray-200 rounded-2xl shadow-sm text-center max-w-md w-full">
          <p className="font-semibold text-gray-800 text-lg">Memeriksa izin akses fisioterapis...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 text-lg">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Spanduk Sandbox Juri */}
        {peranTerapis?.demo && (
          <aside
            role="region"
            aria-label="Informasi Sandbox Juri"
            className="p-4 bg-purple-50 border-2 border-purple-400 text-purple-950 rounded-2xl flex items-center gap-3 shadow-sm"
          >
            <span aria-hidden="true" className="text-2xl font-bold">🧪</span>
            <div>
              <p className="font-bold text-xl">Sandbox Juri</p>
              <p className="text-lg text-purple-900">
                Anda masuk sebagai Terapis Demo dengan data 5 pasien sintetis (Pak Wayan, Bu Made, Pak Nyoman, Bu Ketut, Pak Komang). Data ini aman diuji dan tidak memengaruhi pasien klinis nyata.
              </p>
            </div>
          </aside>
        )}

        {/* Baris Identitas & Navigasi Atas */}
        <header className="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Dasbor Fisioterapis
            </h1>
            <p className="text-gray-600 mt-1 text-lg">
              Selamat datang, <span className="font-semibold text-gray-800">{peranTerapis?.nama || 'Fisioterapis'}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={muatData}
              disabled={sedangMemuat}
              aria-label="Muat ulang daftar pasien"
              className="min-h-[44px] min-w-[44px] px-4 py-2 border-2 border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-2 text-lg"
            >
              <span aria-hidden="true">{sedangMemuat ? '⏳' : '🔄'}</span>
              <span>{sedangMemuat ? 'Memuat...' : 'Muat Ulang'}</span>
            </button>

            <button
              type="button"
              onClick={handleKeluar}
              aria-label="Keluar dari akun fisioterapis"
              className="min-h-[44px] min-w-[44px] px-4 py-2 border-2 border-red-300 text-red-700 hover:bg-red-50 font-semibold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-2 text-lg"
            >
              <span aria-hidden="true">🚪</span>
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* Tombol Utama: Pasien Baru (NFR-6: Tombol utama ≥ 64px) */}
        <section>
          <Link
            href="/terapis/pasien/baru"
            className="w-full min-h-[64px] px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl rounded-2xl shadow-md transition-colors flex items-center justify-center gap-3 cursor-pointer focus-visible:outline-3 focus-visible:outline-blue-600"
          >
            <span aria-hidden="true" className="text-2xl font-bold">➕</span>
            <span>Tambah Pasien Baru</span>
          </Link>
        </section>

        {/* Galat jika gagal kueri */}
        {galat && (
          <div role="alert" className="p-4 bg-red-50 border-2 border-red-500 text-red-900 rounded-xl flex items-start gap-3 text-lg">
            <span aria-hidden="true" className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold text-lg">Gagal Memuat Data Pasien</p>
              <p className="text-lg">{galat}</p>
            </div>
          </div>
        )}

        {/* Daftar Prioritas Pasien */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              Daftar Pasien Terurut Prioritas Tindakan
            </h2>
            <span className="text-lg text-gray-500">
              {daftarPasien.length} Pasien Terdaftar
            </span>
          </div>

          {/* Keadaan kosong: hanya tampil bila sudahMuat && !galat && daftarPasien.length === 0 */}
          {sudahMuat && !galat && !sedangMemuat && daftarPasien.length === 0 && (
            <div className="p-8 bg-white border border-gray-200 rounded-2xl shadow-sm text-center space-y-3">
              <p className="text-xl font-semibold text-gray-700">Belum ada pasien terdaftar</p>
              <p className="text-gray-600 max-w-lg mx-auto text-lg">
                Tambahkan pasien baru untuk mengatur resep latihan dan membuat kode klaim perangkat.
              </p>
              <Link
                href="/terapis/pasien/baru"
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-lg"
              >
                <span>➕ Daftarkan Pasien Pertama</span>
              </Link>
            </div>
          )}

          <div className="space-y-3">
            {daftarPasien.map((p) => {
              const adaLencana = p.eskalasi_terbuka || p.lencana_nyeri || p.jarang || p.is_sintetis;

              // Bila pct_terakhir null dan sesi_terakhir tidak null -> "Tidak ada repetisi terukur"
              const teksKompensasi = p.pct_terakhir !== null
                ? `${Math.round(p.pct_terakhir)}%`
                : p.sesi_terakhir !== null
                  ? 'Tidak ada repetisi terukur'
                  : 'Belum ada sesi';

              return (
                <article
                  key={p.pasien_id}
                  className="bg-white border-2 border-gray-200 hover:border-blue-400 p-5 rounded-2xl shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    {/* Baris Nama & Lencana */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-2xl font-bold text-gray-900">
                        {p.nama_panggilan}
                      </h3>

                      {/* Lencana Selalu Ikon + Teks (Aksesibilitas NFR-6: Tidak dibedakan warna saja) */}
                      {adaLencana && (
                        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Status dan Peringatan Pasien">
                          {p.eskalasi_terbuka && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-lg font-bold bg-red-100 text-red-900 border border-red-300">
                              <span aria-hidden="true">⚠️</span>
                              <span>Eskalasi</span>
                            </span>
                          )}

                          {p.lencana_nyeri && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-lg font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <span aria-hidden="true">⚡</span>
                              <span>Nyeri</span>
                            </span>
                          )}

                          {p.jarang && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-lg font-bold bg-orange-100 text-orange-900 border border-orange-300">
                              <span aria-hidden="true">⏰</span>
                              <span>Jarang latihan</span>
                            </span>
                          )}

                          {p.is_sintetis && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-lg font-medium bg-gray-100 text-gray-800 border border-gray-300">
                              <span aria-hidden="true">🧪</span>
                              <span>Data sintetis</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Ringkasan Angka Sesi */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-lg text-gray-700 pt-1">
                      <div>
                        <span className="text-gray-500">Kompensasi Sesi Terakhir: </span>
                        <span className="font-bold text-gray-900">
                          {teksKompensasi}
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-500">Kepatuhan 7 Hari: </span>
                        <span className="font-bold text-gray-900">
                          {p.sesi_7_hari} dari {p.sesi_per_minggu} sesi
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tombol Menuju Detail Pasien */}
                  <div className="md:self-center">
                    <Link
                      href={`/terapis/pasien/${p.pasien_id}`}
                      className="min-h-[44px] min-w-[44px] px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl border border-blue-200 transition-colors inline-flex items-center justify-center gap-2 focus-visible:outline-3 focus-visible:outline-blue-600 text-lg"
                    >
                      <span>Lihat Detail</span>
                      <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
