/** Kerangka konten Detail Pasien saat data dimuat: bentuknya meniru halaman asli supaya tidak melompat. */
export default function SkeletonDetail() {
  const blok = 'rounded-lg bg-slate-100';

  return (
    <div role="status" aria-live="polite" className="flex w-full animate-pulse flex-col gap-6 motion-reduce:animate-none">
      <span className="sr-only">Memuat data pasien…</span>

      <div className={`h-6 w-28 ${blok}`} />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-slate-100" />
          <div className={`h-7 w-48 ${blok}`} />
        </div>
        <div className={`h-12 w-44 ${blok}`} />
      </div>

      <div className="h-20 rounded-2xl bg-slate-100" />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <div className={`h-4 w-24 ${blok}`} />
          <div className={`h-12 w-full ${blok}`} />
        </div>
        <div className="space-y-2">
          <div className={`h-4 w-28 ${blok}`} />
          <div className={`h-12 w-full ${blok}`} />
        </div>
      </div>

      {[0, 1].map(i => (
        <div key={i} className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="h-12 bg-slate-100" />
          <div className="p-5">
            <div className="h-48 rounded-lg bg-slate-50" />
          </div>
        </div>
      ))}
    </div>
  );
}
