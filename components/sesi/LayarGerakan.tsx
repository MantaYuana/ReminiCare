'use client';

const NAMA_GERAKAN: Record<string, string> = {
  jangkau_depan:   'Jangkau ke depan',
  jangkau_samping: 'Jangkau ke samping',
};

interface PropsLayarGerakan {
  gerakan: string;
  sisi: 'kiri' | 'kanan';
  hitungan: number;
  totalRepPerGerakan: number;
  skor: number;
  fps: number;
  gating: boolean;
  onBerhenti(): void;
}

// Video kamera dirender oleh Sesi (satu <video> tetap terpasang); layar ini hanya overlay.
export default function LayarGerakan({
  gerakan,
  sisi,
  hitungan,
  totalRepPerGerakan,
  skor,
  fps,
  gating,
  onBerhenti,
}: PropsLayarGerakan) {
  const namaFile = gerakan === 'jangkau_samping' ? 'jangkau_samping' : 'jangkau_depan';
  const mirror = sisi === 'kiri' ? 'scaleX(-1)' : undefined;
  const persen = Math.min(100, Math.round((hitungan / Math.max(1, totalRepPerGerakan)) * 100));
  const yakin = Math.round(skor * 100);

  return (
    <div className="relative z-10 flex h-screen flex-col justify-between p-4 text-white">
      {/* Atas: nama gerakan + keyakinan */}
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl bg-ink/75 px-4 py-2 backdrop-blur">
          <p className="text-base text-white/80">Gerakan</p>
          <p className="text-lg font-semibold">{NAMA_GERAKAN[gerakan] ?? gerakan}</p>
        </div>
        <div
          className="rounded-2xl bg-ink/75 px-4 py-2 backdrop-blur"
          role="meter"
          aria-label={`Keyakinan kamera ${yakin} persen`}
          aria-valuenow={yakin}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <p className="text-base text-white/80">Keyakinan {yakin}%</p>
          <div className="mt-1 h-2 w-28 rounded-full bg-white/25">
            <div className="h-2 rounded-full bg-brand-600 transition-all duration-200" style={{ width: `${yakin}%` }} />
          </div>
        </div>
      </div>

      {/* Tengah: peringatan gating */}
      <div className="flex justify-center">
        {gating && (
          <div role="status" className="rounded-2xl bg-amber-300 px-5 py-3 text-center text-lg font-semibold text-slate-900">
            Kamera tidak melihat Anda dengan jelas
          </div>
        )}
      </div>

      {/* Bawah: hitungan, progres, tombol */}
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div className="rounded-2xl bg-ink/75 px-5 py-3 backdrop-blur">
            <div
              className="text-7xl font-bold leading-none tabular-nums"
              aria-live="polite"
              aria-label={`Repetisi ${hitungan} dari ${totalRepPerGerakan}`}
            >
              {hitungan}
              <span className="text-4xl font-semibold text-white/70"> / {totalRepPerGerakan}</span>
            </div>
            <div className="mt-3 h-2.5 w-44 rounded-full bg-white/25" aria-hidden="true">
              <div className="h-2.5 rounded-full bg-brand-600 transition-all duration-300" style={{ width: `${persen}%` }} />
            </div>
          </div>

          <video
            src={`/video/${namaFile}.mp4`}
            autoPlay
            loop
            muted
            playsInline
            className="h-28 w-36 rounded-2xl border-2 border-white/60 bg-black object-cover"
            style={mirror ? { transform: mirror } : undefined}
            aria-label={`Contoh gerakan ${NAMA_GERAKAN[gerakan] ?? gerakan}`}
          />
        </div>

        <button
          onClick={onBerhenti}
          className="min-h-[64px] w-full rounded-2xl bg-white text-lg font-semibold text-red-700 shadow-lg transition-colors hover:bg-red-50"
        >
          Berhenti
        </button>

        <p className="text-center text-sm text-white/60" aria-hidden="true">{fps} fps</p>
      </div>
    </div>
  );
}
