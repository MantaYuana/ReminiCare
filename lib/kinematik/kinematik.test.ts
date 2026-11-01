// lib/kinematik/kinematik.test.ts
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { koefButterworth, buatBiquad, filtfilt, buatResampler, keSampel } from './sinyal.ts';
import { kalibrasi } from './fitur.ts';
import { buatMesin, agregatSesi } from './mesin.ts';
import type { FrameMentah, EventMesin, KonfigSesi, HasilRepetisi, Gerakan, Toleransi, ModeKoreksi, KalimatCondong, Kandidat } from './tipe.ts';

export type Ubah = {
  swKali?: number;
  tinggiKali?: number;
  dp?: number;
  panggulY?: number;
  bahuDx?: number;
};

export function acak(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 0xffffffff) * 0.004 - 0.002;
  };
}

export function frame(t: number, u: Ubah, r: () => number): FrameMentah {
  const W = 640;
  const H = 480;
  const swKali = u.swKali ?? 1;
  const tinggiKali = u.tinggiKali ?? 1;
  const bahuDx = u.bahuDx ?? 0;
  const cx = 0.5 + bahuDx;
  const yH = u.panggulY ?? 0.75;
  const yS = yH - 0.35 * tinggiKali;
  const dp = u.dp ?? 0;

  const lm = Array.from({ length: 33 }, () => ({ x: 0.5 + r(), y: 0.5 + r(), visibility: 0.9 }));
  lm[11] = { x: cx - 0.1 * swKali + r(), y: yS + r(), visibility: 0.9 };
  lm[12] = { x: cx + 0.1 * swKali + r(), y: yS + r(), visibility: 0.9 };
  lm[23] = { x: 0.42 + r(), y: yH + r(), visibility: 0.9 };
  lm[24] = { x: 0.58 + r(), y: yH + r(), visibility: 0.9 };
  lm[8]  = { x: cx + 0.05 + r(), y: yS - 0.12 + r(), visibility: 0.9 };
  lm[14] = { x: 0.62 + r(), y: yS + 0.15 + r(), visibility: 0.9 };
  lm[16] = { x: 0.6 + r(), y: 0.7 - dp * 0.2667 + r(), visibility: 0.9 };

  const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  world[11] = { x: -0.15, y: -0.5, z: 0 };
  world[12] = { x: 0.15, y: -0.5, z: 0 };

  return { t, W, H, lm, world };
}

const rInit = acak(7);
const diamInit = Array.from({ length: 150 }, (_, i) => frame(i * 33, {}, rInit));
const kalibRes = kalibrasi(diamInit, 'kanan');
assert.ok(kalibRes.ok);
const b = kalibRes.baseline;

const cfg: KonfigSesi = {
  sisi: 'kanan',
  durasiPersen: 30,
  tolBatang: 'normal',
  tolBahu: 'normal',
  mode: 'penuh',
  kalimat: 'sandaran',
  kandidat: 'a',
  suaraCondong: true,
};

const kondong = { swKali: 1.08, tinggiKali: 0.94 };

let r = acak(1);
let m = buatMesin(cfg, b);

beforeEach(() => {
  r = acak(1);
  m = buatMesin(cfg, b);
  m.mulaiGerakan('jangkau_depan');
});

export function jalankan(
  mesin: ReturnType<typeof buatMesin>,
  dariMs: number,
  sampaiMs: number,
  u: (t: number) => Ubah,
): EventMesin[] {
  const evs: EventMesin[] = [];
  for (let t = dariMs; t <= sampaiMs; t += 33) {
    evs.push(...mesin.dorong(frame(t, u(t), r)));
  }
  evs.push(...mesin.akhiri());
  return evs;
}

test('1: netral 10 dtk → 0 koreksi, batang tidak pernah true', () => {
  const ev = jalankan(m, 5000, 15000, () => ({}));
  assert.equal(ev.filter(e => e.jenis === 'koreksi').length, 0);
  assert.ok(ev.every(e => e.jenis !== 'sampel' || !e.penanda.batang));
});

test('2: condong buatan → batang true untuk kandidat a dan c', () => {
  for (const kandidat of ['a', 'c'] as const) {
    const ev = jalankan(buatMesin({ ...cfg, kandidat }, b), 5000, 7000, () => kondong);
    assert.ok(ev.some(e => e.jenis === 'sampel' && e.penanda.batang), kandidat);
  }
});

test('3: sinus dp 15 dtk + diam 1 dtk → tepat 5 repetisi; bagus hanya di hitungan 3 (Penuh), tidak ada di Mati', () => {
  const dp = (t: number) => (t < 20000 ? 0.4 * (1 - Math.cos((2 * Math.PI * (t - 5000)) / 3000)) : 0);
  const rep = jalankan(m, 5000, 21000, t => ({ dp: dp(t) })).filter(e => e.jenis === 'repetisi');
  assert.equal(rep.length, 5);
  assert.deepEqual(rep.map(e => e.bagus), [false, false, true, false, false]);
  const mati = jalankan(buatMesin({ ...cfg, mode: 'mati' }, b), 5000, 21000, t => ({ dp: dp(t) }));
  assert.ok(mati.every(e => e.jenis !== 'repetisi' || !e.bagus) && mati.every(e => e.jenis !== 'koreksi'));
});

test('4: satu repetisi lambat 6 dtk, condong on/off/on 500 ms → tepat 1 koreksi, tersimpan di hasil', () => {
  const dp = (t: number) => (t < 11000 ? 0.4 * (1 - Math.cos((2 * Math.PI * (t - 5000)) / 6000)) : 0);
  const kon = (t: number) => (t >= 6500 && t < 7000) || (t >= 7500 && t < 8000);
  const ev = jalankan(m, 5000, 12000, t => ({ dp: dp(t), ...(kon(t) ? kondong : {}) }));
  assert.equal(ev.filter(e => e.jenis === 'koreksi').length, 1);
  assert.equal(m.hasil()[0].koreksi?.kode, 'K-CONDONG-S');
});

test('5: condong saat panggul y = 1,05 → 0 koreksi', () => {
  const dp = (t: number) => (t < 11000 ? 0.4 * (1 - Math.cos((2 * Math.PI * (t - 5000)) / 6000)) : 0);
  const ev = jalankan(m, 5000, 12000, t => ({ dp: dp(t), ...kondong, panggulY: 1.05 }));
  assert.equal(ev.filter(e => e.jenis === 'koreksi').length, 0);
});

test('6: biquad + filtfilt pada deret konstan tetap konstan; koefisien §6.3', () => {
  const k = koefButterworth(5, 30);
  assert.ok(Math.abs(k.b0 - 0.1550510) < 1e-6 && Math.abs(k.b1 - 0.3101021) < 1e-6);
  assert.ok(Math.abs(k.a1 + 0.6202041) < 1e-6 && Math.abs(k.a2 - 0.2404082) < 1e-6);
  const bq = buatBiquad(k);
  for (let i = 0; i < 50; i++) assert.ok(Math.abs(bq(3.7) - 3.7) < 1e-9);
  for (const y of filtfilt(Array(40).fill(3.7), k)) assert.ok(Math.abs(y - 3.7) < 1e-9);
});

test('7: kalibrasi — diam ok, bahu berosilasi 0,05·SW → gerak', () => {
  const r7 = acak(7);
  const diam = Array.from({ length: 150 }, (_, i) => frame(i * 33, {}, r7));
  const ok = kalibrasi(diam, 'kanan');
  assert.ok(ok.ok && Math.abs(ok.baseline.SW0 - 128) < 2 && Math.abs(ok.baseline.h0 - 168 / 128) < 0.03);
  const goyang = Array.from({ length: 150 }, (_, i) =>
    frame(i * 33, { bahuDx: 0.01 * Math.sin((2 * Math.PI * i * 33) / 1000) }, r7));
  assert.deepEqual(kalibrasi(goyang, 'kanan'), { ok: false, alasan: 'gerak' });
});

test('gating: panggul keluar 2 dtk lalu kembali → event gating aktif lalu lepas', () => {
  const ev = jalankan(m, 5000, 10000, t => (t >= 6000 && t < 8000 ? { panggulY: 1.05 } : {}));
  assert.deepEqual(ev.filter(e => e.jenis === 'gating').map(e => e.aktif), [true, false]);
});

test('sampel: maksimal 1 event per dorong()', () => {
  for (let t = 5000; t < 6000; t += 33) assert.ok(m.dorong(frame(t, {}, r)).filter(e => e.jenis === 'sampel').length <= 1);
});

const sampelDari = (ev: EventMesin[]) => ev.flatMap(e => (e.jenis === 'sampel' ? [e] : []));

test('tingkat: >= 1 tepat saat penanda batang menyala, di bawah 0,5 saat netral', () => {
  const sampel = sampelDari(jalankan(m, 5000, 15000, t => (t >= 8000 ? kondong : {})));
  assert.ok(sampel.some(e => e.tingkat.batang! >= 1));
  assert.ok(sampel.every(e => (e.tingkat.batang! >= 1) === e.penanda.batang));
  assert.ok(sampel.filter(e => e.t < 8000).every(e => e.tingkat.batang! < 0.5));
});

test('tingkat: null bila mode Mati, atau toleransi batang Abaikan', () => {
  const mati = sampelDari(jalankan(buatMesin({ ...cfg, mode: 'mati' }, b), 5000, 7000, () => kondong));
  assert.ok(mati.every(e => e.tingkat.batang === null && e.tingkat.bahu === null));
  const abaikan = sampelDari(jalankan(buatMesin({ ...cfg, tolBatang: 'abaikan' }, b), 5000, 7000, () => kondong));
  assert.ok(abaikan.every(e => e.tingkat.batang === null && e.tingkat.bahu !== null));
});

test('celah 2 dtk tidak diinterpolasi', () => {
  const rs = buatResampler();
  rs.dorong(keSampel(frame(0, {}, r), 'kanan', null));
  assert.equal(rs.dorong(keSampel(frame(2000, { dp: 0.8 }, r), 'kanan', null)).length, 0);
});

const repDasar: HasilRepetisi = {
  gerakan: 'jangkau_depan',
  ke: 1,
  tMulai: 0,
  tSelesai: 1000,
  terukur: true,
  fraksiTergating: 0,
  fraksi: { condongA: 0, condongB: 0, condongC: 0, miring: 0, el: 0, batang: 0, bahu: 0 },
  fraksiBatangKandidat: { a: 0, b: 0, c: 0 },
  kompensasi: { batang: false, bahu: false },
  terkompensasi: false,
  puncak: { w: 0, d: 0, r: 0, zb: 0, dTheta: 0, el: 0, dTheta3d: 0 },
  waktuGerak10: 1,
  waktuGerak5: 1.1,
  vPuncak: 0.5,
  nPuncak: 1,
  koreksi: null,
  visPanggulMin: 0.9,
  visPanggulMed: 0.9,
  panggulMin: { x: 0, y: 0 },
  panggulMaks: { x: 1, y: 1 },
};

const tiga: HasilRepetisi[] = [
  { ...repDasar, ke: 1, terukur: true, kompensasi: { batang: true, bahu: false }, terkompensasi: true },
  { ...repDasar, ke: 2, terukur: true, kompensasi: { batang: false, bahu: false }, terkompensasi: false },
  { ...repDasar, ke: 3, terukur: false, kompensasi: { batang: true, bahu: false }, terkompensasi: false },
];

const dasarAgregat = {
  id: 'sesi-1',
  pasienId: 'p1',
  mulai: '2026-11-01T00:00:00.000Z',
  selesai: '2026-11-01T00:05:00.000Z',
  resep: {
    gerakan: ['jangkau_depan' as Gerakan],
    repetisi: 10,
    sesi_per_minggu: 3,
    toleransi_batang: 'normal' as Toleransi,
    toleransi_bahu: 'normal' as Toleransi,
    durasi_persen: 30,
    mode_koreksi: 'penuh' as ModeKoreksi,
    kalimat_condong: 'sandaran' as KalimatCondong,
    kandidat_condong: 'a' as Kandidat,
    suara_condong: true,
    ambang_versi: 'awal',
  },
  baseline: { SW0: 128, h0: 1.3, theta0: 0, e0: 0.3, R0: { x: 0, y: 0 }, zS0: 0, T0: 0.5, theta3d0: 0 },
  fpsMedian: 30,
  suara: 'klip' as const,
  delegate: 'GPU' as const,
};

test('agregatSesi: per_penanda = jumlah repetisi terukur yang terkompensasi per penanda', () => {
  assert.deepEqual(agregatSesi({ ...dasarAgregat, hasil: tiga }).per_gerakan.jangkau_depan.per_penanda, { batang: 1, bahu: 0 });
});
