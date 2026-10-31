// lib/naskah.ts
// Voice script — maps clip codes to Indonesian spoken text.
// TODO: replace placeholder phrases with final audio script once audio clips are delivered.

// ── Angka satu..dua puluh ─────────────────────────────────────────────────

const KATA_ANGKA: Record<number, string> = {
  1:  'satu',
  2:  'dua',
  3:  'tiga',
  4:  'empat',
  5:  'lima',
  6:  'enam',
  7:  'tujuh',
  8:  'delapan',
  9:  'sembilan',
  10: 'sepuluh',
  11: 'sebelas',
  12: 'dua belas',
  13: 'tiga belas',
  14: 'empat belas',
  15: 'lima belas',
  16: 'enam belas',
  17: 'tujuh belas',
  18: 'delapan belas',
  19: 'sembilan belas',
  20: 'dua puluh',
};

// ── Teks persetujuan (F19-v1) ─────────────────────────────────────────────
// TODO: ganti dengan naskah persetujuan final dari tim
const TEKS_SETUJU = [
  'Aplikasi ini akan merekam gerakan tubuh Anda menggunakan kamera perangkat untuk membantu latihan fisioterapi.',
  'Data gerakan diproses di perangkat dan hanya skor latihan yang dikirim ke server, bukan video.',
  'Data Anda disimpan dengan aman dan hanya dapat diakses oleh fisioterapis Anda.',
  'Anda dapat menghapus semua data dan melepas perangkat kapan saja melalui menu Hapus Data.',
  'Dengan menekan Setuju, Anda menyatakan telah membaca dan memahami penjelasan ini.',
];

// ── NASKAH utama ──────────────────────────────────────────────────────────

export const NASKAH: Record<string, string> = {
  // Angka hitungan N-1..N-20
  ...Object.fromEntries(
    Object.entries(KATA_ANGKA).map(([k, v]) => [`N-${k}`, v]),
  ),

  // Koreksi postur
  // TODO: ganti dengan teks final dari Lampiran A
  'K-CONDONG-S': 'Coba condongkan punggung ke sandaran kursi.',
  'K-CONDONG-T': 'Coba duduk tegak, jangan condong.',
  'K-MIRING':    'Coba duduk lurus, jangan miring ke samping.',
  'K-BAHU':      'Turunkan bahu Anda, rileks.',

  // Instruksi sesi
  // TODO: ganti dengan teks final dari Lampiran A
  'I-MULAI':       'Mari kita mulai latihan.',
  'I-POSISI':      'Pastikan posisi duduk Anda sudah benar.',
  'I-KAMERA':      'Izinkan akses kamera untuk memulai.',
  'I-BINGKAI':     'Pastikan seluruh tubuh Anda terlihat di kamera.',
  'I-GATING':      'Tahan posisi sejenak.',
  'I-KALIB':       'Kalibrasi dimulai. Tetap diam.',
  'I-KALIB-OK':    'Kalibrasi berhasil.',
  'I-KALIB-ULANG': 'Kalibrasi gagal. Coba lagi.',
  'I-G1':          'Gerakan pertama.',
  'I-G2':          'Gerakan kedua.',
  'I-ISTIRAHAT':   'Istirahat sejenak.',
  'I-BAGUS':       'Bagus!',
  'I-SELESAI':     'Latihan selesai. Kerja bagus!',
  'I-NYERI':       'Apakah Anda merasakan nyeri setelah latihan?',

  // Ringkasan performa
  // TODO: ganti dengan teks final dari Lampiran A
  'R-BAIK':   'Performa Anda hari ini sangat baik.',
  'R-CUKUP':  'Performa Anda hari ini cukup baik.',
  'R-KURANG': 'Terus berlatih, Anda pasti bisa lebih baik.',

  // Persetujuan I-SETUJU-1..n
  ...Object.fromEntries(
    TEKS_SETUJU.map((teks, i) => [`I-SETUJU-${i + 1}`, teks]),
  ),
};

// ── Kode wajib (non I-SETUJU, non N-*) ───────────────────────────────────

export const KODE_WAJIB: string[] = [
  'K-CONDONG-S', 'K-CONDONG-T', 'K-MIRING', 'K-BAHU',
  'I-MULAI', 'I-POSISI', 'I-KAMERA', 'I-BINGKAI', 'I-GATING',
  'I-KALIB', 'I-KALIB-OK', 'I-KALIB-ULANG',
  'I-G1', 'I-G2', 'I-ISTIRAHAT', 'I-BAGUS',
  'R-BAIK', 'R-CUKUP', 'R-KURANG',
  'I-SELESAI', 'I-NYERI',
];

// ── teksSetuju ────────────────────────────────────────────────────────────

/** Kembalikan array paragraf persetujuan sesuai urutan I-SETUJU-1..n. */
export function teksSetuju(): string[] {
  const hasil: string[] = [];
  let i = 1;
  while (NASKAH[`I-SETUJU-${i}`]) {
    hasil.push(NASKAH[`I-SETUJU-${i}`]);
    i++;
  }
  return hasil;
}
