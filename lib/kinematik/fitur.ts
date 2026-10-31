// lib/kinematik/fitur.ts
// Feature calculation, thresholds, pose markers, gating, and calibration.

import {
  type Sampel, type Baseline, type Fitur, type Ambang, type AmbangEfektif,
  type Penanda, type Kandidat, type Gerakan, type Toleransi, type Sisi,
  type FrameMentah, type HasilKalibrasi,
  AMBANG_AWAL, KALI_TOLERANSI, GATING, KALIB, HZ,
} from './tipe.ts';
import { keSampel, buatResampler, koefButterworth } from './sinyal.ts';

// ── hitungFitur ───────────────────────────────────────────────────────────

function jarakP2(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function sudutHS(H: { x: number; y: number }, S: { x: number; y: number }): number {
  return Math.atan2(S.x - H.x, H.y - S.y) * (180 / Math.PI);
}

export function hitungFitur(s: Sampel, b: Baseline, sisi: Sisi): Fitur {
  const { p, S3, H3 } = s;
  const SW = jarakP2(p.bahuKi, p.bahuKa);
  const tengahBahu = { x: (p.bahuKi.x + p.bahuKa.x) / 2, y: (p.bahuKi.y + p.bahuKa.y) / 2 };
  const tengahPanggul = { x: (p.panggulKi.x + p.panggulKa.x) / 2, y: (p.panggulKi.y + p.panggulKa.y) / 2 };
  const tinggi = Math.abs(tengahBahu.y - tengahPanggul.y);

  const w = SW / b.SW0 - 1;
  const d = 1 - (tinggi / b.SW0) / b.h0;
  const r = 1 - (tinggi / SW) / b.h0;
  const zb = (b.zS0 - S3.z) / b.T0;
  const dTheta = Math.abs(sudutHS(tengahPanggul, tengahBahu) - b.theta0);

  const bahuT = sisi === 'kiri' ? p.bahuKi : p.bahuKa;
  const e = (bahuT.y - p.telingaT.y) / b.SW0;
  const el = 1 - e / b.e0;

  const dTheta3d = Math.abs(
    Math.atan2(S3.x - H3.x, H3.y - S3.y) * (180 / Math.PI) - b.theta3d0,
  );
  const dp = jarakP2(p.pergelanganT, b.R0) / b.SW0;

  return { w, d, r, zb, dTheta, el, dTheta3d, dp };
}

// ── ambangEfektif ─────────────────────────────────────────────────────────

export function ambangEfektif(g: Gerakan, tolBatang: Toleransi, tolBahu: Toleransi): AmbangEfektif {
  const base = AMBANG_AWAL[g];
  const kB = KALI_TOLERANSI[tolBatang];
  const kH = KALI_TOLERANSI[tolBahu];
  return {
    tw:     kB !== null ? base.tw * kB : base.tw,
    td:     kB !== null ? base.td * kB : base.td,
    tr:     kB !== null ? base.tr * kB : base.tr,
    tz:     kB !== null ? base.tz * kB : base.tz,
    tTheta: kB !== null ? base.tTheta * kB : base.tTheta,
    tel:    kH !== null ? base.tel * kH : base.tel,
    batang: kB !== null,
    bahu:   kH !== null,
  };
}

// ── hitungPenanda ─────────────────────────────────────────────────────────

export function hitungPenanda(f: Fitur, a: AmbangEfektif, kandidat: Kandidat): Penanda {
  const condongA = f.w >= a.tw && f.d >= a.td;
  const condongB = f.zb >= a.tz;
  const condongC = f.r >= a.tr;
  const miring   = f.dTheta >= a.tTheta;
  const el       = f.el >= a.tel;

  const condong = kandidat === 'a' ? condongA : kandidat === 'b' ? condongB : condongC;
  const batang  = a.batang && (condong || miring);
  const bahu    = a.bahu && el;

  return { condongA, condongB, condongC, miring, el, condong, batang, bahu };
}

// ── Gating ────────────────────────────────────────────────────────────────

export function buatGating(): {
  dorong(t: number, diDalam: boolean, skor: number): { aktif: boolean; skorMedian: number };
} {
  const riwayat: { t: number; skor: number }[] = [];
  let aktif = false;
  let tMulaiKondisi = -Infinity;

  function median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  return {
    dorong(t, diDalam, skor) {
      // Jaga riwayat 1 detik terakhir
      const batas = t - GATING.jendelaMs;
      while (riwayat.length > 0 && riwayat[0].t < batas) riwayat.shift();
      riwayat.push({ t, skor });

      const skorMedian = median(riwayat.map(r => r.skor));
      const buruk = !diDalam || skorMedian < GATING.masuk;
      const baik  = diDalam && skorMedian >= GATING.lepas;

      if (!aktif) {
        if (buruk) {
          if (tMulaiKondisi < 0) tMulaiKondisi = t;
          if (t - tMulaiKondisi >= GATING.tahanMs) aktif = true;
        } else {
          tMulaiKondisi = -Infinity;
        }
      } else {
        if (baik) {
          if (tMulaiKondisi < 0) tMulaiKondisi = t;
          if (t - tMulaiKondisi >= GATING.tahanMs) { aktif = false; tMulaiKondisi = -Infinity; }
        } else {
          tMulaiKondisi = -Infinity;
        }
      }

      return { aktif, skorMedian };
    },
  };
}

// ── buatPemantau — untuk LayarPanduan ─────────────────────────────────────

export function buatPemantau(sisi: Sisi): {
  dorong(f: FrameMentah): { gating: boolean; skor: number; diDalam: boolean };
} {
  const gating = buatGating();
  let sebelum = null as ReturnType<typeof keSampel> | null;

  return {
    dorong(f) {
      const s = keSampel(f, sisi, sebelum);
      sebelum = s;
      const { aktif } = gating.dorong(s.t, s.diDalam, s.skor);
      return { gating: aktif, skor: s.skor, diDalam: s.diDalam };
    },
  };
}

// ── Kalibrasi ─────────────────────────────────────────────────────────────

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function sd(arr: number[], m: number): number {
  if (arr.length < 2) return 0;
  const v = arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

export function kalibrasi(frames: FrameMentah[], sisi: Sisi): HasilKalibrasi {
  // Resample tanpa filter
  const resampler = buatResampler(HZ);
  const sampelMentah = frames.map(f => keSampel(f, sisi, null));
  const ss: ReturnType<typeof keSampel>[] = [];
  for (const s of sampelMentah) ss.push(...resampler.dorong(s));

  if (ss.length === 0) return { ok: false, alasan: 'keyakinan' };

  // Cek keyakinan: min 50% sampel yakin
  const yakin = ss.filter(s => s.diDalam && s.skor >= 0.5);
  if (yakin.length / ss.length < KALIB.minFraksi) {
    return { ok: false, alasan: 'keyakinan' };
  }

  // Median SW untuk deteksi diam
  const swArr = yakin.map(s => {
    const p = s.p;
    return Math.sqrt((p.bahuKi.x - p.bahuKa.x) ** 2 + (p.bahuKi.y - p.bahuKa.y) ** 2);
  });
  const SWm = median(swArr);

  // Deteksi diam: SD posisi S dalam jendela 1 dtk < 0.02 * SWm
  const jendelaMs = KALIB.jendelaMs;
  const diam: ReturnType<typeof keSampel>[] = [];
  for (let i = 0; i < yakin.length; i++) {
    const cur = yakin[i];
    const jendela = yakin.filter(s => Math.abs(s.t - cur.t) <= jendelaMs / 2);
    const sxArr = jendela.map(s => (s.p.bahuKi.x + s.p.bahuKa.x) / 2);
    const syArr = jendela.map(s => (s.p.bahuKi.y + s.p.bahuKa.y) / 2);
    const mxS = median(sxArr); const myS = median(syArr);
    const sdS = Math.sqrt((sd(sxArr, mxS) ** 2 + sd(syArr, myS) ** 2) / 2);
    if (sdS < KALIB.sdMaks * SWm) diam.push(cur);
  }

  if (diam.length / ss.length < KALIB.minFraksi) {
    return { ok: false, alasan: 'gerak' };
  }

  // Hitung baseline dari sampel diam
  const swDiam = diam.map(s => Math.sqrt((s.p.bahuKi.x - s.p.bahuKa.x) ** 2 + (s.p.bahuKi.y - s.p.bahuKa.y) ** 2));
  const SW0 = median(swDiam);

  const tengahBahu = diam.map(s => ({ x: (s.p.bahuKi.x + s.p.bahuKa.x) / 2, y: (s.p.bahuKi.y + s.p.bahuKa.y) / 2 }));
  const tengahPanggul = diam.map(s => ({ x: (s.p.panggulKi.x + s.p.panggulKa.x) / 2, y: (s.p.panggulKi.y + s.p.panggulKa.y) / 2 }));
  const tinggiArr = diam.map((_, i) => Math.abs(tengahBahu[i].y - tengahPanggul[i].y));
  const h0 = median(tinggiArr) / SW0;

  const thetaArr = diam.map((_, i) => Math.atan2(tengahBahu[i].x - tengahPanggul[i].x, tengahPanggul[i].y - tengahBahu[i].y) * (180 / Math.PI));
  const theta0 = median(thetaArr);

  const bahuT = sisi === 'kiri'
    ? diam.map(s => s.p.bahuKi)
    : diam.map(s => s.p.bahuKa);
  const eArr = diam.map((s, i) => (bahuT[i].y - s.p.telingaT.y) / SW0);
  const e0 = median(eArr);

  const R0: import('./tipe.ts').P2 = {
    x: median(diam.map(s => s.p.pergelanganT.x)),
    y: median(diam.map(s => s.p.pergelanganT.y)),
  };

  const zS0 = median(diam.map(s => s.S3.z));
  const T0  = median(diam.map(s => Math.sqrt((s.S3.x - s.H3.x) ** 2 + (s.S3.y - s.H3.y) ** 2 + (s.S3.z - s.H3.z) ** 2)));
  const theta3d0 = median(diam.map(s => Math.atan2(s.S3.x - s.H3.x, s.H3.y - s.S3.y) * (180 / Math.PI)));

  return {
    ok: true,
    baseline: { SW0, h0, theta0, e0, R0, zS0, T0, theta3d0 },
  };
}
