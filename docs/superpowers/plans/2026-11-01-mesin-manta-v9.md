# Mesin Pose + `/uji` + Aset ReminiCare (bagian Manta) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelesaikan bagian Manta sesuai spec v1.1:
- Memperbaiki mesin kinematik yang sudah ada di `main` sampai memenuhi kontrak §6 dan 7 tes §6.12.
- Membangun `/uji` (F17) dengan ekspor CSV.
- Memasang mesin asli ke layar sesi bersama Ari (G1).
- Menyiapkan aset suara/video.
- Menjalankan uji kompensasi §12.3 sampai keputusan 07.30.

**Architecture:** Mesin tetap berupa fungsi murni di `lib/kinematik/*`, tanpa DOM, dan diuji `node --test` dengan deret pose sintetis. Kamera dan MediaPipe hanya ada di `lib/pose.ts`. `/uji` adalah client page tanpa login dan tanpa database. Logika CSV-nya dipisah ke `lib/uji.ts`, supaya bisa diuji.

**Tech Stack:** `@mediapipe/tasks-vision` 1.2.0 (aset di `public/mediapipe/1.2.0/`), Next.js 16 App Router, TypeScript, `node --test` (Node ≥ 22.18, type stripping).

**Spec:** `SPEC-ReminiCare-ramping.md` v1.1 (§1, §2, §3 A2/A3/A5/A6/A8–A11, §4.5, §5, §6, §7, §10.7, §10.10, §12.1, §12.3, §14 no. 1/8/11/12/13) dan `PRD-ReminiCare.md` v1.8. Keduanya ada di folder lomba; salin ke `docs/` sebelum mulai (spec §0).

**Titik mulai:** mesin ada di `origin/main` (commit `ef86007`, ditulis Ari), sedangkan checkout lokal sedang di branch `backend` yang belum punya file mesin. Mulai dari `git switch main && git pull`, lalu `git switch -c feat/mesin-manta`. Mulai sekarang file `lib/kinematik/*`, `lib/pose.ts`, `app/uji/*`, `lib/uji*.ts`, `public/mediapipe|audio|video/*`, dan `data/uji/*` milik Manta (spec §5). Kabari Ari soal ini.

---

## Dampak V9 untuk Manta

Kontrak mesin §6 tidak berubah. Yang berubah hanya ini:
- **A5 I-SETUJU** direkam dari naskah final Pindra, yang sekarang memuat kalimat akun Google (spec §10.5 butir 2 dan 4). Jangan rekam dari `TEKS_SETUJU` placeholder.
- **Tamu** sekarang mengisi resep sendiri (repetisi 5–20, toleransi apa pun, Penuh/Mati), tetapi kandidat condong tamu tetap `'a'` [V8]. Mesin harus aman untuk semua kombinasi resep. Tes Task 2 memakai Penuh dan Mati.
- **`/uji` tetap tanpa login.** Halaman ini tidak memanggil database, dan tidak ditautkan dari UI **[keputusan plan]**.

## Inventaris: repo (`origin/main`) vs spec v1.1

| Aksi | Apa | Di mana | Task |
|---|---|---|---|
| **Ubah** (kritis) | `mesin.ts` mengimpor `FC_HZ`, `HZ` dari `./sinyal.ts`, padahal tidak diekspor di sana. Akibatnya galat link ESM di Node, dan di bundler `koefButterworth(undefined, undefined)` membuat semua sampel NaN | `lib/kinematik/mesin.ts:11` | 1 |
| **Ubah** (kritis) | `HasilKalibrasi` diimpor dari `tipe.ts` tetapi tidak didefinisikan, jadi `tsc` gagal | `lib/kinematik/fitur.ts:7`, `tipe.ts` | 1 |
| **Ubah** | Event `gating` tidak pernah dipancarkan, jadi I-GATING di `sesi-state.ts:140` tidak pernah bunyi | `mesin.ts` | 2 |
| **Ubah** | `HasilRepetisi.koreksi` selalu `null` (koreksi tidak disimpan ke repetisi berjalan), sehingga kolom CSV `koreksi_kode`/`latensi_ms` kosong | `mesin.ts:prosesTertunda` | 2 |
| **Ubah** | `bagus` tidak dibatasi mode Penuh, dan penghitung bagus tidak direset di `mulaiGerakan` | `mesin.ts` | 2 |
| **Ubah** | Event `sampel` dipancarkan per sampel resample. Spec meminta 1 per `dorong()` | `mesin.ts` | 2 |
| **Ubah** | `per_penanda` diisi **rata-rata fraksi**. Dasbor F13 (`[id]/page.tsx:1670`) dan data sintetis memakai **jumlah repetisi** | `mesin.ts:agregatSesi` | 2 |
| **Ubah** | `vP = 0` belum membuat `terukur = false` (spec §6.7 langkah 1). `jumlahPuncak` belum memilih puncak yang lebih tinggi bila dua puncak < 100 ms | `repetisi.ts` | 2 |
| **Ubah** | Resampler menginterpolasi celah panjang (tab tersembunyi), sehingga bisa terbentuk gerakan palsu. Celah > 500 ms → mulai grid baru **[keputusan plan]** | `sinyal.ts:buatResampler` | 2 |
| **Ubah** | `pose.ts`: `typeof RunningMode.VIDEO` (tipe saja, cukup `'VIDEO'`); frame video yang sama diproses dua kali di rAF 60 Hz; GPU yang gagal saat `detectForVideo` pertama belum jatuh ke CPU | `lib/pose.ts` | 3 |
| **Ubah** | Konstanta `AMBANG_AWAL` / `AMBANG_VERSI` (05.30) dan `KANDIDAT_CONDONG` / `SUARA_CONDONG` (07.30) | `tipe.ts` | 8 |
| **Tambah** | `lib/kinematik/kinematik.test.ts` (7 kasus §6.12 + gating + agregat + celah) | baru | 1, 2 |
| **Tambah** | `public/mediapipe/LICENSE` (Apache 2.0, F18) | baru | 3 |
| **Tambah** | `lib/uji.ts` + `lib/uji.test.ts` (kolom CSV, baris rep/statis, nama file) dan `app/uji/page.tsx` | baru | 4 |
| **Tambah** | 41 klip + I-SETUJU-n (`public/audio/<KODE>.mp3`), 2 video (`public/video/*.mp4`), CSV uji (`data/uji/*.csv`), A2, A8, A9, A11 | baru | 6, 7, 8 |
| **Hapus** | Impor dan variabel yang tidak dipakai (`ki`/`ka` di `sinyal.ts`, `AMBANG_AWAL`, `Sisi`, ternary `gerakanAktif` di `mesin.ts`). Tidak ada file Manta yang dihapus; `lib/mesin-tiruan.ts` milik Ari dan boleh dibuang Ari setelah Task 5 | — | 1, 2 |
| **Tetap** | `tipe.ts` (sama persis dengan §6.1–§6.2), `koefButterworth`, `buatBiquad`, `filtfilt`, `keSampel`, `hitungFitur`, `ambangEfektif`, `hitungPenanda`, `buatGating`, `buatPemantau`, `kalibrasi`, `langkahRep`, `kecepatan`, `onsetOffset`, `buatKoreksi`, aset MediaPipe 1.2.0, `headers()` di `next.config.ts` | — | — |

## Global Constraints

- Kode `lib/kinematik/*` dan `lib/uji.ts`: fungsi murni, tanpa DOM, impor relatif berekstensi `.ts`, tanpa `enum`/`namespace`/parameter property, tanpa alias `@/`. Tes: `npm test` (= `node --test "lib/**/*.test.ts"`).
- Waktu dalam ms dari timestamp rAF (basisnya sama dengan `performance.now()`). Timestamp yang sama dikirim ke `detectForVideo`.
- Bingkai yang masuk ke `detectForVideo` tidak dicerminkan; cermin hanya lewat CSS.
- Konstanta §6.2 dipakai apa adanya: `HZ = 30`, `FC_HZ = 5`, `GATING { masuk 0.5, lepas 0.6, jendelaMs 1000, tahanMs 1000 }`, `REP { mulai 0.25, jauh 0.6, minMs 800, maksMs 15000, padMs 500 }`, `ONSET { utama 0.10, alt 0.05 }`, `PUNCAK { fraksi 0.20, jarakMs 100 }`, `KOREKSI { debounceMs 300, samaMs 4000, antarMs 1500 }`, `KALIB { durasiMs 5000, sdMaks 0.02, minFraksi 0.5, maksGagal 3 }`, `BAGUS_BERUNTUN = 3`.
- Mode tamu selalu `kandidat: 'a'`. `SUARA_CONDONG` berlaku global, termasuk tamu.
- Koefisien Butterworth fc 5 / fs 30: b0 = b2 = 0,1550510; b1 = 0,3101021; a1 = −0,6202041; a2 = 0,2404082.
- Audio: MP3 mono 44,1 kHz 96 kbps, hening awal < 50 ms, hening akhir ≤ 200 ms, kenyaringan dinormalisasi, nama `public/audio/<KODE>.mp3`, suara laki-laki.
- Video: `public/video/jangkau_depan.mp4`, `public/video/jangkau_samping.mp4`; loop 5–10 dtk, tanpa suara, < 1 MB, tampak depan, duduk, lengan kanan.
- CSV `/uji`: nama `uji_{subjek}_{posisi}_{yyyymmdd-hhmm}.csv`; tidak ada bingkai yang disimpan; kolom persis spec §10.10.
- P1 (histogram, kamera oblik, kanal visual) tidak dibangun sebelum G2 hijau.

## Review Focus

1. **Mesin mati diam-diam di browser.** Impor yang tidak ada berubah jadi `undefined`, lalu semua fitur NaN, sehingga tidak ada koreksi dan tidak ada repetisi, tanpa galat yang terlihat. Ditangkap tes Task 1: mengimpor `mesin.ts` di Node langsung gagal link, dan tes 3 menghitung repetisi.
2. **Tab disembunyikan atau HP dikunci saat sesi.** Celah frame panjang diinterpolasi menjadi gerakan palsu. Tes celah ada di Task 2.
3. **fps tampak 30 terus.** `Sesi.tsx` menghitung fps dengan rumus konstan, dan rAF 60 Hz memproses frame kamera yang sama dua kali. Tangani di Task 3 (lewati frame dobel) dan Task 5 (fps dari timestamp frame).
4. **Latensi suara salah jam.** `suara.ucap` mengembalikan `tMulai` dari `Date.now()`, sedangkan `tDeteksi` berbasis `performance.now()`. NFR-2 jadi tidak bermakna. Di Task 4, latensi dihitung `performance.now() − tDeteksi` tepat setelah `await suara.ucap(...)`.
5. **`per_penanda` pecahan, padahal dasbor membaca jumlah.** Fisioterapis melihat "0,3 repetisi". Tes agregat ada di Task 2.

---

### Task 1: Perbaiki impor/tipe + tes dasar sinyal dan kalibrasi (±40 menit)

**Files:**
- Modify: `lib/kinematik/mesin.ts:4-13` (impor `FC_HZ`, `HZ` dari `./tipe.ts`; buang impor yang tidak dipakai)
- Modify: `lib/kinematik/fitur.ts` (definisikan `export type HasilKalibrasi = { ok: true; baseline: Baseline } | { ok: false; alasan: 'gerak' | 'keyakinan' }` di sini, sesuai spec §6.6; buang dari impor `tipe.ts`)
- Modify: `lib/kinematik/sinyal.ts` (buang `ki`, `ka`)
- Create: `lib/kinematik/kinematik.test.ts`

**Interfaces:**
- Produces: di file tes, `type Ubah = { swKali?: number; tinggiKali?: number; dp?: number; panggulY?: number; bahuDx?: number }`, `acak(seed: number): () => number`, helper `frame(t: number, u: Ubah, r: () => number): FrameMentah`, dan `jalankan(m: Mesin, dariMs: number, sampaiMs: number, u: (t: number) => Ubah): EventMesin[]` di file tes. Task 2 memakai keduanya.

- [ ] **Step 1: Tulis helper + tes 6 dan 7.** Geometri pose duduk (W 640, H 480, ternormalisasi):
  - Bahu 11/12: `(cx ∓ 0.1·swKali, yS)`, dengan `cx = 0.5 + bahuDx`, `yH = panggulY ?? 0.75`, `yS = yH − 0.35·tinggiKali`. Jadi SW0 = 128 px dan tinggi = 168 px.
  - Panggul 23/24: `(0.42, yH)` / `(0.58, yH)`.
  - Telinga kanan 8: `(cx + 0.05, yS − 0.12)`. Siku kanan 14: `(0.62, yS + 0.15)`.
  - Pergelangan kanan 16: `(0.6, 0.7 − dp·0.2667)`, dengan 0.2667 = 128/480. Jadi `dp` di helper sama dengan `dp` mesin.
  - Titik lain `(0.5, 0.5)`. Semua visibility 0,9.
  - Derau ±0,002 dari LCG berbenih (`seed = (seed·1664525 + 1013904223) mod 2³²`), supaya deterministik.
  - World: 33 titik `(0,0,0)`, kecuali bahu 11/12 `(∓0.15, −0.5, 0)`, jadi T0 = 0,5.
  - `sisi` = `'kanan'`, `t` tiap 33 ms.

```ts
test('6: biquad + filtfilt pada deret konstan tetap konstan; koefisien §6.3', () => {
  const k = koefButterworth(5, 30);
  assert.ok(Math.abs(k.b0 - 0.1550510) < 1e-6 && Math.abs(k.b1 - 0.3101021) < 1e-6);
  assert.ok(Math.abs(k.a1 + 0.6202041) < 1e-6 && Math.abs(k.a2 - 0.2404082) < 1e-6);
  const bq = buatBiquad(k);
  for (let i = 0; i < 50; i++) assert.ok(Math.abs(bq(3.7) - 3.7) < 1e-9);
  for (const y of filtfilt(Array(40).fill(3.7), k)) assert.ok(Math.abs(y - 3.7) < 1e-9);
});

test('7: kalibrasi — diam ok, bahu berosilasi 0,05·SW → gerak', () => {
  const r = acak(7);
  const diam = Array.from({ length: 150 }, (_, i) => frame(i * 33, {}, r));
  const ok = kalibrasi(diam, 'kanan');
  assert.ok(ok.ok && Math.abs(ok.baseline.SW0 - 128) < 2 && Math.abs(ok.baseline.h0 - 168 / 128) < 0.03);
  const goyang = Array.from({ length: 150 }, (_, i) =>
    frame(i * 33, { bahuDx: 0.01 * Math.sin((2 * Math.PI * i * 33) / 1000) }, r));
  assert.deepEqual(kalibrasi(goyang, 'kanan'), { ok: false, alasan: 'gerak' });
});
```

  Di file yang sama, `import { buatMesin } from './mesin.ts'`. Impor ini sekaligus menjadi tes link.

- [ ] **Step 2: Jalankan `npm test`.**
  Expected: FAIL `does not provide an export named 'FC_HZ'`.
- [ ] **Step 3: Perbaiki impor dan tipe** sesuai daftar Files.
- [ ] **Step 4: Jalankan `npm test` dan `npx tsc --noEmit`.**
  Expected: tes 6 dan 7 PASS; tsc tanpa galat di `lib/kinematik/*`.
- [ ] **Step 5: Commit**

```bash
git add lib/kinematik/mesin.ts lib/kinematik/fitur.ts lib/kinematik/sinyal.ts lib/kinematik/kinematik.test.ts
git commit -m "fix(mesin): impor FC_HZ/HZ dan tipe HasilKalibrasi, tes sinyal + kalibrasi"
```

### Task 2: Orkestrator sesuai §6.9 + tes 1–5 (±75 menit)

**Files:**
- Modify: `lib/kinematik/mesin.ts` (`buatMesin`, `agregatSesi`)
- Modify: `lib/kinematik/repetisi.ts` (`nilaiRepetisi` langkah 1, `jumlahPuncak`)
- Modify: `lib/kinematik/sinyal.ts` (`buatResampler`: celah > 500 ms → `prev = cur`, `t0 = cur.t`, `k = 0`, kembalikan `[]`)
- Test: `lib/kinematik/kinematik.test.ts`

**Interfaces:**
- Consumes: helper Task 1.
- Produces: `buatMesin(cfg, b)` dengan event sesuai §6.1 dan `HasilRepetisi.koreksi` terisi; `agregatSesi` dengan `per_penanda` berupa jumlah. Dipakai Ari (Task 5) dan `/uji` (Task 4).

- [ ] **Step 1: Tulis tes.**
  - `cfg` = `{ sisi: 'kanan', durasiPersen: 30, tolBatang: 'normal', tolBahu: 'normal', mode: 'penuh', kalimat: 'sandaran', kandidat: 'a', suaraCondong: true }`.
  - Baseline dari `kalibrasi` 5 dtk diam.
  - `mesin.mulaiGerakan('jangkau_depan')`.
  - `kondong = { swKali: 1.08, tinggiKali: 0.94 }`.
  - Setiap tes membuat `r = acak(1)` dan `m = buatMesin(cfg, b)` yang baru (`beforeEach`), supaya state tidak terbawa antar-tes.
  - `jalankan` mengirim `frame(t, u(t), r)` tiap 33 ms dan mengumpulkan semua event, lalu memanggil `m.akhiri()` di akhir.

```ts
test('1: netral 10 dtk → 0 koreksi, batang tidak pernah true', () => {
  const ev = jalankan(m, 5000, 15000, () => ({}));
  assert.equal(ev.filter(e => e.jenis === 'koreksi').length, 0);
  assert.ok(ev.every(e => e.jenis !== 'sampel' || !e.penanda.batang));
});
test('2: condong buatan → batang true untuk kandidat a dan c', () => {
  for (const kandidat of ['a', 'c'] as const) {
    const ev = jalankan(buatMesin({ ...cfg, kandidat }, b), 5000, 7000, () => kondong);
    assert.ok(ev.some(e => e.jenis === 'sampel' && e.penanda.batang), kandidat);
  }
});
test('3: sinus dp 15 dtk + diam 1 dtk → tepat 5 repetisi; bagus hanya di hitungan 3 (Penuh), tidak ada di Mati', () => {
  const dp = (t: number) => (t < 20000 ? 0.4 * (1 - Math.cos((2 * Math.PI * (t - 5000)) / 3000)) : 0);
  const rep = jalankan(m, 5000, 21000, t => ({ dp: dp(t) })).filter(e => e.jenis === 'repetisi');
  assert.equal(rep.length, 5);
  assert.deepEqual(rep.map(e => e.bagus), [false, false, true, false, false]);
  const mati = jalankan(buatMesin({ ...cfg, mode: 'mati' }, b), 5000, 21000, t => ({ dp: dp(t) }));
  assert.ok(mati.every(e => e.jenis !== 'repetisi' || !e.bagus) && mati.every(e => e.jenis !== 'koreksi'));
});
test('4: satu repetisi lambat 6 dtk, condong on/off/on 500 ms → tepat 1 koreksi, tersimpan di hasil', () => {
  const dp = (t: number) => (t < 11000 ? 0.4 * (1 - Math.cos((2 * Math.PI * (t - 5000)) / 6000)) : 0);
  const kon = (t: number) => (t >= 6500 && t < 7000) || (t >= 7500 && t < 8000);
  const ev = jalankan(m, 5000, 12000, t => ({ dp: dp(t), ...(kon(t) ? kondong : {}) }));
  assert.equal(ev.filter(e => e.jenis === 'koreksi').length, 1);
  assert.equal(m.hasil()[0].koreksi?.kode, 'K-CONDONG-S');
});
test('5: condong saat panggul y = 1,05 → 0 koreksi', () => {
  const dp = (t: number) => (t < 11000 ? 0.4 * (1 - Math.cos((2 * Math.PI * (t - 5000)) / 6000)) : 0);
  const ev = jalankan(m, 5000, 12000, t => ({ dp: dp(t), ...kondong, panggulY: 1.05 }));
  assert.equal(ev.filter(e => e.jenis === 'koreksi').length, 0);
});
test('gating: panggul keluar 2 dtk lalu kembali → event gating aktif lalu lepas', () => {
  const ev = jalankan(m, 5000, 10000, t => (t >= 6000 && t < 8000 ? { panggulY: 1.05 } : {}));
  assert.deepEqual(ev.filter(e => e.jenis === 'gating').map(e => e.aktif), [true, false]);
});
test('sampel: maksimal 1 event per dorong()', () => {
  for (let t = 5000; t < 6000; t += 33) assert.ok(m.dorong(frame(t, {}, r)).filter(e => e.jenis === 'sampel').length <= 1);
});
test('celah 2 dtk tidak diinterpolasi', () => {
  const rs = buatResampler();
  rs.dorong(keSampel(frame(0, {}, r), 'kanan', null));
  assert.equal(rs.dorong(keSampel(frame(2000, { dp: 0.8 }, r), 'kanan', null)).length, 0);
});
test('agregatSesi: per_penanda = jumlah repetisi terukur yang terkompensasi per penanda', () => {
  // 3 HasilRepetisi buatan untuk jangkau_depan: (terukur, batang), (terukur, —), (tak terukur, batang)
  assert.deepEqual(agregatSesi({ ...dasar, hasil: tiga }).per_gerakan.jangkau_depan.per_penanda, { batang: 1, bahu: 0 });
});
```

- [ ] **Step 2: Jalankan `npm test`.**
  Expected: FAIL pada tes gating (tidak ada event), 4 (`koreksi` null), 3 (`bagus` di Mati), sampel, celah, dan agregat.
- [ ] **Step 3: Implementasi.**
  - Simpan `gatingSebelum`; pancarkan `{ jenis: 'gating', aktif, t }` bila berubah.
  - `korBerjalan` diisi saat event `koreksi`, direset saat DIAM → BERGERAK, lalu ikut disimpan ke `tertunda` dan `hasil.koreksi`.
  - `bagus = cfg.mode === 'penuh' && penghitung.tambah(...)`. `mulaiGerakan` membuat penghitung baru.
  - Event `sampel` hanya untuk sampel terakhir dari `resampler.dorong`.
  - `per_penanda = { batang: gt.filter(r => r.kompensasi.batang).length, bahu: gt.filter(r => r.kompensasi.bahu).length }`.
  - `nilaiRepetisi`: bila `vP = 0`, `terukur = false` dan semua metrik null.
  - `jumlahPuncak`: puncak yang berjarak < 100 ms dari puncak sebelumnya menggantikan puncak itu bila lebih tinggi.
- [ ] **Step 4: Jalankan `npm test` dan `npx tsc --noEmit`.**
  Expected: semua tes kinematik PASS, plus tes lama (`sesi-state`, `mesin-tiruan`, dll.) tetap PASS.
- [ ] **Step 5: Commit**

```bash
git add lib/kinematik/
git commit -m "fix(mesin): event gating, koreksi per repetisi, bagus per mode, per_penanda jumlah, celah frame"
```

### Task 3: `lib/pose.ts` + LICENSE (±30 menit)

**Files:**
- Modify: `lib/pose.ts`
- Create: `public/mediapipe/LICENSE` (salin teks Apache 2.0 dari `node_modules/@mediapipe/tasks-vision/LICENSE` bila ada, atau teks resmi Apache-2.0)

**Interfaces:**
- Produces (tetap): `mulaiPose(video: HTMLVideoElement, onFrame: (f: FrameMentah) => void): Promise<{ delegate: 'GPU' | 'CPU'; berhenti(): void }>`.

- [ ] **Step 1: Implementasi.**
  - `runningMode: 'VIDEO'` tanpa cast.
  - Di `loop`, lewati frame bila `video.currentTime` sama dengan frame sebelumnya (`onFrame` tidak dipanggil).
  - Bungkus `detectForVideo` pertama dengan try/catch: bila galat dan delegate masih GPU, `close()` lalu buat ulang dengan `delegate: 'CPU'` dan set `delegate = 'CPU'`.
  - Supaya delegate setelah fallback terbaca, kembalikan getter: `get delegate() { return delegate; }`.
- [ ] **Step 2: Verifikasi manual.** Buka halaman uji sementara (atau `/uji` setelah Task 4) di Chrome laptop. Console mencatat jumlah `onFrame` per detik.
  Expected: ≤ fps kamera (sekitar 30), tidak 60. Delegate `GPU`. Dengan `chrome://flags` WebGL dimatikan, delegate `CPU` dan pose tetap jalan.
- [ ] **Step 3: Cek header di production** (NFR-8): `curl -sI https://<url-production>/mediapipe/1.2.0/pose_landmarker_lite.task | grep -i cache-control`.
  Expected: `public, max-age=31536000, immutable`. `/mediapipe/LICENSE` tersaji.
- [ ] **Step 4: Commit**

```bash
git add lib/pose.ts public/mediapipe/LICENSE
git commit -m "fix(pose): lewati frame dobel, fallback CPU saat detect, lisensi MediaPipe"
```

### Task 4: `/uji` (F17) dengan CSV (±90 menit)

**Files:**
- Create: `lib/uji.ts`, `lib/uji.test.ts`
- Create: `app/uji/page.tsx`

**Interfaces:**
- Consumes: `mulaiPose` (Task 3), `kalibrasi`, `buatMesin`, `EventMesin`, `HasilRepetisi`, `KANDIDAT_CONDONG`, `AMBANG_VERSI` (Task 2), `suara` (Ari, `lib/suara.ts`).
- Produces (`lib/uji.ts`):
  - `export const KOLOM_CSV: readonly string[]`, persis daftar kolom spec §10.10, dalam urutan yang sama.
  - `export type MetaSet = { subjek: string; sisi: Sisi; gerakan: Gerakan; label: 'normal' | 'condong' | 'miring' | 'elevasi'; sudut: 0 | 10 | 20 | 30 | null; posisi: 'depan' | 'oblik'; repInstruksi: number; mode: 'penuh' | 'mati'; durasiPersen: number }`.
  - `export function setId(m: MetaSet): string` → `{subjek}-{gerakan}-{label}-{sudut ?? 'x'}`.
  - `export function barisRep(m: MetaSet, h: HasilRepetisi, x: { waktuIso: string; fps: number; delegate: string; jalurSuara: string; latensiMs: number | null }): Record<string, string | number>`.
  - `export function barisStatis(m: MetaSet, sampel: Extract<EventMesin, { jenis: 'sampel' }>[], waktuIso: string): Record<string, string | number>`: median `fitur` untuk kolom `*_puncak`, fraksi aktif `condongA/B/C`, `miring`, `el` untuk kolom `fraksi_*`, dan kolom lain kosong.
  - `export function keCsv(baris: Record<string, string | number>[]): string`.
  - `export function namaFile(subjek: string, posisi: string, d: Date): string`.

- [ ] **Step 1: Tulis `lib/uji.test.ts`.**

```ts
test('KOLOM_CSV mengikuti spec §10.10', () => {
  assert.equal(KOLOM_CSV[0], 'waktu_iso');
  assert.equal(KOLOM_CSV.at(-1), 'panggul_y_maks');
  assert.equal(KOLOM_CSV.length, 49);
});
test('barisRep: kep_batang_x memakai fraksiBatangKandidat ≥ durasi/100; kep_bahu memakai fraksi.el', () => {
  const b = barisRep(meta, hasilContoh /* fraksiBatangKandidat {a:.35,b:.1,c:.29}, fraksi.el .4 */, ekstra);
  assert.deepEqual([b.kep_batang_a, b.kep_batang_b, b.kep_batang_c, b.kep_bahu], [1, 0, 0, 1]);
  assert.equal(b.tipe, 'rep'); assert.equal(b.set_id, 'S1-jangkau_depan-condong-20');
});
test('barisStatis: median fitur dan fraksi aktif 3 dtk', () => {
  const b = barisStatis(meta, [s(0.1, true), s(0.3, false), s(0.2, true)], iso);
  assert.equal(b.w_puncak, 0.2); assert.ok(Math.abs(Number(b.fraksi_condong_a) - 2 / 3) < 1e-9);
  assert.equal(b.tipe, 'statis'); assert.equal(b.rep_ke, '');
});
test('keCsv: header + kutip untuk koma/kutip', () => {
  const csv = keCsv([{ ...kosong, subjek: 'a,"b"' }]);
  assert.ok(csv.startsWith(KOLOM_CSV.join(',') + '\n') && csv.includes('"a,""b"""'));
});
test('namaFile', () => {
  assert.equal(namaFile('S1', 'depan', new Date(2026, 10, 1, 5, 30)), 'uji_S1_depan_20261101-0530.csv');
});
```

  Fixture:
  - `meta = { subjek: 'S1', sisi: 'kanan', gerakan: 'jangkau_depan', label: 'condong', sudut: 20, posisi: 'depan', repInstruksi: 10, mode: 'penuh', durasiPersen: 30 }`.
  - `s(w, condongA)` membuat event `sampel` dengan `fitur.w = w` dan `penanda.condongA = condongA`; field lain nol/false.
  - `kosong` = objek berisi semua `KOLOM_CSV` bernilai `''`.

- [ ] **Step 2: Jalankan `npm test`.**
  Expected: FAIL modul `./uji.ts` tidak ada.
- [ ] **Step 3: Implementasi `lib/uji.ts`.** Boolean ditulis `1`/`0`, null ditulis kosong, angka apa adanya. `durasi_ms = tSelesai − tMulai`. `kandidat_aktif = KANDIDAT_CONDONG`.
- [ ] **Step 4: Implementasi `app/uji/page.tsx`** (spec §10.10):
  - Form sebelum tiap set, berisi field `MetaSet`. Bawaan `repInstruksi` 10, mode Penuh.
  - Tombol: Kalibrasi, Mulai set, Akhiri set, Rekam statis 3 dtk, Ekspor CSV, Hapus baris.
  - Tabel live dari event `sampel`: w, d, r, zb, Δθ, el, Δθ3D, dp, status, gating, skor, fps, delegate, jalur suara, flag condongA/B/C, miring, el.
  - Pada event `repetisi`, buat baris lewat `barisRep`.
  - Pada `koreksi`, panggil `await suara.ucap(kode, { prioritas: true })`, lalu `latensiMs = performance.now() − tDeteksi` (Review Focus 4). Simpan sampai repetisi itu selesai.
  - fps = jumlah `onFrame` dalam 1 dtk terakhir.
  - Baris disimpan di state dan autosave `rc_uji` (try/catch).
  - Ekspor memakai `Blob` + `<a download={namaFile(...)}>`.
  - Tanpa login dan tanpa Supabase.
- [ ] **Step 5: Verifikasi manual** di Chrome laptop: kalibrasi → satu set normal 10 repetisi → satu rekam statis → ekspor.
  Expected:
  - CSV terbuka di spreadsheet, berisi 11 baris (10 `rep` + 1 `statis`) dengan header persis.
  - Hitungan mesin ≈ 10.
  - Setelah reload halaman, baris masih ada.
  - Tab Network: tidak ada permintaan selain aset statis.
- [ ] **Step 6: Commit**

```bash
git add lib/uji.ts lib/uji.test.ts app/uji/page.tsx
git commit -m "feat(uji): halaman /uji dengan rekam set, rekam statis, ekspor CSV (F17)"
```

### Task 5: Pasang mesin asli ke layar sesi bersama Ari (G1, ±60 menit)

**Files:** `components/Sesi.tsx` dan `components/sesi/*` milik Ari. Manta menulis bersama Ari dan tidak mengubah file lain.

**Interfaces:**
- Consumes: `mulaiPose`, `buatPemantau`, `kalibrasi`, `buatMesin`, `agregatSesi`, `KANDIDAT_CONDONG`, `SUARA_CONDONG`, `AMBANG_VERSI`.

- [ ] **Step 1: Satu `mulaiPose` per sesi.** Frame dirutekan lewat ref sesuai state layar:
  - `panduan` → `pemantau.dorong(f)` → tombol Siap aktif bila `!gating`.
  - `kalibrasi` → kumpulkan frame 5 dtk → `kalibrasi(frames, sisi)`. Gagal → I-KALIB-ULANG; gagal ke-3 → kembali ke panduan.
  - `gerakan` → `mesin.dorong(f)` → handler event yang sudah ada.
- [ ] **Step 2: `KonfigSesi` dari resep.** `kandidat = tamu ? 'a' : KANDIDAT_CONDONG`, `suaraCondong = SUARA_CONDONG`. Salinan resep membawa `kandidat_condong`, `suara_condong`, `ambang_versi`.
- [ ] **Step 3: fps dan delegate.** fps dihitung dari timestamp frame (median selisih → `fpsMedian`), menggantikan rumus konstan di `Sesi.tsx`. `delegate` dibaca dari hasil `mulaiPose`. `agregatSesi` menerima `baseline` dari kalibrasi. `buatMesinTiruan` tidak dipakai lagi.
- [ ] **Step 4: Verifikasi butir G1** (spec §2) di Chrome laptop:
  - Kalibrasi jalan.
  - Hitungan "N-k" terdengar dari mesin asli.
  - Condong sengaja → satu koreksi per repetisi.
  - Panggul keluar bingkai → I-GATING.
  - Mode Mati → tanpa K-* dan I-BAGUS.
  - Sesi tersimpan, dan baris `sesi` di Supabase berisi `per_penanda` berupa bilangan bulat.
  Expected: semua butir lolos.
- [ ] **Step 5: Ari yang commit**, karena file-file ini miliknya.

### Task 6: Aset suara dan video (A3, A5, A6)

**Files:** `public/audio/<KODE>.mp3`, `public/video/jangkau_depan.mp4`, `public/video/jangkau_samping.mp4`

- [ ] **Step 1: A3, 41 klip** (slot 20.00–21.00): 21 kode `KODE_WAJIB` di `lib/naskah.ts` (termasuk 3 R-*) + `N-1` … `N-20`. Teks diambil dari `NASKAH` setelah Ari mengganti placeholder dengan Lampiran A PRD. Rekam 2 kali, pilih yang terbaik, dan dengarkan ulang dari speaker ponsel pada jarak 2 m.
- [ ] **Step 2: A5, I-SETUJU-1…n** (slot 00.30–01.00): satu klip per paragraf naskah final Pindra, **versi V9** (dengan kalimat akun Google). Jumlah klip = jumlah paragraf `TEKS_SETUJU` setelah diperbarui Ari.
- [ ] **Step 3: A6, 2 video** (slot 01.00–01.30), sesuai Global Constraints.
- [ ] **Step 4: Verifikasi.** Hitung file: `ls public/audio/*.mp3 | wc -l` = 41 + n. Di Chrome desktop (jalur klip), buka sesi tamu: semua instruksi terdengar dan tidak ada kode yang jatuh ke Web Speech. Tiap video < 1 MB.
- [ ] **Step 5: Commit**

```bash
git add public/audio public/video
git commit -m "feat(aset): 41 klip suara, klip persetujuan V9, 2 video peragaan"
```

### Task 7: Aset kertas dan cek awal (A2, A8, A9)

- [ ] **A2 cek foto condong (18.00):** foto diam ponsel setinggi dada, jarak 1,5 m, condong 0/10/20/30° (inklinometer di sternum). Ukur lebar bahu dan jarak tengah bahu–panggul dalam piksel, lalu hitung w, d, r. Catat apakah d < 0,04 dan r ≥ 0,04 pada 20°.
- [ ] **A8 tabel ambang awal (18.30):** sama dengan `AMBANG_AWAL` di `tipe.ts`. Tidak ada perubahan kode.
- [ ] **A9 formulir uji kertas (04.30):** per subjek, tangga 0/10/20/30°, 2 gerakan × 4 kondisi × 10 repetisi, dan set gating. Kolom: hitungan instruksi vs mesin, catatan.

### Task 8: Uji kompensasi §12.3 + keputusan 07.30 (05.00–07.45)

**Files:**
- Create: `data/uji/*.csv` (A10)
- Modify: `lib/kinematik/tipe.ts` (`AMBANG_AWAL`, `AMBANG_VERSI`, `KANDIDAT_CONDONG`, `SUARA_CONDONG`)
- README: tabel A11 (bersama Pindra)

- [ ] **Step 1: S1 Pindra, 05.00–05.30.** Tangga condong (Rekam statis per sudut), 2 gerakan × 4 kondisi × 10 repetisi, dan set gating. Ekspor CSV ke `data/uji/`.
- [ ] **Step 2: Setel ambang dari S1 saja, 05.30–06.00.** Untuk tiap fitur dan gerakan, pilih τ yang memaksimalkan spesifisitas dengan sensitivitas wajar, dibaca dari kolom `*_puncak` per label di spreadsheet. Ubah `AMBANG_AWAL` dan `AMBANG_VERSI = 'S1-0600'`, jalankan `npm test` (tes boleh disesuaikan bila ambang berubah), lalu deploy.
- [ ] **Step 3: S2 Ari (06.00) dan S3 Manta (06.30, Ari jadi operator).** Ekspor CSV.
- [ ] **Step 4: Sens/spes dari S2 + S3, 07.00–07.30**, per penanda per gerakan, dengan n per sel:
  - Positif BATANG = condong + miring; negatifnya normal + elevasi.
  - Positif BAHU = elevasi; negatifnya normal + condong + miring.
  - Pakai `kep_batang_a/b/c`, `kep_miring`, `kep_bahu`.
  - Laju aktif tiga kandidat pada baris `statis` per sudut.
  - Galat hitung = `rep_instruksi` − jumlah baris `rep` per `set_id`.
- [ ] **Step 5: Keputusan 07.30** (spec §12.3):
  - Pilih kandidat dengan sensitivitas tertinggi pada 10° dan 20°, yang spesifisitasnya pada set normal dan miring tidak lebih rendah dari (a). Bila setara, pilih (c).
  - Bila tidak ada kandidat yang aktif andal pada 20°, set `SUARA_CONDONG = false` dan catat R3 terwujud.
  - Bila spesifisitas bahu rendah, bawaan toleransi bahu jadi Longgar.
  - Bila panggul sering gagal di set gating, BATANG dimatikan untuk sesi itu.
  - Ubah `KANDIDAT_CONDONG` / `SUARA_CONDONG`, lalu deploy.
- [ ] **Step 6: Perangkat dan latensi.**
  - fps + delegate di laptop dan Oppo Find X8 (plus HP kelas menengah bila ada).
  - Daftar suara id-ID lokal per perangkat.
  - p95 `latensi_ms` per `jalur_suara` dari CSV (bahan untuk Pindra).
- [ ] **Step 7: Tabel A11 (07.45) ke README dan deck.** Angka ditulis apa adanya, tanpa target lulus.
- [ ] **Step 8: Commit**

```bash
git add data/uji lib/kinematik/tipe.ts
git commit -m "chore(uji): CSV S1-S3, ambang S1-0600, keputusan kandidat condong 07.30"
```

---

## Catatan

- Rumus SD di `kalibrasi` (`√((sd_x² + sd_y²)/2)`, dengan median sebagai pusat) sedikit berbeda dari kata "SD 2D" di spec. Tes 7 tetap lolos, jadi rumus dibiarkan; ubah hanya bila uji lapangan menunjukkan kalibrasi terlalu longgar.
- `suara.ts` (Ari) memakai `Date.now()` untuk `tMulai`. `/uji` tidak bergantung pada nilai itu (Review Focus 4). Bila Ari mau menyeragamkan, cukup ganti ke `performance.now()`.
- `.gitignore` mengabaikan `*.md`, jadi file rencana ini perlu `git add -f` bila ingin di-commit.
