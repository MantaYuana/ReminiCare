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
import type {
  SisiTerdampak,
  JenisGerakan,
  TingkatToleransi,
  ModeKoreksiResep,
  PilihanKalimatCondong,
} from '../../../../components/FormResep';
import { useTerapis } from '../../../../components/terapis/useTerapis';
import KerangkaTerapis from '../../../../components/terapis/KerangkaTerapis';
import LayarMuat from '../../../../components/LayarMuat';
import SkeletonDetail from '../../../../components/terapis/SkeletonDetail';
import { IkonBintang, IkonPanahBawah, IkonPanahKiri, IkonPeringatan } from '../../../../components/ikon';
import type { MasukanRingkasan } from '../../../../lib/ringkasan';

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

/**
 * Fungsi-fungsi murni turunan data eskalasi (Fase 6 SPEC §10.4 & §8.6)
 */

// 1. tinjauTerakhir: nilai maksimum kolom `ditinjau` dari daftarEskalasi (null bila belum pernah ditinjau).
function hitungTinjauTerakhir(daftar: BarisEskalasi[]): string | null {
  const ditinjauList = daftar
    .map((e) => e.ditinjau)
    .filter((d): d is string => d !== null && d !== undefined);
  if (ditinjauList.length === 0) return null;
  // Urutkan menurun berdasarkan Date.parse untuk memperoleh tanggal peninjauan termutakhir
  ditinjauList.sort((a, b) => Date.parse(b) - Date.parse(a));
  return ditinjauList[0];
}

// 2. terbuka: elemen daftarEskalasi dengan ditinjau === null (paling banyak satu, dijaga unik oleh DB).
function cariEskalasiTerbuka(daftar: BarisEskalasi[]): BarisEskalasi | null {
  return daftar.find((e) => e.ditinjau === null) ?? null;
}

// 3. sesiSejakTinjau: sesi dari daftarSesi dengan mulai > tinjauTerakhir (semua sesi bila belum pernah ditinjau).
// Perbandingan wajib menggunakan Date.parse, bukan perbandingan leksikografis string.
function filterSesiSejakTinjau(
  daftar: BarisSesi[],
  tinjauTerakhir: string | null
): BarisSesi[] {
  if (!tinjauTerakhir) return daftar;
  const tTinjau = Date.parse(tinjauTerakhir);
  return daftar.filter((s) => Date.parse(s.mulai) > tTinjau);
}

// 4. titikData: sesiSejakTinjau dengan rep_terukur >= 5, urut mulai naik.
// Definisinya HARUS sama persis dengan trigger cek_eskalasi (SPEC §8.6: sesi rep_terukur >= 5 dan mulai > v_tinjau order by mulai, id).
function hitungTitikDataEskalasi(sesiSejak: BarisSesi[]): BarisSesi[] {
  return sesiSejak
    .filter((s) => s.rep_terukur >= 5)
    .sort((a, b) => Date.parse(a.mulai) - Date.parse(b.mulai));
}

// 5. formatLabelKeputusan: pemetaan keputusan eskalasi ke label teks deskriptif Bahasa Indonesia
function formatLabelKeputusan(k: string | null): string {
  if (k === 'lanjutkan') return 'Lanjutkan';
  if (k === 'ubah_resep') return 'Ubah resep';
  if (k === 'tatap_muka') return 'Jadwalkan tatap muka';
  return k ?? '—';
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

const KELAS_KEPALA_KARTU =
  'flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-[#4aa9ab] to-[#0b7f87] px-5 py-3 text-white';

/** Kartu bagian: kepala gradien teal berisi judul (dan aksi), badan putih. */
function KartuBagian({
  id,
  judul,
  ket,
  aksi,
  children,
}: {
  id: string;
  judul: string;
  ket?: string;
  aksi?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={KELAS_KEPALA_KARTU}>
        <div>
          <h2 id={id} className="text-base font-semibold">{judul}</h2>
          {ket && <p className="text-sm text-white/90">{ket}</p>}
        </div>
        {aksi}
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

export default function DetailPasienPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const t = useTerapis();

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
  // Data eskalasi disimpan di state untuk Fase 6 (run chart eskalasi & form tinjau)
  const [daftarEskalasi, setDaftarEskalasi] = useState<BarisEskalasi[]>([]);
  const [prioritas, setPrioritas] = useState<PrioritasDetail | null>(null);
  // B2: Galat dipisah antara muat awal (layar penuh) dan muat ulang senyap (banner alert tanpa me-unmount FormResep)
  const [galatAwal, setGalatAwal] = useState<string | null>(null);
  const [galatMuatUlang, setGalatMuatUlang] = useState<string | null>(null);

  // State Fase 6: Form Tinjau & Status Tindakan
  const [formTinjauTerbuka, setFormTinjauTerbuka] = useState(false);
  const [keputusan, setKeputusan] = useState<
    'lanjutkan' | 'ubah_resep' | 'tatap_muka' | ''
  >('');
  const [catatanTinjau, setCatatanTinjau] = useState('');
  const [sedangTinjau, setSedangTinjau] = useState(false);
  const [galatTinjau, setGalatTinjau] = useState<string | null>(null);
  const [statusTinjauan, setStatusTinjauan] = useState<string | null>(null);

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

  // State Fase 7: Ringkasan AI (F20)
  const [sedangRingkas, setSedangRingkas] = useState(false);
  const [hasilRingkasan, setHasilRingkasan] = useState<{
    sumber: 'ai' | 'templat';
    teks: string;
    alasan?: 'tanpa_kunci' | 'api_gagal' | 'kalimat' | 'angka_tidak_cocok';
    masukan: MasukanRingkasan;
  } | null>(null);
  const [galatRingkasan, setGalatRingkasan] = useState<string | null>(null);
  // Kotak hasil tersembunyi sampai tombol ditekan; ditutup lewat panah di tengah bawah
  const [ringkasanTerbuka, setRingkasanTerbuka] = useState(false);

  // Pencegahan unmount memory leak, race condition, dan klik ganda
  const mountedRef = useRef(true);
  const seqRef = useRef(0);
  const sedangProsesRef = useRef(false);
  const konfirmasiRef = useRef<HTMLDivElement | null>(null);
  const salinTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sedangTinjauRef = useRef(false);
  const judulFormTinjauRef = useRef<HTMLHeadingElement | null>(null);
  const statusTinjauanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sedangRingkasRef = useRef(false);
  const ringkasanSeqRef = useRef(0);
  const ringkasanAbortRef = useRef<AbortController | null>(null);

  // Efek pelacak status mount dan pembersihan timer
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (salinTimeoutRef.current) {
        clearTimeout(salinTimeoutRef.current);
      }
      if (statusTinjauanTimeoutRef.current) {
        clearTimeout(statusTinjauanTimeoutRef.current);
      }
      if (ringkasanAbortRef.current) {
        ringkasanAbortRef.current.abort();
      }
    };
  }, []);

  // Pindahkan fokus ke dialog konfirmasi saat muncul (aksesibilitas NFR-6)
  useEffect(() => {
    if (konfirmasiTampil) {
      konfirmasiRef.current?.focus();
    }
  }, [konfirmasiTampil]);

  // Pindahkan fokus ke judul form tinjauan saat muncul (aksesibilitas NFR-6 / SPEC §10.4)
  useEffect(() => {
    if (formTinjauTerbuka) {
      judulFormTinjauRef.current?.focus();
    }
  }, [formTinjauTerbuka]);

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

  // Fungsi muat paralel (Fase 5 PLAN & Fase 6):
  // Muat awal (awal = true) menampilkan layar "Memuat..." penuh.
  // Muat ulang berikutnya (awal = false, misal dari onBerhasil FormResep atau Tinjau) senyap dengan state menyegarkan.
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
        setGalatAwal(null);
      } else {
        setMenyegarkan(true);
        setGalatMuatUlang(null);
      }

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

        // B3: Galat dari v_prioritas jangan menggagalkan halaman (sudah ada fallback). Hanya console.error.
        if (resPrioritas.error) {
          console.error(
            'Galat membaca v_prioritas (menggunakan fallback):',
            resPrioritas.error
          );
        }

        // B2: Periksa galat pada entitas utama (pasien, sesi, eskalasi)
        const errUtama =
          resPasien.error || resSesi.error || resEskalasi.error;

        if (errUtama) {
          console.error('Galat memuat data detail pasien:', errUtama);
          const pesan = pesanGalat(errUtama);
          if (awal) {
            setGalatAwal(pesan);
          } else {
            setGalatMuatUlang(pesan);
          }
          return;
        }

        if (!resPasien.data) {
          setPasien(null);
          return;
        }

        const dataPasien = resPasien.data as PasienDetail;
        setPasien(dataPasien);
        setDaftarSesi((resSesi.data as BarisSesi[]) || []);
        // Data eskalasi disimpan di state untuk run chart eskalasi & form tinjau Fase 6
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
        const pesan = pesanGalat(err as { message?: string; status?: number });
        if (awal) {
          setGalatAwal(pesan);
        } else {
          setGalatMuatUlang(pesan);
        }
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

      // Perbarui juga data pasien lokal (user_id di-set null karena akun lama dilepas oleh buat_kode)
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

  // Handler simpan tinjauan eskalasi (Fase 6 SPEC §10.4 butir 2, PLAN §3 Fase 6)
  async function handleSimpanTinjauan(e: React.FormEvent) {
    e.preventDefault();
    if (sedangTinjauRef.current || !terbuka || !peranTerapis || !keputusan)
      return;
    sedangTinjauRef.current = true;
    if (!mountedRef.current) return;
    setSedangTinjau(true);
    setGalatTinjau(null);

    try {
      // [default spec] ditinjau memakai jam klien (new Date().toISOString()) sesuai PLAN §1.2 butir 4
      const waktuSekarang = new Date().toISOString();
      const catatanTrim = catatanTinjau.trim() || null;
      const keputusanDipilih = keputusan;

      const { data, error } = await supabase
        .from('eskalasi')
        .update({
          ditinjau: waktuSekarang,
          ditinjau_oleh: peranTerapis.uid,
          keputusan: keputusanDipilih,
          catatan: catatanTrim,
        })
        .eq('id', terbuka.id)
        .is('ditinjau', null) // jangan menimpa tinjauan yang sudah terjadi di tab lain
        .select('id');

      if (!mountedRef.current) return;

      if (error) {
        setGalatTinjau(pesanGalat(error));
        return;
      }

      if (!data || data.length === 0) {
        setGalatTinjau(
          'Eskalasi sudah ditinjau atau Anda tidak berhak mengubahnya'
        );
        await muat(false);
        return;
      }

      // Sukses: tutup form, bersihkan pilihan form, tampilkan status role="status"
      setFormTinjauTerbuka(false);
      setKeputusan('');
      setCatatanTinjau('');
      setStatusTinjauan('Tinjauan tersimpan');
      if (statusTinjauanTimeoutRef.current) {
        clearTimeout(statusTinjauanTimeoutRef.current);
      }
      statusTinjauanTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setStatusTinjauan(null);
        }
      }, 5000);

      await muat(false);

      if (keputusanDipilih === 'ubah_resep') {
        setTimeout(() => {
          const el = document.getElementById('judul-edit-resep');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.focus();
          }
        }, 100);
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setGalatTinjau(pesanGalat(err as { message?: string; status?: number }));
    } finally {
      if (mountedRef.current) {
        sedangTinjauRef.current = false;
        setSedangTinjau(false);
      }
    }
  }

  // Handler buat ringkasan AI (Fase 7 / SPEC §9, §10.4, PLAN §3 Fase 7)
  async function buatRingkasan() {
    if (sedangRingkasRef.current) return;
    sedangRingkasRef.current = true;

    if (ringkasanAbortRef.current) {
      ringkasanAbortRef.current.abort();
    }
    const abortController = new AbortController();
    ringkasanAbortRef.current = abortController;

    const curSeq = ++ringkasanSeqRef.current;
    setSedangRingkas(true);
    setGalatRingkasan(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        if (!mountedRef.current) return;
        setGalatRingkasan('Sesi habis, masuk lagi');
        setSedangRingkas(false);
        sedangRingkasRef.current = false;
        return;
      }

      const res = await fetch('/api/ringkasan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pasien_id: pasien?.id }),
        signal: abortController.signal,
      });

      if (!mountedRef.current || curSeq !== ringkasanSeqRef.current) return;

      if (!res.ok) {
        if (res.status === 401) {
          setGalatRingkasan('Sesi habis, masuk lagi');
        } else if (res.status === 403) {
          setGalatRingkasan('Pasien ini bukan milik akun Anda');
        } else {
          setGalatRingkasan('Ringkasan gagal dibuat, coba lagi');
        }
        setSedangRingkas(false);
        sedangRingkasRef.current = false;
        return;
      }

      const data = await res.json();
      if (!mountedRef.current || curSeq !== ringkasanSeqRef.current) return;

      setHasilRingkasan(data);
      setRingkasanTerbuka(true);
    } catch (err: unknown) {
      if (!mountedRef.current || curSeq !== ringkasanSeqRef.current) return;
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setGalatRingkasan('Ringkasan gagal dibuat, coba lagi');
    } finally {
      if (mountedRef.current && curSeq === ringkasanSeqRef.current) {
        setSedangRingkas(false);
        sedangRingkasRef.current = false;
      }
    }
  }

  // Tampilan selama guard peran dan muat awal berlangsung
  if (sedangCekPeran) return <LayarMuat teks="Memeriksa izin akses…" />;
  if (sedangMuat) {
    return (
      <KerangkaTerapis t={t} halaman="pasien" judul="Detail pasien" tanpaCari>
        <SkeletonDetail />
      </KerangkaTerapis>
    );
  }

  // Galat kueri awal (hanya pada muat awal penuh, B2)
  if (galatAwal) {
    return (
      <KerangkaTerapis t={t} halaman="pasien" judul="Detail pasien" tanpaCari>
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-900"
        >
          <h1 className="text-2xl font-bold">Terjadi Kesalahan</h1>
          <p className="mt-2 text-lg">{galatAwal}</p>
          <div className="mt-6">
            <Link
              href="/terapis/pasien"
              className="rc-btn-2"
            >
              Kembali ke Semua Pasien
            </Link>
          </div>
        </div>
      </KerangkaTerapis>
    );
  }

  // Pasien tidak ditemukan atau bukan milik terapis ini
  if (!pasien) {
    return (
      <KerangkaTerapis t={t} halaman="pasien" judul="Detail pasien" tanpaCari>
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
              href="/terapis/pasien"
              className="rc-btn-2"
            >
              Kembali ke Semua Pasien
            </Link>
          </div>
        </div>
      </KerangkaTerapis>
    );
  }

  // --- Perhitungan Data Fase 6: Eskalasi Terbuka, Titik Data, & Tinjauan ---
  const tinjauTerakhir = hitungTinjauTerakhir(daftarEskalasi);
  const terbuka = cariEskalasiTerbuka(daftarEskalasi);
  const sesiSejakTinjau = filterSesiSejakTinjau(daftarSesi, tinjauTerakhir);
  const titikData = hitungTitikDataEskalasi(sesiSejakTinjau);
  const jumlahBukanTitik = sesiSejakTinjau.length - titikData.length;

  // Baris eskalasi terakhir yang pernah ditinjau (untuk tampilan satu baris A4 bila tidak ada eskalasi terbuka)
  const eskalasiTerakhirDitinjau =
    daftarEskalasi
      .filter((e) => e.ditinjau !== null)
      .sort((a, b) => Date.parse(b.ditinjau!) - Date.parse(a.ditinjau!))[0] ??
    null;

  // Titik grafik run chart eskalasi (A2)
  const titikGrafikEskalasi: TitikGrafik[] = titikData.map((s, idx) => {
    const isCelah =
      s.pct_terkompensasi === null ||
      s.pct_terkompensasi === undefined ||
      s.rep_terukur === 0;

    const yVal = isCelah
      ? null
      : Number(Number(s.pct_terkompensasi).toFixed(1));
    const isPemicu = Boolean(terbuka?.sesi_pemicu?.includes(s.id));

    return {
      y: yVal,
      label: `S${idx + 1}`,
      bentuk: 'bulat',
      tebal: isPemicu,
    };
  });

  // --- Perhitungan Data Bagian C: Tren % Terkompensasi ---
  // Tampilkan paling banyak 30 sesi terakhir [default spec]
  const sesiTren30 = daftarSesi.slice(-30);
  // B1: Kirim huruf P/M/R hanya bila sesiTren30.length <= 15 agar tidak bertumpuk
  const tampilkanHurufTren = sesiTren30.length <= 15;

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
      if (tampilkanHurufTren) huruf = 'P';
    } else if (mode === 'mati') {
      bentuk = 'kotak';
      if (tampilkanHurufTren) huruf = 'M';
    } else if (mode === 'ringkasan') {
      // [default spec] Mode 'ringkasan' dipetakan ke titik bulat + huruf 'R'
      bentuk = 'bulat';
      if (tampilkanHurufTren) huruf = 'R';
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
    <KerangkaTerapis t={t} halaman="pasien" judul="Detail pasien" tanpaCari>
      <div className="flex w-full flex-col gap-6">
      {/* Banner galat muat ulang senyap (B2) */}
      {galatMuatUlang && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-lg font-medium text-red-900"
        >
          Gagal menyegarkan data: {galatMuatUlang}
        </div>
      )}

      {/* Banner status aksi (misal: tinjauan tersimpan) */}
      {statusTinjauan && (
        <div
          role="status"
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-lg font-semibold text-emerald-900"
        >
          ✓ {statusTinjauan}
        </div>
      )}

      {/* 1. KEPALA HALAMAN */}
      <div className="flex flex-col gap-4">
        <Link
          href="/terapis/pasien"
          className="-ml-2 inline-flex min-h-[44px] w-fit items-center gap-1 rounded-lg px-2 text-base font-medium text-brand-700 transition-colors hover:bg-brand-50"
        >
          <IkonPanahKiri className="h-5 w-5" />
          Semua Pasien
        </Link>

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl font-semibold text-brand-700"
            >
              {pasien.nama_panggilan.trim()[0]?.toUpperCase() ?? '?'}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-semibold">{pasien.nama_panggilan}</h2>
              {(pasien.is_sintetis || menyegarkan) && (
                <p className="text-sm text-muted">
                  {pasien.is_sintetis && 'Data sintetis'}
                  {pasien.is_sintetis && menyegarkan && ' · '}
                  {menyegarkan && <span className="animate-pulse">Menyegarkan data…</span>}
                </p>
              )}
            </div>
          </div>

          <Link
            href={`/terapis/pasien/${pasien.id}/ubah`}
            className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-brand-700 px-5 text-base font-semibold text-white transition-colors hover:bg-brand-800"
          >
            Ubah Resep Latihan
          </Link>
        </header>
      </div>

      {/* 6. RINGKASAN AI: banner; kotak hasil muncul setelah tombol ditekan, ditutup lewat panah */}
      <section aria-labelledby="judul-ringkasan-ai" className="flex flex-col">
        <div
          className={`flex flex-wrap items-center gap-4 bg-gradient-to-r from-[#4aa9ab] to-[#0b7f87] px-6 py-5 text-white transition-[border-radius] duration-300 motion-reduce:transition-none ${
            hasilRingkasan && ringkasanTerbuka ? 'rounded-t-2xl' : 'rounded-2xl'
          }`}
        >
          <IkonBintang className="h-12 w-12 text-white/50" />
          <div className="min-w-0 flex-1">
            <h2 id="judul-ringkasan-ai" className="text-base font-semibold">
              Buat Ringkasan Pasien Dari Remini AI
            </h2>
            <p className="text-sm text-white/90">
              Hanya angka tanpa nama yang dikirim ke layanan AI Google (Gemini). Ringkasan tidak mengubah resep.
            </p>
          </div>
          <button
            type="button"
            onClick={hasilRingkasan && !ringkasanTerbuka ? () => setRingkasanTerbuka(true) : buatRingkasan}
            disabled={sedangRingkas}
            aria-busy={sedangRingkas}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
          >
            {sedangRingkas ? (
              <>
                <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
                Menyusun Ringkasan…
              </>
            ) : hasilRingkasan ? (
              ringkasanTerbuka ? 'Buat Ulang' : 'Lihat Ringkasan'
            ) : (
              'Buat Ringkasan'
            )}
          </button>
        </div>

        {galatRingkasan && (
          <div role="alert" className="rc-alert mt-3">
            {galatRingkasan}
          </div>
        )}

        {/* Kontainer role="status" aria-live="polite" selalu dirender di DOM agar screen reader mendeteksi pembaruan konten */}
        <div role="status" aria-live="polite">
          {hasilRingkasan && (
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
                ringkasanTerbuka ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
              aria-hidden={!ringkasanTerbuka}
              inert={!ringkasanTerbuka}
            >
              <div className="overflow-hidden">
                <div className="space-y-4 rounded-b-2xl border border-t-0 border-brand-600 bg-white p-6">
              <div className="flex flex-wrap items-center gap-3">
                      {hasilRingkasan.sumber === 'ai' ? (
                        <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 font-bold text-emerald-900 text-lg">
                          <svg
                            className="h-6 w-6 text-emerald-700 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                            />
                          </svg>
                          <span>Ringkasan AI, cek grafik sebelum memutuskan</span>
                        </div>
                      ) : (
                        <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 font-bold text-amber-950 text-lg">
                          <svg
                            className="h-6 w-6 text-amber-700 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <span>Ringkasan templat, cek grafik sebelum memutuskan</span>
                          {hasilRingkasan.alasan && (
                            <span className="rounded bg-amber-200/80 px-2 py-0.5 font-medium text-amber-900 text-lg">
                              {hasilRingkasan.alasan === 'tanpa_kunci'
                                ? 'Kunci layanan AI belum diatur'
                                : hasilRingkasan.alasan === 'api_gagal'
                                ? 'Layanan AI tidak dapat dihubungi'
                                : 'Keluaran AI ditolak pemeriksaan otomatis'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-lg leading-relaxed text-slate-800">
                      {hasilRingkasan.teks}
                    </p>

                    <details className="pt-2">
                      <summary className="cursor-pointer text-lg font-semibold text-sky-700 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded select-none inline-flex min-h-[44px] items-center">
                        Lihat angka yang dikirim
                      </summary>
                      <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-lg text-slate-800">
                        {JSON.stringify(hasilRingkasan.masukan, null, 2)}
                      </pre>
                    </details>

                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setRingkasanTerbuka(false)}
                      aria-label="Tutup ringkasan"
                      className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-50"
                    >
                      <IkonPanahBawah className="h-6 w-6 rotate-180" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Identitas pasien (hanya baca; ubah lewat Ubah Resep Latihan) */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="baca-nama" className="mb-1 block text-sm font-medium">Nama Pasien</label>
          <input id="baca-nama" readOnly value={pasien.nama_panggilan} className="min-h-[48px] w-full rounded-lg bg-slate-50 px-3 text-base text-muted" />
        </div>
        <div>
          <label htmlFor="baca-sisi" className="mb-1 block text-sm font-medium">Sisi Terdampak</label>
          <input id="baca-sisi" readOnly value={pasien.sisi_terdampak === 'kiri' ? 'Lengan kiri' : 'Lengan kanan'} className="min-h-[48px] w-full rounded-lg bg-slate-50 px-3 text-base text-muted" />
        </div>
      </div>

      {/* 7. BAGIAN TAUTAN PERANGKAT (Fase 4c / F03) */}
      <section
        aria-labelledby="judul-tautan-perangkat"
        className="space-y-4"
      >
        <div className="space-y-1">
          <h2
            id="judul-tautan-perangkat"
            className="text-base font-medium"
          >
            Buat Tautan
          </h2>
          <p className="text-sm text-muted">
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
                  akun lama. Lanjutkan?
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
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-brand-700 px-6 text-base font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
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
                'Buat Tautan'
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
                    Kode lama dibatalkan dan akun lama dilepas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2. ESKALASI TERBUKA (SPEC §10.4 butir 2, §14 F14) */}
      {terbuka && (
        <section
          aria-labelledby="judul-eskalasi-terbuka"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className={KELAS_KEPALA_KARTU}>
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="judul-eskalasi-terbuka" className="text-base font-semibold">
                Eskalasi Terbuka
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-300 px-3 py-0.5 text-xs font-semibold text-ink">
                <IkonPeringatan className="h-4 w-4" />
                Perlu evaluasi
              </span>
            </div>
            {!formTinjauTerbuka && (
              <button
                type="button"
                onClick={() => {
                  setGalatTinjau(null);
                  setFormTinjauTerbuka(true);
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-yellow-300 px-6 text-sm font-semibold text-ink transition-colors hover:bg-yellow-200"
              >
                Tinjau
              </button>
            )}
          </div>

          <div className="space-y-5 p-5">
          <p className="text-base text-muted">
            Sistem tidak mengubah resep. Keputusan ada pada Anda.
          </p>

          {/* Indikator run dan median baseline */}
          <div className="flex flex-wrap items-center gap-4 text-lg font-medium text-amber-950">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              run {terbuka.panjang_run} &gt; batas {terbuka.batas}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              Median baseline {Number(terbuka.median_baseline).toFixed(1)}%
            </div>
          </div>

          {/* Form Tinjau in-page bila tombol Tinjau ditekan */}
          {formTinjauTerbuka && (
            <form
              onSubmit={handleSimpanTinjauan}
              className="rounded-xl border-2 border-amber-300 bg-white p-6 space-y-6 shadow-sm"
            >
              <div className="space-y-1">
                <h3
                  ref={judulFormTinjauRef}
                  tabIndex={-1}
                  className="text-2xl font-bold text-slate-900 focus-visible:outline-none"
                >
                  Form Tinjauan Eskalasi
                </h3>
                <p className="text-lg text-slate-600">
                  Pilih keputusan klinis terhadap resep latihan pasien ini.
                </p>
              </div>

              {galatTinjau && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-300 bg-red-50 p-4 text-lg font-medium text-red-900"
                >
                  {galatTinjau}
                </div>
              )}

              {/* fieldset + legend Keputusan */}
              <fieldset className="space-y-3">
                <legend className="text-xl font-bold text-slate-900 mb-2">
                  Keputusan
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Lanjutkan */}
                  <label
                    className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-colors ${
                      keputusan === 'lanjutkan'
                        ? 'border-sky-700 bg-sky-50'
                        : 'border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="keputusan"
                      value="lanjutkan"
                      checked={keputusan === 'lanjutkan'}
                      onChange={() => setKeputusan('lanjutkan')}
                      className="h-6 w-6 text-sky-700 focus:ring-sky-500"
                    />
                    <span className="text-xl font-bold text-slate-900">
                      Lanjutkan
                    </span>
                  </label>

                  {/* Ubah resep */}
                  <label
                    className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-colors ${
                      keputusan === 'ubah_resep'
                        ? 'border-sky-700 bg-sky-50'
                        : 'border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="keputusan"
                      value="ubah_resep"
                      checked={keputusan === 'ubah_resep'}
                      onChange={() => setKeputusan('ubah_resep')}
                      className="h-6 w-6 text-sky-700 focus:ring-sky-500"
                    />
                    <span className="text-xl font-bold text-slate-900">
                      Ubah resep
                    </span>
                  </label>

                  {/* Jadwalkan tatap muka */}
                  <label
                    className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border-2 p-4 transition-colors ${
                      keputusan === 'tatap_muka'
                        ? 'border-sky-700 bg-sky-50'
                        : 'border-slate-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="keputusan"
                      value="tatap_muka"
                      checked={keputusan === 'tatap_muka'}
                      onChange={() => setKeputusan('tatap_muka')}
                      className="h-6 w-6 text-sky-700 focus:ring-sky-500"
                    />
                    <span className="text-xl font-bold text-slate-900">
                      Jadwalkan tatap muka
                    </span>
                  </label>
                </div>
              </fieldset>

              {/* Catatan (opsional) - [default spec] maxLength 500 */}
              <div className="space-y-2">
                <label
                  htmlFor="catatan-tinjau"
                  className="block text-lg font-semibold text-slate-800"
                >
                  Catatan (opsional)
                </label>
                <textarea
                  id="catatan-tinjau"
                  rows={3}
                  maxLength={500}
                  value={catatanTinjau}
                  onChange={(e) => setCatatanTinjau(e.target.value)}
                  placeholder="Tuliskan catatan observasi atau rencana tindakan bila diperlukan..."
                  className="w-full rounded-xl border border-slate-300 p-4 text-lg text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                />
                <p className="text-lg text-slate-500 text-right">
                  {catatanTinjau.length} / 500 karakter
                </p>
              </div>

              {/* Tombol Simpan & Batal */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  type="submit"
                  disabled={sedangTinjau || !keputusan}
                  className="inline-flex min-h-[64px] items-center justify-center rounded-xl bg-sky-700 px-8 py-4 text-xl font-bold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 disabled:opacity-50 shadow-sm"
                >
                  {sedangTinjau ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  type="button"
                  disabled={sedangTinjau}
                  onClick={() => {
                    setFormTinjauTerbuka(false);
                    setGalatTinjau(null);
                    setKeputusan('');
                    setCatatanTinjau('');
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-lg font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-400 disabled:opacity-50"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* Run chart eskalasi */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <Grafik
              judul="Run chart eskalasi"
              titik={titikGrafikEskalasi}
              yMin={0}
              yMaks={100}
              satuan="%"
              acuan={{
                y: Number(terbuka.median_baseline),
                label: 'Median baseline',
              }}
              tinggi={220}
            />
            {/* Teks penjelas titik tebal */}
            <p className="text-center text-lg font-medium text-slate-700">
              Titik tebal = sesi yang membentuk run
            </p>
          </div>

          {/* Tabel titik data eskalasi di bawah grafik */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <caption className="sr-only">
                  Tabel titik data eskalasi terbuka beserta persentase kompensasi, repetisi terukur, persentase tak terukur, status nyeri, dan penanda sesi pemicu.
                </caption>
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-50 text-lg font-semibold text-slate-800">
                    <th scope="col" className="p-3">
                      Sesi &amp; Waktu
                    </th>
                    <th scope="col" className="p-3">
                      % Terkompensasi
                    </th>
                    <th scope="col" className="p-3">
                      Repetisi Terukur
                    </th>
                    <th scope="col" className="p-3">
                      % Tak Terukur
                    </th>
                    <th scope="col" className="p-3">
                      Nyeri
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-lg text-slate-800">
                  {titikData.map((s, idx) => {
                    const isPemicu = Boolean(
                      terbuka.sesi_pemicu?.includes(s.id)
                    );
                    const isNullKompensasi =
                      s.pct_terkompensasi === null ||
                      s.pct_terkompensasi === undefined ||
                      s.rep_terukur === 0;
                    const pctStr = isNullKompensasi
                      ? '—'
                      : `${Number(s.pct_terkompensasi).toFixed(1)}%`;
                    const pctTakTerukurStr =
                      s.pct_tak_terukur !== null &&
                      s.pct_tak_terukur !== undefined
                        ? `${Number(s.pct_tak_terukur).toFixed(1)}%`
                        : '—';

                    return (
                      <tr
                        key={s.id}
                        className={
                          isPemicu
                            ? 'bg-amber-100/50 hover:bg-amber-100/80 font-medium'
                            : 'hover:bg-slate-50/70'
                        }
                      >
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700">
                              S{idx + 1}
                            </span>
                            <span>({formatTanggalJam(s.mulai)})</span>
                            {isPemicu && (
                              <span className="inline-flex items-center rounded-full border border-amber-500 bg-amber-200 px-2.5 py-0.5 text-lg font-bold text-amber-950">
                                Pemicu
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-semibold">{pctStr}</td>
                        <td className="p-3">{s.rep_terukur}</td>
                        <td className="p-3">{pctTakTerukurStr}</td>
                        <td className="p-3">{renderNyeri(s.nyeri)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Catatan sesi yang tidak dihitung (< 5 repetisi terukur) */}
            {jumlahBukanTitik > 0 && (
              <p className="text-lg text-slate-600 italic">
                {jumlahBukanTitik} sesi &lt; 5 repetisi terukur tidak dihitung
              </p>
            )}
          </div>
          </div>
        </section>
      )}

      {/* A4: Satu baris kecil bila tidak ada eskalasi terbuka tetapi ada tinjauan sebelumnya [default spec] */}
      {!terbuka && eskalasiTerakhirDitinjau && (
        <section
          aria-labelledby="judul-status-eskalasi"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id="judul-status-eskalasi" className="sr-only">
            Status Eskalasi Terakhir
          </h2>
          <p className="text-lg text-slate-700">
            Terakhir ditinjau{' '}
            {formatTanggalJam(eskalasiTerakhirDitinjau.ditinjau!)}:{' '}
            <span className="font-semibold text-slate-900">
              {formatLabelKeputusan(eskalasiTerakhirDitinjau.keputusan)}
            </span>
          </p>
        </section>
      )}

      {/* 3. TREN % TERKOMPENSASI PER SESI (SPEC §10.4 butir 3) */}
      <KartuBagian
        id="judul-tren-kompensasi"
        judul="Tren % Terkompensasi per Sesi"
        ket="Perkembangan kompensasi postur (maksimal 30 sesi terakhir)."
      >
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
            <p className="text-center text-lg text-slate-600">
              Huruf ditampilkan bila ≤ 15 sesi
            </p>
          </div>
        )}
      </KartuBagian>

      {/* 4. TABEL 10 SESI TERAKHIR + KEPATUHAN (SPEC §10.4 butir 4) */}
      <KartuBagian
        id="judul-riwayat-sesi"
        judul="10 Sesi Terakhir & Kepatuhan"
        ket="Riwayat sesi terbaru dan tingkat kepatuhan latihan 7 hari terakhir."
        aksi={
          <span className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-ink">
            7 hari: {sesi7Hari} dari {targetPerMinggu}
          </span>
        }
      >
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
      </KartuBagian>

      {/* 5. METRIK KINEMATIK PER GERAKAN (SPEC §10.4 butir 5) */}
      <KartuBagian
        id="judul-kinematik"
        judul="Metrik Kinematik per Gerakan"
        ket="2D, untuk tren pasien ini saja"
      >
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
      </KartuBagian>
      </div>
    </KerangkaTerapis>
  );
}
