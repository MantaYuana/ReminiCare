// Tipe-tipe dari spec §6.2 — diisi sementara oleh Ari, akan ditimpa Manta tanpa diskusi

import type { Sisi, Gerakan, Toleransi, ModeKoreksi, KalimatCondong, Kandidat, HasilRepetisi, EventMesin, Baseline } from './tipe.ts';

export type ResepSalinan = {
  gerakan: Gerakan[];
  repetisi: number;
  sesi_per_minggu: number;
  toleransi_batang: Toleransi;
  toleransi_bahu: Toleransi;
  durasi_persen: number;
  mode_koreksi: ModeKoreksi;
  kalimat_condong: KalimatCondong;
  kandidat_condong: Kandidat;
  suara_condong: boolean;
  ambang_versi: string;
};

export type BarisSesi = {
  id: string;
  pasien_id: string;
  mulai: string;
  selesai: string;
  resep: ResepSalinan;
  baseline: Omit<Baseline, 'R0' | 'theta3d0'>;
  rep_total: number;
  rep_terukur: number;
  rep_terkompensasi: number;
  per_gerakan: Record<string, {
    rep_total: number;
    rep_terukur: number;
    rep_terkompensasi: number;
    per_penanda: { batang: number; bahu: number };
    waktu_gerak_median: number | null;
    v_puncak_median: number | null;
    n_puncak_median: number | null;
  }>;
  pct_tak_terukur: number;
  fps_median: number;
  suara: 'webspeech' | 'klip';
  delegate: 'GPU' | 'CPU';
  nyeri: null;
  is_sintetis: false;
};

export interface Mesin {
  mulaiGerakan(g: Gerakan): void;
  dorong(f: unknown): EventMesin[];
  akhiri(): EventMesin[];
  hasil(): HasilRepetisi[];
}

export declare function agregatSesi(x: {
  id: string;
  pasienId: string;
  mulai: string;
  selesai: string;
  resep: ResepSalinan;
  baseline: Baseline;
  hasil: HasilRepetisi[];
  fpsMedian: number;
  suara: 'webspeech' | 'klip';
  delegate: 'GPU' | 'CPU';
}): BarisSesi;

// Konstanta — diisi Manta saat G1
export declare const KANDIDAT_CONDONG: Kandidat;
export declare const SUARA_CONDONG: boolean;
export declare const ISTIRAHAT_MS: number;
export declare const AMBANG_VERSI: string;
