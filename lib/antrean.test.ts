// lib/antrean.test.ts — Task 2, Step 1: tes gagal dulu
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { buatAntrean } from './antrean.ts';
import type { Op } from './antrean.ts';
import type { BarisSesi } from './kinematik/mesin.ts';

// ── Helper: buat BarisSesi stub ────────────────────────────────────────────
function buatBarisSesi(id: string): BarisSesi {
  return {
    id,
    pasien_id: 'pasien-1',
    mulai: new Date().toISOString(),
    selesai: new Date().toISOString(),
    resep: {
      gerakan: ['jangkau_depan'],
      repetisi: 5,
      sesi_per_minggu: 3,
      toleransi_batang: 'normal',
      toleransi_bahu: 'normal',
      durasi_persen: 30,
      mode_koreksi: 'penuh',
      kalimat_condong: 'sandaran',
      kandidat_condong: 'a',
      suara_condong: false,
      ambang_versi: 'v1',
    },
    baseline: {} as any,
    rep_total: 5,
    rep_terukur: 4,
    rep_terkompensasi: 1,
    per_gerakan: {},
    pct_tak_terukur: 0.2,
    fps_median: 30,
    suara: 'webspeech',
    delegate: 'GPU',
    nyeri: null,
    is_sintetis: false,
  };
}

// ── Fake PenyimpananKV (Map-based) ─────────────────────────────────────────
function buatSimpanan() {
  const store = new Map<string, string>();
  return {
    dapatkan(k: string): string | null { return store.get(k) ?? null; },
    atur(k: string, v: string): void { store.set(k, v); },
    hapus(k: string): void { store.delete(k); },
  };
}

function buatSimpananKuotaPenuh() {
  return {
    dapatkan(_k: string): string | null { return null; },
    atur(_k: string, _v: string): void {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    },
    hapus(_k: string): void {},
  };
}

// ── Fake KlienKirim ────────────────────────────────────────────────────────
function buatKlien(statusSesi: number | null, statusNyeri?: { status: number | null; hasil: boolean | null }) {
  let panggilanUpsert = 0;
  return {
    get panggilanUpsert() { return panggilanUpsert; },
    async upsertSesi(_b: BarisSesi) {
      panggilanUpsert++;
      return { status: statusSesi };
    },
    async laporNyeri(_id: string, _n: 0 | 1 | 2) {
      return statusNyeri ?? { status: 200, hasil: true };
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('antrean', () => {
  it('kirim mengosongkan antrean bila sukses', async () => {
    const simpan = buatSimpanan();
    const klien = buatKlien(201);
    const { tambah, kirim, jumlahSesi } = buatAntrean({ simpan, klien });

    const op1: Op = { jenis: 'sesi', baris: buatBarisSesi('sesi-1') };
    const op2: Op = { jenis: 'sesi', baris: buatBarisSesi('sesi-2') };
    tambah(op1);
    tambah(op2);

    await kirim();

    assert.equal(jumlahSesi(), 0, 'antrean harus kosong setelah sukses');
    assert.equal(klien.panggilanUpsert, 2, 'upsertSesi harus dipanggil 2×');
  });

  it('galat jaringan menghentikan dan menyimpan', async () => {
    const simpan = buatSimpanan();
    const klien = buatKlien(null); // null = galat jaringan
    const { tambah, kirim, jumlahSesi } = buatAntrean({ simpan, klien });

    tambah({ jenis: 'sesi', baris: buatBarisSesi('sesi-1') });
    tambah({ jenis: 'sesi', baris: buatBarisSesi('sesi-2') });

    await kirim();

    assert.equal(klien.panggilanUpsert, 1, 'harus berhenti setelah galat pertama');
    assert.equal(jumlahSesi(), 2, 'kedua op harus tetap di antrean');
  });

  it('5xx menghentikan', async () => {
    const simpan = buatSimpanan();
    const klien = buatKlien(503);
    const { tambah, kirim, jumlahSesi } = buatAntrean({ simpan, klien });

    tambah({ jenis: 'sesi', baris: buatBarisSesi('sesi-1') });
    tambah({ jenis: 'sesi', baris: buatBarisSesi('sesi-2') });

    await kirim();

    assert.equal(jumlahSesi(), 2, '5xx harus berhenti dan tetap 2 di antrean');
  });

  it('4xx lain pindah ke rc_gagal dan lanjut', async () => {
    const simpan = buatSimpanan();
    // Op pertama 400, op kedua 201
    let panggilan = 0;
    const klien = {
      panggilanUpsert: 0,
      async upsertSesi(_b: BarisSesi) {
        klien.panggilanUpsert++;
        panggilan++;
        return { status: panggilan === 1 ? 400 : 201 };
      },
      async laporNyeri(_id: string, _n: 0 | 1 | 2) {
        return { status: 200, hasil: true };
      },
    };
    const { tambah, kirim, jumlahSesi } = buatAntrean({ simpan, klien });

    tambah({ jenis: 'sesi', baris: buatBarisSesi('sesi-1') });
    tambah({ jenis: 'sesi', baris: buatBarisSesi('sesi-2') });

    await kirim();

    const gagal = simpan.dapatkan('rc_gagal');
    assert.ok(gagal !== null, 'rc_gagal harus terisi');
    const arr = JSON.parse(gagal!);
    assert.equal(arr.length, 1, 'satu op harus ada di rc_gagal');
    assert.equal(jumlahSesi(), 0, 'op kedua berhasil, antrean kosong');
  });

  it('nyeri hasil false dianggap selesai', async () => {
    const simpan = buatSimpanan();
    const klien = {
      panggilanUpsert: 0,
      async upsertSesi(_b: BarisSesi) { return { status: 201 }; },
      async laporNyeri(_id: string, _n: 0 | 1 | 2) {
        return { status: 200, hasil: false }; // false = tetap selesai
      },
    };
    const { tambah, kirim, jumlahSesi } = buatAntrean({ simpan, klien });

    tambah({ jenis: 'nyeri', sesi_id: 'sesi-1', nilai: 1 });
    await kirim();

    assert.equal(jumlahSesi(), 0, 'nyeri hasil false harus dianggap selesai');
  });

  it('kirim bersamaan tidak menggandakan', async () => {
    const simpan = buatSimpanan();
    const klien = buatKlien(201);
    const { tambah, kirim, jumlahSesi } = buatAntrean({ simpan, klien });

    tambah({ jenis: 'sesi', baris: buatBarisSesi('sesi-1') });

    // Dua kirim() bersamaan tanpa await di antara
    const p1 = kirim();
    const p2 = kirim();
    await Promise.all([p1, p2]);

    assert.equal(klien.panggilanUpsert, 1, 'upsertSesi harus dipanggil tepat 1× (guard sedangKirim)');
    assert.equal(jumlahSesi(), 0);
  });

  it('tambah mengembalikan false saat kuota penuh', () => {
    const simpan = buatSimpananKuotaPenuh();
    const klien = buatKlien(201);
    const { tambah } = buatAntrean({ simpan, klien });

    const hasil = tambah({ jenis: 'sesi', baris: buatBarisSesi('sesi-1') });

    assert.equal(hasil, false, 'tambah harus return false saat QuotaExceededError');
  });

  it('jumlahSesi hanya menghitung jenis sesi', () => {
    const simpan = buatSimpanan();
    const klien = buatKlien(201);
    const { tambah, jumlahSesi } = buatAntrean({ simpan, klien });

    tambah({ jenis: 'sesi', baris: buatBarisSesi('sesi-1') });
    tambah({ jenis: 'nyeri', sesi_id: 'sesi-1', nilai: 0 });

    assert.equal(jumlahSesi(), 1, 'nyeri tidak dihitung oleh jumlahSesi');
  });
});
