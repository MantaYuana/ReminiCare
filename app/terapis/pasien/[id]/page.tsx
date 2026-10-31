'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import * as QRCode from 'qrcode';
import {
  supabase,
  cekPeran,
  pesanGalat,
  type Peran,
} from '../../../../lib/supabase';
import Grafik, { type TitikGrafik } from '../../../../components/Grafik';
import FormResep, {
  type SisiTerdampak,
  type JenisGerakan,
  type TingkatToleransi,
  type ModeKoreksiResep,
  type PilihanKalimatCondong,
} from '../../../../components/FormResep';

interface PasienDetail {
  id: string;
  terapis_id: string;
  user_id: string | null;
  nama_panggilan: string;
  sisi_terdampak: SisiTerdampak;
  gerakan: JenisGerakan[];
  repetisi: number;
  sesi_per_minggu: number;
  toleransi_batang: TingkatToleransi;
  toleransi_bahu: TingkatToleransi;
  durasi_persen: number;
  mode_koreksi: ModeKoreksiResep;
  kalimat_condong: PilihanKalimatCondong;
  kode_klaim: string | null;
  kode_kedaluwarsa: string | null;
  persetujuan_versi: string | null;
  persetujuan_waktu: string | null;
  persetujuan_oleh: string | null;
  is_sintetis: boolean;
  dibuat: string;
  [key: string]: unknown;
}

interface PerGerakanDetail {
  rep_total?: number;
  rep_terukur?: number;
  rep_terkompensasi?: number;
  per_penanda?: {
    batang?: number;
    bahu?: number;
  };
  waktu_gerak_median?: number | null;
  v_puncak_median?: number | null;
  n_puncak_median?: number | null;
}

interface BarisSesi {
  id: string;
  mulai: string;
  resep: {
    mode_koreksi?: string;
    [key: string]: unknown;
  } | null;
  rep_total: number;
  rep_terukur: number;
  rep_terkompensasi: number;
  pct_terkompensasi: number | string | null;
  per_gerakan: Record<string, PerGerakanDetail> | null;
  pct_tak_terukur: number | string | null;
  nyeri: number | null;
  is_sintetis: boolean;
}

interface BarisEskalasi {
  id: string;
  pasien_id: string;
  dibuka: string;
  sesi_pemicu: string[];
  median_baseline: number;
  panjang_run: number;
  batas: number;
  ditinjau: string | null;
  ditinjau_oleh: string | null;
  keputusan: string | null;
  catatan: string | null;
}

interface PrioritasDetail {
  sesi_7_hari: number | null;
  sesi_per_minggu: number | null;
}

const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fungsi bantu murni di luar komponen (format tanggal pendek id-ID untuk label sumbu x grafik)
function formatTanggalPendek(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return iso;
  }
}

// Fungsi bantu murni di luar komponen (format tanggal lengkap beserta jam id-ID)
function formatTanggalJam(iso: string): string {
  try {
    const d = new Date(iso);
    const tgl = d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const jam = d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${tgl}, ${jam}`;
  } catch {
    return iso;
  }
}

// Fungsi bantu murni untuk label tampilan gerakan
function labelGerakan(g: string): string {
  if (g === 'jangkau_depan') return 'Jangkau depan';
  if (g === 'jangkau_samping') return 'Jangkau samping';
  return g.replace(/_/g, ' ');
}

// Komponen bantu NFR-6: Lencana nyeri dengan ikon + label teks (tidak hanya warna)
function renderNyeri(nyeri: number | null): React.JSX.Element {
  if (nyeri === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
          <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 005 0"
          />
        </svg>
        <span>Tidak nyeri</span>
      </span>
    );
  }
  if (nyeri === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
          <path strokeLinecap="round" strokeWidth="2" d="M9 10h.01M15 10h.01M9 15h6" />
        </svg>
        <span>Agak nyeri</span>
      </span>
    );
  }
  if (nyeri === 2) {
    return (
      <span className="inline-flex items-center gap-1.5 font-bold text-red-800">
        <svg
          className="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
          <path
            strokeLinecap="round"
            strokeWidth="2"
            d="M9 10h.01M15 10h.01M14.5 15.5a3.5 3.5 0 00-5 0"
          />
        </svg>
        <span>Nyeri</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-500">
      <span>— Belum diisi</span>
    </span>
  );
}

// Komponen bantu NFR-6: Lencana sesi sintetis dengan ikon + label teks
function renderLencanaSintetis(isSintetis: boolean): React.JSX.Element {
  if (!isSintetis) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-300 bg-purple-100 px-3 py-1 font-semibold text-purple-800">
      <svg
        className="h-4 w-4 shrink-0"
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
      <span>Sintetis</span>
    </span>
  );
}

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

  // State data pasien & sesi
  const [sedangMuat, setSedangMuat] = useState(true);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [pasien, setPasien] = useState<PasienDetail | null>(null);
  const [daftarSesi, setDaftarSesi] = useState<BarisSesi[]>([]);
  // Data eskalasi disimpan di state untuk digunakan pada Fase 6 (run chart eskalasi & form tinjau)
  const [daftarEskalasi, setDaftarEskalasi] = useState<BarisEskalasi[]>([]);
  const [prioritas, setPrioritas] = useState<PrioritasDetail | null>(null);
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

  // Pindahkan fokus ke dialog konfirmasi saat muncul (aksesibilitas NFR-6)
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

  // Fungsi muat paralel (Fase 5 PLAN):
  // Muat awal (awal = true) menampilkan layar "Memuat..." penuh.
  // Muat ulang berikutnya (awal = false, misal dari onBerhasil FormResep) senyap dengan state menyegarkan.
  const muat = useCallback(
    async (awal: boolean = false) => {
      if (!id || !REGEX_UUID.test(id)) {
        if (mountedRef.current) {
          setPasien(null);
          setSedangMuat(false);
        }
        return;
      }

      if (awal) {
        setSedangMuat(true);
      } else {
        setMenyegarkan(true);
      }
      setGalat(null);

      try {
        const [resPasien, resSesi, resEskalasi, resPrioritas] =
          await Promise.all([
            supabase.from('pasien').select('*').eq('id', id).maybeSingle(),
            supabase
              .from('sesi')
              .select(
                'id, mulai, resep, rep_total, rep_terukur, rep_terkompensasi, pct_terkompensasi, per_gerakan, pct_tak_terukur, nyeri, is_sintetis'
              )
              .eq('pasien_id', id)
              .order('mulai'),
            supabase
              .from('eskalasi')
              .select('*')
              .eq('pasien_id', id)
              .order('dibuka'),
            supabase
              .from('v_prioritas')
              .select('sesi_7_hari, sesi_per_minggu')
              .eq('pasien_id', id)
              .maybeSingle(),
          ]);

        if (!mountedRef.current) return;

        // Promise.all tidak melempar galat Supabase; periksa .error di setiap hasil
        const errFirst =
          resPasien.error ||
          resSesi.error ||
          resEskalasi.error ||
          resPrioritas.error;

        if (errFirst) {
          console.error('Galat memuat data detail pasien:', errFirst);
          setGalat(pesanGalat(errFirst));
          return;
        }

        if (!resPasien.data) {
          setPasien(null);
          return;
        }

        const dataPasien = resPasien.data as PasienDetail;
        setPasien(dataPasien);
        setDaftarSesi((resSesi.data as BarisSesi[]) || []);
        // Data eskalasi disimpan di state tetapi belum dirender pada Fase 5 (akan dipakai pada Fase 6)
        setDaftarEskalasi((resEskalasi.data as BarisEskalasi[]) || []);
        setPrioritas((resPrioritas.data as PrioritasDetail) || null);

        // Pemuatan QR dari kode_klaim yang masih berlaku HANYA pada muat awal
        if (awal && dataPasien.kode_klaim && dataPasien.kode_kedaluwarsa) {
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
        console.error('Galat saat memuat data:', err);
        setGalat(pesanGalat(err as { message?: string; status?: number }));
      } finally {
        if (mountedRef.current) {
          if (awal) {
            setSedangMuat(false);
          } else {
            setMenyegarkan(false);
          }
        }
      }
    },
    [id]
  );

  // 2. Efek pemanggilan awal muat data
  useEffect(() => {
    if (sedangCekPeran) return;
    muat(true);
  }, [sedangCekPeran, muat]);

  // Handler klik tombol "Buat tautan perangkat"
  function handleKlikBuatTautan() {
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

      // Isolasi try/catch agar tautan tetap aktif bila pembuatan data URL QR gagal
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

  // Tampilan selama guard peran berlangsung
  if (sedangCekPeran) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 bg-slate-50">
        <p className="text-xl font-medium text-slate-700">
          Memeriksa izin akses...
        </p>
      </main>
    );
  }

  // Tampilan selama muat awal penuh
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

  // --- Perhitungan Data Bagian C: Tren % Terkompensasi ---
  // Tampilkan paling banyak 30 sesi terakhir [default spec]
  const sesiTren30 = daftarSesi.slice(-30);
  const titikTren: TitikGrafik[] = sesiTren30.map((s) => {
    const isCelah =
      s.pct_terkompensasi === null ||
      s.pct_terkompensasi === undefined ||
      s.rep_terukur === 0;

    const yVal = isCelah ? null : Number(Number(s.pct_terkompensasi).toFixed(1));

    const mode = s.resep?.mode_koreksi;
    let bentuk: 'bulat' | 'kotak' = 'bulat';
    let huruf: string | undefined = undefined;

    if (mode === 'penuh') {
      bentuk = 'bulat';
      huruf = 'P';
    } else if (mode === 'mati') {
      bentuk = 'kotak';
      huruf = 'M';
    } else if (mode === 'ringkasan') {
      // [default spec] Mode 'ringkasan' dipetakan ke titik bulat + huruf 'R'
      bentuk = 'bulat';
      huruf = 'R';
    } else {
      bentuk = 'bulat';
      huruf = undefined;
    }

    return {
      y: yVal,
      label: formatTanggalPendek(s.mulai),
      bentuk,
      huruf,
    };
  });

  // --- Perhitungan Data Bagian D: Tabel 10 Sesi Terakhir & Kepatuhan ---
  const sesiTerbaru10 = [...daftarSesi].reverse().slice(0, 10);

  // Kepatuhan 7 hari:
  // Bila v_prioritas null, fallback hitung sesi 7 hari dari daftarSesi dan target sesi_per_minggu
  const batas7Hari = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const sesi7HariFallback = daftarSesi.filter(
    (s) => new Date(s.mulai).getTime() > batas7Hari
  ).length;

  // [default spec] Fallback hitung kepatuhan bila v_prioritas bernilai null
  const sesi7Hari = prioritas?.sesi_7_hari ?? sesi7HariFallback;
  const targetPerMinggu =
    prioritas?.sesi_per_minggu ?? pasien.sesi_per_minggu ?? 3;

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
              {menyegarkan && (
                <span className="text-lg font-medium text-slate-500 animate-pulse">
                  (Menyegarkan data...)
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

      {/* 2. PLACEHOLDER FASE 6: Eskalasi terbuka, run chart, tabel eskalasi, tombol Tinjau */}
      {/* Placeholder Fase 6: Eskalasi terbuka (bila ada), run chart, tabel eskalasi, tombol Tinjau */}

      {/* 3. TREN % TERKOMPENSASI PER SESI (SPEC §10.4 butir 3) */}
      <section
        aria-labelledby="judul-tren-kompensasi"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
      >
        <div className="space-y-1">
          <h2
            id="judul-tren-kompensasi"
            className="text-2xl font-bold text-slate-900"
          >
            Tren % Terkompensasi per Sesi
          </h2>
          <p className="text-lg text-slate-600">
            Perkembangan kompensasi postur (maksimal 30 sesi terakhir).
          </p>
        </div>

        {daftarSesi.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-lg font-medium text-slate-700">
            Belum ada sesi latihan
          </div>
        ) : (
          <div className="space-y-4">
            <Grafik
              judul="Tren % Terkompensasi per Sesi"
              titik={titikTren}
              yMin={0}
              yMaks={100}
              satuan="%"
              tinggi={220}
            />
            {/* Legenda teks: informasi tidak boleh hanya lewat warna (NFR-6) */}
            <p className="text-center text-lg font-medium text-slate-700">
              Bulat P = Penuh · Kotak M = Mati · Bulat R = Ringkasan
            </p>
          </div>
        )}
      </section>

      {/* 4. TABEL 10 SESI TERAKHIR + KEPATUHAN (SPEC §10.4 butir 4) */}
      <section
        aria-labelledby="judul-riwayat-sesi"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2
              id="judul-riwayat-sesi"
              className="text-2xl font-bold text-slate-900"
            >
              10 Sesi Terakhir & Kepatuhan
            </h2>
            <p className="text-lg text-slate-600">
              Riwayat sesi terbaru dan tingkat kepatuhan latihan 7 hari terakhir.
            </p>
          </div>
          <div className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-2.5">
            <p className="text-lg font-bold text-sky-950">
              7 hari: {sesi7Hari} dari {targetPerMinggu}
            </p>
          </div>
        </div>

        {daftarSesi.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-lg font-medium text-slate-700">
            Belum ada sesi latihan
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <caption className="sr-only">
                Tabel 10 sesi latihan terakhir beserta kompensasi, mode, nyeri,
                persentase tak terukur, dan lencana data sintetis.
              </caption>
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50 text-lg font-semibold text-slate-800">
                  <th scope="col" className="p-3">
                    Tanggal
                  </th>
                  <th scope="col" className="p-3">
                    % Terkompensasi
                  </th>
                  <th scope="col" className="p-3">
                    Mode
                  </th>
                  <th scope="col" className="p-3">
                    Nyeri
                  </th>
                  <th scope="col" className="p-3">
                    % Tak Terukur
                  </th>
                  <th scope="col" className="p-3">
                    Sintetis
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-lg text-slate-800">
                {sesiTerbaru10.map((s) => {
                  const isNullKompensasi =
                    s.pct_terkompensasi === null ||
                    s.pct_terkompensasi === undefined ||
                    s.rep_terukur === 0;

                  const pctStr = isNullKompensasi
                    ? '—'
                    : `${Number(s.pct_terkompensasi).toFixed(1)}%`;

                  const modeStr =
                    s.resep?.mode_koreksi === 'penuh'
                      ? 'Penuh'
                      : s.resep?.mode_koreksi === 'mati'
                      ? 'Mati'
                      : s.resep?.mode_koreksi === 'ringkasan'
                      ? 'Ringkasan'
                      : '—';

                  const pctTakTerukurStr =
                    s.pct_tak_terukur !== null && s.pct_tak_terukur !== undefined
                      ? `${Number(s.pct_tak_terukur).toFixed(1)}%`
                      : '—';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="p-3 font-medium whitespace-nowrap">
                        {formatTanggalJam(s.mulai)}
                      </td>
                      <td className="p-3 font-semibold">{pctStr}</td>
                      <td className="p-3">{modeStr}</td>
                      <td className="p-3">{renderNyeri(s.nyeri)}</td>
                      <td className="p-3">{pctTakTerukurStr}</td>
                      <td className="p-3">
                        {renderLencanaSintetis(s.is_sintetis)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. METRIK KINEMATIK PER GERAKAN (SPEC §10.4 butir 5) */}
      <section
        aria-labelledby="judul-kinematik"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
      >
        <div className="space-y-1">
          <h2
            id="judul-kinematik"
            className="text-2xl font-bold text-slate-900"
          >
            Metrik Kinematik per Gerakan
          </h2>
          {/* Keterangan tetap sesuai SPEC: "2D, untuk tren pasien ini saja" */}
          <p className="text-lg text-slate-600">
            2D, untuk tren pasien ini saja
          </p>
        </div>

        {daftarSesi.length === 0 ||
        !pasien.gerakan ||
        pasien.gerakan.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-lg font-medium text-slate-700">
            Belum ada data gerak
          </div>
        ) : (
          <div className="space-y-6">
            {pasien.gerakan.map((g) => {
              // Kumpulkan titik grafik median waktu gerak untuk gerakan g (maks 30 sesi terakhir)
              const sesi30 = daftarSesi.slice(-30);
              const titikGerakan: TitikGrafik[] = sesi30.map((s) => {
                const infoGerakan =
                  s.per_gerakan && typeof s.per_gerakan === 'object'
                    ? s.per_gerakan[g]
                    : null;
                const waktu = infoGerakan?.waktu_gerak_median;
                const yVal =
                  waktu !== null &&
                  waktu !== undefined &&
                  !Number.isNaN(Number(waktu))
                    ? Number(Number(waktu).toFixed(2))
                    : null;

                return {
                  y: yVal,
                  label: formatTanggalPendek(s.mulai),
                  bentuk: 'bulat',
                };
              });

              const nilaiValid = titikGerakan
                .filter((pt) => pt.y !== null)
                .map((pt) => pt.y as number);

              // Cari sesi terakhir yang memiliki data untuk gerakan ini
              const sesiTerakhirAdaData = [...daftarSesi]
                .reverse()
                .find((s) => {
                  const pg =
                    s.per_gerakan && typeof s.per_gerakan === 'object'
                      ? s.per_gerakan[g]
                      : null;
                  return pg !== null && pg !== undefined;
                });

              const dataTerakhir = sesiTerakhirAdaData?.per_gerakan?.[g];
              const adaData = nilaiValid.length > 0 || Boolean(dataTerakhir);

              if (!adaData) {
                return (
                  <div
                    key={g}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3"
                  >
                    <h3 className="text-xl font-bold text-slate-800">
                      Gerakan: {labelGerakan(g)}
                    </h3>
                    <p className="text-lg text-slate-600">
                      Belum ada data gerak
                    </p>
                  </div>
                );
              }

              // Batas yMaks = Math.max(4, Math.ceil(nilaiMaks * 1.2)) agar selalu bulat
              const nilaiMaks =
                nilaiValid.length > 0 ? Math.max(...nilaiValid) : 0;
              const yMaks = Math.max(4, Math.ceil(nilaiMaks * 1.2));

              const vPuncakStr =
                dataTerakhir?.v_puncak_median !== null &&
                dataTerakhir?.v_puncak_median !== undefined
                  ? Number(dataTerakhir.v_puncak_median).toFixed(2)
                  : '—';

              const nPuncakStr =
                dataTerakhir?.n_puncak_median !== null &&
                dataTerakhir?.n_puncak_median !== undefined
                  ? dataTerakhir.n_puncak_median
                  : '—';

              const batangN = dataTerakhir?.per_penanda?.batang ?? 0;
              const bahuN = dataTerakhir?.per_penanda?.bahu ?? 0;

              return (
                <div
                  key={g}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4"
                >
                  <h3 className="text-xl font-bold text-slate-800">
                    Gerakan: {labelGerakan(g)}
                  </h3>

                  <Grafik
                    judul={`Tren Waktu Gerak Median: ${labelGerakan(g)}`}
                    titik={titikGerakan}
                    yMin={0}
                    yMaks={yMaks}
                    satuan=" dtk"
                    tinggi={200}
                  />

                  {dataTerakhir && sesiTerakhirAdaData && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                      <h4 className="text-lg font-bold text-slate-900">
                        Metrik Sesi Terakhir ({formatTanggalJam(sesiTerakhirAdaData.mulai)}):
                      </h4>
                      <p className="text-lg text-slate-800">
                        Kecepatan puncak (median):{' '}
                        <span className="font-semibold">{vPuncakStr}</span> —
                        kurang andal
                      </p>
                      <p className="text-lg text-slate-800">
                        Jumlah puncak (median):{' '}
                        <span className="font-semibold">{nPuncakStr}</span> —
                        kurang andal
                      </p>
                      <p className="text-lg text-slate-800">
                        Rincian penanda terkompensasi:{' '}
                        <span className="font-semibold">
                          Batang: {batangN}
                        </span>
                        {' · '}
                        <span className="font-semibold">
                          Bahu: {bahuN} (penanda lemah)
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 6. PLACEHOLDER FASE 7: Kartu Ringkasan AI */}
      {/* Placeholder Fase 7: Kartu Ringkasan AI (Gemini / templat deterministik) */}

      {/* 7. BAGIAN TAUTAN PERANGKAT (Fase 4c / F03) */}
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

      {/* 8. EDIT RESEP (SPEC §10.4 butir 8) */}
      <section
        aria-labelledby="judul-edit-resep"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
      >
        <div className="space-y-1">
          <h2
            id="judul-edit-resep"
            className="text-2xl font-bold text-slate-900"
          >
            Ubah Resep Latihan
          </h2>
          <p className="text-lg text-slate-600">
            Perubahan target latihan, repetisi, dan batas toleransi gerakan pasien.
          </p>
        </div>

        {/* Pemanggilan muat(false) senyap agar FormResep tidak ter-unmount dan pesan sukses tetap tampil */}
        <FormResep
          key={pasien.id}
          pasien={pasien}
          onBerhasil={() => muat(false)}
        />
      </section>

      {/* 9. TOMBOL DEMO (SPEC §10.4 butir 9: hanya bila peranTerapis?.demo) */}
      {/* Rute /pasien/sesi adalah milik Ari; tombol ini disediakan untuk pengujian mode demo */}
      {peranTerapis?.demo && (
        <section
          aria-labelledby="judul-demo"
          className="rounded-xl border border-purple-200 bg-purple-50 p-6 space-y-4"
        >
          <div className="space-y-1">
            <h2 id="judul-demo" className="text-2xl font-bold text-purple-950">
              Uji Coba Latihan Mandiri (Mode Demo)
            </h2>
            <p className="text-lg text-purple-900">
              Sebagai akun fisioterapis demo, Anda dapat menjalankan simulasi latihan dengan resep pasien ini.
            </p>
          </div>
          <div>
            <Link
              href={`/pasien/sesi?pasien=${pasien.id}`}
              className="inline-flex min-h-[64px] items-center justify-center rounded-xl bg-purple-700 px-8 py-4 text-xl font-bold text-white hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500 shadow-sm"
            >
              Latih sebagai pasien ini
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
