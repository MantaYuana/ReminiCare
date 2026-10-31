'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as QRCode from 'qrcode';
import { supabase, cekPeran, pesanGalat, type Peran } from '../../../../lib/supabase';

interface PasienDetail {
  id: string;
  terapis_id: string;
  user_id: string | null;
  nama_panggilan: string;
  sisi_terdampak: 'kiri' | 'kanan';
  gerakan: string[];
  repetisi: number;
  sesi_per_minggu: number;
  toleransi_batang: string;
  toleransi_bahu: string;
  durasi_persen: number;
  mode_koreksi: string;
  kalimat_condong: string;
  kode_klaim: string | null;
  kode_kedaluwarsa: string | null;
  persetujuan_versi: string | null;
  persetujuan_waktu: string | null;
  persetujuan_oleh: string | null;
  is_sintetis: boolean;
  dibuat: string;
}

const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function DetailPasienPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();

  // Pastikan ID bertipe string (bukan array atau undefined)
  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : '';

  // State guard peran
  const [sedangCekPeran, setSedangCekPeran] = useState(true);
  const [peranTerapis, setPeranTerapis] = useState<
    Extract<Peran, { jenis: 'terapis' }> | null
  >(null);

  // State data pasien
  const [sedangMuat, setSedangMuat] = useState(true);
  const [pasien, setPasien] = useState<PasienDetail | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  // State bagian tautan perangkat (F03)
  const [sedangBuatKode, setSedangBuatKode] = useState(false);
  const [konfirmasiTampil, setKonfirmasiTampil] = useState(false);
  const [kodeAktif, setKodeAktif] = useState<string | null>(null);
  const [tautanAktif, setTautanAktif] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pesanGagalQr, setPesanGagalQr] = useState<string | null>(null);
  const [tanggalKedaluwarsa, setTanggalKedaluwarsa] = useState<string | null>(
    null
  );
  const [statusSalin, setStatusSalin] = useState<'idle' | 'tersalin' | 'gagal'>(
    'idle'
  );
  const [galatKode, setGalatKode] = useState<string | null>(null);

  // Pencegahan unmount memory leak, race condition, dan klik ganda
  const mountedRef = useRef(true);
  const seqRef = useRef(0);
  const sedangProsesRef = useRef(false);
  const konfirmasiRef = useRef<HTMLDivElement | null>(null);
  const salinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Efek pelacak status mount dan pembersihan timer
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (salinTimeoutRef.current) {
        clearTimeout(salinTimeoutRef.current);
      }
    };
  }, []);

  // Pindahkan fokus ke dialog konfirmasi saat muncul (aksesibilitas)
  useEffect(() => {
    if (konfirmasiTampil) {
      konfirmasiRef.current?.focus();
    }
  }, [konfirmasiTampil]);

  // 1. Guard peran fisioterapis
  useEffect(() => {
    async function validasiPeran() {
      try {
        const peran = await cekPeran();
        if (!mountedRef.current) return;

        if (peran.jenis !== 'terapis') {
          router.replace('/');
          return;
        }

        setPeranTerapis(peran);
        setSedangCekPeran(false);
      } catch (err) {
        if (!mountedRef.current) return;
        console.error('Galat saat cekPeran:', err);
        router.replace('/');
      }
    }

    validasiPeran();
  }, [router]);

  // 2. Muat data pasien
  useEffect(() => {
    if (sedangCekPeran) return;

    // Validasi id dengan regex UUID: bila tidak valid, jangan query dan tampilkan cabang "Pasien tidak ditemukan"
    if (!id || !REGEX_UUID.test(id)) {
      setPasien(null);
      setSedangMuat(false);
      return;
    }

    async function muatPasien() {
      setSedangMuat(true);
      setGalat(null);

      try {
        const { data, error } = await supabase
          .from('pasien')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!mountedRef.current) return;

        if (error) {
          console.error('Galat kueri pasien:', error);
          setGalat(pesanGalat(error));
          setSedangMuat(false);
          return;
        }

        if (!data) {
          setPasien(null);
          setSedangMuat(false);
          return;
        }

        const dataPasien = data as PasienDetail;
        setPasien(dataPasien);

        // Jika pasien sudah memiliki kode klaim aktif, tampilkan tautan dan coba buat QR awal
        if (dataPasien.kode_klaim && dataPasien.kode_kedaluwarsa) {
          const tglExpired = new Date(dataPasien.kode_kedaluwarsa);
          if (tglExpired > new Date()) {
            const origin =
              typeof window !== 'undefined' ? window.location.origin : '';
            const tautan = `${origin}/k/${dataPasien.kode_klaim}`;

            setKodeAktif(dataPasien.kode_klaim);
            setTautanAktif(tautan);
            setTanggalKedaluwarsa(
              tglExpired.toLocaleString('id-ID', {
                dateStyle: 'full',
                timeStyle: 'short',
              })
            );

            try {
              const dataUrl = await QRCode.toDataURL(tautan, {
                margin: 2,
                width: 280,
              });
              if (mountedRef.current) {
                setQrDataUrl(dataUrl);
              }
            } catch (errQr) {
              console.error('Galat pembuatan QR code awal:', errQr);
              if (mountedRef.current) {
                setPesanGagalQr('QR gagal dibuat, gunakan tautan di bawah');
              }
            }
          }
        }
      } catch (err: unknown) {
        if (!mountedRef.current) return;
        console.error('Galat memuat pasien:', err);
        setGalat(pesanGalat(err as { message?: string; status?: number }));
      } finally {
        if (mountedRef.current) {
          setSedangMuat(false);
        }
      }
    }

    muatPasien();
  }, [sedangCekPeran, id]);

  // Handler klik tombol "Buat tautan perangkat"
  function handleKlikBuatTautan() {
    // Jika sudah ada kode aktif, pasien memiliki kode klaim, atau perangkat sudah terikat (user_id), minta konfirmasi
    if (kodeAktif || pasien?.kode_klaim || pasien?.user_id) {
      setKonfirmasiTampil(true);
    } else {
      eksekusiBuatKode();
    }
  }

  // Eksekusi RPC buat_kode
  async function eksekusiBuatKode() {
    if (sedangProsesRef.current || !id) return;
    sedangProsesRef.current = true;
    if (!mountedRef.current) return;
    setSedangBuatKode(true);
    setGalatKode(null);
    setPesanGagalQr(null);
    setKonfirmasiTampil(false);

    const seq = ++seqRef.current;

    try {
      const { data: kode, error: errRpc } = await supabase.rpc('buat_kode', {
        p_pasien_id: id,
      });

      if (errRpc) throw errRpc;
      if (!mountedRef.current || seq !== seqRef.current) return;

      const origin =
        typeof window !== 'undefined' ? window.location.origin : '';
      const tautan = `${origin}/k/${kode}`;

      // Baca ulang kolom kode_kedaluwarsa dari baris pasien
      let tglKedaluwarsaStr = '';
      const { data: dataPasienBaru, error: errBaca } = await supabase
        .from('pasien')
        .select('kode_kedaluwarsa')
        .eq('id', id)
        .maybeSingle();

      if (!errBaca && dataPasienBaru?.kode_kedaluwarsa) {
        tglKedaluwarsaStr = new Date(
          dataPasienBaru.kode_kedaluwarsa
        ).toLocaleString('id-ID', {
          dateStyle: 'full',
          timeStyle: 'short',
        });
      } else {
        // [default spec] Fallback bila pembacaan ulang gagal: now() + 7 hari
        const fallbackDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        tglKedaluwarsaStr = fallbackDate.toLocaleString('id-ID', {
          dateStyle: 'full',
          timeStyle: 'short',
        });
      }

      if (!mountedRef.current || seq !== seqRef.current) return;

      // 1. Set kodeAktif, tautanAktif, tanggalKedaluwarsa, dan pasien LEBIH DULU
      setKodeAktif(kode);
      setTautanAktif(tautan);
      setTanggalKedaluwarsa(tglKedaluwarsaStr);
      setStatusSalin('idle');

      // Perbarui juga data pasien lokal (user_id di-set null karena perangkat lama dilepas oleh buat_kode)
      setPasien((prev) =>
        prev
          ? {
              ...prev,
              user_id: null,
              kode_klaim: kode,
              kode_kedaluwarsa: dataPasienBaru?.kode_kedaluwarsa ?? null,
            }
          : null
      );

      // 2. Bungkus QRCode.toDataURL dalam try/catch tersendiri agar kode tetap aktif bila QR gagal dibuat
      try {
        const dataUrl = await QRCode.toDataURL(tautan, {
          margin: 2,
          width: 280,
        });
        if (mountedRef.current && seq === seqRef.current) {
          setQrDataUrl(dataUrl);
        }
      } catch (errQr) {
        console.error('Galat pembuatan QR code:', errQr);
        if (mountedRef.current && seq === seqRef.current) {
          setQrDataUrl(null);
          setPesanGagalQr('QR gagal dibuat, gunakan tautan di bawah');
        }
      }
    } catch (err: unknown) {
      if (mountedRef.current && seq === seqRef.current) {
        console.error('Galat saat membuat kode:', err);
        setGalatKode(pesanGalat(err as { message?: string; status?: number }));
      }
    } finally {
      if (mountedRef.current && seq === seqRef.current) {
        sedangProsesRef.current = false;
        setSedangBuatKode(false);
      }
    }
  }

  // Handler salin tautan ke clipboard
  async function salinTautan() {
    if (!tautanAktif) return;
    try {
      await navigator.clipboard.writeText(tautanAktif);
      if (!mountedRef.current) return;
      setStatusSalin('tersalin');
      if (salinTimeoutRef.current) clearTimeout(salinTimeoutRef.current);
      salinTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setStatusSalin((s) => (s === 'tersalin' ? 'idle' : s));
        }
      }, 3000);
    } catch {
      if (!mountedRef.current) return;
      setStatusSalin('gagal');
      if (salinTimeoutRef.current) clearTimeout(salinTimeoutRef.current);
      salinTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setStatusSalin((s) => (s === 'gagal' ? 'idle' : s));
        }
      }, 5000);
    }
  }

  // Tampilan selama guard peran berlangsung (tidak menampilkan data sebelum guard selesai)
  if (sedangCekPeran) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 bg-slate-50">
        <p className="text-xl font-medium text-slate-700">
          Memeriksa izin akses...
        </p>
      </main>
    );
  }

  // Tampilan selama memuat data pasien
  if (sedangMuat) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div className="flex items-center gap-3 text-slate-700">
          <svg
            className="h-8 w-8 animate-spin text-sky-700"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <p className="text-xl font-medium">Memuat data pasien...</p>
        </div>
      </main>
    );
  }

  // Galat kueri
  if (galat) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-900"
        >
          <h1 className="text-2xl font-bold">Terjadi Kesalahan</h1>
          <p className="mt-2 text-lg">{galat}</p>
          <div className="mt-6">
            <Link
              href="/terapis"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-sky-700 px-6 py-3 text-lg font-semibold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
            >
              Kembali ke Daftar Pasien
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Pasien tidak ditemukan atau bukan milik terapis ini
  if (!pasien) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-900"
        >
          <h1 className="text-2xl font-bold">Pasien tidak ditemukan</h1>
          <p className="mt-2 text-lg">
            Pasien dengan ID ini tidak ditemukan atau bukan milik akun Anda.
          </p>
          <div className="mt-6">
            <Link
              href="/terapis"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-sky-700 px-6 py-3 text-lg font-semibold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
            >
              Kembali ke Daftar Pasien
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-8">
      {/* 1. KEPALA HALAMAN (Header) */}
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">
                {pasien.nama_panggilan}
              </h1>
              {pasien.is_sintetis && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-300 bg-purple-100 px-3 py-1 text-lg font-semibold text-purple-800">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                    />
                  </svg>
                  Data sintetis
                </span>
              )}
            </div>
            <p className="text-xl text-slate-700">
              Sisi terdampak:{' '}
              <span className="font-semibold capitalize">
                {pasien.sisi_terdampak}
              </span>
            </p>
          </div>

          <Link
            href="/terapis"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-lg font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-400"
          >
            ← Kembali ke Daftar
          </Link>
        </div>
      </header>

      {/* // Fase 6: Eskalasi terbuka (bila ada), run chart, tabel eskalasi, tombol Tinjau */}

      {/* // Fase 5: Tren % terkompensasi per sesi (bulat P / kotak M) */}

      {/* // Fase 5: Tabel 10 sesi terakhir (kepatuhan, nyeri, tak terukur) */}

      {/* // Fase 5: Metrik kinematik per gerakan */}

      {/* // Fase 7: Kartu Ringkasan AI */}

      {/* 2. BAGIAN TAUTAN PERANGKAT (Fase 4c / F03) */}
      <section
        aria-labelledby="judul-tautan-perangkat"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
      >
        <div className="space-y-1">
          <h2
            id="judul-tautan-perangkat"
            className="text-2xl font-bold text-slate-900"
          >
            Tautan Perangkat Pasien
          </h2>
          <p className="text-lg text-slate-600">
            Klaim perangkat latihan di rumah melalui pemindaian kode QR atau
            tautan langsung.
          </p>
        </div>

        {galatKode && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 p-4 text-lg font-medium text-red-900"
          >
            {galatKode}
          </div>
        )}

        {/* Dialog Konfirmasi In-Page saat akan membuat tautan baru */}
        {konfirmasiTampil && (
          <div
            ref={konfirmasiRef}
            tabIndex={-1}
            role="region"
            aria-label="Konfirmasi buat tautan baru"
            className="rounded-xl border-2 border-amber-400 bg-amber-50 p-6 space-y-4 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500"
          >
            <div className="flex items-start gap-3">
              <svg
                className="h-7 w-7 text-amber-700 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-amber-950">
                  Konfirmasi Penggantian Tautan
                </h3>
                <p className="text-lg text-amber-900">
                  Membuat tautan baru membatalkan tautan lama dan melepas
                  perangkat lama. Lanjutkan?
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <button
                type="button"
                onClick={eksekusiBuatKode}
                disabled={sedangBuatKode}
                className="inline-flex min-h-[64px] items-center justify-center rounded-xl bg-amber-600 px-6 py-4 text-xl font-bold text-white hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500 disabled:opacity-50"
              >
                {sedangBuatKode ? 'Memproses...' : 'Ya, buat baru'}
              </button>
              <button
                type="button"
                onClick={() => setKonfirmasiTampil(false)}
                disabled={sedangBuatKode}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-lg font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-400"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {/* Tombol Utama Buat Tautan Perangkat */}
        {!konfirmasiTampil && (
          <div>
            <button
              type="button"
              onClick={handleKlikBuatTautan}
              disabled={sedangBuatKode}
              className="inline-flex min-h-[64px] items-center justify-center rounded-xl bg-sky-700 px-8 py-4 text-xl font-bold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 disabled:opacity-50 shadow-sm"
            >
              {sedangBuatKode ? (
                <span className="flex items-center gap-3">
                  <svg
                    className="h-6 w-6 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Menghasilkan Tautan...
                </span>
              ) : (
                'Buat tautan perangkat'
              )}
            </button>
          </div>
        )}

        {/* Tampilan QR Code dan Tautan jika kode aktif tersedia */}
        {tautanAktif && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Gambar QR Code atau Pesan Fallback bila QR Gagal Dibuat */}
              <div className="shrink-0 text-center space-y-2">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Kode QR untuk tautan pendaftaran perangkat pasien ${pasien.nama_panggilan}`}
                    width={280}
                    height={280}
                    className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm mx-auto"
                  />
                ) : pesanGagalQr ? (
                  <div className="flex h-[280px] w-[280px] items-center justify-center rounded-xl border border-amber-300 bg-amber-50 p-4 text-center text-lg font-medium text-amber-900 mx-auto">
                    {pesanGagalQr}
                  </div>
                ) : null}
                <p className="text-lg font-mono font-bold tracking-wider text-slate-800">
                  Kode: {kodeAktif}
                </p>
              </div>

              {/* Detail Tautan, Salin, & Kedaluwarsa */}
              <div className="flex-1 space-y-4 w-full">
                <div className="space-y-1">
                  <label
                    htmlFor="kolom-tautan-perangkat"
                    className="block text-lg font-semibold text-slate-800"
                  >
                    Alamat Tautan Pasien
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      id="kolom-tautan-perangkat"
                      type="text"
                      readOnly
                      value={tautanAktif}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-lg font-mono text-slate-800 select-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={salinTautan}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-sky-700 px-6 py-3 text-lg font-semibold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 shrink-0"
                    >
                      Salin tautan
                    </button>
                  </div>
                  {statusSalin === 'tersalin' && (
                    <p
                      role="status"
                      className="text-lg font-medium text-emerald-700"
                    >
                      ✓ Tersalin
                    </p>
                  )}
                  {statusSalin === 'gagal' && (
                    <p
                      role="status"
                      className="text-lg font-medium text-red-600"
                    >
                      Gagal menyalin, salin manual
                    </p>
                  )}
                </div>

                {tanggalKedaluwarsa && (
                  <p className="text-lg text-slate-700">
                    Kedaluwarsa:{' '}
                    <span className="font-semibold text-slate-900">
                      {tanggalKedaluwarsa}
                    </span>
                  </p>
                )}

                {/* Peringatan Persis sesuai Spec */}
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                  <p className="text-lg font-medium text-amber-950">
                    Kode lama dibatalkan dan perangkat lama dilepas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* // Fase 5: Edit resep (FormResep) */}

      {/* // Fase 5+: Tombol "Latih sebagai pasien ini" (bila peranTerapis?.demo) */}
    </main>
  );
}
