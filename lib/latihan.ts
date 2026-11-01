// lib/latihan.ts
// Fungsi murni untuk kartu latihan di beranda. Aman diimpor node --test.

export const NAMA_GERAKAN: Record<string, string> = {
  jangkau_depan: 'Jangkau ke depan',
  jangkau_samping: 'Jangkau ke samping',
};

const DETIK_PER_REPETISI = 8;   // perkiraan: angkat, tahan, turun
const DETIK_PERSIAPAN = 15;     // diam sebentar untuk kalibrasi

/** Perkiraan lama satu gerakan dalam menit (dibulatkan ke atas, minimal 1). */
export function perkiraanMenit(repetisi: number): number {
  return Math.max(1, Math.ceil((repetisi * DETIK_PER_REPETISI + DETIK_PERSIAPAN) / 60));
}

/** Berkas contoh gerakan di /public/video. */
export function videoGerakan(g: string): string {
  return `/video/${g === 'jangkau_samping' ? 'jangkau_samping' : 'jangkau_depan'}.mp4`;
}
