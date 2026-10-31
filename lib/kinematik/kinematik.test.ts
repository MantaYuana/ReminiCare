// lib/kinematik/kinematik.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { koefButterworth, buatBiquad, filtfilt } from './sinyal.ts';
import { kalibrasi } from './fitur.ts';
import { buatMesin } from './mesin.ts';
import type { FrameMentah, EventMesin } from './tipe.ts';

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

export function jalankan(
  m: ReturnType<typeof buatMesin>,
  dariMs: number,
  sampaiMs: number,
  u: (t: number) => Ubah,
  r: () => number,
): EventMesin[] {
  const evs: EventMesin[] = [];
  for (let t = dariMs; t <= sampaiMs; t += 33) {
    evs.push(...m.dorong(frame(t, u(t), r)));
  }
  evs.push(...m.akhiri());
  return evs;
}

test('6: biquad + filtfilt pada deret konstan tetap konstan; koefisien §6.3', () => {
  const k = koefButterworth(5, 30);
  assert.ok(Math.abs(k.b0 - 0.1550510) < 1e-6 && Math.abs(k.b1 - 0.3101021) < 1e-6);
  assert.ok(Math.abs(k.a1 + 0.6202041) < 1e-6 && Math.abs(k.a2 - 0.2404082) < 1e-6);
  const bq = buatBiquad(k);
  for (let i = 0; i < 50; i++) assert.ok(Math.abs(bq(3.7) - 3.7) < 1e-9);
  for (const y of filtfilt(Array(40).fill(3.7), k)) assert.ok(Math.abs(y - 3.7) < 1e-9);
});

test('7: kalibrasi — diam ok, bahu berosilasi 0,05·SW → gerak', () => {
  const r = acak(7);
  const diam = Array.from({ length: 150 }, (_, i) => frame(i * 33, {}, r));
  const ok = kalibrasi(diam, 'kanan');
  assert.ok(ok.ok && Math.abs(ok.baseline.SW0 - 128) < 2 && Math.abs(ok.baseline.h0 - 168 / 128) < 0.03);
  const goyang = Array.from({ length: 150 }, (_, i) =>
    frame(i * 33, { bahuDx: 0.01 * Math.sin((2 * Math.PI * i * 33) / 1000) }, r));
  assert.deepEqual(kalibrasi(goyang, 'kanan'), { ok: false, alasan: 'gerak' });
});
