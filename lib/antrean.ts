// lib/antrean.ts
// Offline queue for session and pain data. Factory pattern allows
// dependency injection so tests run without DOM or network access.

import type { BarisSesi } from './kinematik/mesin.ts';

// ── Tipe publik ────────────────────────────────────────────────────────────

export type Op =
  | { jenis: 'sesi'; baris: BarisSesi }
  | { jenis: 'nyeri'; sesi_id: string; nilai: 0 | 1 | 2 };

/** Antarmuka penyimpanan KV — diimplementasi oleh localStorage atau Map palsu di tes. */
export type PenyimpananKV = {
  dapatkan(kunci: string): string | null;
  /** Melempar QuotaExceededError bila penuh. */
  atur(kunci: string, nilai: string): void;
  hapus(kunci: string): void;
};

export type KlienKirim = {
  upsertSesi(b: BarisSesi): Promise<{ status: number | null }>;
  laporNyeri(id: string, n: 0 | 1 | 2): Promise<{ status: number | null; hasil: boolean | null }>;
};

// ── Konstanta kunci ────────────────────────────────────────────────────────

const KUNCI_ANTREAN = 'rc_antrean';
const KUNCI_GAGAL   = 'rc_gagal';

// ── Pabrik ─────────────────────────────────────────────────────────────────

export function buatAntrean(dep: { simpan: PenyimpananKV; klien: KlienKirim }) {
  const { simpan, klien } = dep;
  let sedangKirim = false;

  // ── Baca / tulis antrean ────────────────────────────────────────────────

  function bacaAntrean(): Op[] {
    try {
      const raw = simpan.dapatkan(KUNCI_ANTREAN);
      if (!raw) return [];
      return JSON.parse(raw) as Op[];
    } catch {
      return [];
    }
  }

  function tulisAntrean(ops: Op[]): boolean {
    try {
      simpan.atur(KUNCI_ANTREAN, JSON.stringify(ops));
      return true;
    } catch (e) {
      if (e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        return false;
      }
      return false;
    }
  }

  // ── Daftar gagal ────────────────────────────────────────────────────────

  function tambahGagal(op: Op): void {
    try {
      const raw = simpan.dapatkan(KUNCI_GAGAL);
      const arr: Op[] = raw ? (JSON.parse(raw) as Op[]) : [];
      arr.push(op);
      simpan.atur(KUNCI_GAGAL, JSON.stringify(arr));
    } catch {
      // abaikan — kuota mungkin penuh
    }
  }

  // ── API publik ──────────────────────────────────────────────────────────

  /** Tambahkan op ke antrean. Kembalikan false bila QuotaExceededError. */
  function tambah(op: Op): boolean {
    try {
      const ops = bacaAntrean();
      ops.push(op);
      simpan.atur(KUNCI_ANTREAN, JSON.stringify(ops));
      return true;
    } catch (e) {
      if (e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        return false;
      }
      return false;
    }
  }

  /** Kirim semua op di antrean secara FIFO.
   *  - null / 5xx → berhenti, sisakan di antrean
   *  - 4xx lain   → pindah ke rc_gagal, lanjut ke op berikutnya
   *  - 2xx        → hapus dari antrean
   *  Guard sedangKirim mencegah dua pemanggilan bersamaan menggandakan pengiriman. */
  async function kirim(): Promise<void> {
    if (sedangKirim) return;
    sedangKirim = true;

    try {
      let ops = bacaAntrean();

      while (ops.length > 0) {
        const op = ops[0];
        let berhasil = false;
        let pindahGagal = false;

        if (op.jenis === 'sesi') {
          const { status } = await klien.upsertSesi(op.baris);
          if (status === null || (status >= 500 && status < 600)) {
            break; // galat jaringan atau 5xx — berhenti
          } else if (status >= 200 && status < 300) {
            berhasil = true;
          } else {
            // 4xx lain
            pindahGagal = true;
          }
        } else {
          // jenis === 'nyeri'
          const { status, hasil } = await klien.laporNyeri(op.sesi_id, op.nilai);
          if (status === null || (status >= 500 && status < 600)) {
            break;
          } else if (status >= 200 && status < 300) {
            // hasil false pun dianggap selesai
            berhasil = true;
          } else {
            pindahGagal = true;
          }
        }

        if (berhasil || pindahGagal) {
          ops = ops.slice(1); // buang op pertama
          tulisAntrean(ops);
          if (pindahGagal) tambahGagal(op);
        }
      }
    } finally {
      sedangKirim = false;
    }
  }

  /** Hitung jumlah op dengan jenis 'sesi' di antrean. */
  function jumlahSesi(): number {
    return bacaAntrean().filter(op => op.jenis === 'sesi').length;
  }

  return { tambah, kirim, jumlahSesi };
}

// ── Singleton ─────────────────────────────────────────────────────────────
// Lazy-initialized so importing this module in Node (tests) does not crash.

function buatPenyimpananLokal(): PenyimpananKV {
  return {
    dapatkan(k) {
      try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; }
    },
    atur(k, v) {
      // Biarkan QuotaExceededError menjalar supaya tambah() bisa tangkap
      globalThis.localStorage?.setItem(k, v);
    },
    hapus(k) {
      try { globalThis.localStorage?.removeItem(k); } catch { /* abaikan */ }
    },
  };
}

// Lazy import supabase — singleton is created at browser runtime, not at module load
let _singleton: ReturnType<typeof buatAntrean> | null = null;

// Klien Supabase dibagi dengan seluruh aplikasi: sesi login Google, PKCE, dan rotasi
// refresh token tidak boleh dipegang beberapa klien. Impor dinamis supaya tes (buatAntrean)
// tidak memuat Supabase.
function dapatSingleton() {
  if (_singleton) return _singleton;
  const klienBrowser: KlienKirim = {
    async upsertSesi(baris) {
      try {
        const { supabase: sb } = await import('./supabase.ts');
        const { error, status } = await sb
          .from('sesi')
          .upsert(baris, { onConflict: 'id', ignoreDuplicates: true });
        if (error && !error.message) return { status: null };
        return { status: status ?? null };
      } catch {
        return { status: null };
      }
    },
    async laporNyeri(id, n) {
      try {
        const { supabase: sb } = await import('./supabase.ts');
        const { data, error, status } = await sb.rpc('lapor_nyeri', {
          p_sesi_id: id,
          p_nilai: n,
        });
        if (error) return { status: status ?? null, hasil: null };
        return { status: status ?? null, hasil: data as boolean };
      } catch {
        return { status: null, hasil: null };
      }
    },
  };
  _singleton = buatAntrean({ simpan: buatPenyimpananLokal(), klien: klienBrowser });
  return _singleton;
}

export const tambah   = (op: Op)         => dapatSingleton().tambah(op);
export const kirim    = ()               => dapatSingleton().kirim();
export const jumlahSesi = ()             => dapatSingleton().jumlahSesi();
