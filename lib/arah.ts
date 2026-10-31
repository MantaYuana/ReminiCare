// lib/arah.ts
// Fungsi murni untuk navigasi dan kode klaim. Aman diimpor node --test.

import { lanjutAman } from './peran.ts';
import type { Peran } from './peran.ts';

/**
 * Rute tujuan setelah masuk. `lanjut` dari URL selalu disaring lewat lanjutAman.
 * null = tetap di halaman (belum masuk, atau belum punya peran).
 */
export function ruteUntuk(p: Peran, lanjut: string | null): string | null {
  switch (p.jenis) {
    case 'terapis':
      return lanjutAman(lanjut) ?? '/terapis';
    case 'pasien':
    case 'pasien_baru':
      return lanjutAman(lanjut) ?? '/pasien';
    case 'luring':
      return '/pasien';
    case 'tanpa_peran':
    case 'keluar':
      return null;
  }
}

/** Kode klaim 8 karakter heksadesimal huruf besar (spec §8.5); null bila bentuknya salah. */
export function normalKode(s: string): string | null {
  const k = s.replace(/\s+/g, '').toUpperCase();
  return /^[0-9A-F]{8}$/.test(k) ? k : null;
}

/** Isi QR dari fisioterapis (tautan `.../k/KODE`) atau kode polos; null bila bukan kode klaim. */
export function kodeDariQR(isi: string): string | null {
  const t = isi.trim();
  const dariTautan = /\/k\/([^/?#\s]+)\/?(?:[?#].*)?$/i.exec(t);
  return normalKode(dariTautan ? dariTautan[1] : t);
}
