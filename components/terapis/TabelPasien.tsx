import Link from 'next/link';
import type { BarisPrioritas } from './useTerapis';

function teksKompensasi(p: BarisPrioritas): string {
  if (p.pct_terakhir !== null) return `${Math.round(p.pct_terakhir)}%`;
  return p.sesi_terakhir !== null ? 'Tidak ada repetisi terukur' : 'Belum ada sesi';
}

function Lencana({ teks, titik }: { teks: string; titik: string }) {
  // Teks selalu tampil; titik warna hanya penegas (NFR-6)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-ink">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${titik}`} />
      {teks}
    </span>
  );
}

function Kepatuhan({ p }: { p: BarisPrioritas }) {
  const persen = Math.min(100, Math.round((p.sesi_7_hari / Math.max(1, p.sesi_per_minggu)) * 100));
  return (
    <div className="flex flex-col gap-1">
      <span className="text-base">{p.sesi_7_hari} dari {p.sesi_per_minggu} sesi</span>
      <div className="h-1.5 w-24 rounded-full bg-brand-50" role="img" aria-label={`${persen} persen dari target sesi mingguan`}>
        <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${persen}%` }} />
      </div>
    </div>
  );
}

/** Daftar pasien terurut prioritas tindakan. Kolom tengah disembunyikan di ponsel dan dipindah ke bawah nama. */
export default function TabelPasien({ daftar }: { daftar: BarisPrioritas[] }) {
  return (
    <div className="overflow-hidden rounded-2xl shadow-[0_4px_20px_rgba(20,24,25,0.08)]">
      <table className="w-full text-left">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="px-5 pb-2 pt-4 font-semibold">Nama</th>
            <th scope="col" className="hidden px-3 pb-2 pt-4 font-semibold sm:table-cell">Kompensasi terakhir</th>
            <th scope="col" className="hidden px-3 pb-2 pt-4 font-semibold sm:table-cell">Kepatuhan 7 hari</th>
            <th scope="col" className="px-5 pb-2 pt-4 text-right font-semibold"><span className="sr-only">Aksi</span></th>
          </tr>
        </thead>
        <tbody>
          {daftar.map(p => (
            <tr key={p.pasien_id} className="border-t border-slate-100 align-middle">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                    {p.nama_panggilan.trim()[0]?.toUpperCase() ?? '?'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-lg font-medium leading-snug">{p.nama_panggilan}</p>
                    {(p.eskalasi_terbuka || p.lencana_nyeri || p.jarang || p.is_sintetis) && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5" role="group" aria-label="Status dan peringatan pasien">
                        {p.eskalasi_terbuka && <Lencana teks="Eskalasi" titik="bg-red-600" />}
                        {p.lencana_nyeri && <Lencana teks="Nyeri" titik="bg-amber-500" />}
                        {p.jarang && <Lencana teks="Jarang latihan" titik="bg-orange-500" />}
                        {p.is_sintetis && <span className="text-xs text-muted">Data sintetis</span>}
                      </div>
                    )}
                    <dl className="mt-1 text-sm text-muted sm:hidden">
                      <div className="flex gap-1"><dt>Kompensasi:</dt><dd className="font-semibold text-ink">{teksKompensasi(p)}</dd></div>
                      <div className="flex gap-1"><dt>Kepatuhan:</dt><dd className="font-semibold text-ink">{p.sesi_7_hari} dari {p.sesi_per_minggu} sesi</dd></div>
                    </dl>
                  </div>
                </div>
              </td>
              <td className="hidden px-3 py-3 text-base sm:table-cell">{teksKompensasi(p)}</td>
              <td className="hidden px-3 py-3 sm:table-cell"><Kepatuhan p={p} /></td>
              <td className="px-5 py-3 text-right">
                <Link
                  href={`/terapis/pasien/${p.pasien_id}`}
                  aria-label={`Lihat detail ${p.nama_panggilan}`}
                  className="inline-flex min-h-[44px] items-center rounded-full bg-brand-50 px-4 text-sm font-semibold uppercase tracking-wide text-brand-700 transition-colors hover:bg-brand-100"
                >
                  Lihat detail
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
