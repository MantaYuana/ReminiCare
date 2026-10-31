'use client';

interface PropsLayarPanduan {
  bantuan: boolean;
  onSiap(): void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export default function LayarPanduan({ bantuan, onSiap, videoRef }: PropsLayarPanduan) {
  return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold">Panduan posisi</h1>

      {bantuan && (
        <div role="alert" className="w-full bg-yellow-50 border border-yellow-300 rounded-xl p-4 text-base">
          Kalibrasi gagal beberapa kali. Pastikan posisi Anda sesuai panduan di bawah.
        </div>
      )}

      {/* Pratinjau kamera */}
      <div className="relative w-full aspect-video bg-gray-900 rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
          aria-label="Pratinjau kamera"
        />
      </div>

      {/* Petunjuk posisi */}
      <ul className="w-full space-y-2 text-base list-disc list-inside">
        <li>Gunakan kursi bersandaran tanpa sandaran tangan</li>
        <li>Posisikan kamera setinggi dada</li>
        <li>Jarak 1,5–2 meter dari kamera</li>
        <li>Tampak depan, kepala sampai pangkuan terlihat</li>
        <li>Lanskap (horizontal) disarankan</li>
      </ul>

      <button
        onClick={onSiap}
        className="btn-utama w-full bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Siap
      </button>
    </div>
  );
}
