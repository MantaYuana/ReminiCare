// lib/suara.test.ts — failing tests first
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pilihSuara, adalahIOS, buatAntreanSuara } from './suara.ts';

describe('suara', () => {
  // ── pilihSuara ────────────────────────────────────────────────────────

  it('pilihSuara mengabaikan suara jaringan', () => {
    assert.equal(pilihSuara([{ lang: 'id-ID', localService: false }]), -1);
  });

  it('pilihSuara mengabaikan suara non-id', () => {
    assert.equal(pilihSuara([{ lang: 'en-US', localService: true }]), -1);
  });

  it('pilihSuara memilih id lokal pertama', () => {
    assert.equal(
      pilihSuara([
        { lang: 'en-US', localService: true },
        { lang: 'id-ID', localService: true },
      ]),
      1,
    );
  });

  it('pilihSuara menerima lang id- apapun selama lokal', () => {
    assert.equal(pilihSuara([{ lang: 'id', localService: true }]), 0);
  });

  // ── adalahIOS ─────────────────────────────────────────────────────────

  it('adalahIOS benar untuk iPhone UA', () => {
    assert.equal(
      adalahIOS({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
      }),
      true,
    );
  });

  it('adalahIOS benar untuk MacIntel dengan maxTouchPoints > 1 (iPad)', () => {
    assert.equal(
      adalahIOS({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 }),
      true,
    );
  });

  it('adalahIOS salah untuk MacIntel tanpa touchPoints', () => {
    assert.equal(
      adalahIOS({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 }),
      false,
    );
  });

  it('adalahIOS salah untuk Android', () => {
    assert.equal(
      adalahIOS({
        userAgent: 'Mozilla/5.0 (Linux; Android 14)',
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      }),
      false,
    );
  });

  // ── buatAntreanSuara ──────────────────────────────────────────────────

  it('antrean suara FIFO', () => {
    const q = buatAntreanSuara<string>();
    q.masuk('a');
    q.masuk('b');
    assert.equal(q.ambil(), 'a');
    assert.equal(q.ambil(), 'b');
    assert.equal(q.ambil(), undefined);
  });

  it('prioritas masuk ke depan tanpa memotong yang sedang diputar', () => {
    const q = buatAntreanSuara<string>();
    q.masuk('a');
    q.masuk('b');
    q.masuk('c', true); // prioritas → depan, tapi tidak mendahului 'a' yang sudah ada
    // urutan: a (sudah ada duluan di depan), c, b
    // 'c' masuk ke posisi 1 (setelah a, sebelum b)
    assert.equal(q.ambil(), 'a');
    assert.equal(q.ambil(), 'c');
    assert.equal(q.ambil(), 'b');
  });

  it('panjang antrean benar', () => {
    const q = buatAntreanSuara<number>();
    assert.equal(q.panjang(), 0);
    q.masuk(1);
    q.masuk(2);
    assert.equal(q.panjang(), 2);
    q.ambil();
    assert.equal(q.panjang(), 1);
  });
});
