'use client';

interface PropsLayarPanduan {
  bantuan: boolean;
  gating: boolean;
  onSiap(): void;
}

// Pratinjau kamera dirender oleh Sesi (satu <video> tetap terpasang untuk mesin pose).
const PETUNJUK = [
  'Duduk di kursi bersandaran, tanpa sandaran tangan',
  'Letakkan ponsel setinggi dada, 1,5 sampai 2 meter di depan Anda',
  'Hadap kamera; kepala sampai pangkuan harus terlihat',
  'Posisi lanskap (mendatar) disarankan',
];

export default function LayarPanduan({ bantuan, gating, onSiap }: PropsLayarPanduan) {
  return (
    <div className="rc-wrap pt-4!">
      <div>
        <h1 className="rc-judul">Posisikan kamera</h1>
        <p className="rc-sub">Pastikan Anda terlihat jelas di pratinjau di atas.</p>
      </div>

      {bantuan && (
        <div role="alert" className="rc-info">
          Kalibrasi belum berhasil beberapa kali. Periksa lagi posisi kamera dan duduk sesuai petunjuk, lalu coba lagi.
        </div>
      )}

      <div
        role="status"
        className={gating ? 'rc-info' : 'rc-ok'}
      >
        {gating ? 'Kamera belum melihat Anda dengan jelas. Geser posisi sampai kepala sampai pangkuan masuk bingkai.' : 'Posisi terlihat baik. Tekan Siap bila sudah nyaman.'}
      </div>

      <ul className="rc-card flex flex-col gap-3">
        {PETUNJUK.map((t, i) => (
          <li key={t} className="flex gap-3 text-base">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-800"
            >
              {i + 1}
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ul>

      <button onClick={onSiap} disabled={gating} className="rc-btn">
        {gating ? 'Posisikan tubuh ke dalam bingkai' : 'Siap'}
      </button>
    </div>
  );
}
