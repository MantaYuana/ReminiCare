'use client';

import type { TitikGrafik } from '../Grafik';
import Grafik from '../Grafik';
import type { Riwayat } from '../../lib/lokal';

// Summary screen shown after session completes or user stops early.

interface PropsLayarRingkasan {
  totalRep: number;
  repBenar: number;
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
  tamu,
  riwayat = [],
  onSelesai,
  onNyeri,
  nyeriSudahDipilih,
  pesanSimpan,
}: PropsLayarRingkasan) {
  const pctBenar = totalRep > 0 ? Math.round((repBenar / totalRep) * 100) : 0;

  // Buat titik grafik dari 7 riwayat terakhir
  const titikGrafik: TitikGrafik[] = riwayat.slice(-7).map((r, i) => ({
    y: r.pct_benar ?? null,
    label: `S${i + 1}`,
  }));

  return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Latihan selesai!</h1>

      {pesanSimpan && (
        <div role="alert" className="w-full bg-yellow-50 border border-yellow-300 rounded-xl p-4 text-base">
          {pesanSimpan}
        </div>
      )}

      {/* Statistik sesi */}
      <div className="w-full grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-base text-gray-500">Total repetisi</p>
          <p className="text-4xl font-bold">{totalRep}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 text-center">
          <p className="text-base text-gray-500">Repetisi benar</p>
          <p className="text-4xl font-bold">{repBenar}</p>
        </div>
      </div>

      <div className="w-full bg-gray-50 rounded-xl p-4 text-center">
        <p className="text-base text-gray-500">Persentase benar</p>
        <p className="text-4xl font-bold text-blue-600">{pctBenar}%</p>
      </div>

      {/* Grafik riwayat — hanya pasien dengan data */}
      {!tamu && titikGrafik.length > 0 && (
        <div className="w-full">
          <Grafik
            judul="% repetisi benar (7 sesi terakhir)"
            titik={titikGrafik}
            satuan="%"
          />
        </div>
      )}

      {/* TODO: agregatSesi — wiring ke mesin asli saat integrasi */}

      {/* Lapor nyeri — hanya pasien, bukan tamu */}
      {!tamu && onNyeri && (
        <div className="w-full">
          <p className="text-base font-medium mb-3">Bagaimana kondisi Anda setelah latihan?</p>
          <div className="grid grid-cols-3 gap-3">
            {LABEL_NYERI.map(({ nilai, label, ikon }) => (
              <button
                key={nilai}
                onClick={() => onNyeri(nilai)}
                disabled={nyeriSudahDipilih}
                className="btn-sekunder flex flex-col items-center gap-1 bg-gray-50 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label={label}
              >
                <span className="text-2xl" aria-hidden="true">{ikon}</span>
                <span className="text-base">{label}</span>
              </button>
            ))}
          </div>
          {nyeriSudahDipilih && (
            <p className="text-base text-green-600 mt-2 text-center" role="status">Terima kasih atas responnya.</p>
          )}
        </div>
      )}

      <button
        onClick={onSelesai}
        className="btn-utama w-full bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Selesai
      </button>
    </div>
  );
}
