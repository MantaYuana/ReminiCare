// lib/naskah.test.ts — failing tests first
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NASKAH, KODE_WAJIB, teksSetuju } from './naskah.ts';

describe('naskah', () => {
  it('N-1 sampai N-20 berupa kata', () => {
    assert.equal(NASKAH['N-1'],  'satu');
    assert.equal(NASKAH['N-5'],  'lima');
    assert.equal(NASKAH['N-10'], 'sepuluh');
    assert.equal(NASKAH['N-20'], 'dua puluh');
    for (let k = 1; k <= 20; k++) {
      assert.ok(
        typeof NASKAH[`N-${k}`] === 'string' && NASKAH[`N-${k}`].trim().length > 0,
        `N-${k} harus ada dan tidak kosong`,
      );
    }
  });

  it('semua kode wajib punya teks tidak kosong', () => {
    for (const kode of KODE_WAJIB) {
      assert.ok(
        typeof NASKAH[kode] === 'string' && NASKAH[kode].trim().length > 0,
        `KODE_WAJIB "${kode}" harus ada di NASKAH dan tidak kosong`,
      );
    }
  });

  it('KODE_WAJIB berisi tepat kode yang diharapkan', () => {
    const DIHARAPKAN = [
      'K-CONDONG-S', 'K-CONDONG-T', 'K-MIRING', 'K-BAHU',
      'I-MULAI', 'I-POSISI', 'I-KAMERA', 'I-BINGKAI', 'I-GATING',
      'I-KALIB', 'I-KALIB-OK', 'I-KALIB-ULANG',
      'I-G1', 'I-G2', 'I-ISTIRAHAT', 'I-BAGUS',
      'R-BAIK', 'R-CUKUP', 'R-KURANG',
      'I-SELESAI', 'I-NYERI',
    ];
    for (const kode of DIHARAPKAN) {
      assert.ok(KODE_WAJIB.includes(kode), `"${kode}" harus ada di KODE_WAJIB`);
    }
    // Tidak boleh ada kode I-SETUJU-* atau N-* di KODE_WAJIB
    for (const kode of KODE_WAJIB) {
      assert.ok(!kode.startsWith('I-SETUJU'), 'I-SETUJU tidak boleh ada di KODE_WAJIB');
      assert.ok(!kode.startsWith('N-'), 'N-* tidak boleh ada di KODE_WAJIB');
    }
  });

  it('jumlah paragraf persetujuan sama dengan klip', () => {
    const paragraf = teksSetuju();
    assert.ok(paragraf.length >= 1, 'teksSetuju harus mengembalikan minimal 1 paragraf');
    for (let i = 1; i <= paragraf.length; i++) {
      assert.ok(
        typeof NASKAH[`I-SETUJU-${i}`] === 'string' && NASKAH[`I-SETUJU-${i}`].trim().length > 0,
        `I-SETUJU-${i} harus ada di NASKAH`,
      );
    }
    // teksSetuju() harus konsisten dengan NASKAH
    for (let i = 0; i < paragraf.length; i++) {
      assert.equal(paragraf[i], NASKAH[`I-SETUJU-${i + 1}`]);
    }
  });
});
