'use client';

import Link from 'next/link';
import Grafik from '../Grafik';
import type { TitikGrafik } from '../Grafik';
import type { Riwayat } from '../../lib/lokal.ts';

// Ringkasan setelah sesi selesai atau dihentikan lebih awal.

interface PropsLayarRingkasan {
  totalRep: number;
  repBenar: number;
  pctBenar: number | null;   // null = belum ada repetisi terukur
  tamu: boolean;
  riwayat?: Riwayat[];
  onSelesai(): void;
  onNyeri?(nilai: 0 | 1 | 2): void;
  nyeriSudahDipilih: boolean;
  pesanSimpan?: string;
}

const LABEL_NYERI: { nilai: 0 | 1 | 2; label: string }[] = [
  { nilai: 0, label: 'Tidak nyeri' },
  { nilai: 1, label: 'Agak nyeri' },
  { nilai: 2, label: 'Nyeri' },
];

/** Wajah garis sederhana: mulut melengkung naik, lurus, atau turun. */
function Wajah({ nilai }: { nilai: 0 | 1 | 2 }) {
  const mulut = nilai === 0 ? 'M8 14.5c1 1.5 2.5 2.2 4 2.2s3-.7 4-2.2' : nilai === 1 ? 'M8.5 15.5h7' : 'M8 17c1-1.5 2.5-2.2 4-2.2s3 .7 4 2.2';
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-9 w-9">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 10v.01M15 10v.01" strokeWidth="2.4" />
      <path d={mulut} />
    </svg>
  );
}

/** Lingkar persentase; angka di tengah, teks pendukung untuk pembaca layar. */
function Lingkar({ persen }: { persen: number | null }) {
  const r = 68;
  const keliling = 2 * Math.PI * r;
  const isi = persen === null ? 0 : (Math.min(100, Math.max(0, persen)) / 100) * keliling;
  return (
    <div className="relative mx-auto h-44 w-44" role="img" aria-label={persen === null ? 'Belum ada repetisi terukur' : `${persen} persen gerakan benar`}>
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="80" cy="80" r={r} fill="none" strokeWidth="12" className="stroke-brand-50" />
        <circle
          cx="80" cy="80" r={r} fill="none" strokeWidth="12" strokeLinecap="round"
          className="stroke-brand-700 transition-[stroke-dasharray] duration-700 motion-reduce:transition-none"
          strokeDasharray={`${isi} ${keliling}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-5xl font-semibold tabular-nums text-brand-700">
        {persen === null ? '–' : `${persen}%`}
      </span>
    </div>
  );
}

function kalimatHasil(pct: number | null): string {
  if (pct === null) return 'Belum ada repetisi yang bisa diukur. Coba lagi dengan posisi duduk dan kamera sesuai petunjuk.';
  if (pct >= 80) return 'Gerakan Anda sudah sangat baik. Pertahankan.';
  if (pct >= 50) return 'Terus berlatih, gerakan Anda makin baik.';
  return 'Tidak apa-apa. Coba lagi besok dengan tenang, pelan-pelan saja.';
}

export default function LayarRingkasan({
  totalRep,
  repBenar,
  pctBenar,
  tamu,
  riwayat = [],
  onSelesai,
  onNyeri,
  nyeriSudahDipilih,
  pesanSimpan,
}: PropsLayarRingkasan) {
  const titikGrafik: TitikGrafik[] = riwayat.slice(-7).map((r, i) => ({
    y: r.pct_benar ?? null,
    label: `S${i + 1}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="rc-judul">Latihan selesai</h2>
        <p className="rc-sub">Terima kasih sudah berlatih hari ini.</p>
      </div>

      {pesanSimpan && (
        <div role="alert" className="rc-info">{pesanSimpan}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Hasil latihan" className="rc-card flex flex-col gap-5 text-center">
          <p className="text-base font-medium text-muted">Gerakan yang benar</p>
          <Lingkar persen={pctBenar} />
          <p className="mx-auto max-w-sm text-base">{kalimatHasil(pctBenar)}</p>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">
            <div>
              <p className="text-base text-muted">Total repetisi</p>
              <p className="text-3xl font-semibold tabular-nums">{totalRep}</p>
            </div>
            <div>
              <p className="text-base text-muted">Repetisi benar</p>
              <p className="text-3xl font-semibold tabular-nums">{repBenar}</p>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-6">
          {!tamu && titikGrafik.length > 0 && (
            <section className="rc-card">
              <h3 className="mb-2 text-lg font-semibold">Perkembangan 7 sesi terakhir</h3>
              <Grafik judul="% repetisi benar (7 sesi terakhir)" titik={titikGrafik} satuan="%" />
            </section>
          )}

          {tamu && (
            <section className="rounded-2xl bg-brand-50 p-5">
              <h3 className="text-lg font-semibold text-brand-700">Mode tamu: hasil ini tidak disimpan</h3>
              <p className="mt-1 text-base text-muted">Buat akun, lalu minta fisioterapis menghubungkan resep latihan Anda supaya perkembangan tercatat.</p>
              <Link href="/daftar" className="rc-btn-2 mt-4 bg-white">Buat akun</Link>
            </section>
          )}

          {!tamu && onNyeri && (
            <section className="rc-card">
              <h3 className="mb-3 text-lg font-semibold">Bagaimana rasanya hari ini?</h3>
              <div className="grid grid-cols-3 gap-3">
                {LABEL_NYERI.map(({ nilai, label }) => (
                  <button
                    key={nilai}
                    onClick={() => onNyeri(nilai)}
                    disabled={nyeriSudahDipilih}
                    className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-1 py-2 text-base font-medium text-ink transition-colors hover:border-brand-600 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Wajah nilai={nilai} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              {nyeriSudahDipilih && (
                <p className="mt-3 text-center text-base text-brand-800" role="status">Terima kasih atas jawabannya.</p>
              )}
            </section>
          )}
        </div>
      </div>

      <button onClick={onSelesai} className="rc-btn lg:max-w-sm">Selesai</button>
    </div>
  );
}
