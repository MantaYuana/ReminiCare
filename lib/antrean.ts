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
  /** uid akun yang sedang masuk; null = belum masuk, jadi jangan kirim apa pun. */
  uidSekarang(): Promise<string | null>;
};

// Op di penyimpanan membawa uid akun pemiliknya, dicap saat kirim() pertama kali melihatnya
// (tambah() selalu langsung diikuti kirim(), jadi pemiliknya akun yang sedang masuk).
type OpTersimpan = Op & { uid?: string };

// ── Konstanta kunci ────────────────────────────────────────────────────────

const KUNCI_ANTREAN = 'rc_antrean';
const KUNCI_GAGAL   = 'rc_gagal';

/** Event window setelah antrean berubah, supaya UI menghitung ulang tanpa polling. */
export const EVENT_ANTREAN = 'rc-antrean';

// ── Pabrik ─────────────────────────────────────────────────────────────────

export function buatAntrean(dep: { simpan: PenyimpananKV; klien: KlienKirim }) {
  const { simpan, klien } = dep;
  let sedangKirim = false;

  // ── Baca / tulis antrean ────────────────────────────────────────────────

  function bacaAntrean(): OpTersimpan[] {
    try {
      const raw = simpan.dapatkan(KUNCI_ANTREAN);
      if (!raw) return [];
      return JSON.parse(raw) as OpTersimpan[];
    } catch {
      return [];
    }
  }

  function tulisAntrean(ops: OpTersimpan[]): boolean {
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

  function tambahGagal(op: OpTersimpan): void {
    try {
      const raw = simpan.dapatkan(KUNCI_GAGAL);
      const arr: OpTersimpan[] = raw ? (JSON.parse(raw) as OpTersimpan[]) : [];
      arr.push(op);
      simpan.atur(KUNCI_GAGAL, JSON.stringify(arr));
    } catch {
      // abaikan — kuota mungkin penuh
    }
  }

  /** Cap op baru dengan `uid`; op milik akun lain pindah ke rc_gagal supaya tidak terkirim atas nama akun ini. */
  function siapkan(uid: string): OpTersimpan[] {
    const semua = bacaAntrean();
    const milik: OpTersimpan[] = [];
    for (const op of semua) {
      if (!op.uid || op.uid === uid) milik.push({ ...op, uid });
      else tambahGagal(op);
    }
    if (milik.length !== semua.length || semua.some(op => !op.uid)) tulisAntrean(milik);
    return milik;
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
   *  - belum masuk → tidak mengirim apa pun
   *  Guard sedangKirim mencegah dua pemanggilan bersamaan menggandakan pengiriman. */
  async function kirim(): Promise<void> {
    if (sedangKirim) return;
    sedangKirim = true;

    try {
      const uid = await klien.uidSekarang();
      if (!uid) return;

      while (true) {
        // Baca ulang tiap putaran: tambah() bisa menyisipkan op (mis. nyeri) selama await di bawah
        const ops = siapkan(uid);
        if (ops.length === 0) break;
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
          // Hanya kirim() yang membuang, jadi op terdepan di penyimpanan masih op yang baru dikirim
          tulisAntrean(bacaAntrean().slice(1));
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

  /** Hitung semua op (sesi + nyeri) yang belum terkirim. */
  function jumlahOp(): number {
    return bacaAntrean().length;
  }

  return { tambah, kirim, jumlahSesi, jumlahOp };
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
      globalThis.dispatchEvent?.(new Event(EVENT_ANTREAN));
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
    async uidSekarang() {
      try {
        const { supabase: sb } = await import('./supabase.ts');
        const { data } = await sb.auth.getSession();   // baca sesi tersimpan, tidak butuh jaringan
        return data.session?.user.id ?? null;
      } catch {
        return null;
      }
    },
  };
  _singleton = buatAntrean({ simpan: buatPenyimpananLokal(), klien: klienBrowser });
  return _singleton;
}

export const tambah   = (op: Op)         => dapatSingleton().tambah(op);
export const kirim    = ()               => dapatSingleton().kirim();
export const jumlahSesi = ()             => dapatSingleton().jumlahSesi();
export const jumlahOp   = ()             => dapatSingleton().jumlahOp();
