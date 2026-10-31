// lib/lokal.ts — Task 2
// Semua akses localStorage dibungkus try/catch. Kunci: rc_resep, rc_antrean,
// rc_gagal, rc_riwayat:{pasien_id} (maks 30).

import type { ResepSalinan } from './kinematik/mesin.ts';
import type { Sisi } from './kinematik/tipe.ts';

// ── Tipe publik ────────────────────────────────────────────────────────────

export type Riwayat = {
  mulai: string;
  pct_benar: number | null;
  rep_total: number;
  rep_benar: number;
};

export type ResepLokal = {
  pasien_id: string;
  nama_panggilan: string;
  sisi_terdampak: Sisi;
} & Omit<ResepSalinan, 'kandidat_condong' | 'suara_condong' | 'ambang_versi'>;

// ── Primitif ───────────────────────────────────────────────────────────────

/** Baca nilai JSON dari localStorage; kembalikan `awal` bila tidak ada atau gagal. */
export function bacaJson<T>(kunci: string, awal: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(kunci);
    if (raw === null || raw === undefined) return awal;
    return JSON.parse(raw) as T;
  } catch {
    return awal;
  }
}

/** Tulis nilai JSON ke localStorage. Kembalikan false bila QuotaExceededError atau akses ditolak. */
export function tulisJson(kunci: string, nilai: unknown): boolean {
  try {
    globalThis.localStorage?.setItem(kunci, JSON.stringify(nilai));
    return true;
  } catch (e) {
    if (e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      return false;
    }
    return false;
  }
}

/** Hapus kunci dari localStorage. */
export function hapus(kunci: string): void {
  try {
    globalThis.localStorage?.removeItem(kunci);
  } catch {
    // abaikan
  }
}

// ── Resep ──────────────────────────────────────────────────────────────────

export function bacaResep(): ResepLokal | null {
  return bacaJson<ResepLokal | null>('rc_resep', null);
}

export function simpanResep(r: ResepLokal): boolean {
  return tulisJson('rc_resep', r);
}

// ── Riwayat ────────────────────────────────────────────────────────────────

const MAKS_RIWAYAT = 30;

export function bacaRiwayat(pasienId: string): Riwayat[] {
  return bacaJson<Riwayat[]>(`rc_riwayat:${pasienId}`, []);
}

/** Tambah ke riwayat, pangkas ke 30 terbaru. */
export function tambahRiwayat(pasienId: string, r: Riwayat): void {
  const sekarang = bacaRiwayat(pasienId);
  const baru = [...sekarang, r].slice(-MAKS_RIWAYAT);
  tulisJson(`rc_riwayat:${pasienId}`, baru);
}
