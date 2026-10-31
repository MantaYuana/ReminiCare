'use client';

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

const LABEL_NYERI: { nilai: 0 | 1 | 2; label: string; ikon: string }[] = [
  { nilai: 0, label: 'Tidak nyeri', ikon: '😊' },
  { nilai: 1, label: 'Agak nyeri',  ikon: '😐' },
  { nilai: 2, label: 'Nyeri',       ikon: '😣' },
];

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
    <div className="rc-wrap">
      <div>
        <h1 className="rc-judul">Latihan selesai</h1>
        <p className="rc-sub">Terima kasih sudah berlatih hari ini.</p>
      </div>

      {pesanSimpan && (
        <div role="alert" className="rc-info">{pesanSimpan}</div>
      )}

      <div className="rc-card text-center">
        <p className="text-base text-muted">Gerakan yang benar</p>
        <p className="text-6xl font-bold tabular-nums text-brand-700">
          {pctBenar === null ? '–' : `${pctBenar}%`}
        </p>
        {pctBenar === null && (
          <p className="mt-1 text-base text-muted">Belum ada repetisi yang bisa diukur.</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">
          <div>
            <p className="text-sm text-muted">Total repetisi</p>
            <p className="text-3xl font-bold tabular-nums">{totalRep}</p>
          </div>
          <div>
            <p className="text-sm text-muted">Repetisi benar</p>
            <p className="text-3xl font-bold tabular-nums">{repBenar}</p>
          </div>
        </div>
      </div>

      {!tamu && titikGrafik.length > 0 && (
        <div className="rc-card">
          <Grafik judul="% repetisi benar (7 sesi terakhir)" titik={titikGrafik} satuan="%" />
        </div>
      )}

      {tamu && (
        <p className="rc-sub text-center">Mode tamu: hasil ini tidak disimpan.</p>
      )}

      {!tamu && onNyeri && (
        <div className="rc-card">
          <p className="mb-3 text-base font-semibold">Bagaimana rasanya hari ini?</p>
          <div className="grid grid-cols-3 gap-3">
            {LABEL_NYERI.map(({ nilai, label, ikon }) => (
              <button
                key={nilai}
                onClick={() => onNyeri(nilai)}
                disabled={nyeriSudahDipilih}
                className="flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-1 py-2 text-base font-medium transition-colors hover:border-brand-600 hover:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-3xl" aria-hidden="true">{ikon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
          {nyeriSudahDipilih && (
            <p className="mt-3 text-center text-base text-brand-800" role="status">Terima kasih atas jawabannya.</p>
          )}
        </div>
      )}

      <button onClick={onSelesai} className="rc-btn">Selesai</button>
    </div>
  );
}
