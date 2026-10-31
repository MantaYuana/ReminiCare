import { IkonAkun, IkonBel, IkonPesan, IkonTitikTiga } from '../ikon';

/** Kolom kanan beranda fisioterapis: foto (atau inisial) dan nama. Telepon belum ada datanya. */
export default function PanelProfil({ nama, foto }: { nama: string; foto: string | null }) {
  const inisial = nama.trim()[0]?.toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Profil Anda</h2>
        <button type="button" disabled aria-label="Opsi (belum tersedia)" className="flex h-9 w-9 items-center justify-center text-muted disabled:cursor-not-allowed">
          <IkonTitikTiga className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt="" referrerPolicy="no-referrer" className="h-24 w-24 rounded-full border-4 border-brand-600 object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-brand-600 bg-brand-50 text-3xl font-semibold text-brand-700"
          >
            {inisial ?? <IkonAkun className="h-10 w-10" />}
          </span>
        )}
        <p className="mt-2 text-lg font-semibold leading-snug">{nama || 'Fisioterapis'}</p>
        <div className="mt-2 flex gap-4">
          <button type="button" disabled aria-label="Pengingat (belum tersedia)" className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 text-ink disabled:cursor-not-allowed disabled:opacity-60">
            <IkonBel className="h-5 w-5" />
          </button>
          <button type="button" disabled aria-label="Pesan (belum tersedia)" className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 text-ink disabled:cursor-not-allowed disabled:opacity-60">
            <IkonPesan className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
