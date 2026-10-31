'use client';

// Penanda tahap sesi. Teks selalu tampil, bukan hanya warna (NFR-6).
const TAHAP = ['Persiapan', 'Kalibrasi', 'Latihan', 'Selesai'] as const;

export default function Langkah({ aktif }: { aktif: 0 | 1 | 2 | 3 }) {
  return (
    <ol
      className="mx-auto flex w-full max-w-lg items-center gap-2 px-5 pt-5"
      aria-label={`Tahap ${aktif + 1} dari ${TAHAP.length}: ${TAHAP[aktif]}`}
    >
      {TAHAP.map((nama, i) => (
        <li key={nama} className="flex-1">
          <div className={`h-1.5 rounded-full ${i <= aktif ? 'bg-brand-700' : 'bg-slate-300'}`} />
          <span className={`mt-1 block text-sm ${i === aktif ? 'font-semibold text-ink' : 'text-muted'}`}>
            {nama}
          </span>
        </li>
      ))}
    </ol>
  );
}
