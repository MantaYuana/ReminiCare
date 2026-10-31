// lib/uji.ts
// Testing page helpers: CSV columns, row generators, CSV serialization, and file naming.
// Pure functions, no DOM.

import type { Sisi, Gerakan, EventMesin, HasilRepetisi } from './kinematik/tipe.ts';
import { KANDIDAT_CONDONG, AMBANG_VERSI } from './kinematik/tipe.ts';

export const KOLOM_CSV = [
  'waktu_iso', 'subjek', 'sisi', 'gerakan', 'label', 'sudut_target', 'posisi', 'set_id', 'tipe', 'rep_ke', 'rep_instruksi', 'durasi_ms',
  'terukur', 'fraksi_tergating',
  'w_puncak', 'd_puncak', 'r_puncak', 'zb_puncak', 'dtheta_puncak', 'el_puncak', 'dtheta3d_puncak',
  'fraksi_condong_a', 'fraksi_condong_b', 'fraksi_condong_c', 'fraksi_miring', 'fraksi_el',
  'kep_batang_a', 'kep_batang_b', 'kep_batang_c', 'kep_miring', 'kep_bahu', 'terkompensasi', 'kandidat_aktif', 'ambang_versi',
  'waktu_gerak_10', 'waktu_gerak_5', 'v_puncak', 'n_puncak',
  'fps', 'delegate', 'jalur_suara', 'koreksi_kode', 'latensi_ms',
  'vis_panggul_min', 'vis_panggul_med', 'panggul_x_min', 'panggul_x_maks', 'panggul_y_min', 'panggul_y_maks',
] as const;

export type MetaSet = {
  subjek: string;
  sisi: Sisi;
  gerakan: Gerakan;
  label: 'normal' | 'condong' | 'miring' | 'elevasi';
  sudut: 0 | 10 | 20 | 30 | null;
  posisi: 'depan' | 'oblik';
  repInstruksi: number;
  mode: 'penuh' | 'mati';
  durasiPersen: number;
};

export function setId(m: MetaSet): string {
  return `${m.subjek}-${m.gerakan}-${m.label}-${m.sudut ?? 'x'}`;
}

export function barisRep(
  m: MetaSet,
  h: HasilRepetisi,
  x: { waktuIso: string; fps: number; delegate: string; jalurSuara: string; latensiMs: number | null },
): Record<string, string | number> {
  const durasiPersenFraksi = m.durasiPersen / 100;
  return {
    waktu_iso: x.waktuIso,
    subjek: m.subjek,
    sisi: m.sisi,
    gerakan: m.gerakan,
    label: m.label,
    sudut_target: m.sudut ?? '',
    posisi: m.posisi,
    set_id: setId(m),
    tipe: 'rep',
    rep_ke: h.ke,
    rep_instruksi: m.repInstruksi,
    durasi_ms: h.tSelesai - h.tMulai,
    terukur: h.terukur ? 1 : 0,
    fraksi_tergating: h.fraksiTergating,
    w_puncak: h.puncak.w,
    d_puncak: h.puncak.d,
    r_puncak: h.puncak.r,
    zb_puncak: h.puncak.zb,
    dtheta_puncak: h.puncak.dTheta,
    el_puncak: h.puncak.el,
    dtheta3d_puncak: h.puncak.dTheta3d,
    fraksi_condong_a: h.fraksi.condongA,
    fraksi_condong_b: h.fraksi.condongB,
    fraksi_condong_c: h.fraksi.condongC,
    fraksi_miring: h.fraksi.miring,
    fraksi_el: h.fraksi.el,
    kep_batang_a: h.fraksiBatangKandidat.a >= durasiPersenFraksi ? 1 : 0,
    kep_batang_b: h.fraksiBatangKandidat.b >= durasiPersenFraksi ? 1 : 0,
    kep_batang_c: h.fraksiBatangKandidat.c >= durasiPersenFraksi ? 1 : 0,
    kep_miring: h.fraksi.miring >= durasiPersenFraksi ? 1 : 0,
    kep_bahu: h.fraksi.el >= durasiPersenFraksi ? 1 : 0,
    terkompensasi: h.terkompensasi ? 1 : 0,
    kandidat_aktif: KANDIDAT_CONDONG,
    ambang_versi: AMBANG_VERSI,
    waktu_gerak_10: h.waktuGerak10 ?? '',
    waktu_gerak_5: h.waktuGerak5 ?? '',
    v_puncak: h.vPuncak ?? '',
    n_puncak: h.nPuncak ?? '',
    fps: x.fps,
    delegate: x.delegate,
    jalur_suara: x.jalurSuara,
    koreksi_kode: h.koreksi?.kode ?? '',
    latensi_ms: x.latensiMs ?? '',
    vis_panggul_min: h.visPanggulMin,
    vis_panggul_med: h.visPanggulMed,
    panggul_x_min: h.panggulMin.x,
    panggul_x_maks: h.panggulMaks.x,
    panggul_y_min: h.panggulMin.y,
    panggul_y_maks: h.panggulMaks.y,
  };
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function barisStatis(
  m: MetaSet,
  sampel: Extract<EventMesin, { jenis: 'sampel' }>[],
  waktuIso: string,
): Record<string, string | number> {
  const n = sampel.length;
  const durasi_ms = n > 1 ? sampel[n - 1].t - sampel[0].t : '';

  return {
    waktu_iso: waktuIso,
    subjek: m.subjek,
    sisi: m.sisi,
    gerakan: m.gerakan,
    label: m.label,
    sudut_target: m.sudut ?? '',
    posisi: m.posisi,
    set_id: setId(m),
    tipe: 'statis',
    rep_ke: '',
    rep_instruksi: '',
    durasi_ms,
    terukur: '',
    fraksi_tergating: '',
    w_puncak: n > 0 ? median(sampel.map(s => s.fitur.w)) : '',
    d_puncak: n > 0 ? median(sampel.map(s => s.fitur.d)) : '',
    r_puncak: n > 0 ? median(sampel.map(s => s.fitur.r)) : '',
    zb_puncak: n > 0 ? median(sampel.map(s => s.fitur.zb)) : '',
    dtheta_puncak: n > 0 ? median(sampel.map(s => s.fitur.dTheta)) : '',
    el_puncak: n > 0 ? median(sampel.map(s => s.fitur.el)) : '',
    dtheta3d_puncak: n > 0 ? median(sampel.map(s => s.fitur.dTheta3d)) : '',
    fraksi_condong_a: n > 0 ? sampel.filter(s => s.penanda.condongA).length / n : '',
    fraksi_condong_b: n > 0 ? sampel.filter(s => s.penanda.condongB).length / n : '',
    fraksi_condong_c: n > 0 ? sampel.filter(s => s.penanda.condongC).length / n : '',
    fraksi_miring: n > 0 ? sampel.filter(s => s.penanda.miring).length / n : '',
    fraksi_el: n > 0 ? sampel.filter(s => s.penanda.el).length / n : '',
    kep_batang_a: '',
    kep_batang_b: '',
    kep_batang_c: '',
    kep_miring: '',
    kep_bahu: '',
    terkompensasi: '',
    kandidat_aktif: KANDIDAT_CONDONG,
    ambang_versi: AMBANG_VERSI,
    waktu_gerak_10: '',
    waktu_gerak_5: '',
    v_puncak: '',
    n_puncak: '',
    fps: '',
    delegate: '',
    jalur_suara: '',
    koreksi_kode: '',
    latensi_ms: '',
    vis_panggul_min: '',
    vis_panggul_med: '',
    panggul_x_min: '',
    panggul_x_maks: '',
    panggul_y_min: '',
    panggul_y_maks: '',
  };
}

function formatNilaiCsv(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function keCsv(baris: Record<string, string | number>[]): string {
  const barisCsv: string[] = [KOLOM_CSV.join(',')];
  for (const b of baris) {
    const nilaiKolom = KOLOM_CSV.map(k => formatNilaiCsv(b[k]));
    barisCsv.push(nilaiKolom.join(','));
  }
  return barisCsv.join('\n') + '\n';
}

export function namaFile(subjek: string, posisi: string, d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `uji_${subjek}_${posisi}_${y}${m}${day}-${hh}${mm}.csv`;
}
