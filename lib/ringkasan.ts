// lib/ringkasan.ts
// Modul fungsi murni untuk ringkasan AI (F20) dan templat deterministik.
// Aturan node --test: impor relatif dengan ekstensi .ts, tanpa alias @/, tanpa enum/namespace, tanpa API DOM.

export type MasukanRingkasan = {
  periode_hari: 14;
  jendela_kepatuhan_hari: 7;
  target_sesi_per_minggu: number;
  jumlah_sesi_periode: number;
  sesi_7_hari: number;
  kepatuhan_7_hari_persen: number;
  pct_terkompensasi_median_periode: number | null;
  sesi_nyeri: number; // sesi dengan nyeri >= 1
  sesi: {
    hari_lalu: number;
    pct_terkompensasi: number | null;
    rep_terukur: number;
    pct_tak_terukur: number | null;
    nyeri: 0 | 1 | 2 | null;
    mode_koreksi: 'penuh' | 'ringkasan' | 'mati';
    waktu_gerak_median_detik: {
      jangkau_depan?: number;
      jangkau_samping?: number;
    };
  }[];
  eskalasi_terbuka: null | {
    median_baseline: number;
    panjang_run: number;
    batas: number;
    hari_sejak_dibuka: number;
  };
};

export interface RawPasien {
  sesi_per_minggu: number | string;
  [key: string]: unknown;
}

export interface RawPerGerakan {
  waktu_gerak_median?: number | string | null;
  [key: string]: unknown;
}

export interface RawSesi {
  mulai: string | Date;
  resep?: {
    mode_koreksi?: string;
    [key: string]: unknown;
  } | null;
  rep_terukur: number | string;
  pct_terkompensasi: number | string | null;
  pct_tak_terukur: number | string | null;
  nyeri: number | null;
  per_gerakan?: Record<string, RawPerGerakan> | null;
  [key: string]: unknown;
}

export interface RawEskalasi {
  dibuka: string | Date;
  median_baseline: number | string;
  panjang_run: number | string;
  batas: number | string;
  [key: string]: unknown;
}

// PROMPT persis dari SPEC §9 (sumber kebenaran sistem instruksi Gemini)
export const PROMPT_RINGKASAN =
  'Anda menulis ringkasan data latihan rumah untuk fisioterapis. Tulis 3 sampai 5 kalimat Bahasa Indonesia, nada netral. Pakai hanya angka yang ada di JSON masukan dan tulis angka dengan digit. Jangan membuat diagnosis, jangan menebak penyebab, jangan menyarankan perubahan resep, dosis, atau tindakan. Jangan menyebut nama atau identitas apa pun. Bila data sedikit, katakan data terbatas.';

export type AlasanRingkasan =
  | 'tanpa_kunci'
  | 'api_gagal'
  | 'kalimat'
  | 'angka_tidak_cocok';

export interface HasilRingkasan {
  sumber: 'ai' | 'templat';
  teks: string;
  alasan?: AlasanRingkasan;
}

/**
 * Bangun masukan teragregasi untuk AI/templat dari data mentah database.
 * Privasi keras: tidak ada nama, ID, UUID, atau tanggal absolut dalam keluaran.
 */
export function bangunMasukan(
  pasien: RawPasien,
  sesi: RawSesi[],
  esk: RawEskalasi | null,
  kini: Date = new Date()
): MasukanRingkasan {
  const kiniMs = kini.getTime();
  const batas7HariMs = kiniMs - 7 * 86400000;

  // Urutkan sesi naik menurut mulai
  const sesiUrut = [...sesi].sort(
    (a, b) => new Date(a.mulai).getTime() - new Date(b.mulai).getTime()
  );

  const jumlah_sesi_periode = sesiUrut.length;

  const sesi_7_hari = sesiUrut.filter(
    (s) => new Date(s.mulai).getTime() > batas7HariMs
  ).length;

  const target = Number(pasien.sesi_per_minggu);
  const targetSah = Number.isFinite(target) && target > 0 ? target : 1;
  const kepatuhan_7_hari_persen =
    Math.round(((sesi_7_hari / targetSah) * 100) * 10) / 10;

  // Kumpulkan pct_terkompensasi non-null untuk median periode
  const daftarPct: number[] = [];
  for (const s of sesiUrut) {
    if (
      s.pct_terkompensasi !== null &&
      s.pct_terkompensasi !== undefined &&
      s.pct_terkompensasi !== ''
    ) {
      const val = Number(s.pct_terkompensasi);
      if (!Number.isNaN(val)) {
        daftarPct.push(Math.round(val * 10) / 10);
      }
    }
  }
  daftarPct.sort((a, b) => a - b);

  let pct_terkompensasi_median_periode: number | null = null;
  if (daftarPct.length > 0) {
    const mid = Math.floor(daftarPct.length / 2);
    if (daftarPct.length % 2 === 1) {
      pct_terkompensasi_median_periode = daftarPct[mid];
    } else {
      const rataRata = (daftarPct[mid - 1] + daftarPct[mid]) / 2;
      pct_terkompensasi_median_periode = Math.round(rataRata * 10) / 10;
    }
  }

  // Hitung sesi dengan nyeri >= 1
  const sesi_nyeri = sesiUrut.filter(
    (s) => s.nyeri !== null && s.nyeri !== undefined && Number(s.nyeri) >= 1
  ).length;

  // Transformasi per sesi
  const sesiTeragregasi: MasukanRingkasan['sesi'] = sesiUrut.map((s) => {
    const mulaiMs = new Date(s.mulai).getTime();
    // [default spec] hari_lalu dihitung sebagai floor((kini - mulai) / 86400000) non-negatif
    const hari_lalu = Math.max(0, Math.floor((kiniMs - mulaiMs) / 86400000));

    let pct_terkompensasi: number | null = null;
    if (
      s.pct_terkompensasi !== null &&
      s.pct_terkompensasi !== undefined &&
      s.pct_terkompensasi !== ''
    ) {
      const v = Number(s.pct_terkompensasi);
      if (!Number.isNaN(v)) {
        pct_terkompensasi = Math.round(v * 10) / 10;
      }
    }

    const rep_terukur = Number(s.rep_terukur) || 0;

    let pct_tak_terukur: number | null = null;
    if (
      s.pct_tak_terukur !== null &&
      s.pct_tak_terukur !== undefined &&
      s.pct_tak_terukur !== ''
    ) {
      const v = Number(s.pct_tak_terukur);
      if (!Number.isNaN(v)) {
        pct_tak_terukur = Math.round(v * 10) / 10;
      }
    }

    let nyeri: 0 | 1 | 2 | null = null;
    if (s.nyeri !== null && s.nyeri !== undefined) {
      const n = Number(s.nyeri);
      if (n === 0 || n === 1 || n === 2) {
        nyeri = n;
      }
    }

    // [default spec] bila mode_koreksi hilang atau tidak dikenal ('penuh' | 'ringkasan' | 'mati'), gunakan 'penuh'
    let mode_koreksi: 'penuh' | 'ringkasan' | 'mati' = 'penuh';
    const mk = s.resep?.mode_koreksi;
    if (mk === 'mati' || mk === 'ringkasan' || mk === 'penuh') {
      mode_koreksi = mk;
    }

    // Hanya waktu gerak median detik yang diekstrak (2 desimal), v_puncak dan n_puncak tidak dikirim
    const waktu_gerak_median_detik: {
      jangkau_depan?: number;
      jangkau_samping?: number;
    } = {};

    if (s.per_gerakan && typeof s.per_gerakan === 'object') {
      const depan = s.per_gerakan.jangkau_depan?.waktu_gerak_median;
      if (depan !== null && depan !== undefined && depan !== '') {
        const vd = Number(depan);
        if (!Number.isNaN(vd)) {
          waktu_gerak_median_detik.jangkau_depan = Math.round(vd * 100) / 100;
        }
      }

      const samping = s.per_gerakan.jangkau_samping?.waktu_gerak_median;
      if (samping !== null && samping !== undefined && samping !== '') {
        const vs = Number(samping);
        if (!Number.isNaN(vs)) {
          waktu_gerak_median_detik.jangkau_samping = Math.round(vs * 100) / 100;
        }
      }
    }

    return {
      hari_lalu,
      pct_terkompensasi,
      rep_terukur,
      pct_tak_terukur,
      nyeri,
      mode_koreksi,
      waktu_gerak_median_detik,
    };
  });

  // Eskalasi terbuka
  let eskalasi_terbuka: MasukanRingkasan['eskalasi_terbuka'] = null;
  if (esk) {
    const dibukaMs = new Date(esk.dibuka).getTime();
    // [default spec] hari_sejak_dibuka sama dengan hari_lalu
    const hari_sejak_dibuka = Math.max(
      0,
      Math.floor((kiniMs - dibukaMs) / 86400000)
    );

    eskalasi_terbuka = {
      median_baseline: Math.round(Number(esk.median_baseline) * 10) / 10,
      panjang_run: Number(esk.panjang_run),
      batas: Number(esk.batas),
      hari_sejak_dibuka,
    };
  }

  return {
    periode_hari: 14,
    jendela_kepatuhan_hari: 7,
    target_sesi_per_minggu: Number(pasien.sesi_per_minggu) || 0,
    jumlah_sesi_periode,
    sesi_7_hari,
    kepatuhan_7_hari_persen,
    pct_terkompensasi_median_periode,
    sesi_nyeri,
    sesi: sesiTeragregasi,
    eskalasi_terbuka,
  };
}

/**
 * Normalisasi angka ke string 1 desimal.
 */
export function norm(x: number): string {
  return String(Math.round(x * 10) / 10);
}

/**
 * Ekstraksi seluruh angka sah dari objek masukan ringkasan.
 * Untuk tiap daun angka v: norm(v), norm(round(v)), norm(|v|), norm(round(|v|)).
 */
export function angkaSah(m: MasukanRingkasan): Set<string> {
  const sah = new Set<string>();

  function kumpulkan(obj: unknown) {
    if (obj === null || obj === undefined) return;
    if (typeof obj === 'number') {
      if (!Number.isNaN(obj)) {
        sah.add(norm(obj));
        sah.add(norm(Math.round(obj)));
        sah.add(norm(Math.abs(obj)));
        sah.add(norm(Math.round(Math.abs(obj))));
      }
      return;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        kumpulkan(item);
      }
      return;
    }
    if (typeof obj === 'object') {
      for (const val of Object.values(obj as Record<string, unknown>)) {
        kumpulkan(val);
      }
    }
  }

  kumpulkan(m);
  return sah;
}

/**
 * Memeriksa apakah setiap angka dalam teks terdaftar dalam set angka sah.
 * Token /\d+(?:[.,]\d+)?/g, koma diubah jadi titik, norm(parseFloat(token)) harus ada di sah.
 */
export function cekAngka(teks: string, sah: Set<string>): boolean {
  const matches = teks.match(/\d+(?:[.,]\d+)?/g);
  if (!matches) {
    return true;
  }
  for (const token of matches) {
    const bersih = token.replace(',', '.');
    const val = parseFloat(bersih);
    if (Number.isNaN(val) || !sah.has(norm(val))) {
      return false;
    }
  }
  return true;
}

/**
 * Memeriksa apakah teks terdiri dari 3 sampai 5 kalimat Bahasa Indonesia.
 * Tidak memecah kalimat pada koma atau titik desimal (mis. "12.5").
 */
export function cekKalimat(teks: string): boolean {
  if (!teks || typeof teks !== 'string') return false;
  // Pisahkan pada [.!?] yang diikuti spasi atau akhir teks
  const kalimat = teks
    .trim()
    .split(/[.!?]+(?:\s+|$)/)
    .filter((k) => k.trim().length > 0);
  return kalimat.length >= 3 && kalimat.length <= 5;
}

/**
 * Templat deterministik ringkasan (SPEC §9, 5 butir).
 * Harus menangani nilai null dan masukan kosong dengan aman tanpa memunculkan angka yang tidak ada.
 */
export function templat(m: MasukanRingkasan): string {
  const kalimat: string[] = [];

  // Butir 1 & 5: [default spec] templat bila jumlah_sesi_periode = 0 menggantikan butir 1 dengan "Belum ada sesi dalam 14 hari terakhir."
  if (m.jumlah_sesi_periode === 0) {
    kalimat.push('Belum ada sesi dalam 14 hari terakhir.');
  } else {
    kalimat.push(
      `Dalam 14 hari terakhir tercatat ${m.jumlah_sesi_periode} sesi; kepatuhan 7 hari ${m.kepatuhan_7_hari_persen}% dari target ${m.target_sesi_per_minggu} sesi per minggu.`
    );
  }

  // Butir 2: tangani pct_terkompensasi null atau 0 sesi
  const sesiTerakhir = m.sesi.length > 0 ? m.sesi[m.sesi.length - 1] : null;
  if (
    !sesiTerakhir ||
    sesiTerakhir.pct_terkompensasi === null ||
    m.pct_terkompensasi_median_periode === null
  ) {
    kalimat.push(
      'Persentase repetisi terkompensasi sesi terakhir belum terukur.'
    );
  } else {
    kalimat.push(
      `Persentase repetisi terkompensasi sesi terakhir ${sesiTerakhir.pct_terkompensasi}%, median periode ${m.pct_terkompensasi_median_periode}%.`
    );
  }

  // Butir 3
  kalimat.push(
    `Nyeri dilaporkan (agak nyeri atau nyeri) pada ${m.sesi_nyeri} sesi.`
  );

  // Butir 4
  if (m.eskalasi_terbuka) {
    kalimat.push(
      `Eskalasi terbuka: ${m.eskalasi_terbuka.panjang_run} sesi berturut-turut di atas median baseline ${m.eskalasi_terbuka.median_baseline}% (batas ${m.eskalasi_terbuka.batas}).`
    );
  } else {
    kalimat.push('Tidak ada eskalasi terbuka.');
  }

  return kalimat.join(' ');
}

/**
 * Fungsi murni dan deterministik untuk memutuskan apakah teks AI dipakai atau jatuh ke templat.
 */
export function putuskanRingkasan(
  masukan: MasukanRingkasan,
  teksAi: string | null,
  alasanGagal?: 'tanpa_kunci' | 'api_gagal'
): HasilRingkasan {
  // [default spec] bila alasanGagal eksplisit ada, langsung gunakan templat dengan alasan itu
  if (alasanGagal) {
    return {
      sumber: 'templat',
      teks: templat(masukan),
      alasan: alasanGagal,
    };
  }

  if (!teksAi || !cekKalimat(teksAi)) {
    return {
      sumber: 'templat',
      teks: templat(masukan),
      alasan: 'kalimat',
    };
  }

  const sah = angkaSah(masukan);
  if (!cekAngka(teksAi, sah)) {
    return {
      sumber: 'templat',
      teks: templat(masukan),
      alasan: 'angka_tidak_cocok',
    };
  }

  return {
    sumber: 'ai',
    teks: teksAi,
  };
}

