// lib/kinematik/repetisi.ts
// Repetition detection, scoring, metrics, and correction logic.

import {
  type Sampel, type Penanda, type HasilRepetisi, type Gerakan, type KodeKoreksi,
  type SubSinyal, type KalimatCondong, type KonfigSesi, type StatusRep, type P2,
  REP, ONSET, PUNCAK, KOREKSI, BAGUS_BERUNTUN, TAK_TERUKUR, HZ, FC_HZ,
} from './tipe.ts';
import { koefButterworth, filtfilt } from './sinyal.ts';
import type { Fitur } from './tipe.ts';

// ── Tipe internal ─────────────────────────────────────────────────────────

export type KeadaanRep = { status: StatusRep; tMulai: number | null };

export type SampelRep = {
  t: number;
  pw: P2;
  tergating: boolean;
  fitur: Fitur;
  penanda: Penanda;
  visPanggul: number;
  panggulN: P2;
};

// ── langkahRep ────────────────────────────────────────────────────────────

export function langkahRep(
  k: KeadaanRep,
  t: number,
  dp: number,
): { k: KeadaanRep; selesai: { tMulai: number; tSelesai: number; sah: boolean } | null } {
  const { status, tMulai } = k;

  if (status === 'DIAM') {
    if (dp > REP.mulai) {
      return { k: { status: 'BERGERAK', tMulai: t }, selesai: null };
    }
    return { k, selesai: null };
  }

  if (status === 'BERGERAK') {
    if (dp > REP.jauh) {
      return { k: { status: 'JAUH', tMulai }, selesai: null };
    }
    if (dp < REP.mulai) {
      // Kembali ke DIAM tanpa repetisi sah
      return { k: { status: 'DIAM', tMulai: null }, selesai: null };
    }
    return { k, selesai: null };
  }

  // JAUH
  if (dp < REP.mulai) {
    const durasi = t - tMulai!;
    return {
      k: { status: 'DIAM', tMulai: null },
      selesai: { tMulai: tMulai!, tSelesai: t, sah: durasi >= REP.minMs && durasi <= REP.maksMs },
    };
  }
  return { k, selesai: null };
}

// ── kecepatan ─────────────────────────────────────────────────────────────

export function kecepatan(seg: SampelRep[]): number[] {
  if (seg.length < 2) return seg.map(() => 0);
  const k = koefButterworth(FC_HZ, HZ);
  const xs = filtfilt(seg.map(s => s.pw.x), k);
  const ys = filtfilt(seg.map(s => s.pw.y), k);
  return seg.map((_, i) => {
    if (i === 0 || i === seg.length - 1) return 0;
    const dx = (xs[i + 1] - xs[i - 1]) * HZ / 2;
    const dy = (ys[i + 1] - ys[i - 1]) * HZ / 2;
    return Math.sqrt(dx * dx + dy * dy);
  });
}

export function onsetOffset(v: number[], fraksi: number): [number, number] | null {
  const vP = Math.max(...v);
  if (vP === 0) return null;
  const threshold = fraksi * vP;
  let on = -1, off = -1;
  for (let i = 0; i < v.length; i++) {
    if (v[i] > threshold) { if (on < 0) on = i; off = i; }
  }
  if (on < 0) return null;
  return [on, off];
}

export function jumlahPuncak(v: number[], vPuncak: number): number {
  const threshold = PUNCAK.fraksi * vPuncak;
  const dt = 1000 / HZ;
  let count = 0;
  let lastPeakTime = -Infinity;
  let lastPeakVal = -Infinity;
  for (let i = 1; i < v.length - 1; i++) {
    if (v[i] > threshold && v[i] >= v[i - 1] && v[i] >= v[i + 1]) {
      const t = i * dt;
      if (t - lastPeakTime < PUNCAK.jarakMs) {
        if (v[i] > lastPeakVal) {
          lastPeakTime = t;
          lastPeakVal = v[i];
        }
      } else {
        count++;
        lastPeakTime = t;
        lastPeakVal = v[i];
      }
    }
  }
  return count;
}

// ── nilaiRepetisi ─────────────────────────────────────────────────────────

function medianNum(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

export function nilaiRepetisi(
  seg: SampelRep[],
  tMulai: number,
  tSelesai: number,
  durasiPersen: number,
): Omit<HasilRepetisi, 'gerakan' | 'ke' | 'koreksi'> {
  if (seg.length === 0) {
    return {
      tMulai, tSelesai,
      terukur: false, fraksiTergating: 1,
      fraksi: { condongA: 0, condongB: 0, condongC: 0, miring: 0, el: 0, batang: 0, bahu: 0 },
      fraksiBatangKandidat: { a: 0, b: 0, c: 0 },
      kompensasi: { batang: false, bahu: false }, terkompensasi: false,
      puncak: { w: 0, d: 0, r: 0, zb: 0, dTheta: 0, el: 0, dTheta3d: 0 },
      waktuGerak10: null, waktuGerak5: null, vPuncak: null, nPuncak: null,
      visPanggulMin: 0, visPanggulMed: 0, panggulMin: { x: 0, y: 0 }, panggulMaks: { x: 0, y: 0 },
    };
  }

  const v = kecepatan(seg);
  const vP = Math.max(...v);

  const r10 = onsetOffset(v, ONSET.utama);
  const r5  = onsetOffset(v, ONSET.alt);

  // Fase = seg[on..off]
  const [on10, off10] = r10 ?? [0, seg.length - 1];
  const fase = seg.slice(on10, off10 + 1);

  const fraksiTergating = fase.length > 0 ? fase.filter(s => s.tergating).length / fase.length : 1;
  const terukur = vP > 0 && fraksiTergating <= TAK_TERUKUR;

  const bersih = fase.filter(s => !s.tergating);
  const n = bersih.length;

  function fraksiPenanda(fn: (p: Penanda) => boolean): number {
    return n > 0 ? bersih.filter(s => fn(s.penanda)).length / n : 0;
  }

  const fraksi = {
    condongA: fraksiPenanda(p => p.condongA),
    condongB: fraksiPenanda(p => p.condongB),
    condongC: fraksiPenanda(p => p.condongC),
    miring:   fraksiPenanda(p => p.miring),
    el:       fraksiPenanda(p => p.el),
    batang:   fraksiPenanda(p => p.batang),
    bahu:     fraksiPenanda(p => p.bahu),
  };

  const fraksiBatangKandidat = {
    a: n > 0 ? bersih.filter(s => s.penanda.condongA || s.penanda.miring).length / n : 0,
    b: n > 0 ? bersih.filter(s => s.penanda.condongB || s.penanda.miring).length / n : 0,
    c: n > 0 ? bersih.filter(s => s.penanda.condongC || s.penanda.miring).length / n : 0,
  };

  const minPersen = durasiPersen / 100;
  const kompensasi = {
    batang: fraksi.batang >= minPersen,
    bahu:   fraksi.bahu >= minPersen,
  };
  const terkompensasi = terukur && (kompensasi.batang || kompensasi.bahu);

  // Puncak fitur
  const puncak = {
    w:       bersih.length > 0 ? Math.max(...bersih.map(s => s.fitur.w)) : 0,
    d:       bersih.length > 0 ? Math.max(...bersih.map(s => s.fitur.d)) : 0,
    r:       bersih.length > 0 ? Math.max(...bersih.map(s => s.fitur.r)) : 0,
    zb:      bersih.length > 0 ? Math.max(...bersih.map(s => s.fitur.zb)) : 0,
    dTheta:  bersih.length > 0 ? Math.max(...bersih.map(s => s.fitur.dTheta)) : 0,
    el:      bersih.length > 0 ? Math.max(...bersih.map(s => s.fitur.el)) : 0,
    dTheta3d: bersih.length > 0 ? Math.max(...bersih.map(s => s.fitur.dTheta3d)) : 0,
  };

  const waktuGerak10 = terukur && r10 ? (seg[off10].t - seg[on10].t) / 1000 : null;
  const [on5, off5]  = r5 ?? [0, seg.length - 1];
  const waktuGerak5  = terukur && r5 ? (seg[off5].t - seg[on5].t) / 1000 : null;

  const vPuncakVal = terukur && vP > 0 ? vP : null;
  const nPuncak = terukur && vPuncakVal !== null ? jumlahPuncak(v.slice(on10, off10 + 1), vP) : null;

  const vpArr = fase.map(s => s.visPanggul);
  const visPanggulMin = vpArr.length > 0 ? Math.min(...vpArr) : 0;
  const visPanggulMed = medianNum(vpArr) ?? 0;
  const pxArr = fase.map(s => s.panggulN.x);
  const pyArr = fase.map(s => s.panggulN.y);
  const panggulMin: P2 = { x: Math.min(...pxArr.length > 0 ? pxArr : [0]), y: Math.min(...pyArr.length > 0 ? pyArr : [0]) };
  const panggulMaks: P2 = { x: Math.max(...pxArr.length > 0 ? pxArr : [0]), y: Math.max(...pyArr.length > 0 ? pyArr : [0]) };

  return {
    tMulai, tSelesai, terukur, fraksiTergating, fraksi, fraksiBatangKandidat,
    kompensasi, terkompensasi, puncak,
    waktuGerak10, waktuGerak5, vPuncak: vPuncakVal, nPuncak,
    visPanggulMin, visPanggulMed, panggulMin, panggulMaks,
  };
}

// ── kodeKoreksi ───────────────────────────────────────────────────────────

export function kodeKoreksi(sub: SubSinyal, kalimat: KalimatCondong): KodeKoreksi {
  if (sub === 'condong') return kalimat === 'sandaran' ? 'K-CONDONG-S' : 'K-CONDONG-T';
  if (sub === 'miring') return 'K-MIRING';
  return 'K-BAHU';
}

// ── buatKoreksi ───────────────────────────────────────────────────────────

export function buatKoreksi(cfg: KonfigSesi): {
  mulaiRep(): void;
  dorong(t: number, status: StatusRep, tergating: boolean, p: Penanda): { sub: SubSinyal; kode: KodeKoreksi; tDeteksi: number } | null;
} {
  const sejak: Record<SubSinyal, number | null> = { condong: null, miring: null, bahu: null };
  const terakhir: Record<KodeKoreksi, number> = { 'K-CONDONG-S': -Infinity, 'K-CONDONG-T': -Infinity, 'K-MIRING': -Infinity, 'K-BAHU': -Infinity };
  let terakhirApapun = -Infinity;
  let sudahRep = false;

  return {
    mulaiRep() { sudahRep = false; },

    dorong(t, status, tergating, p) {
      if (cfg.mode !== 'penuh') return null;

      const boleh = (status === 'BERGERAK' || status === 'JAUH') && !tergating;
      const aktif: Record<SubSinyal, boolean> = {
        condong: boleh && p.batang && p.condong,
        miring:  boleh && p.batang && p.miring,
        bahu:    boleh && p.bahu,
      };

      // Tergating menghapus sejak
      if (tergating) {
        sejak.condong = null; sejak.miring = null; sejak.bahu = null;
        return null;
      }

      for (const sub of ['condong', 'miring', 'bahu'] as SubSinyal[]) {
        sejak[sub] = aktif[sub] ? (sejak[sub] ?? t) : null;
      }

      if (sudahRep) return null;

      for (const sub of ['condong', 'miring', 'bahu'] as SubSinyal[]) {
        if (sejak[sub] === null || t - sejak[sub]! < KOREKSI.debounceMs) continue;
        if (sub === 'condong' && !cfg.suaraCondong) continue;
        const kode = kodeKoreksi(sub, cfg.kalimat);
        if (t - terakhir[kode] < KOREKSI.samaMs) continue;
        if (t - terakhirApapun < KOREKSI.antarMs) continue;
        sudahRep = true;
        terakhir[kode] = terakhirApapun = t;
        return { sub, kode, tDeteksi: t };
      }
      return null;
    },
  };
}

// ── Penghitung bagus beruntun ─────────────────────────────────────────────

export function buatPenghitungBagus(): {
  tambah(terukur: boolean, terkompensasi: boolean): boolean;
} {
  let beruntun = 0;
  return {
    tambah(terukur, terkompensasi) {
      if (terukur && !terkompensasi) {
        beruntun++;
        if (beruntun >= BAGUS_BERUNTUN) { beruntun = 0; return true; }
      } else {
        beruntun = 0;
      }
      return false;
    },
  };
}
