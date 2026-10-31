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
// Naskah final A4 (SPEC §10.5, V9: kalimat akun Google di paragraf 2 dan 4).
// Lima paragraf = lima klip I-SETUJU-n di public/audio; ubah teks berarti rekam ulang klipnya.
const TEKS_SETUJU = [
  'Aplikasi ini membantu latihan lengan di rumah. Kamera menghitung gerakan dan memberi koreksi suara. Video tidak pernah keluar dari ponsel ini.',
  'Yang disimpan: nama panggilan, resep, dan angka tiap sesi. Untuk ringkasan otomatis fisioterapis, hanya angka tanpa nama yang dikirim ke layanan AI Google. Untuk masuk, email dan nama akun Google Anda disimpan oleh layanan login, dan fisioterapis tidak melihatnya.',
  'Data disimpan sampai Anda menghapusnya, atau sampai proyek demo ditutup, paling lama 90 hari.',
  'Anda boleh berhenti kapan saja. Tombol Hapus data saya di beranda menghapus semua sesi dan melepas akun Anda dari data pasien. Akun login Anda tetap ada sampai fitur hapus akun tersedia.',
  'Server berada di Singapura. Persetujuan diberikan oleh pasien, atau oleh wali atas nama pasien bila pasien tidak mampu.',
];

// ── NASKAH utama (kalimat persis Lampiran A PRD) ──────────────────────────

export const NASKAH: Record<string, string> = {
  // Angka hitungan N-1..N-20
  ...Object.fromEntries(
    Object.entries(KATA_ANGKA).map(([k, v]) => [`N-${k}`, v]),
  ),

  'K-CONDONG-S': 'Punggung tetap menempel sandaran.',
  'K-CONDONG-T': 'Punggung tetap tegak.',
  'K-MIRING':    'Badan jangan miring.',
  'K-BAHU':      'Turunkan bahu, rileks.',

  'I-MULAI':       'Ayo mulai latihan.',
  'I-POSISI':      'Duduk tegak dan hadap ke kamera.',
  'I-KAMERA':      'Duduk di kursi bersandaran. Letakkan ponsel setinggi dada, satu setengah sampai dua meter di depan Anda.',
  'I-BINGKAI':     'Pastikan kepala sampai pangkuan terlihat di layar.',
  'I-GATING':      'Kamera tidak melihat Anda dengan jelas.',
  'I-KALIB':       'Diam sebentar.',
  'I-KALIB-OK':    'Kalibrasi selesai.',
  'I-KALIB-ULANG': 'Mohon diam sebentar, kita ulangi.',
  'I-G1':          'Gerakan pertama: jangkau ke depan.',
  'I-G2':          'Gerakan kedua: jangkau ke samping.',
  'I-ISTIRAHAT':   'Istirahat sebentar.',
  'I-BAGUS':       'Bagus, lanjutkan.',
  'I-SELESAI':     'Sesi selesai. Terima kasih.',
  'I-NYERI':       'Bagaimana rasanya hari ini?',

  'R-BAIK':   'Bagus, hampir semua gerakan sudah benar.',
  'R-CUKUP':  'Cukup, sebagian gerakan masih perlu diperbaiki.',
  'R-KURANG': 'Banyak gerakan masih perlu diperbaiki, pelan-pelan saja.',

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
