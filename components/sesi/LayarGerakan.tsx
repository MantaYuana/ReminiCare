'use client';

import type { Gerakan } from '../../lib/kinematik/tipe';

const NAMA_GERAKAN: Record<string, string> = {
  jangkau_depan:   'Jangkau Depan',
  jangkau_samping: 'Jangkau Samping',
};

interface PropsLayarGerakan {
  gerakan: string;
  sisi: 'kiri' | 'kanan';
  hitungan: number;
  totalRepPerGerakan: number;
  skor: number;
  fps: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onBerhenti(): void;
}

export default function LayarGerakan({
  gerakan,
  sisi,
  hitungan,
  totalRepPerGerakan,
  skor,
  fps,
  videoRef,
  onBerhenti,
}: PropsLayarGerakan) {
  const namaFile = gerakan === 'jangkau_samping' ? 'jangkau_samping' : 'jangkau_depan';
  const mirror = sisi === 'kiri' ? 'scaleX(-1)' : undefined;

  return (
    <div className="relative flex flex-col h-screen bg-black">
      {/* Video kamera (dicerminkan) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
        aria-label="Kamera latihan"
      />

      {/* Video peragaan di pojok kanan bawah */}
      <video
        src={`/video/${namaFile}.mp4`}
        autoPlay
        loop
        muted
        playsInline
        className="absolute bottom-4 right-4 w-32 h-24 object-cover rounded-lg border-2 border-white/50"
        style={mirror ? { transform: mirror } : undefined}
        aria-label={`Video peragaan ${NAMA_GERAKAN[gerakan] ?? gerakan}`}
      />

      {/* Overlay UI */}
      <div className="relative z-10 flex flex-col h-full p-4 text-white">
        {/* Hitungan besar di tengah atas */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <p className="text-lg font-medium opacity-90">{NAMA_GERAKAN[gerakan] ?? gerakan}</p>
          <div
            className="text-8xl font-bold tabular-nums"
            aria-live="polite"
            aria-label={`Repetisi ${hitungan} dari ${totalRepPerGerakan}`}
          >
            {hitungan} / {totalRepPerGerakan}
          </div>

          {/* Indikator keyakinan */}
          <div className="w-48 mt-4" role="meter" aria-label={`Keyakinan ${Math.round(skor * 100)}%`} aria-valuenow={Math.round(skor * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="flex justify-between text-sm mb-1">
              <span>Keyakinan</span>
              <span>{Math.round(skor * 100)}%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className="bg-green-400 h-3 rounded-full transition-all duration-200"
                style={{ width: `${Math.round(skor * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* FPS kecil di pojok */}
        <p className="absolute top-4 left-4 text-xs opacity-50">{fps} fps</p>

        {/* Tombol berhenti */}
        <button
          onClick={onBerhenti}
          className="btn-utama w-full bg-red-600 text-white rounded-xl hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-400 mt-auto"
        >
          Berhenti
        </button>
      </div>
    </div>
  );
}
