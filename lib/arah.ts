// lib/arah.ts
// Fungsi murni untuk navigasi dan kode klaim. Aman diimpor node --test.

/** Kode klaim 8 karakter heksadesimal huruf besar (spec §8.5); null bila bentuknya salah. */
export function normalKode(s: string): string | null {
  const k = s.replace(/\s+/g, '').toUpperCase();
  return /^[0-9A-F]{8}$/.test(k) ? k : null;
}
