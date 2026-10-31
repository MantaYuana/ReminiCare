// Kinematic types — placeholder until the pose engine module is available.
// This file will be overwritten by the pose engine owner without coordination.

export type Sisi = 'kiri' | 'kanan';
export type Gerakan = 'jangkau_depan' | 'jangkau_samping';
export type Toleransi = 'abaikan' | 'longgar' | 'normal' | 'ketat';
export type ModeKoreksi = 'penuh' | 'ringkasan' | 'mati';
export type KalimatCondong = 'sandaran' | 'tegak';
export type Kandidat = 'a' | 'b' | 'c';
export type StatusRep = 'DIAM' | 'BERGERAK' | 'JAUH';
export type SubSinyal = 'condong' | 'miring' | 'bahu';
export type KodeKoreksi = 'K-CONDONG-S' | 'K-CONDONG-T' | 'K-MIRING' | 'K-BAHU';

export type Titik = { x: number; y: number; visibility?: number };

export type Penanda = {
  batang: number | null;
  bahu: number | null;
  vPuncak: number | null;
  nPuncak: number | null;
  koreksi: { kode: KodeKoreksi; tDeteksi: number } | null;
  visPanggulMin: number;
  visPanggulMed: number;
  panggulMin: Titik;
  panggulMaks: Titik;
};

export type Fitur = {
  w: number | null;
  d: number | null;
  r: number | null;
  zb: number | null;
  el: number | null;
};

export type HasilRepetisi = {
  gerakan: Gerakan;
  bagus: boolean;
  tMulai: number;
  tSelesai: number;
  penanda: Penanda;
};

export type Baseline = {
  R0: number;
  theta3d0: number;
  [key: string]: number;
};

export type EventMesin =
  | { jenis: 'sampel'; t: number; status: StatusRep; gating: boolean; skor: number; diDalam: boolean; fitur: Fitur; penanda: Penanda }
  | { jenis: 'gating'; aktif: boolean; t: number }
  | { jenis: 'koreksi'; sub: SubSinyal; kode: KodeKoreksi; tDeteksi: number }
  | { jenis: 'repetisi'; hasil: HasilRepetisi; hitungan: number; bagus: boolean };
