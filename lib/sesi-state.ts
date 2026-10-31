// lib/sesi-state.ts
// Pure reducer for session screen state + voice event filter.
// No DOM access — safe to import in Node.

import type { EventMesin, ModeKoreksi, Gerakan } from './kinematik/tipe.ts';
import type { KodeKlip } from './suara.ts';

// ── Tipe publik ────────────────────────────────────────────────────────────

export type NamaLayar =
  | 'mulai' | 'kamera' | 'panduan' | 'kalibrasi'
  | 'gerakan' | 'istirahat' | 'ringkasan';

export type Layar = {
  nama: NamaLayar;
  gerakanKe: number;
  hitungan: number;
  totalRep: number;
  gagalKalibrasi: number;
  bantuan: boolean;
};

export type Aksi =
  | { t: 'suaraSiap' }
  | { t: 'kameraSiap' }
  | { t: 'siap' }
  | { t: 'kalibrasi'; ok: boolean }
  | { t: 'repetisi'; hitungan: number }
  | { t: 'istirahatSelesai' }
  | { t: 'berhenti' };

const MAKS_GAGAL_KALIBRASI = 3;

// ── mulaiLayar ─────────────────────────────────────────────────────────────

export function mulaiLayar(suaraSudahBuka: boolean): Layar {
  return {
    nama: suaraSudahBuka ? 'kamera' : 'mulai',
    gerakanKe: 0,
    hitungan: 0,
    totalRep: 0,
    gagalKalibrasi: 0,
    bantuan: false,
  };
}

// ── langkah (reducer) ──────────────────────────────────────────────────────

export function langkah(
  l: Layar,
  a: Aksi,
  resep: { gerakan: readonly Gerakan[] | string[]; repetisi: number },
): { layar: Layar; keluar: boolean } {
  const next = (patch: Partial<Layar>): { layar: Layar; keluar: boolean } => ({
    layar: { ...l, ...patch },
    keluar: false,
  });

  switch (a.t) {
    case 'suaraSiap':
      if (l.nama === 'mulai') return next({ nama: 'kamera' });
      return next({});

    case 'kameraSiap':
      if (l.nama === 'kamera') return next({ nama: 'panduan' });
      return next({});

    case 'siap':
      if (l.nama === 'panduan') return next({ nama: 'kalibrasi' });
      return next({});

    case 'kalibrasi': {
      if (l.nama !== 'kalibrasi') return next({});
      if (a.ok) {
        return next({ nama: 'gerakan', gerakanKe: 0, hitungan: 0, gagalKalibrasi: 0 });
      }
      const gagal = l.gagalKalibrasi + 1;
      if (gagal >= MAKS_GAGAL_KALIBRASI) {
        return next({ nama: 'panduan', bantuan: true, gagalKalibrasi: 0 });
      }
      return next({ gagalKalibrasi: gagal });
    }

    case 'repetisi': {
      if (l.nama !== 'gerakan') return next({});
      // hitungan dari mesin kumulatif per gerakan → ganti porsi gerakan ini, jangan dijumlah ulang
      const totalRep = l.totalRep - l.hitungan + a.hitungan;
      const gerakanSelesai = a.hitungan >= resep.repetisi;
      if (!gerakanSelesai) {
        return next({ hitungan: a.hitungan, totalRep });
      }
      // Gerakan selesai — ada gerakan berikutnya?
      const adaBerikutnya = l.gerakanKe + 1 < resep.gerakan.length;
      if (adaBerikutnya) {
        return next({ nama: 'istirahat', hitungan: a.hitungan, totalRep });
      }
      return next({ nama: 'ringkasan', hitungan: a.hitungan, totalRep });
    }

    case 'istirahatSelesai':
      if (l.nama !== 'istirahat') return next({});
      return next({ nama: 'gerakan', gerakanKe: l.gerakanKe + 1, hitungan: 0 });

    case 'berhenti':
      if (l.totalRep === 0) {
        return { layar: { ...l }, keluar: true };
      }
      return next({ nama: 'ringkasan' });

    default:
      return next({});
  }
}

// ── buatJuruSuara ──────────────────────────────────────────────────────────

const JEDA_GATING_MS = 5000;

export function buatJuruSuara(
  mode: ModeKoreksi,
): (e: EventMesin, kini: number) => { kode: KodeKlip; prioritas?: boolean }[] {
  let tGatingTerakhir = -Infinity;

  return (e: EventMesin, kini: number) => {
    switch (e.jenis) {
      case 'repetisi': {
        const hasil: { kode: KodeKlip; prioritas?: boolean }[] = [
          { kode: `N-${e.hitungan}` as KodeKlip },
        ];
        if (mode === 'penuh' && e.bagus) {
          hasil.push({ kode: 'I-BAGUS' });
        }
        return hasil;
      }

      case 'koreksi': {
        if (mode !== 'penuh') return [];
        return [{ kode: e.kode as KodeKlip, prioritas: true }];
      }

      case 'gating': {
        if (!e.aktif) return [];
        if (kini - tGatingTerakhir < JEDA_GATING_MS) return [];
        tGatingTerakhir = kini;
        return [{ kode: 'I-GATING' }];
      }

      default:
        return [];
    }
  };
}
