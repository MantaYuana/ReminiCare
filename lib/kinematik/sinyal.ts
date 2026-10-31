// lib/kinematik/sinyal.ts
// Signal processing: frame conversion, resampling, Butterworth filter, filtfilt.

import {
  type FrameMentah, type Sampel, type Kunci, type Titik3, type P2,
  HZ, IDX, idxK,
} from './tipe.ts';
import type { Sisi } from './tipe.ts';

// ── keSampel ──────────────────────────────────────────────────────────────

function tengah(a: Titik3, b: Titik3): Titik3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function jarak3(a: Titik3, b: Titik3): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

export function keSampel(f: FrameMentah, sisi: Sisi, sebelum: Sampel | null): Sampel {
  const { W, H, lm, world, t } = f;

  // Bila tidak ada pose, tahan posisi dari frame sebelumnya
  if (!lm || !world) {
    const kosong: P2 = { x: 0, y: 0 };
    const kosong3: Titik3 = { x: 0, y: 0, z: 0 };
    if (sebelum) {
      return { ...sebelum, t, diDalam: false, skor: 0 };
    }
    const p: Record<Kunci, P2> = {
      telingaT: kosong, bahuKi: kosong, bahuKa: kosong,
      sikuT: kosong, pergelanganT: kosong, panggulKi: kosong, panggulKa: kosong,
    };
    return { t, p, S3: kosong3, H3: kosong3, diDalam: false, skor: 0, visPanggul: 0, panggulN: kosong };
  }




  const p: Record<Kunci, P2> = {
    telingaT:     { x: lm[IDX.telinga[sisi]].x * W,     y: lm[IDX.telinga[sisi]].y * H },
    bahuKi:       { x: lm[IDX.bahu.kiri].x * W,          y: lm[IDX.bahu.kiri].y * H },
    bahuKa:       { x: lm[IDX.bahu.kanan].x * W,         y: lm[IDX.bahu.kanan].y * H },
    sikuT:        { x: lm[IDX.siku[sisi]].x * W,         y: lm[IDX.siku[sisi]].y * H },
    pergelanganT: { x: lm[IDX.pergelangan[sisi]].x * W,  y: lm[IDX.pergelangan[sisi]].y * H },
    panggulKi:    { x: lm[IDX.panggul.kiri].x * W,       y: lm[IDX.panggul.kiri].y * H },
    panggulKa:    { x: lm[IDX.panggul.kanan].x * W,      y: lm[IDX.panggul.kanan].y * H },
  };

  // diDalam: semua kunci K ada di [0,1]
  const kIdx = idxK(sisi);
  let diDalam = true;
  let minVis = 1;
  for (const i of kIdx) {
    const lmI = lm[i];
    if (lmI.x < 0 || lmI.x > 1 || lmI.y < 0 || lmI.y > 1) { diDalam = false; }
    const v = lmI.visibility ?? 0;
    if (v < minVis) minVis = v;
  }

  const bahuKiW  = world[IDX.bahu.kiri];
  const bahuKaW  = world[IDX.bahu.kanan];
  const panggulKiW = world[IDX.panggul.kiri];
  const panggulKaW = world[IDX.panggul.kanan];
  const S3 = tengah(bahuKiW, bahuKaW);
  const H3 = tengah(panggulKiW, panggulKaW);

  const visPanggul = Math.min(
    lm[IDX.panggul.kiri].visibility ?? 0,
    lm[IDX.panggul.kanan].visibility ?? 0,
  );
  const panggulN: P2 = {
    x: (lm[IDX.panggul.kiri].x + lm[IDX.panggul.kanan].x) / 2,
    y: (lm[IDX.panggul.kiri].y + lm[IDX.panggul.kanan].y) / 2,
  };

  return { t, p, S3, H3, diDalam, skor: minVis, visPanggul, panggulN };
}

// ── Resampler 30 Hz ───────────────────────────────────────────────────────

function lerpP2(a: P2, b: P2, alpha: number): P2 {
  return { x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha };
}

function lerpT3(a: Titik3, b: Titik3, alpha: number): Titik3 {
  return {
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha,
    z: a.z + (b.z - a.z) * alpha,
  };
}

function lerpSampel(a: Sampel, b: Sampel, alpha: number): Sampel {
  const p = {} as Record<Kunci, P2>;
  for (const k of Object.keys(a.p) as Kunci[]) {
    p[k] = lerpP2(a.p[k], b.p[k], alpha);
  }
  return {
    t: a.t + (b.t - a.t) * alpha,
    p,
    S3: lerpT3(a.S3, b.S3, alpha),
    H3: lerpT3(a.H3, b.H3, alpha),
    diDalam: a.diDalam && b.diDalam,
    skor: Math.min(a.skor, b.skor),
    visPanggul: Math.min(a.visPanggul, b.visPanggul),
    panggulN: lerpP2(a.panggulN, b.panggulN, alpha),
  };
}

export function buatResampler(hz = HZ): { dorong(s: Sampel): Sampel[] } {
  const dt = 1000 / hz;
  let prev: Sampel | null = null;
  let t0: number | null = null;
  let k = 0;

  return {
    dorong(cur: Sampel): Sampel[] {
      const hasil: Sampel[] = [];
      if (prev === null) { prev = cur; t0 = cur.t; k = 0; return hasil; }

      // Generate grid points that fall in (prev.t, cur.t]
      while (true) {
        const tGrid = t0! + (k + 1) * dt;
        if (tGrid > cur.t) break;
        const alpha = (tGrid - prev.t) / (cur.t - prev.t);
        const s = lerpSampel(prev, cur, alpha);
        s.t = tGrid;
        hasil.push(s);
        k++;
      }
      prev = cur;
      return hasil;
    },
  };
}

// ── Filter Butterworth ────────────────────────────────────────────────────

export type Koef = { b0: number; b1: number; b2: number; a1: number; a2: number };

export function koefButterworth(fc: number, fs: number): Koef {
  const K = Math.tan(Math.PI * fc / fs);
  const K2 = K * K;
  const sq2 = Math.SQRT2;
  const n = 1 / (1 + sq2 * K + K2);
  return {
    b0: K2 * n,
    b1: 2 * K2 * n,
    b2: K2 * n,
    a1: 2 * (K2 - 1) * n,
    a2: (1 - sq2 * K + K2) * n,
  };
}

export function buatBiquad(k: Koef): (x: number) => number {
  // State awal = mantap pada nilai x₀ pertama (diisi pada panggilan pertama)
  let z1 = 0, z2 = 0;
  let pertama = true;
  return (x: number) => {
    if (pertama) {
      // Kondisi mantap: z1 = (b1+b2-a1-a2)*x, z2 = (b2-a2)*x
      z1 = (k.b1 + k.b2 - k.a1 - k.a2) * x;
      z2 = (k.b2 - k.a2) * x;
      pertama = false;
    }
    const y = k.b0 * x + z1;
    z1 = k.b1 * x - k.a1 * y + z2;
    z2 = k.b2 * x - k.a2 * y;
    return y;
  };
}

// Filter per koordinat Sampel
export function buatFilterSampel(k: Koef): (s: Sampel) => Sampel {
  const filters: Record<string, (x: number) => number> = {};

  function f(key: string): (x: number) => number {
    if (!filters[key]) filters[key] = buatBiquad(k);
    return filters[key];
  }

  return (s: Sampel): Sampel => {
    const p = {} as Record<Kunci, P2>;
    for (const kunci of Object.keys(s.p) as Kunci[]) {
      p[kunci] = {
        x: f(`${kunci}.x`)(s.p[kunci].x),
        y: f(`${kunci}.y`)(s.p[kunci].y),
      };
    }
    return {
      ...s,
      p,
      S3: { x: f('S3.x')(s.S3.x), y: f('S3.y')(s.S3.y), z: f('S3.z')(s.S3.z) },
      H3: { x: f('H3.x')(s.H3.x), y: f('H3.y')(s.H3.y), z: f('H3.z')(s.H3.z) },
    };
  };
}

// filtfilt: zero-phase offline (untuk nilaiRepetisi)
export function filtfilt(xs: number[], k: Koef): number[] {
  if (xs.length === 0) return [];
  const PAD = 15;

  // Pad pantul: cermin awal dan akhir
  const padded: number[] = [];
  for (let i = PAD; i >= 1; i--) padded.push(xs[Math.min(i, xs.length - 1)]);
  padded.push(...xs);
  for (let i = xs.length - 2; i >= xs.length - 1 - PAD; i--) padded.push(xs[Math.max(i, 0)]);

  function filterForward(data: number[]): number[] {
    const bq = buatBiquad(k);
    return data.map(x => bq(x));
  }

  const maju = filterForward(padded);
  const balik = filterForward([...maju].reverse());
  const hasil = balik.reverse();

  return hasil.slice(PAD, PAD + xs.length);
}
