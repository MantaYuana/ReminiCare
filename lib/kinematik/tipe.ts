// Kinematic types and constants — pose engine domain types.

// ── Tipe dasar ────────────────────────────────────────────────────────────

export type Sisi = 'kiri' | 'kanan';
export type Gerakan = 'jangkau_depan' | 'jangkau_samping';
export type Toleransi = 'abaikan' | 'longgar' | 'normal' | 'ketat';
export type ModeKoreksi = 'penuh' | 'ringkasan' | 'mati';
export type KalimatCondong = 'sandaran' | 'tegak';
export type Kandidat = 'a' | 'b' | 'c';   // a = w∧d, b = zb, c = r
export type StatusRep = 'DIAM' | 'BERGERAK' | 'JAUH';
export type SubSinyal = 'condong' | 'miring' | 'bahu';
export type KodeKoreksi = 'K-CONDONG-S' | 'K-CONDONG-T' | 'K-MIRING' | 'K-BAHU';

export type Titik = { x: number; y: number; visibility?: number };
export type Titik3 = { x: number; y: number; z: number };
export type P2 = { x: number; y: number };

export type FrameMentah = {
  t: number;            // ms
  W: number; H: number; // video.videoWidth / videoHeight
  lm: Titik[] | null;   // 33 titik; null = tidak ada pose
  world: Titik3[] | null;
};

export type Kunci = 'telingaT' | 'bahuKi' | 'bahuKa' | 'sikuT' | 'pergelanganT' | 'panggulKi' | 'panggulKa';

export type Sampel = {
  t: number;
  p: Record<Kunci, P2>;
  S3: Titik3; H3: Titik3;
  diDalam: boolean;
  skor: number;
  visPanggul: number;
  panggulN: P2;
};

export type Baseline = {
  SW0: number;
  h0: number;
  theta0: number;
  e0: number;
  R0: P2;
  zS0: number;
  T0: number;
  theta3d0: number;
};

export type Fitur = {
  w: number; d: number; r: number; zb: number;
  dTheta: number; el: number; dTheta3d: number; dp: number;
};

export type Ambang = { tw: number; td: number; tr: number; tz: number; tTheta: number; tel: number };
export type AmbangEfektif = Ambang & { batang: boolean; bahu: boolean };

export type Penanda = {
  condongA: boolean; condongB: boolean; condongC: boolean; miring: boolean; el: boolean;
  condong: boolean;
  batang: boolean;
  bahu: boolean;
};

export type KonfigSesi = {
  sisi: Sisi; durasiPersen: number; tolBatang: Toleransi; tolBahu: Toleransi;
  mode: ModeKoreksi; kalimat: KalimatCondong; kandidat: Kandidat; suaraCondong: boolean;
};

export type HasilRepetisi = {
  gerakan: Gerakan; ke: number; tMulai: number; tSelesai: number;
  terukur: boolean;
  fraksiTergating: number;
  fraksi: {
    condongA: number; condongB: number; condongC: number;
    miring: number; el: number; batang: number; bahu: number;
  };
  fraksiBatangKandidat: { a: number; b: number; c: number };
  kompensasi: { batang: boolean; bahu: boolean };
  terkompensasi: boolean;
  puncak: { w: number; d: number; r: number; zb: number; dTheta: number; el: number; dTheta3d: number };
  waktuGerak10: number | null; waktuGerak5: number | null;
  vPuncak: number | null;
  nPuncak: number | null;
  koreksi: { kode: KodeKoreksi; tDeteksi: number } | null;
  visPanggulMin: number; visPanggulMed: number; panggulMin: P2; panggulMaks: P2;
};

export type EventMesin =
  | { jenis: 'sampel'; t: number; status: StatusRep; gating: boolean; skor: number; diDalam: boolean; fitur: Fitur; penanda: Penanda }
  | { jenis: 'gating'; aktif: boolean; t: number }
  | { jenis: 'koreksi'; sub: SubSinyal; kode: KodeKoreksi; tDeteksi: number }
  | { jenis: 'repetisi'; hasil: HasilRepetisi; hitungan: number; bagus: boolean };

// ── Konstanta ─────────────────────────────────────────────────────────────

export const HZ = 30;
export const FC_HZ = 5;

export const IDX = {
  telinga:     { kiri: 7,  kanan: 8  },
  bahu:        { kiri: 11, kanan: 12 },
  siku:        { kiri: 13, kanan: 14 },
  pergelangan: { kiri: 15, kanan: 16 },
  panggul:     { kiri: 23, kanan: 24 },
} as const;

export const idxK = (s: Sisi): number[] => [
  11, 12, 23, 24,
  IDX.siku[s],
  IDX.pergelangan[s],
  IDX.telinga[s],
];

export const AMBANG_AWAL: Record<Gerakan, Ambang> = {
  jangkau_depan:   { tw: 0.06, td: 0.04, tr: 0.04, tz: 0.15, tTheta: 6,  tel: 0.15 },
  jangkau_samping: { tw: 0.06, td: 0.04, tr: 0.04, tz: 0.15, tTheta: 8,  tel: 0.25 },
};

export const AMBANG_VERSI = 'S1-0600';

export const KALI_TOLERANSI: Record<Toleransi, number | null> = {
  ketat:   0.75,
  normal:  1,
  longgar: 1.5,
  abaikan: null,
};

export const GATING = { masuk: 0.5, lepas: 0.6, jendelaMs: 1000, tahanMs: 1000 };
export const REP    = { mulai: 0.25, jauh: 0.6, minMs: 800, maksMs: 15000, padMs: 500 };
export const ONSET  = { utama: 0.10, alt: 0.05 };
export const PUNCAK = { fraksi: 0.20, jarakMs: 100 };
export const TAK_TERUKUR   = 0.5;
export const KOREKSI       = { debounceMs: 300, samaMs: 4000, antarMs: 1500 };
export const KALIB         = { durasiMs: 5000, sdMaks: 0.02, jendelaMs: 1000, minFraksi: 0.5, maksGagal: 3 };
export const BAGUS_BERUNTUN = 3;
export const ISTIRAHAT_MS  = 20000;
export const KANDIDAT_CONDONG: Kandidat = 'c';
export const SUARA_CONDONG = true;
