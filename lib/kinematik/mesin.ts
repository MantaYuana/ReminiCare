// lib/kinematik/mesin.ts
// Session engine orchestrator and session aggregation.

import {
  type FrameMentah, type Gerakan, type Baseline, type EventMesin,
  type HasilRepetisi, type KonfigSesi, type Sampel, type Toleransi,
  type ModeKoreksi, type KalimatCondong, type Kandidat, type KodeKoreksi,
  REP, AMBANG_VERSI, KANDIDAT_CONDONG, SUARA_CONDONG, ISTIRAHAT_MS,
  FC_HZ, HZ,
} from './tipe.ts';
import { keSampel, buatResampler, buatFilterSampel, koefButterworth } from './sinyal.ts';
import { hitungFitur, ambangEfektif, hitungPenanda, buatGating } from './fitur.ts';
import { langkahRep, nilaiRepetisi, buatKoreksi, buatPenghitungBagus } from './repetisi.ts';
import type { KeadaanRep, SampelRep } from './repetisi.ts';

// ── Tipe publik ────────────────────────────────────────────────────────────

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
    rep_total: number; rep_terukur: number; rep_terkompensasi: number;
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
  dorong(f: FrameMentah): EventMesin[];
  akhiri(): EventMesin[];
  hasil(): HasilRepetisi[];
}

// ── buatMesin ─────────────────────────────────────────────────────────────

export function buatMesin(cfg: KonfigSesi, b: Baseline): Mesin {
  const resampler = buatResampler(HZ);
  const koef      = koefButterworth(FC_HZ, HZ);
  const filter    = buatFilterSampel(koef);
  const gating    = buatGating();
  const koreksi   = buatKoreksi(cfg);
  let penghitung  = buatPenghitungBagus();
  let gatingSebelum = false;
  let korBerjalan: { kode: KodeKoreksi; tDeteksi: number } | null = null;

  let gerakanAktif: Gerakan = 'jangkau_depan';
  let keAdaan: KeadaanRep = { status: 'DIAM', tMulai: null };
  let hitungan = 0;
  let sebelum: Sampel | null = null;
  const buffer: SampelRep[] = [];
  const tertunda: { tMulai: number; tSelesai: number; sah: boolean; koreksi: { kode: KodeKoreksi; tDeteksi: number } | null }[] = [];
  const semuaHasil: HasilRepetisi[] = [];

  function ambangSekarang() {
    return ambangEfektif(gerakanAktif, cfg.tolBatang, cfg.tolBahu);
  }

  function prosesTertunda(tSekarang: number): EventMesin[] {
    const events: EventMesin[] = [];
    const selesai = tertunda.filter(p => tSekarang >= p.tSelesai + REP.padMs);
    for (const p of selesai) {
      tertunda.splice(tertunda.indexOf(p), 1);
      if (!p.sah) continue;
      const seg = buffer.filter(s => s.t >= p.tMulai - REP.padMs && s.t <= p.tSelesai + REP.padMs);
      const nilai = nilaiRepetisi(seg, p.tMulai, p.tSelesai, cfg.durasiPersen);
      hitungan++;
      const bagusMentah = penghitung.tambah(nilai.terukur, nilai.terkompensasi);
      const bagus = cfg.mode === 'penuh' && bagusMentah;
      const hasil: HasilRepetisi = { gerakan: gerakanAktif, ke: hitungan, koreksi: p.koreksi, ...nilai };
      semuaHasil.push(hasil);
      events.push({ jenis: 'repetisi', hasil, hitungan, bagus });
    }
    return events;
  }

  function pangkasBuffer(tMin: number) {
    const batas = tMin - REP.padMs;
    while (buffer.length > 0 && buffer[0].t < batas) buffer.shift();
  }

  return {
    mulaiGerakan(g) {
      gerakanAktif = g;
      keAdaan = { status: 'DIAM', tMulai: null };
      hitungan = 0;
      koreksi.mulaiRep();
      penghitung = buatPenghitungBagus();
      korBerjalan = null;
      gatingSebelum = false;
      buffer.length = 0;
      tertunda.length = 0;
    },

    dorong(f): EventMesin[] {
      const events: EventMesin[] = [];
      const sampelBaru = resampler.dorong(keSampel(f, cfg.sisi, sebelum));
      if (sampelBaru.length > 0) sebelum = sampelBaru[sampelBaru.length - 1];

      let eventSampel: EventMesin | null = null;

      for (const s of sampelBaru) {
        const sf = filter(s);
        const fitur = hitungFitur(sf, b, cfg.sisi);
        const ambang = ambangSekarang();
        const penanda = hitungPenanda(fitur, ambang, cfg.kandidat);
        const { aktif: gatingAktif } = gating.dorong(sf.t, sf.diDalam, sf.skor);
        const tergating = !sf.diDalam || gatingAktif;

        if (gatingAktif !== gatingSebelum) {
          gatingSebelum = gatingAktif;
          events.push({ jenis: 'gating', aktif: gatingAktif, t: sf.t });
        }

        const repSebelum = keAdaan.status;
        const { k: keBarU, selesai } = langkahRep(keAdaan, sf.t, fitur.dp);
        if (repSebelum === 'DIAM' && keBarU.status === 'BERGERAK') {
          koreksi.mulaiRep();
          korBerjalan = null;
        }
        keAdaan = keBarU;

        const kor = koreksi.dorong(sf.t, keAdaan.status, tergating, penanda);
        if (kor) {
          korBerjalan = { kode: kor.kode, tDeteksi: kor.tDeteksi };
          events.push({ jenis: 'koreksi', sub: kor.sub, kode: kor.kode, tDeteksi: kor.tDeteksi });
        }

        buffer.push({
          t: sf.t, pw: sf.p.pergelanganT, tergating,
          fitur, penanda, visPanggul: sf.visPanggul, panggulN: sf.panggulN,
        });

        if (selesai) tertunda.push({ ...selesai, koreksi: korBerjalan });
        events.push(...prosesTertunda(sf.t));

        // Pangkas buffer
        const tMin = tertunda.length > 0
          ? Math.min(...tertunda.map(p => p.tMulai))
          : keAdaan.tMulai ?? sf.t;
        pangkasBuffer(tMin);

        eventSampel = {
          jenis: 'sampel', t: sf.t, status: keAdaan.status,
          gating: gatingAktif, skor: sf.skor, diDalam: sf.diDalam, fitur, penanda,
        };
      }

      if (eventSampel) events.push(eventSampel);
      return events;
    },

    akhiri(): EventMesin[] {
      const events: EventMesin[] = [];
      // Paksa proses semua tertunda
      const tAkhir = buffer.length > 0 ? buffer[buffer.length - 1].t + REP.padMs + 1 : Date.now();
      events.push(...prosesTertunda(tAkhir));
      return events;
    },

    hasil(): HasilRepetisi[] {
      return [...semuaHasil];
    },
  };
}

// ── agregatSesi ───────────────────────────────────────────────────────────

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

export function agregatSesi(x: {
  id: string; pasienId: string; mulai: string; selesai: string;
  resep: ResepSalinan; baseline: Baseline;
  hasil: HasilRepetisi[]; fpsMedian: number;
  suara: 'webspeech' | 'klip'; delegate: 'GPU' | 'CPU';
}): BarisSesi {
  const { id, pasienId, mulai, selesai, resep, baseline, hasil, fpsMedian, suara, delegate } = x;

  const sah = hasil; // semua repetisi sah
  const repTotal = sah.length;
  const repTerukur = sah.filter(r => r.terukur).length;
  const repTerkompensasi = sah.filter(r => r.terkompensasi).length;

  const pctTakTerukur = repTotal > 0
    ? sah.reduce((sum, r) => sum + (r.terukur ? 0 : 1), 0) / repTotal * 100
    : 0;

  // Per gerakan
  const gerakan = [...new Set(sah.map(r => r.gerakan))];
  const perGerakan: BarisSesi['per_gerakan'] = {};
  for (const g of gerakan) {
    const gs = sah.filter(r => r.gerakan === g);
    const gt = gs.filter(r => r.terukur);
    const perPenanda = {
      batang: gt.filter(r => r.kompensasi.batang).length,
      bahu:   gt.filter(r => r.kompensasi.bahu).length,
    };
    perGerakan[g] = {
      rep_total:         gs.length,
      rep_terukur:       gt.length,
      rep_terkompensasi: gs.filter(r => r.terkompensasi).length,
      per_penanda:       perPenanda,
      waktu_gerak_median: median(gt.map(r => r.waktuGerak10).filter((v): v is number => v !== null)),
      v_puncak_median:    median(gt.map(r => r.vPuncak).filter((v): v is number => v !== null)),
      n_puncak_median:    median(gt.map(r => r.nPuncak).filter((v): v is number => v !== null)),
    };
  }

  return {
    id, pasien_id: pasienId, mulai, selesai, resep,
    baseline: {
      SW0: baseline.SW0, h0: baseline.h0, theta0: baseline.theta0,
      e0: baseline.e0, zS0: baseline.zS0, T0: baseline.T0,
    },
    rep_total: repTotal,
    rep_terukur: repTerukur,
    rep_terkompensasi: repTerkompensasi,
    per_gerakan: perGerakan,
    pct_tak_terukur: pctTakTerukur,
    fps_median: fpsMedian,
    suara, delegate, nyeri: null, is_sintetis: false,
  };
}

// Ekspor konstanta yang dibutuhkan UI
export { AMBANG_VERSI, KANDIDAT_CONDONG, SUARA_CONDONG, ISTIRAHAT_MS };
