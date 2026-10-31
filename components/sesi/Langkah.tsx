'use client';

// Penanda tahap sesi. Teks selalu tampil, bukan hanya warna (NFR-6).
const TAHAP = ['Persiapan', 'Kalibrasi', 'Latihan', 'Selesai'] as const;

export default function Langkah({ aktif }: { aktif: 0 | 1 | 2 | 3 }) {
  return (
    <ol
      className="flex w-full items-center gap-3 sm:gap-6"
      aria-label={`Tahap ${aktif + 1} dari ${TAHAP.length}: ${TAHAP[aktif]}`}
    >
      {TAHAP.map((nama, i) => (
        <li key={nama} className="flex-1 text-center">
          <div className={`h-3 rounded-full ${i === aktif ? 'bg-brand-600' : i < aktif ? 'bg-brand-600/60' : 'bg-brand-100'}`} />
          <span className={`mt-1 block text-sm ${i === aktif ? 'font-semibold text-ink' : 'text-muted'}`}>
            {nama}
          </span>
        </li>
      ))}
    </ol>
  );
}
