// lib/uji.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KOLOM_CSV,
  setId,
  barisRep,
  barisStatis,
  keCsv,
  namaFile,
  type MetaSet,
} from './uji.ts';
import type { EventMesin, HasilRepetisi } from './kinematik/tipe.ts';

const meta: MetaSet = {
  subjek: 'S1',
  sisi: 'kanan',
  gerakan: 'jangkau_depan',
  label: 'condong',
  sudut: 20,
  posisi: 'depan',
  repInstruksi: 10,
  mode: 'penuh',
  durasiPersen: 30,
};

const hasilContoh: HasilRepetisi = {
  gerakan: 'jangkau_depan',
  ke: 1,
  tMulai: 1000,
  tSelesai: 4000,
  terukur: true,
  fraksiTergating: 0,
  fraksi: {
    condongA: 0.35,
    condongB: 0.1,
    condongC: 0.29,
    miring: 0.05,
    el: 0.4,
    batang: 0.35,
    bahu: 0.4,
  },
  fraksiBatangKandidat: { a: 0.35, b: 0.1, c: 0.29 },
  kompensasi: { batang: true, bahu: true },
  terkompensasi: true,
  puncak: { w: 0.1, d: 0.08, r: 0.09, zb: 0.2, dTheta: 5, el: 0.3, dTheta3d: 4 },
  waktuGerak10: 2.5,
  waktuGerak5: 2.8,
  vPuncak: 0.6,
  nPuncak: 1,
  koreksi: null,
  visPanggulMin: 0.9,
  visPanggulMed: 0.95,
  panggulMin: { x: 0.4, y: 0.7 },
  panggulMaks: { x: 0.6, y: 0.8 },
};

const ekstra = {
  waktuIso: '2026-11-01T05:30:00.000Z',
  fps: 30,
  delegate: 'GPU',
  jalurSuara: 'klip',
  latensiMs: 45,
};

function s(w: number, condongA: boolean): Extract<EventMesin, { jenis: 'sampel' }> {
  return {
    jenis: 'sampel',
    t: 1000,
    status: 'BERGERAK',
    gating: false,
    skor: 0.9,
    diDalam: true,
    fitur: { w, d: 0, r: 0, zb: 0, dTheta: 0, el: 0, dTheta3d: 0, dp: 0 },
    penanda: {
      condongA,
      condongB: false,
      condongC: false,
      miring: false,
      el: false,
      condong: condongA,
      batang: condongA,
      bahu: false,
    },
    tingkat: { batang: null, bahu: null },
  };
}

const kosong: Record<string, string | number> = Object.fromEntries(
  KOLOM_CSV.map(k => [k, '']),
);

test('KOLOM_CSV mengikuti spec §10.10', () => {
  assert.equal(KOLOM_CSV[0], 'waktu_iso');
  assert.equal(KOLOM_CSV.at(-1), 'panggul_y_maks');
  assert.equal(KOLOM_CSV.length, 49);
});

test('barisRep: kep_batang_x memakai fraksiBatangKandidat ≥ durasi/100; kep_bahu memakai fraksi.el', () => {
  const b = barisRep(meta, hasilContoh, ekstra);
  assert.deepEqual([b.kep_batang_a, b.kep_batang_b, b.kep_batang_c, b.kep_bahu], [1, 0, 0, 1]);
  assert.equal(b.tipe, 'rep');
  assert.equal(b.set_id, 'S1-jangkau_depan-condong-20');
});

test('barisStatis: median fitur dan fraksi aktif 3 dtk', () => {
  const iso = '2026-11-01T05:30:00.000Z';
  const b = barisStatis(meta, [s(0.1, true), s(0.3, false), s(0.2, true)], iso);
  assert.equal(b.w_puncak, 0.2);
  assert.ok(Math.abs(Number(b.fraksi_condong_a) - 2 / 3) < 1e-9);
  assert.equal(b.tipe, 'statis');
  assert.equal(b.rep_ke, '');
});

test('keCsv: header + kutip untuk koma/kutip', () => {
  const csv = keCsv([{ ...kosong, subjek: 'a,"b"' }]);
  assert.ok(csv.startsWith(KOLOM_CSV.join(',') + '\n') && csv.includes('"a,""b"""'));
});

test('namaFile', () => {
  assert.equal(namaFile('S1', 'depan', new Date(2026, 10, 1, 5, 30)), 'uji_S1_depan_20261101-0530.csv');
});
