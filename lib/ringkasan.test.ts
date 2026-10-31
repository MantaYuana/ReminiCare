// lib/ringkasan.test.ts
// Pengujian unit fungsi murni ringkasan AI (SPEC §9, PLAN §3 Fase 7, §5.4).
// Aturan: node:test + node:assert/strict, impor relatif ./ringkasan.ts.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  type MasukanRingkasan,
  type RawPasien,
  type RawSesi,
  type RawEskalasi,
  PROMPT_RINGKASAN,
  bangunMasukan,
  norm,
  angkaSah,
  cekAngka,
  cekKalimat,
  templat,
  putuskanRingkasan,
} from './ringkasan.ts';

// Sampel masukan dasar untuk pengujian
function buatMasukanDasar(
  sesi: MasukanRingkasan['sesi'] = [],
  esk: MasukanRingkasan['eskalasi_terbuka'] = null
): MasukanRingkasan {
  return {
    periode_hari: 14,
    jendela_kepatuhan_hari: 7,
    target_sesi_per_minggu: 3,
    jumlah_sesi_periode: sesi.length,
    sesi_7_hari: sesi.filter((s) => s.hari_lalu <= 7).length,
    kepatuhan_7_hari_persen: 100,
    pct_terkompensasi_median_periode: sesi.length > 0 ? 30 : null,
    sesi_nyeri: sesi.filter((s) => (s.nyeri ?? 0) >= 1).length,
    sesi,
    eskalasi_terbuka: esk,
  };
}

// -------------------------------------------------------------
// 1. TIGA TES WAJIB (SPEC §9)
// -------------------------------------------------------------

test('Wajib 1: angka asing pada teks menyebabkan cekAngka bernilai false', () => {
  const m = buatMasukanDasar([
    {
      hari_lalu: 1,
      pct_terkompensasi: 25.5,
      rep_terukur: 20,
      pct_tak_terukur: 0,
      nyeri: 0,
      mode_koreksi: 'penuh',
      waktu_gerak_median_detik: { jangkau_depan: 2.34 },
    },
  ]);
  const sah = angkaSah(m);

  // Angka 99.9 tidak ada di dalam data m
  const teksAdaAngkaAsing =
    'Dalam 14 hari tercatat 1 sesi dengan repetisi 20 dan kompensasi 99.9%.';
  assert.strictEqual(cekAngka(teksAdaAngkaAsing, sah), false);

  // Angka 404 juga tidak ada
  assert.strictEqual(cekAngka('Terdapat 404 sesi yang belum diproses.', sah), false);
});

test('Wajib 2: angka masukan dengan koma desimal terbaca sah (true)', () => {
  const m = buatMasukanDasar([
    {
      hari_lalu: 2,
      pct_terkompensasi: 32.5,
      rep_terukur: 20,
      pct_tak_terukur: 0,
      nyeri: 1,
      mode_koreksi: 'penuh',
      waktu_gerak_median_detik: { jangkau_depan: 1.5 },
    },
  ]);
  const sah = angkaSah(m);

  // Menggunakan koma desimal khas Bahasa Indonesia: "32,5" dan "1,5"
  const teksKoma =
    'Dalam 14 hari pasien menyelesaikan latihan dengan kompensasi 32,5% dan waktu gerak 1,5 detik.';
  assert.strictEqual(cekAngka(teksKoma, sah), true);
});

test('Wajib 3: invarian cekAngka(templat(m), angkaSah(m)) === true untuk berbagai skenario masukan', () => {
  // Skenario A: Masukan kosong (0 sesi)
  const mKosong = buatMasukanDasar([], null);
  const teksKosong = templat(mKosong);
  assert.strictEqual(cekAngka(teksKosong, angkaSah(mKosong)), true);
  assert.strictEqual(cekKalimat(teksKosong), true);

  // Skenario B: Tanpa eskalasi
  const mTanpaEsk = buatMasukanDasar(
    [
      {
        hari_lalu: 1,
        pct_terkompensasi: 20,
        rep_terukur: 20,
        pct_tak_terukur: 0,
        nyeri: 0,
        mode_koreksi: 'penuh',
        waktu_gerak_median_detik: {},
      },
    ],
    null
  );
  const teksTanpaEsk = templat(mTanpaEsk);
  assert.strictEqual(cekAngka(teksTanpaEsk, angkaSah(mTanpaEsk)), true);
  assert.strictEqual(cekKalimat(teksTanpaEsk), true);

  // Skenario C: Dengan eskalasi terbuka
  const mDenganEsk = buatMasukanDasar(
    [
      {
        hari_lalu: 1,
        pct_terkompensasi: 40,
        rep_terukur: 20,
        pct_tak_terukur: 0,
        nyeri: 0,
        mode_koreksi: 'penuh',
        waktu_gerak_median_detik: {},
      },
    ],
    {
      median_baseline: 12.5,
      panjang_run: 8,
      batas: 7,
      hari_sejak_dibuka: 5, // Masukan sintetis arbitrer untuk pengujian unit
    }
  );
  const teksDenganEsk = templat(mDenganEsk);
  assert.strictEqual(cekAngka(teksDenganEsk, angkaSah(mDenganEsk)), true);
  assert.strictEqual(cekKalimat(teksDenganEsk), true);

  // Skenario D: Sesi terakhir memiliki pct_terkompensasi null
  const mPctNull = buatMasukanDasar(
    [
      {
        hari_lalu: 1,
        pct_terkompensasi: null,
        rep_terukur: 3,
        pct_tak_terukur: 100,
        nyeri: 0,
        mode_koreksi: 'penuh',
        waktu_gerak_median_detik: {},
      },
    ],
    null
  );
  mPctNull.pct_terkompensasi_median_periode = null;
  const teksPctNull = templat(mPctNull);
  assert.strictEqual(cekAngka(teksPctNull, angkaSah(mPctNull)), true);
  assert.strictEqual(cekKalimat(teksPctNull), true);
  assert.match(
    teksPctNull,
    /Persentase repetisi terkompensasi sesi terakhir belum terukur\./
  );
});

// -------------------------------------------------------------
// 2. TES TAMBAHAN: cekKalimat (desimal tidak memecah kalimat)
// -------------------------------------------------------------

test('cekKalimat: hanya meloloskan teks dengan 3 sampai 5 kalimat tanpa terpecah desimal', () => {
  // 2 kalimat -> false
  const duaKalimat = 'Sesi latihan berjalan baik. Pasien menyelesaikan seluruh repetisi.';
  assert.strictEqual(cekKalimat(duaKalimat), false);

  // 3 kalimat dengan koma & titik desimal -> true
  const tigaKalimat =
    'Dalam 14 hari tercatat 6 sesi. Median kompensasi adalah 32.5% dan waktu gerak 2,34 detik. Tidak ada nyeri yang dilaporkan.';
  assert.strictEqual(cekKalimat(tigaKalimat), true);

  // 5 kalimat -> true
  const limaKalimat =
    'Kalimat pertama selesai. Kalimat kedua dengan nilai 12.5% tercatat. Kalimat ketiga menyusul. Kalimat keempat juga ada! Terakhir kalimat kelima.';
  assert.strictEqual(cekKalimat(limaKalimat), true);

  // 6 kalimat -> false
  const enamKalimat =
    'Satu. Dua. Tiga. Empat. Lima. Enam.';
  assert.strictEqual(cekKalimat(enamKalimat), false);

  // String kosong atau null -> false
  assert.strictEqual(cekKalimat(''), false);
  // @ts-expect-error uji tipe saat runtime
  assert.strictEqual(cekKalimat(null), false);
});

// -------------------------------------------------------------
// 3. TES TAMBAHAN: putuskanRingkasan (5 jalur keputusan)
// -------------------------------------------------------------

test('putuskanRingkasan: menangani 4 jalur kegagalan ke templat dan 1 jalur sukses AI', () => {
  const m = buatMasukanDasar([
    {
      hari_lalu: 1,
      pct_terkompensasi: 30,
      rep_terukur: 20,
      pct_tak_terukur: 0,
      nyeri: 0,
      mode_koreksi: 'penuh',
      waktu_gerak_median_detik: {},
    },
  ]);

  const teksAiValid =
    'Dalam 14 hari tercatat 1 sesi latihan mandiri. Kepatuhan latihan mencapai 100% dari target 3 sesi per minggu. Nyeri dilaporkan pada 0 sesi. Tidak ada eskalasi terbuka.';

  // Jalur 1: alasan tanpa_kunci
  const r1 = putuskanRingkasan(m, null, 'tanpa_kunci');
  assert.strictEqual(r1.sumber, 'templat');
  assert.strictEqual(r1.alasan, 'tanpa_kunci');

  // Jalur 2: alasan api_gagal
  const r2 = putuskanRingkasan(m, null, 'api_gagal');
  assert.strictEqual(r2.sumber, 'templat');
  assert.strictEqual(r2.alasan, 'api_gagal');

  // Jalur 3: kegagalan jumlah kalimat (!cekKalimat)
  const r3 = putuskanRingkasan(m, 'Hanya satu kalimat ringkasan.');
  assert.strictEqual(r3.sumber, 'templat');
  assert.strictEqual(r3.alasan, 'kalimat');

  // Jalur 4: angka tidak cocok / halusinasi angka asing
  const teksAiHalusinasi =
    'Dalam 14 hari tercatat 1 sesi. Nilai kompensasi 99.9% sangat tinggi. Pasien tidak merasa nyeri.';
  const r4 = putuskanRingkasan(m, teksAiHalusinasi);
  assert.strictEqual(r4.sumber, 'templat');
  assert.strictEqual(r4.alasan, 'angka_tidak_cocok');

  // Jalur 5: AI sukses sepenuhnya
  const r5 = putuskanRingkasan(m, teksAiValid);
  assert.strictEqual(r5.sumber, 'ai');
  assert.strictEqual(r5.teks, teksAiValid);
  assert.strictEqual(r5.alasan, undefined);
});

// -------------------------------------------------------------
// 4. TES PRIVASI: bangunMasukan tidak membocorkan PII/identitas
// -------------------------------------------------------------

test('bangunMasukan: mematuhi privasi keras (tanpa nama, UUID, tanggal ISO, atau metrik kurang andal)', () => {
  const pasien: RawPasien = {
    id: '11111111-2222-3333-4444-555555555555',
    nama_panggilan: 'Wayan',
    sesi_per_minggu: 3,
  };

  const sesi: RawSesi[] = [
    {
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      mulai: '2026-10-30T10:00:00.000Z',
      resep: {
        mode_koreksi: 'penuh',
        toleransi_batang: 'normal',
      },
      rep_terukur: 20,
      pct_terkompensasi: 30.5,
      pct_tak_terukur: 0,
      nyeri: 0,
      per_gerakan: {
        jangkau_depan: {
          waktu_gerak_median: 2.15,
          v_puncak_median: 0.85, // HARUS DIHAPUS
          n_puncak_median: 1, // HARUS DIHAPUS
        },
      },
    },
  ];

  const esk: RawEskalasi = {
    id: '99999999-8888-7777-6666-555555555555',
    dibuka: '2026-10-26T08:00:00.000Z',
    median_baseline: 12.5,
    panjang_run: 8,
    batas: 7,
  };

  const kini = new Date('2026-10-31T12:00:00.000Z');
  const hasil = bangunMasukan(pasien, sesi, esk, kini);
  const jsonStr = JSON.stringify(hasil);

  // 1. Tidak boleh ada nama pasien
  assert.strictEqual(jsonStr.includes('Wayan'), false);

  // 2. Tidak boleh ada UUID (regex)
  const regexUuid =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  assert.strictEqual(regexUuid.test(jsonStr), false);

  // 3. Tidak boleh ada tanggal ISO (regex \d{4}-\d{2}-\d{2})
  const regexIsoDate = /\d{4}-\d{2}-\d{2}/;
  assert.strictEqual(regexIsoDate.test(jsonStr), false);

  // 4. Tidak boleh ada kunci v_puncak atau n_puncak
  assert.strictEqual(jsonStr.includes('v_puncak'), false);
  assert.strictEqual(jsonStr.includes('n_puncak'), false);

  // 5. Bagian lain dari resep tidak boleh bocor
  assert.strictEqual(jsonStr.includes('toleransi_batang'), false);
});

// -------------------------------------------------------------
// 5. TELUSUR HITUNG-TANGAN PASIEN SANDBOX
// -------------------------------------------------------------

test('Hitung-tangan Pasien Sandbox: Pak Wayan, Bu Made, dan Pak Nyoman', () => {
  const kini = new Date('2026-10-31T12:00:00.000Z');

  // --- PAK WAYAN ---
  // Umur sesi: 1; 3.33; 5.67; 8.0; 10.33; 12.67 hari
  // Selang 56 jam = 201600000 ms.
  // 1 hari = 86400000 ms.
  const tWayanSesi1 = new Date(kini.getTime() - 1 * 86400000);
  const tWayanSesi2 = new Date(tWayanSesi1.getTime() - 56 * 3600000);
  const tWayanSesi3 = new Date(tWayanSesi2.getTime() - 56 * 3600000);
  const tWayanSesi4 = new Date(tWayanSesi3.getTime() - 56 * 3600000);
  const tWayanSesi5 = new Date(tWayanSesi4.getTime() - 56 * 3600000);
  const tWayanSesi6 = new Date(tWayanSesi5.getTime() - 56 * 3600000);

  // Pct urut waktu: [40 (terbaru/1 hari), 35, 35, 30, 30, 25 (tertua/12.67 hari)]
  // Kronologis naik (tertua ke terbaru): 25, 30, 30, 35, 35, 40
  const sesiWayan: RawSesi[] = [
    { mulai: tWayanSesi6, rep_terukur: 20, pct_terkompensasi: 25, pct_tak_terukur: 0, nyeri: 0 },
    { mulai: tWayanSesi5, rep_terukur: 20, pct_terkompensasi: 30, pct_tak_terukur: 0, nyeri: 0 },
    { mulai: tWayanSesi4, rep_terukur: 20, pct_terkompensasi: 30, pct_tak_terukur: 0, nyeri: 0 },
    { mulai: tWayanSesi3, rep_terukur: 20, pct_terkompensasi: 35, pct_tak_terukur: 0, nyeri: 0 },
    { mulai: tWayanSesi2, rep_terukur: 20, pct_terkompensasi: 35, pct_tak_terukur: 0, nyeri: 0 },
    { mulai: tWayanSesi1, rep_terukur: 20, pct_terkompensasi: 40, pct_tak_terukur: 0, nyeri: 0 },
  ];

  // esk.dibuka adalah masukan sintetis (pada seed 0003_sintetis.sql, trigger menyala di sesi ke-14 sehingga hari_sejak_dibuka ≈ 3 hari; nilai 5 hari di sini adalah masukan arbitrer untuk pengujian unit)
  const eskWayan: RawEskalasi = {
    dibuka: new Date(kini.getTime() - 5 * 86400000),
    median_baseline: 12.5,
    panjang_run: 8,
    batas: 7,
  };

  const masukanWayan = bangunMasukan({ sesi_per_minggu: 3 }, sesiWayan, eskWayan, kini);

  assert.strictEqual(masukanWayan.jumlah_sesi_periode, 6);
  assert.strictEqual(masukanWayan.sesi_7_hari, 3);
  assert.strictEqual(masukanWayan.kepatuhan_7_hari_persen, 100);
  assert.strictEqual(masukanWayan.pct_terkompensasi_median_periode, 32.5);
  assert.strictEqual(masukanWayan.sesi_nyeri, 0);
  assert.deepStrictEqual(masukanWayan.eskalasi_terbuka, {
    median_baseline: 12.5,
    panjang_run: 8,
    batas: 7,
    hari_sejak_dibuka: 5,
  });

  // --- BU MADE ---
  // Urutan pct Made dari seed (0003_sintetis.sql:93, 6 sesi terakhir) adalah [20, 15, 25, 20, 15, 25] (urut waktu) -> median 20, sesi_nyeri 2
  const sesiMade: RawSesi[] = [
    { mulai: tWayanSesi6, rep_terukur: 20, pct_terkompensasi: 20, pct_tak_terukur: 0, nyeri: 0 },
    { mulai: tWayanSesi5, rep_terukur: 20, pct_terkompensasi: 15, pct_tak_terukur: 0, nyeri: 0 },
    { mulai: tWayanSesi4, rep_terukur: 20, pct_terkompensasi: 25, pct_tak_terukur: 0, nyeri: 1 },
    { mulai: tWayanSesi3, rep_terukur: 20, pct_terkompensasi: 20, pct_tak_terukur: 0, nyeri: 0 },
    { mulai: tWayanSesi2, rep_terukur: 20, pct_terkompensasi: 15, pct_tak_terukur: 0, nyeri: 0 },
    { mulai: tWayanSesi1, rep_terukur: 20, pct_terkompensasi: 25, pct_tak_terukur: 0, nyeri: 2 },
  ];

  const masukanMade = bangunMasukan({ sesi_per_minggu: 3 }, sesiMade, null, kini);
  assert.strictEqual(masukanMade.jumlah_sesi_periode, 6);
  assert.strictEqual(masukanMade.pct_terkompensasi_median_periode, 20);
  assert.strictEqual(masukanMade.sesi_nyeri, 2);
  assert.strictEqual(masukanMade.eskalasi_terbuka, null);

  // --- PAK NYOMAN ---
  // 2 sesi (umur 12 dan 9 hari), sesi_7_hari 0, kepatuhan 0, median pct 22.5
  const sesiNyoman: RawSesi[] = [
    {
      mulai: new Date(kini.getTime() - 12 * 86400000),
      rep_terukur: 20,
      pct_terkompensasi: 20,
      pct_tak_terukur: 0,
      nyeri: 0,
    },
    {
      mulai: new Date(kini.getTime() - 9 * 86400000),
      rep_terukur: 20,
      pct_terkompensasi: 25,
      pct_tak_terukur: 0,
      nyeri: 0,
    },
  ];

  const masukanNyoman = bangunMasukan({ sesi_per_minggu: 3 }, sesiNyoman, null, kini);
  assert.strictEqual(masukanNyoman.jumlah_sesi_periode, 2);
  assert.strictEqual(masukanNyoman.sesi_7_hari, 0);
  assert.strictEqual(masukanNyoman.kepatuhan_7_hari_persen, 0);
  assert.strictEqual(masukanNyoman.pct_terkompensasi_median_periode, 22.5);
  assert.strictEqual(masukanNyoman.eskalasi_terbuka, null);
});

