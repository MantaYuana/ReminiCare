// lib/sesi-state.test.ts — failing tests first
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mulaiLayar, langkah } from './sesi-state.ts';
import { buatJuruSuara } from './sesi-state.ts';
import type { Layar, Aksi } from './sesi-state.ts';

const RESEP = { gerakan: ['jangkau_depan', 'jangkau_samping'] as const, repetisi: 3 };

// Helper: jalankan serangkaian aksi berurutan
function jalankan(awal: Layar, aksi: Aksi[]): { layar: Layar; keluar: boolean } {
  let hasil = { layar: awal, keluar: false };
  for (const a of aksi) {
    hasil = langkah(hasil.layar, a, RESEP);
  }
  return hasil;
}

describe('sesi-state', () => {
  // ── mulaiLayar ──────────────────────────────────────────────────────────

  it('mulaiLayar false → mulai', () => {
    assert.equal(mulaiLayar(false).nama, 'mulai');
  });

  it('mulaiLayar true → kamera', () => {
    assert.equal(mulaiLayar(true).nama, 'kamera');
  });

  // ── alur normal ─────────────────────────────────────────────────────────

  it('alur normal: mulai → kamera → panduan → kalibrasi → gerakan', () => {
    const awal = mulaiLayar(false);
    const { layar: l1 } = langkah(awal, { t: 'suaraSiap' }, RESEP);
    assert.equal(l1.nama, 'kamera');

    const { layar: l2 } = langkah(l1, { t: 'kameraSiap' }, RESEP);
    assert.equal(l2.nama, 'panduan');

    const { layar: l3 } = langkah(l2, { t: 'siap' }, RESEP);
    assert.equal(l3.nama, 'kalibrasi');

    const { layar: l4 } = langkah(l3, { t: 'kalibrasi', ok: true }, RESEP);
    assert.equal(l4.nama, 'gerakan');
    assert.equal(l4.gerakanKe, 0);
  });

  // ── kalibrasi gagal ─────────────────────────────────────────────────────

  it('kalibrasi gagal 2× tetap kalibrasi', () => {
    const awal = mulaiLayar(false);
    const { layar } = jalankan(awal, [
      { t: 'suaraSiap' }, { t: 'kameraSiap' }, { t: 'siap' },
      { t: 'kalibrasi', ok: false },
      { t: 'kalibrasi', ok: false },
    ]);
    assert.equal(layar.nama, 'kalibrasi');
    assert.equal(layar.gagalKalibrasi, 2);
  });

  it('kalibrasi gagal 3× → panduan dengan bantuan, gagalKalibrasi reset', () => {
    const awal = mulaiLayar(false);
    const { layar } = jalankan(awal, [
      { t: 'suaraSiap' }, { t: 'kameraSiap' }, { t: 'siap' },
      { t: 'kalibrasi', ok: false },
      { t: 'kalibrasi', ok: false },
      { t: 'kalibrasi', ok: false },
    ]);
    assert.equal(layar.nama, 'panduan');
    assert.equal(layar.bantuan, true);
    assert.equal(layar.gagalKalibrasi, 0);
  });

  // ── repetisi dan istirahat ──────────────────────────────────────────────

  it('repetisi selesai gerakan pertama → istirahat', () => {
    const awal = mulaiLayar(false);
    const { layar } = jalankan(awal, [
      { t: 'suaraSiap' }, { t: 'kameraSiap' }, { t: 'siap' },
      { t: 'kalibrasi', ok: true },
      { t: 'repetisi', hitungan: 3 },
    ]);
    assert.equal(layar.nama, 'istirahat');
  });

  it('istirahatSelesai → gerakan berikutnya dengan gerakanKe 1 dan hitungan 0', () => {
    const awal = mulaiLayar(false);
    const { layar } = jalankan(awal, [
      { t: 'suaraSiap' }, { t: 'kameraSiap' }, { t: 'siap' },
      { t: 'kalibrasi', ok: true },
      { t: 'repetisi', hitungan: 3 },
      { t: 'istirahatSelesai' },
    ]);
    assert.equal(layar.nama, 'gerakan');
    assert.equal(layar.gerakanKe, 1);
    assert.equal(layar.hitungan, 0);
  });

  it('repetisi selesai gerakan terakhir → ringkasan', () => {
    const awal = mulaiLayar(false);
    const { layar } = jalankan(awal, [
      { t: 'suaraSiap' }, { t: 'kameraSiap' }, { t: 'siap' },
      { t: 'kalibrasi', ok: true },
      { t: 'repetisi', hitungan: 3 },
      { t: 'istirahatSelesai' },
      { t: 'repetisi', hitungan: 3 },
    ]);
    assert.equal(layar.nama, 'ringkasan');
  });

  // ── berhenti ────────────────────────────────────────────────────────────

  it('berhenti dengan totalRep >= 1 → ringkasan, keluar false', () => {
    const awal = mulaiLayar(false);
    const { layar, keluar } = jalankan(awal, [
      { t: 'suaraSiap' }, { t: 'kameraSiap' }, { t: 'siap' },
      { t: 'kalibrasi', ok: true },
      { t: 'repetisi', hitungan: 2 },
      { t: 'berhenti' },
    ]);
    assert.equal(layar.nama, 'ringkasan');
    assert.equal(keluar, false);
  });

  it('berhenti dengan totalRep 0 → keluar true', () => {
    const awal = mulaiLayar(false);
    const { keluar } = jalankan(awal, [
      { t: 'suaraSiap' }, { t: 'kameraSiap' }, { t: 'siap' },
      { t: 'kalibrasi', ok: true },
      { t: 'berhenti' },
    ]);
    assert.equal(keluar, true);
  });

  // ── totalRep ────────────────────────────────────────────────────────────

  it('totalRep bertambah per repetisi', () => {
    const awal = mulaiLayar(false);
    const { layar } = jalankan(awal, [
      { t: 'suaraSiap' }, { t: 'kameraSiap' }, { t: 'siap' },
      { t: 'kalibrasi', ok: true },
      { t: 'repetisi', hitungan: 3 },
      { t: 'istirahatSelesai' },
      { t: 'repetisi', hitungan: 2 },
    ]);
    // gerakan 1: 3 rep, gerakan 2: 2 rep → total 5
    assert.equal(layar.totalRep, 5);
  });
});

describe('juru suara', () => {
  // ── mode penuh ──────────────────────────────────────────────────────────

  it('mode penuh: repetisi bagus → [N-k, I-BAGUS]', () => {
    const juru = buatJuruSuara('penuh');
    const hasil = juru({ jenis: 'repetisi', hitungan: 4, bagus: true } as any, 0);
    const kodes = hasil.map(h => h.kode);
    assert.ok(kodes.includes('N-4' as any));
    assert.ok(kodes.includes('I-BAGUS'));
  });

  it('mode penuh: repetisi tidak bagus → hanya [N-k]', () => {
    const juru = buatJuruSuara('penuh');
    const hasil = juru({ jenis: 'repetisi', hitungan: 4, bagus: false } as any, 0);
    const kodes = hasil.map(h => h.kode);
    assert.ok(kodes.includes('N-4' as any));
    assert.ok(!kodes.includes('I-BAGUS'));
    assert.equal(hasil.length, 1);
  });

  it('mode penuh: koreksi → [{kode, prioritas: true}]', () => {
    const juru = buatJuruSuara('penuh');
    const hasil = juru({ jenis: 'koreksi', kode: 'K-MIRING', tDeteksi: 0 } as any, 0);
    assert.equal(hasil.length, 1);
    assert.equal(hasil[0].kode, 'K-MIRING');
    assert.equal(hasil[0].prioritas, true);
  });

  // ── mode mati ───────────────────────────────────────────────────────────

  it('mode mati: repetisi bagus → hanya [N-k]', () => {
    const juru = buatJuruSuara('mati');
    const hasil = juru({ jenis: 'repetisi', hitungan: 4, bagus: true } as any, 0);
    assert.equal(hasil.length, 1);
    assert.equal(hasil[0].kode, 'N-4' as any);
  });

  it('mode mati: koreksi → []', () => {
    const juru = buatJuruSuara('mati');
    const hasil = juru({ jenis: 'koreksi', kode: 'K-MIRING' } as any, 0);
    assert.equal(hasil.length, 0);
  });

  // ── gating ──────────────────────────────────────────────────────────────

  it('gating aktif pertama kali → [I-GATING]', () => {
    const juru = buatJuruSuara('penuh');
    const hasil = juru({ jenis: 'gating', aktif: true, t: 0 } as any, 0);
    assert.equal(hasil[0]?.kode, 'I-GATING');
  });

  it('gating aktif lagi dalam 5 dtk → []', () => {
    const juru = buatJuruSuara('penuh');
    juru({ jenis: 'gating', aktif: true, t: 0 } as any, 0);
    const hasil = juru({ jenis: 'gating', aktif: true, t: 0 } as any, 3000);
    assert.equal(hasil.length, 0);
  });

  it('gating aktif setelah 5 dtk → [I-GATING] lagi', () => {
    const juru = buatJuruSuara('penuh');
    juru({ jenis: 'gating', aktif: true, t: 0 } as any, 0);
    const hasil = juru({ jenis: 'gating', aktif: true, t: 0 } as any, 5000);
    assert.equal(hasil[0]?.kode, 'I-GATING');
  });

  it('gating tidak aktif → []', () => {
    const juru = buatJuruSuara('penuh');
    const hasil = juru({ jenis: 'gating', aktif: false, t: 0 } as any, 0);
    assert.equal(hasil.length, 0);
  });

  it('event sampel → []', () => {
    const juru = buatJuruSuara('penuh');
    const hasil = juru({ jenis: 'sampel' } as any, 0);
    assert.equal(hasil.length, 0);
  });
});
