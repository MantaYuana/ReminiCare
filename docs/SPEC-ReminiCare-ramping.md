# SPEC ReminiCare: Ramping (P0)

Versi 1.1, 1 November 2026. Turunan dari `PRD-ReminiCare.md` v1.8. Versi 1.1 mengikuti V9: login hanya Google OAuth2 untuk dua peran (fisioterapis, pasien), satu akun = satu peran, sandbox juri diganti tombol "Isi data contoh" / "Atur ulang data contoh", dan mode tamu punya form resep. Isinya hanya P0 dan dibangun SEKARANG. Spec ini tidak mengubah keputusan PRD. Bila PRD diam soal suatu detail, dipakai default paling sederhana dengan tanda **[default spec]**, dan detail itu boleh diubah tanpa rapat. Kontradiksi di PRD dicatat di §14. Spec pasangannya, `SPEC-ReminiCare-lengkap.md` (P0 + P1), baru dipakai setelah G2 hijau.

Aturan: jangan bangun P1 sebelum G2 hijau. Salin kedua spec ke `docs/` di repo begitu repo ada **[default spec]**.

## 0. Cara baca

- `[F07]` merujuk fitur PRD §4.1, `[§7.3]` merujuk bagian PRD, **[V8]** dan **[V9]** adalah keputusan user (dipakai apa adanya), **[default spec]** adalah isian spec, dan **P1** berarti tunda sampai G2 hijau.
- Semua jam memakai WITA. J0 = Sabtu 31 Okt 13.00. Akhir = Minggu 1 Nov 11.00 (22 jam).
- Peta label J di PRD ke jam nyata:

| Label PRD | Isi | Jam di spec |
|---|---|---|
| J0–2 | Setup | 17.00–18.00 (padat; mulai telat 4 jam) |
| J4 | Uji login Google + `daftar` + RLS dengan akun Google tim | 19.00 |
| J8 | Uji fungsi murni `node --test` | 23.00–24.00 |
| J10 gerbang | Event mesin masuk UI asli, sesi tersimpan lewat RLS | **G1 24.00** |
| J12 | fps + delegate di perangkat | 01.30–03.00 |
| J14 | Uji eskalasi; RLS ulang | 22.30 (eskalasi SQL); 03.00 (RLS ulang) |
| J15 | Uji F20, mode koreksi, offline, persetujuan | 03.00–04.30 |
| J16 gerbang | E2E di URL production, lalu feature freeze | **G2 05.00** |
| J16–20 | Uji kompensasi §11.1 | 05.00–07.30 |
| J18 | Pilih kandidat condong + K-CONDONG | **07.30** |
| J20 | Rekam tab Network (privasi) | 07.00–07.30 |
| J22 | Tag kandidat, E2E ulang, login Google akun luar tim | 10.00 |
| J23.5 | Tag final `submission-24h` | 10.30, lalu submit Devpost 10.45 |

## 1. Batas P0

P0 = F01–F20 [V8], dengan potongan berikut.

| Fitur | Masuk P0 | Tidak di P0 |
|---|---|---|
| F02 resep | Semua field. Pilihan mode koreksi di formulir hanya **Penuh / Mati**. Kalimat condong `sandaran` / `tegak` | Pilihan Ringkasan (P1). Kolom DB sudah menerima `ringkasan` |
| F07 layar sesi | Video dicerminkan CSS, overlay landmark, video peragaan di pojok, hitungan "3 / 10", nama gerakan, indikator keyakinan, fps, tombol Berhenti, urutan gerakan → istirahat 20 dtk → gerakan | Kanal visual: bingkai warna + ikon + label (P1) |
| F08 koreksi | Mode Penuh: maks 1 kalimat per repetisi, aktif ≥300 ms, batang didahulukan atas bahu, jeda 4 dtk / 1,5 dtk, kalimat condong per resep, I-BAGUS | Ringkasan suara 3 tingkat R-* (P1) |
| F10 ringkasan | Layar ringkasan + lapor nyeri, juga di mode Mati [V8] | — |
| F12 dasbor | Muat ulang saat fokus + tombol "Muat ulang" | Realtime S2 (P1) |
| F14 eskalasi | Aturan shift Anhøj + run chart sederhana + Tinjau | Aturan crossings (§4.3 PRD) |
| F01 login | Google OAuth2 saja, "Sign Up as Fisioterapis" / "Sign Up as Pasien", satu akun = satu peran. Email/kata sandi dan anonymous sign-in tidak ada [V9] | — |
| F15 tamu | Tautan "Coba latihan tanpa akun", form resep sebelum sesi, bawaan mode Penuh, kalimat `sandaran`; kandidat condong (a) [V8, V9] | — |
| F16 data contoh | "Isi data contoh" / "Atur ulang data contoh" per akun fisioterapis. Sandbox juri dan "Latih sebagai pasien ini" dihapus [V9] | — |
| F17 `/uji` | Label, sudut, posisi, nilai fitur live, rekam set + rekam statis, ekspor CSV lengkap (w, d, r, zb, Δθ, el terpisah) | Histogram per fitur + muat ulang CSV (P1) |
| F18 PWA | Manifest, ikon, cache `immutable` model/wasm, LICENSE | Service worker S3 (P1) |
| F19 | Layar persetujuan + suara, persetujuan dicatat, "Hapus data saya" menghapus sesi **dan** eskalasi [V8] | — |
| F20 | Route Gemini, cek angka, templat cadangan | — |
| §11.1 | 240 repetisi + tangga condong + set gating, tampak depan | Kamera oblik 45° (P1) |

Di luar scope: semua isi PRD §4.3.

Perilaku per mode koreksi di P0:

| Perilaku | Penuh | Mati |
|---|---|---|
| Koreksi suara K-* | Ya, maks 1 per repetisi | Tidak |
| I-BAGUS | Ya | Tidak |
| Hitungan N-k | Ya | Ya |
| Instruksi I-* (kamera, kalibrasi, gating, G1/G2, istirahat, selesai, nyeri) | Ya | Ya **[default spec]** |
| Penanda dihitung dan disimpan | Ya | Ya, jadi data kompensasi tanpa umpan balik |
| Layar ringkasan F10 | Ya | Ya [V8] |
| Kanal visual, R-* | P1 | Tidak |

## 2. Jadwal jam nyata (22 jam)

Peran: **Manta** (mesin pose + perekam suara/video), **Ari** (UI pasien), **Pindra** (backend + dasbor).

| Jam | Manta | Ari | Pindra |
|---|---|---|---|
| 17.00–18.00 | Baca §0–§2 + §6 (15 menit). Salin wasm + model + LICENSE ke `public/mediapipe/` (§4.5). Cek suara id-ID `localService` di Oppo lewat remote debugging. Cek foto condong (A2) | Baca §0–§2 + §10. `create-next-app` (TS, Tailwind, App Router), rute kosong §5, `app/manifest.ts`. Wireframe 20 menit (A1) | Repo `MantaYuana/ReminiCare` (publik, MIT). Supabase ap-southeast-1 + setelan Auth (§4.1). **OAuth client Google (A18, §4.1)**. Vercel + env (§4.2). Deploy "hello" ke production. Kunci Gemini + pin model Flash (§4.3) |
| 18.00–20.00 | `lib/pose.ts` (kamera 640×480, GPU lalu CPU, loop). `sinyal.ts` (resample, Butterworth, filtfilt). `fitur.ts` (fitur, ambang, penanda, gating). `/uji` kasar: nilai fitur live | `/` (Login with Google + Sign up), `/auth/selesai`, `/pasien` beranda (termasuk kolom kode), panduan kamera + izin kamera (F05), kerangka `Sesi.tsx` dengan mesin tiruan (kontrak event §6.10) | `0001_skema.sql` + `daftar` lalu **19.00 uji login Google + `daftar` + RLS** (akun Google tim). `0002_fungsi.sql` (RPC). `lib/supabase.ts` (`masukGoogle`) + guard peran |
| 20.00–21.00 | **SLOT REKAM 1**: 41 klip (A3). Teman memotong hening, menormalisasi, dan mengekspor MP3 | `lib/suara.ts` + `lib/naskah.ts`. Web Speech dulu; klip masuk 21.00 | `FormResep.tsx` + `/terapis/pasien/baru`, `/terapis` dari `v_prioritas`. **Draf naskah F19 (A4) dikirim 21.00** |
| 21.00–23.00 | `repetisi.ts` (mesin status, penilaian, metrik, koreksi), `kalibrasi`, `mesin.ts`. `/uji` lengkap: rekam set, rekam statis, CSV | `Sesi.tsx` lengkap (state §10.7), `/k/[kode]` (login pasien + F03 + F19), ringkasan + nyeri (F10), `/tamu` + form resep (`FormResep` mode lokal) | `0003_sintetis.sql` (`isi_sintetis` + `isi_contoh`) lalu **22.30 uji eskalasi SQL (§12.2)**. Tombol "Isi / Atur ulang data contoh" di `/terapis`. `Grafik.tsx` siap 22.00 (dipakai Ari). Detail pasien: tombol tautan + QR (F03) |
| 23.00–24.00 | `kinematik.test.ts` hijau. Pasang mesin asli ke `Sesi.tsx` bersama Ari | Pasang mesin asli bersama Manta | Detail pasien: tabel sesi + grafik tren (F13). Kerangka README (A13) 23.30 |
| **24.00 G1** | Cek daftar G1 di bawah | ← | ← |
| 00.00–00.30 | Perbaikan integrasi. Ukur fps laptop | `lib/antrean.ts` (F11) + simpan sesi nyata | F13 lanjut. Naskah F19 final 00.00 |
| 00.30–01.30 | **SLOT REKAM 2**: klip I-SETUJU (A5) 00.30–01.00, 2 video peragaan (A6) 01.00–01.30 | F19 "Hapus data saya", mode Penuh/Mati di `Sesi.tsx` | Run chart + Tinjau (F14) |
| 01.30–03.00 | fps + delegate di Oppo (dan HP kelas menengah bila ada), daftar suara per perangkat, log latensi, perbaikan mesin | Aksesibilitas NFR-6, uji suara di Android + layar terkunci | F20: `lib/ringkasan.ts` + route + tes cek angka + kartu UI |
| 03.00–04.00 | Cek header cache model di production (NFR-8). Formulir uji kertas (A9) | Uji mode pesawat (F11). Uji persetujuan, hapus data, klaim ulang, akun fisioterapis buka `/k` ditolak | Uji RLS ulang + Supabase advisors. Uji payload F20. DPIA (A12). Skrip demo (A14) |
| 04.00–05.00 | SEMUA: jalankan skrip demo E2E di URL production, perbaiki yang merah saja | ← | ← |
| **05.00 G2** | Cek daftar G2. Hijau berarti feature freeze; P1 hanya lewat spec lengkap | ← | ← |
| 05.00–05.30 | Operator `/uji`, subjek S1 | Bebas: bug, atau P1 bila G2 hijau | **Subjek S1** |
| 05.30–06.00 | Setel ambang dari CSV S1, ubah `AMBANG_AWAL` + `AMBANG_VERSI`, deploy | Bug / P1 | Bug / P1 |
| 06.00–06.30 | Operator, subjek S2 | **Subjek S2** | Bug / P1 |
| 06.30–07.00 | **Subjek S3** (Ari jadi operator) | Operator `/uji` | Bug / P1 |
| 07.00–07.30 | Sens/spes S2 + S3 per penanda per gerakan, laju aktif 3 kandidat di tangga condong | Rekam tab Network satu sesi penuh (A15) | p95 latensi per jalur suara dari log |
| **07.30** | **Keputusan kandidat condong + K-CONDONG** (aturan §12.3), ubah `KANDIDAT_CONDONG` / `SUARA_CONDONG`, deploy | ← | ← |
| 07.30–08.00 | Tabel hasil (A11) masuk README | Uji §11.2 yang tersisa | Uji §11.2 yang tersisa |
| 08.00–10.00 | Rekam bahan video demo 08.00–09.00, lalu hasil uji ke README + slide hasil | Edit video ≤3 menit (A16), selesai 09.30 | README final + AI Use Declaration (A13) 09.30, pitch deck (A17) 09.45 |
| **10.00** | Tag `kandidat-1`. Smoke test production (tamu, Isi + Atur ulang data contoh, QR dengan akun Google kedua). Login Google dengan akun di luar tim + cek batas laju sign-in (R8). Buka dasbor Supabase (R7) | ← | ← |
| **10.30** | Tag final `submission-24h` | ← | ← |
| **10.45** | Submit Devpost (URL, repo, video, deck) | ← | ← |

Istirahat bergilir 20–30 menit per orang di 01.30–04.00, tidak saat gerbang **[default spec]**.

**G1 (24.00) hijau** bila semua butir ini terpenuhi:
- [ ] Layar sesi asli di Chrome laptop menjalankan kalibrasi, lalu event `repetisi` (hitungan terdengar) dan `koreksi` dari mesin asli, bukan tiruan.
- [ ] Login Google kedua peran jalan, dan sesi tersimpan lewat RLS dari akun pasien yang sudah klaim, tanpa `42501`.
- [ ] `isi_contoh` menghasilkan 5 pasien, Pak Wayan berstatus eskalasi terbuka, dan panggilan kedua (atur ulang) menghasilkan keadaan yang sama.
- [ ] `node --test` hijau.
- [ ] 41 klip ada di `public/audio/`.

G1 merah: semua orang mengeroyok blok yang merah sampai 01.00, dan pekerjaan non-blok ditunda **[default spec]**.

**G2 (05.00) hijau** bila semua butir ini lolos di URL production:
- [ ] Skrip demo: Sign Up as Fisioterapis (laptop) → Isi data contoh → pasien baru → QR di HP → Sign Up as Pasien (akun Google kedua) → persetujuan + klaim → latihan → sesi muncul di dasbor.
- [ ] Mode tamu (form resep → sesi) jalan di Chrome laptop (jalur klip).
- [ ] Tinjau eskalasi menutup penanda, lalu "Atur ulang data contoh" membukanya lagi.
- [ ] F20 tampil (AI atau templat) untuk pasien sintetis.
- [ ] "Hapus data saya" lalu klaim ulang dengan kode baru berhasil.
- [ ] Mode Mati: tanpa K-* dan tanpa I-BAGUS, layar ringkasan tetap tampil.
- [ ] Mode pesawat → antrean → online → terkirim sekali.

G2 merah: tanpa P1, hanya perbaikan. Uji §11.1 tetap mulai 05.00 karena hanya butuh `/uji`.

## 3. Aset non-kode yang perlu dibuat

| # | Aset | Pemilik | Batas jam | Catatan |
|---|---|---|---|---|
| A1 | Wireframe layar sesi + dasbor | Ari | 18.00 | Kertas atau foto cukup. Layar: `/`, beranda, panduan, sesi, ringkasan, daftar prioritas, detail. Sekaligus mengisi penanda kuning di proposal |
| A2 | Cek foto condong (PRD §14) | Manta | 18.00 | Foto diam tampak depan, ponsel setinggi dada, jarak 1,5 m, condong 0/10/20/30° (inklinometer di sternum). Ukur piksel lebar bahu dan jarak titik tengah bahu–panggul, hitung w, d, r (§6.5). Indikatif: apakah d < 0,04 dan r ≥ 0,04 pada 20°. Hasilnya bahan keputusan 07.30 |
| A3 | 41 klip suara (Lampiran A/B PRD) | Manta + teman operator | 21.00 (slot 20.00–21.00) | Suara laki-laki. MP3 mono 44,1 kHz 96 kbps. Hening awal < 50 ms, hening akhir ≤ 200 ms, kenyaringan dinormalisasi. Nama file `public/audio/<KODE>.mp3`. Tiga R-* ikut direkam walau baru dipakai di P1. Dengar ulang dari speaker ponsel pada jarak 2 m. Rekam 2 kali, pilih yang terbaik |
| A4 | Naskah persetujuan F19 (sekitar 5 paragraf) | Pindra | Draf 21.00, final 00.00 | Kerangka di §10.5, termasuk kalimat akun Google [V9]. Versi `F19-v1` |
| A5 | Sekitar 5 klip I-SETUJU-1…n | Manta | 01.00 (slot 00.30) | Satu klip per paragraf A4, format sama dengan A3 |
| A6 | 2 video peragaan | Manta + teman | 01.30 (slot 01.00) | `public/video/jangkau_depan.mp4`, `public/video/jangkau_samping.mp4`. Loop 5–10 dtk, tanpa suara, < 1 MB, tampak depan, duduk, tanpa kompensasi. Direkam dengan **lengan kanan**; untuk sisi kiri dipakai `scaleX(-1)` **[default spec]** |
| A7 | Ikon PWA 192, 512, maskable 512 | Ari | 22.00 | PNG, glyph sederhana, kontras ≥ 3:1 |
| A8 | Tabel ambang awal | Manta | 18.30 | Sama dengan PRD §7.5, masuk ke `konstanta.ts`. Versi akhir 07.30 |
| A9 | Formulir uji di kertas | Manta | 04.30 | Per subjek: tangga 0/10/20/30°, 2 gerakan × 4 kondisi × 10 repetisi, set gating. Kolom hitungan instruksi vs mesin dan catatan |
| A10 | Data label `/uji` (CSV S1–S3) | Manta (operator), 3 subjek | S1 05.30, S2/S3 07.00 | Di-commit ke `data/uji/*.csv`, tanpa bingkai **[default spec]** |
| A11 | Tabel sens/spes + laju aktif kandidat | Manta | 07.45 | Per penanda per gerakan, n per sel, dari S2 + S3. Masuk README + deck |
| A12 | DPIA 1 halaman | Pindra | 04.00 | Isi: pemrosesan, jenis data (data kesehatan = data pribadi spesifik; email dan nama akun Google di Supabase Auth [V9]), tujuan, dasar persetujuan, penerima (Supabase Singapura, Vercel, Google sebagai penyedia login, Gemini untuk agregat), transfer ke luar negeri (PP 33/2026 Pasal 160–162: catat siklus transfer + penilaian), risiko + mitigasi (RLS, minimisasi, tanpa video, hapus data, kunci di server), retensi, hak subjek, status prototipe data sintetis |
| A13 | Kerangka README + AI Use and Third-Party Declaration + kalimat lokasi data NFR-5 | Pindra | Kerangka 23.30, final 09.30 | Isi: apa ini, URL, cara coba (tamu tanpa akun; juri: laptop dengan akun Google sebagai fisioterapis + "Isi data contoh", HP dengan **akun Google kedua** sebagai pasien, disebut di baris pertama bagian ini [V9]), arsitektur, privasi + bukti Network, hasil uji (A11), batas klaim + batas regulasi (PRD §2), keterbatasan (wawancara tidak dilakukan), aset yang dibuat sebelum Hacking Day, lisensi MIT. Declaration: MediaPipe (Apache 2.0), Supabase, Vercel, Google OAuth (login), suara TTS platform, asisten AI yang dipakai tim, Gemini untuk F20. Kalimat NFR-5 apa adanya: "Data sintetis, server Singapura; lokasi penyimpanan untuk deployment klinis akan disesuaikan dengan regulasi sektor kesehatan." |
| A14 | Skrip demo juri (urutan E2E) | Pindra | 04.00 | Dipakai di G2, video, dan penjurian. Urutan: laptop Sign Up as Fisioterapis → Isi data contoh → buka Pak Wayan (eskalasi, run chart, Ringkasan AI) → pasien baru → QR → HP Sign Up as Pasien dengan akun Google kedua → persetujuan → latihan → laptop Muat ulang → Atur ulang data contoh. Tim menyiapkan 1 HP dengan akun Google pasien yang sudah masuk untuk demo tatap muka [V9, R22] |
| A15 | Rekaman tab Network (bukti nol bingkai) | Ari | 07.30 | NFR-3. Potongannya masuk video |
| A16 | Video demo ≤ 3 menit | Manta rekam, Ari edit | 09.30 | Alur **[default spec]**: 0:00 masalah → 0:20 pasien (panduan, kalibrasi, koreksi suara, ringkasan) → 1:30 dasbor (prioritas, run chart, Ringkasan AI) → 2:20 privasi (tab Network) + hasil uji → 2:45 batas klaim + URL |
| A17 | Pitch deck | Pindra + semua | 09.45 | Kalimat regulasi: "prototipe di jalur perangkat lunak alat kesehatan". Klaim mengikuti PRD §2 Batas klaim bukti |
| A18 | OAuth client Google + consent screen | Pindra | 18.00 | [V9] Google Cloud Console: proyek baru → OAuth consent screen jenis External, nama app "ReminiCare", scope `openid`, `email`, `profile` saja → **Publish app (In production)**, bukan Testing (Testing hanya menerima test user, juri ditolak) → Credentials → OAuth client ID jenis Web, Authorized redirect URI `https://<ref>.supabase.co/auth/v1/callback` → Client ID + Secret ke Supabase (§4.1). Secret tidak masuk repo atau Vercel. Uji login dengan 1 akun Google di luar proyek GCP |

Spesifikasi pola data sintetis (aset Pindra di PRD §14) sudah diisi angka konkret di §8.7 (pola) dan §8.8 (hasil yang diharapkan).

## 4. Setup (17.00–18.00)

### 4.1 Supabase (Pindra)
- Proyek baru di region **ap-southeast-1**.
- Auth → Providers → **Google: ON**, isi Client ID + Client Secret dari A18 [V9]. **Email: OFF**, **Anonymous sign-ins: OFF** [V9].
- Auth → URL Configuration: Site URL = URL production. Redirect URLs: `https://<url-production>/**` dan `http://localhost:3000/**`. URL preview Vercel tidak didaftarkan; login diuji di production dan localhost saja **[default spec]**.
- Auth → Rate limits: cek batas sign-up dan sign-in per IP; bila di bawah 100 per 5 menit, naikkan ke 100 **[default spec]**, karena juri berbagi Wi-Fi venue. Dicek ulang pukul 10.00 (R8).
- Layar persetujuan Google menampilkan domain `<ref>.supabase.co`. Diterima untuk lomba; custom domain tidak dipakai **[default spec]**.
- Simpan Project URL + **publishable key**. Service role key **tidak dipakai di mana pun** dan tidak masuk Vercel.
- Migrasi dijalankan berurutan 0001 → 0003 lewat SQL editor atau Supabase CLI.

### 4.2 Vercel (Pindra)
- Impor repo. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`.
- Catat URL production; dipakai di QR dan README.

### 4.3 Gemini (Pindra)
- Kunci dari Google AI Studio, simpan di env Vercel saja.
- Model: **Flash, versi dipin di J0**, ditulis ke `GEMINI_MODEL`. Nama model jangan ditebak; salin persis dari daftar model saat setup.
- Saat pin, cek apakah model punya mode "thinking". Bila ada, kecilkan atau matikan lewat `generationConfig` sesuai dokumentasi model itu, atau naikkan `maxOutputTokens` bila keluaran terpotong.

### 4.4 Next.js (Ari)
- Dependensi, semua dengan versi persis (`npm i -E`): `next`, `react`, `react-dom`, `tailwindcss`, `@supabase/supabase-js`, `@mediapipe/tasks-vision` (versi dipin, 1.2.0 per PRD, dicek ulang), `qrcode` + `@types/qrcode`.
- Tidak dipakai: pustaka grafik, SDK Gemini (cukup `fetch` REST), pustaka PWA, state manager, framework tes, `@supabase/ssr` (sesi tetap di klien, alur PKCE oleh `supabase-js`, §10.1) **[default spec]**.
- `tsconfig`: `"allowImportingTsExtensions": true`. Next sudah `noEmit`.
- `package.json` script `test`: `node --test "lib/**/*.test.ts"`. Butuh Node ≥ 22.18 (type stripping aktif bawaan).
- Kode di `lib/kinematik/` dan `lib/ringkasan.ts` wajib: impor relatif dengan ekstensi `.ts`, tanpa alias `@/`, tanpa `enum`/`namespace`/parameter property, tanpa API DOM. Dengan begitu `node --test` bisa menjalankannya langsung.

### 4.5 Aset MediaPipe (Manta)
- Salin `node_modules/@mediapipe/tasks-vision/wasm/*` ke `public/mediapipe/<versi>/wasm/`.
- Unduh `pose_landmarker_lite.task` sekali ke `public/mediapipe/<versi>/`, lalu commit.
- Salin lisensi Apache 2.0 ke `public/mediapipe/LICENSE`.
- `next.config.ts` → `headers()`: source `/mediapipe/:path*` diberi header `Cache-Control: public, max-age=31536000, immutable`. Versi baru berarti folder baru.

## 5. Struktur folder dan file per modul

```
app/
  layout.tsx                 # lang="id", font dasar ≥18px, pemicu kirim antrean (F11)
  globals.css
  manifest.ts                # F18
  page.tsx                   # "/" : Login with Google + Sign up (2 peran) + tautan tamu + redirect sesuai peran (F01, F15)
  auth/selesai/page.tsx      # penerima redirect OAuth: daftar(peran) bila sign up, lalu arahkan (F01)
  terapis/
    page.tsx                 # F12 daftar prioritas + F16 Isi / Atur ulang data contoh
    pasien/baru/page.tsx     # F02 pasien baru
    pasien/[id]/page.tsx     # F13 detail, F14 run chart + Tinjau, F03 QR, F02 edit, F20
  k/[kode]/page.tsx          # login pasien bila perlu + F03 klaim + F19 persetujuan
  pasien/
    page.tsx                 # F04 beranda (atau kolom kode bila belum ada resep), status antrean F11, F19 hapus data
    sesi/page.tsx            # F05–F10 lewat <Sesi simpan />
  tamu/page.tsx              # F15 <FormResep lokal /> lalu <Sesi simpan={false} />
  uji/page.tsx               # F17
  api/ringkasan/route.ts     # F20
components/
  Sesi.tsx                   # mesin status layar sesi (§10.7)
  Grafik.tsx                 # SVG polyline + bentuk titik + garis acuan (F10, F13, F14)
  FormResep.tsx              # F02 (baru + edit) + mode lokal untuk tamu (F15)
lib/
  supabase.ts                # klien browser (publishable key, PKCE) + masukGoogle() + cekPeran()
  antrean.ts                 # F11 + localStorage
  suara.ts                   # §7
  naskah.ts                  # Lampiran A: kode → teks
  pose.ts                    # kamera + PoseLandmarker GPU/CPU + loop
  ringkasan.ts               # F20: bangunMasukan, angkaSah, cekAngka, cekKalimat, templat
  ringkasan.test.ts
  kinematik/
    tipe.ts                  # tipe + konstanta
    sinyal.ts                # resample, Butterworth, filtfilt, keSampel
    fitur.ts                 # fitur, ambang, penanda, gating, kalibrasi
    repetisi.ts              # mesin status, nilaiRepetisi, metrik, koreksi
    mesin.ts                 # buatMesin (orkestrator) + agregatSesi
    kinematik.test.ts
supabase/migrations/
  0001_skema.sql  0002_fungsi.sql  0003_sintetis.sql
public/
  mediapipe/LICENSE
  mediapipe/<versi>/pose_landmarker_lite.task
  mediapipe/<versi>/wasm/…
  audio/<KODE>.mp3           # 41 + I-SETUJU-n
  video/jangkau_depan.mp4, video/jangkau_samping.mp4
  icons/icon-192.png, icon-512.png, icon-maskable-512.png
data/uji/*.csv               # A10
next.config.ts               # headers() cache immutable
README.md
```

Pemilik file. Satu file punya satu pemilik, supaya tidak ada dua orang menulis file yang sama.

| Pemilik | File |
|---|---|
| Manta | `lib/kinematik/*`, `lib/pose.ts`, `app/uji/page.tsx`, `public/mediapipe/*`, `public/audio/*`, `public/video/*`, `data/uji/*` |
| Ari | `app/layout.tsx`, `app/page.tsx`, `app/auth/*`, `app/manifest.ts`, `app/pasien/*`, `app/tamu/*`, `app/k/*`, `components/Sesi.tsx`, `lib/suara.ts`, `lib/naskah.ts`, `lib/antrean.ts`, `public/icons/*` |
| Pindra | `supabase/migrations/*`, `lib/supabase.ts`, `app/terapis/*`, `app/api/ringkasan/*`, `lib/ringkasan.ts`, `components/Grafik.tsx`, `components/FormResep.tsx`, `next.config.ts`, `README.md` |

## 6. Kontrak mesin kinematik

Prinsip: semua fungsi murni atau closure kecil, satuan waktu ms (`performance.now()`), tanpa DOM, bisa diuji `node --test`. UI hanya memanggil `kalibrasi`, `buatPemantau`, `buatMesin`, dan `agregatSesi`.

### 6.1 Tipe (`lib/kinematik/tipe.ts`)

```ts
export type Sisi = 'kiri' | 'kanan';
export type Gerakan = 'jangkau_depan' | 'jangkau_samping';
export type Toleransi = 'abaikan' | 'longgar' | 'normal' | 'ketat';
export type ModeKoreksi = 'penuh' | 'ringkasan' | 'mati';
export type KalimatCondong = 'sandaran' | 'tegak';
export type Kandidat = 'a' | 'b' | 'c';                 // a = w∧d, b = zb, c = r
export type StatusRep = 'DIAM' | 'BERGERAK' | 'JAUH';
export type SubSinyal = 'condong' | 'miring' | 'bahu';
export type KodeKoreksi = 'K-CONDONG-S' | 'K-CONDONG-T' | 'K-MIRING' | 'K-BAHU';

export type Titik = { x: number; y: number; visibility?: number };  // ternormalisasi, result.landmarks[0]
export type Titik3 = { x: number; y: number; z: number };            // meter, result.worldLandmarks[0]
export type P2 = { x: number; y: number };                           // piksel

export type FrameMentah = {
  t: number;                 // ms, sama dengan timestamp yang dikirim ke detectForVideo
  W: number; H: number;      // video.videoWidth / videoHeight
  lm: Titik[] | null;        // 33 titik; null = tidak ada pose
  world: Titik3[] | null;
};

// kunci landmark: telinga, siku, dan pergelangan = sisi terdampak; bahu dan panggul = keduanya
export type Kunci = 'telingaT' | 'bahuKi' | 'bahuKa' | 'sikuT' | 'pergelanganT' | 'panggulKi' | 'panggulKa';

export type Sampel = {       // setelah konversi piksel, resample 30 Hz, filter
  t: number;
  p: Record<Kunci, P2>;      // piksel
  S3: Titik3; H3: Titik3;    // titik tengah bahu / panggul dari worldLandmarks
  diDalam: boolean;          // syarat (a) §7.3: semua K di [0;1]
  skor: number;              // min visibility K pada frame (undefined → 0)
  visPanggul: number;        // min visibility kedua panggul (untuk CSV)
  panggulN: P2;              // titik tengah panggul ternormalisasi (untuk CSV)
};

export type Baseline = {
  SW0: number;               // px, jarak bahu kiri–kanan
  h0: number;                // |S.y − H.y| / SW0
  theta0: number;            // derajat, sudut H→S terhadap vertikal
  e0: number;                // (bahuT.y − telingaT.y) / SW0
  R0: P2;                    // px, pergelangan terdampak saat istirahat
  zS0: number;               // m, z titik tengah bahu (world)
  T0: number;                // m, jarak 3D titik tengah bahu–panggul
  theta3d0: number;          // derajat, sudut frontal H3→S3 (pembanding /uji)
};

export type Fitur = { w: number; d: number; r: number; zb: number; dTheta: number; el: number; dTheta3d: number; dp: number };
export type Ambang = { tw: number; td: number; tr: number; tz: number; tTheta: number; tel: number };
export type AmbangEfektif = Ambang & { batang: boolean; bahu: boolean };   // false = toleransi abaikan

export type Penanda = {
  condongA: boolean; condongB: boolean; condongC: boolean; miring: boolean; el: boolean;  // mentah, untuk /uji
  condong: boolean;          // kandidat terpilih
  batang: boolean;           // AmbangEfektif.batang && (condong || miring)
  bahu: boolean;             // AmbangEfektif.bahu && el
};

export type KonfigSesi = {
  sisi: Sisi; durasiPersen: number; tolBatang: Toleransi; tolBahu: Toleransi;
  mode: ModeKoreksi; kalimat: KalimatCondong; kandidat: Kandidat; suaraCondong: boolean;
};

export type HasilRepetisi = {
  gerakan: Gerakan; ke: number; tMulai: number; tSelesai: number;
  terukur: boolean;          // fraksiTergating ≤ 0,5
  fraksiTergating: number;
  fraksi: { condongA: number; condongB: number; condongC: number; miring: number; el: number; batang: number; bahu: number };
  fraksiBatangKandidat: { a: number; b: number; c: number };   // fraksi (condong_x ∨ miring) per sampel, untuk CSV /uji
  kompensasi: { batang: boolean; bahu: boolean };     // fraksi ≥ durasiPersen / 100
  terkompensasi: boolean;    // terukur && (batang || bahu)
  puncak: { w: number; d: number; r: number; zb: number; dTheta: number; el: number; dTheta3d: number };
  waktuGerak10: number | null; waktuGerak5: number | null;   // detik
  vPuncak: number | null;    // SW0 per detik
  nPuncak: number | null;
  koreksi: { kode: KodeKoreksi; tDeteksi: number } | null;
  visPanggulMin: number; visPanggulMed: number; panggulMin: P2; panggulMaks: P2;
};

export type EventMesin =
  | { jenis: 'sampel'; t: number; status: StatusRep; gating: boolean; skor: number; diDalam: boolean; fitur: Fitur; penanda: Penanda }  // 1 per dorong(), untuk UI dan /uji
  | { jenis: 'gating'; aktif: boolean; t: number }
  | { jenis: 'koreksi'; sub: SubSinyal; kode: KodeKoreksi; tDeteksi: number }
  | { jenis: 'repetisi'; hasil: HasilRepetisi; hitungan: number; bagus: boolean };
```

### 6.2 Konstanta (`lib/kinematik/tipe.ts`)

```ts
export const HZ = 30;
export const FC_HZ = 5;
export const IDX = { telinga: { kiri: 7, kanan: 8 }, bahu: { kiri: 11, kanan: 12 }, siku: { kiri: 13, kanan: 14 },
                     pergelangan: { kiri: 15, kanan: 16 }, panggul: { kiri: 23, kanan: 24 } } as const;
// K = kedua bahu, kedua panggul, siku + pergelangan + telinga sisi terdampak (§7.3)
export const idxK = (s: Sisi) => [11, 12, 23, 24, IDX.siku[s], IDX.pergelangan[s], IDX.telinga[s]];

export const AMBANG_AWAL: Record<Gerakan, Ambang> = {
  jangkau_depan:   { tw: 0.06, td: 0.04, tr: 0.04, tz: 0.15, tTheta: 6, tel: 0.15 },
  jangkau_samping: { tw: 0.06, td: 0.04, tr: 0.04, tz: 0.15, tTheta: 8, tel: 0.25 },
};
export const AMBANG_VERSI = 'awal';                // jadi 'S1-0600' setelah disetel
export const KALI_TOLERANSI: Record<Toleransi, number | null> = { ketat: 0.75, normal: 1, longgar: 1.5, abaikan: null };
export const GATING = { masuk: 0.5, lepas: 0.6, jendelaMs: 1000, tahanMs: 1000 };
export const REP = { mulai: 0.25, jauh: 0.6, minMs: 800, maksMs: 15000, padMs: 500 };
export const ONSET = { utama: 0.10, alt: 0.05 };
export const PUNCAK = { fraksi: 0.20, jarakMs: 100 };
export const TAK_TERUKUR = 0.5;                    // > 50% fase gerak tergating
export const KOREKSI = { debounceMs: 300, samaMs: 4000, antarMs: 1500 };
export const KALIB = { durasiMs: 5000, sdMaks: 0.02, jendelaMs: 1000, minFraksi: 0.5, maksGagal: 3 };
export const BAGUS_BERUNTUN = 3;
export const ISTIRAHAT_MS = 20000;
export const KANDIDAT_CONDONG: Kandidat = 'a';     // keputusan 07.30
export const SUARA_CONDONG = true;                 // false bila K-CONDONG dimatikan pukul 07.30
```

Mode tamu selalu memakai `kandidat: 'a'` [V8]. `SUARA_CONDONG` berlaku global, termasuk untuk tamu (§14 no. 12).

### 6.3 Praproses (`sinyal.ts`, PRD §7.1–7.2)

```ts
export function keSampel(f: FrameMentah, sisi: Sisi, sebelum: Sampel | null): Sampel;
export function buatResampler(hz?: number): { dorong(s: Sampel): Sampel[] };
export type Koef = { b0: number; b1: number; b2: number; a1: number; a2: number };
export function koefButterworth(fc: number, fs: number): Koef;
export function buatBiquad(k: Koef): (x: number) => number;
export function buatFilterSampel(k: Koef): (s: Sampel) => Sampel;
export function filtfilt(xs: number[], k: Koef): number[];
```

Pseudo:
- `keSampel`: piksel = (x·W, y·H). `diDalam` = setiap indeks `idxK(sisi)` punya x dan y di [0;1]. `skor` = min `visibility` pada K, dengan `undefined` dihitung 0. S3/H3 = rata-rata world 11/12 dan 23/24. Bila `lm` null, posisi ditahan dari `sebelum`, `diDalam = false`, `skor = 0` **[default spec]**.
- `buatResampler`: grid t₀ + k·(1000/30). Untuk tiap titik grid di (prev.t, cur.t], interpolasi linear per koordinat. `diDalam` = AND kedua tetangga, `skor` = min kedua tetangga.
- `koefButterworth` memakai bilinear: K = tan(π·fc/fs), n = 1/(1 + √2·K + K²), b0 = K²·n, b1 = 2·b0, b2 = b0, a1 = 2·(K² − 1)·n, a2 = (1 − √2·K + K²)·n.
  - Untuk fc 5, fs 30: b0 = b2 = 0,1550510; b1 = 0,3101021; a1 = −0,6202041; a2 = 0,2404082. Penguatan DC = 1.
- `buatBiquad` (Direct Form II transposed, kausal): y = b0·x + z1; z1 = b1·x − a1·y + z2; z2 = b2·x − a2·y. State awal diisi dengan nilai mantap x₀ supaya tidak ada transien: z1 = (b1 + b2 − a1 − a2)·x₀, z2 = (b2 − a2)·x₀.
- `buatFilterSampel`: satu biquad per koordinat (x dan y tiap `Kunci`, plus xyz S3 dan H3). Filter dijalankan pada **koordinat**, lalu fitur dihitung dari hasil filter **[default spec]**.
- `filtfilt` (zero-phase, offline per repetisi): pad pantul 15 sampel, filter maju, balik, filter lagi, balik, lalu buang pad.

### 6.4 Fitur, ambang, penanda (`fitur.ts`, PRD §7.5)

```ts
export function hitungFitur(s: Sampel, b: Baseline, sisi: Sisi): Fitur;
export function ambangEfektif(g: Gerakan, tolBatang: Toleransi, tolBahu: Toleransi): AmbangEfektif;
export function hitungPenanda(f: Fitur, a: AmbangEfektif, kandidat: Kandidat): Penanda;
```

Pseudo `hitungFitur`. Notasi: S = tengah(bahuKi, bahuKa), H = tengah(panggulKi, panggulKa), SW = jarak(bahuKi, bahuKa), tinggi = |S.y − H.y|.
- w = SW / SW0 − 1
- d = 1 − (tinggi / SW0) / h0
- r = 1 − (tinggi / SW) / h0
- zb = (zS0 − S3.z) / T0
- dTheta = |sudut(H→S) − theta0|. sudut(H→S) = atan2(S.x − H.x, H.y − S.y) dalam derajat (y gambar mengarah ke bawah).
- el = 1 − e / e0, dengan e = (bahuT.y − telingaT.y) / SW0 dan bahuT = sisi === 'kiri' ? bahuKi : bahuKa.
- dTheta3d = |atan2(S3.x − H3.x, H3.y − S3.y) − theta3d0|. Hanya dicatat di `/uji`.
- dp = jarak(pergelanganT, R0) / SW0. Ini perpindahan untuk hitung repetisi; di PRD §7.6 disebut "r" (§14 no. 1).

`ambangEfektif`: tw, td, tr, tz, tTheta dikali `KALI_TOLERANSI[tolBatang]`, tel dikali `KALI_TOLERANSI[tolBahu]`. Toleransi `abaikan` membuat `batang` (atau `bahu`) = false; flag mentah untuk `/uji` tetap dihitung dengan pengali 1.

`hitungPenanda`: condongA = w ≥ tw ∧ d ≥ td; condongB = zb ≥ tz; condongC = r ≥ tr; miring = dTheta ≥ tTheta; el = el ≥ tel; condong = flag kandidat terpilih; batang = a.batang ∧ (condong ∨ miring); bahu = a.bahu ∧ el.

### 6.5 Gating (`fitur.ts`, PRD §7.3)

```ts
export function buatGating(): { dorong(t: number, diDalam: boolean, skor: number): { aktif: boolean; skorMedian: number } };
export function buatPemantau(sisi: Sisi): { dorong(f: FrameMentah): { gating: boolean; skor: number; diDalam: boolean } };  // untuk layar panduan
```

Pseudo `buatGating`:
- Simpan pasangan (t, skor) selama 1 dtk terakhir. skorMedian = median skor.
- buruk = !diDalam ∨ skorMedian < 0,5. baik = diDalam ∧ skorMedian ≥ 0,6.
- Tidak aktif → aktif bila buruk terus-menerus > 1000 ms. Aktif → tidak aktif bila baik terus-menerus ≥ 1000 ms.
- **tergating** (per sampel) = !diDalam ∨ aktif **[default spec]**. Sampel yang gagal (a) langsung dikeluarkan dari penanda, debounce koreksi, dan fraksi, tanpa menunggu histeresis.
- Tanpa margin dalam. Interpolasi celah ≤ 0,12 dtk hanya ditambah bila pembuangan frame terlalu sering (PRD §7.3).

### 6.6 Kalibrasi baseline (`fitur.ts`, F06 + PRD §7.4)

```ts
export type HasilKalibrasi = { ok: true; baseline: Baseline } | { ok: false; alasan: 'gerak' | 'keyakinan' };
export function kalibrasi(frames: FrameMentah[], sisi: Sisi): HasilKalibrasi;   // frames = 5 dtk
```

Pseudo **[default spec, tafsiran §14 no. 11]**:
1. `ss` = resample(keSampel(frames)). Tanpa filter, karena median sudah tahan derau.
2. Sampel dianggap yakin bila diDalam ∧ skor ≥ 0,5. Bila sampel yakin < 50% dari `ss` → `{ ok: false, alasan: 'keyakinan' }`.
3. SWm = median SW. Sampel *diam* = yakin ∧ SD 2D titik S dalam jendela 1 dtk di sekitarnya < 0,02·SWm.
4. Bila sampel diam < 50% → `{ ok: false, alasan: 'gerak' }`.
5. Pada sampel diam, ambil median: SW0, h0 = median(tinggi)/SW0, theta0, e0, R0 (median per sumbu), zS0 = median(S3.z), T0 = median(|S3 − H3|), theta3d0.
6. UI: gagal → I-KALIB-ULANG lalu ulangi. Gagal ke-3 → kembali ke panduan dengan kotak bantuan penempatan kamera.

`sesi.baseline` menyimpan `{ SW0, h0, theta0, e0, zS0, T0 }`. R0 tidak disimpan karena ia posisi, bukan fitur **[default spec]**.

### 6.7 Repetisi, penilaian, metrik (`repetisi.ts`, PRD §7.6, §7.7, §7.9)

```ts
export type KeadaanRep = { status: StatusRep; tMulai: number | null };
export function langkahRep(k: KeadaanRep, t: number, dp: number):
  { k: KeadaanRep; selesai: { tMulai: number; tSelesai: number; sah: boolean } | null };

export type SampelRep = { t: number; pw: P2 /* pergelangan / SW0 */; tergating: boolean; fitur: Fitur; penanda: Penanda; visPanggul: number; panggulN: P2 };
export function kecepatan(seg: SampelRep[]): number[];                 // filtfilt x,y (koefButterworth(FC_HZ, HZ)) → beda pusat × HZ → |v|
export function onsetOffset(v: number[], fraksi: number): [number, number] | null;
export function jumlahPuncak(v: number[], vPuncak: number): number;
export function nilaiRepetisi(seg: SampelRep[], tMulai: number, tSelesai: number, durasiPersen: number):
  Omit<HasilRepetisi, 'gerakan' | 'ke' | 'koreksi'>;
```

`langkahRep`:
- DIAM: bila dp > 0,25 → BERGERAK (tMulai = t).
- BERGERAK: bila dp > 0,6 → JAUH. Bila dp < 0,25 → DIAM, batal tanpa repetisi.
- JAUH: bila dp < 0,25 → DIAM dan selesai = { tMulai, tSelesai: t, sah: 800 ≤ durasi ≤ 15000 }.

`nilaiRepetisi(seg = sampel [tMulai − 500, tSelesai + 500])`:
1. v = kecepatan(seg). vP = maks v. Bila vP = 0 → terukur = false, metrik null.
2. [on, off] = sampel pertama dan terakhir dengan v > 0,10·vP. [on5, off5] dihitung sama dengan 0,05.
3. fase = seg[on..off]. fraksiTergating = jumlah tergating / |fase|. terukur = fraksiTergating ≤ 0,5.
4. bersih = fase tanpa sampel tergating. fraksi.x = jumlah penanda x aktif / |bersih|, untuk x ∈ {condongA, condongB, condongC, miring, el, batang, bahu}. fraksiBatangKandidat.x = jumlah sampel (condong_x ∨ miring) / |bersih|. |bersih| = 0 → 0.
5. kompensasi.batang = fraksi.batang ≥ durasiPersen/100; kompensasi.bahu sama. terkompensasi = terukur ∧ (batang ∨ bahu).
6. puncak.f = maks f pada `bersih`.
7. waktuGerak10 = (t[off] − t[on]) / 1000; waktuGerak5 dari on5/off5. vPuncak = vP. nPuncak = jumlahPuncak(v[on..off], vP), yaitu maksimum lokal > 0,2·vP dengan jarak ≥ 100 ms; dua puncak yang lebih dekat diambil yang lebih tinggi.
8. Statistik panggul (min, median visibility; min/maks posisi) dihitung pada `fase`.

### 6.8 Koreksi + I-BAGUS (`repetisi.ts`, F08 + PRD §7.8)

```ts
export function kodeKoreksi(sub: SubSinyal, kalimat: KalimatCondong): KodeKoreksi;
  // condong → kalimat 'sandaran' ? 'K-CONDONG-S' : 'K-CONDONG-T'; miring → 'K-MIRING'; bahu → 'K-BAHU'
export function buatKoreksi(cfg: KonfigSesi): {
  mulaiRep(): void;                                    // dipanggil saat DIAM → BERGERAK
  dorong(t: number, status: StatusRep, tergating: boolean, p: Penanda):
    { sub: SubSinyal; kode: KodeKoreksi; tDeteksi: number } | null;
};
```

Pseudo:
```
if cfg.mode !== 'penuh' → null
boleh = status ∈ {BERGERAK, JAUH} ∧ !tergating
aktif = { condong: boleh ∧ p.batang ∧ p.condong, miring: boleh ∧ p.batang ∧ p.miring, bahu: boleh ∧ p.bahu }
untuk tiap sub: sejak[sub] = aktif[sub] ? (sejak[sub] ?? t) : null     // debounce per sub-sinyal [default spec]
if sudahRep → null                                                      // maks 1 per repetisi
untuk sub dalam urutan [condong, miring, bahu]:                         // batang didahulukan atas bahu; condong lebih dulu dari miring [default spec]
  if sejak[sub] == null ∨ t − sejak[sub] < 300 → lanjut
  if sub = condong ∧ !cfg.suaraCondong → lanjut
  kode = kodeKoreksi(sub, cfg.kalimat)
  if t − terakhir[kode] < 4000 ∨ t − terakhirApapun < 1500 → lanjut   // pengaman
  sudahRep = true; terakhir[kode] = terakhirApapun = t
  return { sub, kode, tDeteksi: t }
return null
```

Sampel tergating menghapus `sejak`, sehingga frame di luar bingkai tidak pernah memicu koreksi.

I-BAGUS (hanya mode Penuh): penghitung beruntun naik bila repetisi terukur ∧ !terkompensasi, dan direset oleh repetisi lain (terkompensasi atau tak terukur). Saat mencapai 3, event `repetisi.bagus = true` dan penghitung kembali 0 **[default spec]**.

### 6.9 Orkestrator (`mesin.ts`)

```ts
export interface Mesin {
  mulaiGerakan(g: Gerakan): void;          // reset status, hitungan, ambang, penghitung bagus
  dorong(f: FrameMentah): EventMesin[];    // panggil tiap hasil detectForVideo
  akhiri(): EventMesin[];                  // nilai repetisi tertunda (akhir gerakan / Berhenti)
  hasil(): HasilRepetisi[];                // semua repetisi sesi, urut
}
export function buatMesin(cfg: KonfigSesi, b: Baseline): Mesin;
```

Pseudo `dorong`:
```
for s of resampler.dorong(keSampel(f, cfg.sisi, sebelum)):
  s = filter(s); fitur = hitungFitur(s, b, cfg.sisi); pen = hitungPenanda(fitur, ambang, cfg.kandidat)
  g = gating.dorong(s.t, s.diDalam, s.skor); bila g.aktif berubah → event 'gating'
  tergating = !s.diDalam || g.aktif
  { k, selesai } = langkahRep(k, s.t, fitur.dp); DIAM → BERGERAK → koreksi.mulaiRep()
  kor = koreksi.dorong(s.t, k.status, tergating, pen); ada → event 'koreksi', simpan ke rep berjalan
  buffer.push({ t, pw, tergating, fitur, penanda: pen, visPanggul, panggulN })
  selesai?.sah → tertunda.push(selesai)
  untuk p di tertunda dengan s.t ≥ p.tSelesai + 500:
      hasil = nilaiRepetisi(potong(buffer, p), ...); hitungan++; event 'repetisi' { hasil, hitungan, bagus }
  pangkas buffer yang lebih tua dari (tMulai tertunda/berjalan paling awal, atau s.t) − 500 ms
event 'sampel' untuk sampel terakhir
```

Akibatnya hitungan dan penilaian keluar ± 0,5 dtk setelah lengan kembali, karena penilaian butuh buffer +0,5 dtk **[default spec, §14 no. 13]**. Bila suara sedang memutar koreksi, hitungan menunggu (antrean suara §7).

### 6.10 Event ke UI (kontrak untuk Ari dan mesin tiruan)

| Event | UI melakukan |
|---|---|
| `sampel` | Perbarui overlay, indikator keyakinan (`skor`), status. `/uji` menampilkan `fitur` dan `penanda` |
| `gating` aktif | Indikator "Kamera tidak melihat Anda dengan jelas" + I-GATING (jeda ≥ 5 dtk antar-ulang **[default spec]**) |
| `koreksi` | `suara.ucap(kode, { prioritas: true })`. Catat latensi = `tMulai` suara − `tDeteksi` |
| `repetisi` | `suara.ucap('N-' + hitungan)`. Bila `bagus` → I-BAGUS. Bila hitungan = `resep.repetisi` → `mesin.akhiri()`, lalu ke istirahat atau ringkasan |

Mesin tiruan Ari sebelum G1: timer yang memancarkan `sampel` tiap 33 ms, `repetisi` tiap 3 dtk, `koreksi` acak 1 dari 3 repetisi, `gating` sekali per 20 dtk.

### 6.11 Agregat sesi (`mesin.ts`)

```ts
export type ResepSalinan = {
  gerakan: Gerakan[]; repetisi: number; sesi_per_minggu: number; toleransi_batang: Toleransi; toleransi_bahu: Toleransi;
  durasi_persen: number; mode_koreksi: ModeKoreksi; kalimat_condong: KalimatCondong;
  kandidat_condong: Kandidat; suara_condong: boolean; ambang_versi: string;      // 3 kolom terakhir [default spec]
};
export type BarisSesi = { id: string; pasien_id: string; mulai: string; selesai: string; resep: ResepSalinan;
  baseline: Omit<Baseline, 'R0' | 'theta3d0'>; rep_total: number; rep_terukur: number; rep_terkompensasi: number;
  per_gerakan: Record<string, { rep_total: number; rep_terukur: number; rep_terkompensasi: number;
    per_penanda: { batang: number; bahu: number }; waktu_gerak_median: number | null; v_puncak_median: number | null; n_puncak_median: number | null }>;
  pct_tak_terukur: number; fps_median: number; suara: 'webspeech' | 'klip'; delegate: 'GPU' | 'CPU'; nyeri: null; is_sintetis: false };
export function agregatSesi(x: { id: string; pasienId: string; mulai: string; selesai: string; resep: ResepSalinan;
  baseline: Baseline; hasil: HasilRepetisi[]; fpsMedian: number; suara: 'webspeech' | 'klip'; delegate: 'GPU' | 'CPU' }): BarisSesi;
```

- rep_total = semua repetisi sah. Target resep dihitung dari repetisi sah, termasuk yang tak terukur **[default spec]**.
- rep_terukur = jumlah terukur. rep_terkompensasi = jumlah terkompensasi.
- pct_tak_terukur = (rep_total − rep_terukur) / rep_total × 100, dihitung per repetisi **[default spec]**.
- Median metrik per gerakan diambil hanya dari repetisi terukur.
- `id` = `crypto.randomUUID()`.
- Ukuran < 5 KB (NFR-8).

### 6.12 Tes (`kinematik.test.ts`, PRD §11.2)

Deret sintetis dibuat dari pose duduk tetap (33 titik), dengan derau ± 0,002 dan `t` 33 ms. Kasus:
1. Netral 10 dtk → 0 `koreksi`, `penanda.batang` tidak pernah true.
2. Condong buatan (SW × 1,08, tinggi S–H × 0,94) → `batang` true untuk kandidat a dan c.
3. Sinus perpindahan dp = 0,4·(1 − cos(2πt/3000)) selama 15 dtk, lalu diam 1 dtk → tepat 5 event `repetisi`.
4. Satu repetisi lambat 6 dtk dengan condong on/off/on masing-masing 500 ms → tepat 1 `koreksi`.
5. Condong buatan dengan panggul di y = 1,05 (di luar bingkai) → 0 `koreksi`.
6. `filtfilt` dan `buatBiquad` pada deret konstan → keluaran konstan (penguatan DC 1).
7. `kalibrasi` dengan bahu bergeser 0,05·SW → `alasan: 'gerak'`.

## 7. Suara (`lib/suara.ts`, `lib/naskah.ts`, PRD §8)

```ts
export type KodeKlip = KodeKoreksi | 'I-MULAI' | 'I-POSISI' | 'I-KAMERA' | 'I-BINGKAI' | 'I-GATING' | 'I-KALIB' | 'I-KALIB-OK'
  | 'I-KALIB-ULANG' | 'I-G1' | 'I-G2' | 'I-ISTIRAHAT' | 'I-BAGUS' | 'R-BAIK' | 'R-CUKUP' | 'R-KURANG' | 'I-SELESAI' | 'I-NYERI'
  | `N-${number}` | `I-SETUJU-${number}`;
export const NASKAH: Record<string, string>;   // kode → kalimat persis Lampiran A PRD; N-1…N-20 = "satu"…"dua puluh"
export interface Suara {
  jalur: 'webspeech' | 'klip' | null;
  buka(): Promise<void>;                        // WAJIB di handler ketukan (Mulai latihan / pilih sisi tamu / Dengarkan)
  ucap(kode: KodeKlip, opsi?: { prioritas?: boolean }): Promise<{ tMulai: number }>;
  sibuk(): boolean;
  hentikan(): void;
}
export const suara: Suara;                       // singleton modul, bertahan di navigasi client-side
```

`buka()`:
1. `ctx = new AudioContext(); await ctx.resume()`.
2. Baca daftar suara: `getVoices()`, atau tunggu `voiceschanged` paling lama 1 dtk.
3. v = suara pertama dengan `lang` diawali `id` dan `localService === true`. Suara jaringan tidak pernah dipakai.
4. Bila v ada dan perangkat bukan iOS: ucapkan I-MULAI dengan v. Event `start` ≤ 500 ms → `jalur = 'webspeech'`. Lewat dari itu → `cancel()`, lalu jalur klip.
5. Jalur klip: unduh dan dekode semua `public/audio/*.mp3` (Promise.all), lalu putar I-MULAI.
6. Pilihan jalur berlaku sepanjang sesi dan disimpan ke `sesi.suara`.

`ucap()` bekerja sebagai antrean FIFO, satu suara pada satu waktu. `prioritas: true` (koreksi) masuk ke depan antrean tanpa memotong suara yang sedang diputar **[default spec]**. `tMulai` = event `onstart` (Web Speech) atau saat `AudioBufferSourceNode.start()` dipanggil (klip). Objek utterance disimpan sampai `onend` supaya tidak terkena GC Chrome.

iOS terdeteksi bila UA iPad/iPhone/iPod, atau `MacIntel` dengan `maxTouchPoints > 1`; iOS selalu memakai klip.

## 8. Skema SQL Supabase

Tiga file migrasi dijalankan berurutan. Semua fungsi `security definer` memakai `set search_path = ''` dan nama objek yang dikualifikasi skema.

### 8.1 Tabel (`0001_skema.sql`)

```sql
create table public.profil (
  id uuid primary key references auth.users (id) on delete cascade,
  peran text not null check (peran in ('fisioterapis', 'pasien')),   -- [V9] satu akun = satu peran; tanpa GRANT update
  nama text not null default '',
  dibuat timestamptz not null default now()
);

create table public.pasien (
  id uuid primary key default gen_random_uuid(),
  terapis_id uuid not null references public.profil (id) on delete cascade,
  user_id uuid unique references auth.users (id) on delete set null,
  nama_panggilan text not null check (char_length(nama_panggilan) between 1 and 40),
  sisi_terdampak text not null check (sisi_terdampak in ('kiri', 'kanan')),
  gerakan text[] not null check (cardinality(gerakan) between 1 and 2 and gerakan <@ array['jangkau_depan', 'jangkau_samping']),
  repetisi int not null default 10 check (repetisi between 5 and 20),
  sesi_per_minggu int not null default 3 check (sesi_per_minggu between 1 and 7),
  toleransi_batang text not null default 'normal' check (toleransi_batang in ('abaikan', 'longgar', 'normal', 'ketat')),
  toleransi_bahu text not null default 'normal' check (toleransi_bahu in ('abaikan', 'longgar', 'normal', 'ketat')),
  durasi_persen int not null default 30 check (durasi_persen between 10 and 80),
  mode_koreksi text not null default 'penuh' check (mode_koreksi in ('penuh', 'ringkasan', 'mati')),
  kalimat_condong text not null default 'sandaran' check (kalimat_condong in ('sandaran', 'tegak')),
  kode_klaim text unique,
  kode_kedaluwarsa timestamptz,
  persetujuan_versi text,
  persetujuan_waktu timestamptz,
  persetujuan_oleh text check (persetujuan_oleh in ('pasien', 'wali')),
  is_sintetis boolean not null default false,
  dibuat timestamptz not null default now()
);
create index pasien_terapis_idx on public.pasien (terapis_id);

create table public.sesi (
  id uuid primary key,                                   -- dibuat di klien
  pasien_id uuid not null references public.pasien (id) on delete cascade,
  mulai timestamptz not null,
  selesai timestamptz not null,
  resep jsonb not null,
  baseline jsonb,
  rep_total int not null,
  rep_terukur int not null,
  rep_terkompensasi int not null,
  pct_terkompensasi numeric generated always as (rep_terkompensasi::numeric / nullif(rep_terukur, 0) * 100) stored,
  per_gerakan jsonb not null default '{}'::jsonb,
  pct_tak_terukur numeric,
  fps_median numeric,
  suara text check (suara in ('webspeech', 'klip')),
  delegate text check (delegate in ('GPU', 'CPU')),
  nyeri smallint check (nyeri in (0, 1, 2)),
  is_sintetis boolean not null default false,
  check (rep_total >= 1 and rep_terukur between 0 and rep_total and rep_terkompensasi between 0 and rep_terukur)
);
create index sesi_pasien_mulai_idx on public.sesi (pasien_id, mulai);

create table public.eskalasi (
  id uuid primary key default gen_random_uuid(),
  pasien_id uuid not null references public.pasien (id) on delete cascade,
  dibuka timestamptz not null default now(),
  sesi_pemicu uuid[] not null,
  median_baseline numeric not null,
  panjang_run int not null,
  batas int not null,
  ditinjau timestamptz,
  ditinjau_oleh uuid references public.profil (id) on delete set null,
  keputusan text check (keputusan in ('lanjutkan', 'ubah_resep', 'tatap_muka')),
  catatan text,
  check ((ditinjau is null) = (keputusan is null))
);
create index eskalasi_pasien_idx on public.eskalasi (pasien_id);
-- satu eskalasi terbuka per pasien, dijaga DB [default spec]
create unique index eskalasi_satu_terbuka on public.eskalasi (pasien_id) where ditinjau is null;
```

### 8.2 View prioritas (`0001_skema.sql`, F12 + PRD §6.1)

```sql
create view public.v_prioritas with (security_invoker = true) as
select
  p.id as pasien_id,
  p.nama_panggilan,
  p.is_sintetis,
  p.sesi_per_minggu,
  exists (select 1 from public.eskalasi e where e.pasien_id = p.id and e.ditinjau is null) as eskalasi_terbuka,
  t.nyeri as nyeri_terakhir,
  coalesce(t.nyeri = 2, false) as lencana_nyeri,
  k.n7 as sesi_7_hari,
  k.n7::numeric / p.sesi_per_minggu as kepatuhan_7h,
  (t.mulai is not null and k.n7::numeric / p.sesi_per_minggu < 0.5) as jarang,   -- [default spec] pasien tanpa sesi tidak dilabeli
  t.pct_terkompensasi as pct_terakhir,
  t.mulai as sesi_terakhir
from public.pasien p
left join lateral (
  select s.nyeri, s.pct_terkompensasi, s.mulai
  from public.sesi s
  where s.pasien_id = p.id
  order by s.mulai desc
  limit 1
) t on true
cross join lateral (
  select count(*) as n7
  from public.sesi s
  where s.pasien_id = p.id and s.mulai > now() - interval '7 days'
) k
where p.terapis_id = (select auth.uid());
```

Urutan G11 dibuat di klien (view tidak menjamin urutan): `.order('eskalasi_terbuka', { ascending: false }).order('lencana_nyeri', { ascending: false }).order('jarang', { ascending: false }).order('pct_terakhir', { ascending: false, nullsFirst: false })`.

### 8.3 RLS + GRANT (`0001_skema.sql`, PRD §6.2)

```sql
alter table public.profil enable row level security;
alter table public.pasien enable row level security;
alter table public.sesi enable row level security;
alter table public.eskalasi enable row level security;

create policy profil_pilih on public.profil for select to authenticated
  using (id = (select auth.uid()));
create policy profil_ubah on public.profil for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy pasien_pilih on public.pasien for select to authenticated
  using (terapis_id = (select auth.uid()) or user_id = (select auth.uid()));
create policy pasien_sisip on public.pasien for insert to authenticated
  with check (terapis_id = (select auth.uid())
              and exists (select 1 from public.profil f where f.id = (select auth.uid()) and f.peran = 'fisioterapis'));   -- [V9] akun pasien juga punya profil, jadi FK saja tidak cukup
create policy pasien_ubah on public.pasien for update to authenticated
  using (terapis_id = (select auth.uid())) with check (terapis_id = (select auth.uid()));
create policy pasien_hapus on public.pasien for delete to authenticated
  using (terapis_id = (select auth.uid()));

create policy sesi_pilih on public.sesi for select to authenticated
  using (exists (select 1 from public.pasien p where p.id = sesi.pasien_id
                 and (p.terapis_id = (select auth.uid()) or p.user_id = (select auth.uid()))));
create policy sesi_sisip on public.sesi for insert to authenticated
  with check (exists (select 1 from public.pasien p where p.id = sesi.pasien_id
                      and p.user_id = (select auth.uid())));   -- [V9] cabang terapis demo dihapus
-- sesi: tanpa kebijakan ubah/hapus (nyeri lewat RPC, hapus lewat cabut_persetujuan / cascade)

create policy eskalasi_pilih on public.eskalasi for select to authenticated
  using (exists (select 1 from public.pasien p where p.id = eskalasi.pasien_id and p.terapis_id = (select auth.uid())));
create policy eskalasi_tinjau on public.eskalasi for update to authenticated
  using (exists (select 1 from public.pasien p where p.id = eskalasi.pasien_id and p.terapis_id = (select auth.uid())))
  with check (ditinjau_oleh = (select auth.uid()));
-- eskalasi: tanpa kebijakan sisip (hanya trigger security definer)

-- GRANT eksplisit (tabel baru tidak otomatis terbuka ke Data API). anon + service_role: tanpa GRANT.
grant select, update (nama) on public.profil to authenticated;
grant select, delete on public.pasien to authenticated;
grant insert (terapis_id, nama_panggilan, sisi_terdampak, gerakan, repetisi, sesi_per_minggu, toleransi_batang,
              toleransi_bahu, durasi_persen, mode_koreksi, kalimat_condong) on public.pasien to authenticated;
grant update (nama_panggilan, sisi_terdampak, gerakan, repetisi, sesi_per_minggu, toleransi_batang,
              toleransi_bahu, durasi_persen, mode_koreksi, kalimat_condong) on public.pasien to authenticated;
grant select, insert on public.sesi to authenticated;
grant select on public.eskalasi to authenticated;
grant update (ditinjau, ditinjau_oleh, keputusan, catatan) on public.eskalasi to authenticated;
grant select on public.v_prioritas to authenticated;
```

GRANT kolom membatasi apa yang bisa diubah langsung oleh klien. Kolom kode, `user_id`, persetujuan, dan `is_sintetis` hanya bisa diubah lewat RPC **[default spec]**. `profil.peran` hanya ditulis sekali oleh RPC `daftar` [V9].

### 8.4 RPC `daftar` (`0001_skema.sql`, supaya bisa diuji 19.00) [V9]

Menggantikan trigger daftar. `signInWithOAuth` tidak bisa membawa metadata `role`, jadi peran dikirim lewat query `redirectTo` (`/auth/selesai?peran=…`) dan dicatat oleh RPC ini setelah sesi terbentuk. Tidak ada trigger di `auth.users`, jadi risiko "galat trigger memblokir semua login" hilang.

```sql
create or replace function public.daftar(p_peran text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ada text;
  v_nama text;
begin
  if v_uid is null then raise exception 'belum_masuk'; end if;
  if p_peran not in ('fisioterapis', 'pasien') then raise exception 'peran_tidak_sah'; end if;

  select peran into v_ada from public.profil where id = v_uid;
  if v_ada is not null then
    if v_ada <> p_peran then raise exception 'peran_lain'; end if;
    return v_ada;                                         -- idempoten: sign up ulang dengan peran sama
  end if;

  select left(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), 80)
    into v_nama
    from auth.users u
   where u.id = v_uid;

  insert into public.profil (id, peran, nama) values (v_uid, p_peran, coalesce(v_nama, ''));
  return p_peran;
end;
$$;

revoke execute on function public.daftar(text) from public, anon;
grant execute on function public.daftar(text) to authenticated;
```

Galat `peran_lain` → "Akun Google ini sudah terdaftar sebagai {peran}. Pakai akun Google lain untuk peran ini." **[default spec]**.

### 8.5 RPC (`0002_fungsi.sql`, PRD §6.3)

```sql
create or replace function public.klaim_pasien(p_kode text, p_versi text, p_oleh text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pasien uuid;
begin
  if v_uid is null then raise exception 'belum_masuk'; end if;
  if p_oleh not in ('pasien', 'wali') then raise exception 'oleh_tidak_sah'; end if;
  if exists (select 1 from public.profil where id = v_uid and peran = 'fisioterapis') then raise exception 'akun_terapis'; end if;
  if not exists (select 1 from public.profil where id = v_uid and peran = 'pasien') then raise exception 'belum_daftar'; end if;   -- [V9]
  if exists (select 1 from public.pasien where user_id = v_uid) then raise exception 'sudah_terikat'; end if;

  update public.pasien
     set user_id = v_uid,
         kode_klaim = null,
         kode_kedaluwarsa = null,
         persetujuan_versi = p_versi,
         persetujuan_waktu = now(),
         persetujuan_oleh = p_oleh
   where kode_klaim = upper(p_kode)
     and kode_kedaluwarsa > now()
     and user_id is null
  returning id into v_pasien;

  if v_pasien is null then raise exception 'kode_tidak_sah'; end if;
  return v_pasien;
end;
$$;

create or replace function public.buat_kode(p_pasien_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kode text := upper(left(replace(gen_random_uuid()::text, '-', ''), 8));   -- 8 heks acak [default spec]
begin
  update public.pasien
     set kode_klaim = v_kode,
         kode_kedaluwarsa = now() + interval '7 days',
         user_id = null                                  -- lepas akun lama (F03)
   where id = p_pasien_id
     and terapis_id = auth.uid();
  if not found then raise exception 'bukan_pasien_anda'; end if;
  return v_kode;
end;
$$;

create or replace function public.lapor_nyeri(p_sesi_id uuid, p_nilai int)
returns boolean                                          -- false = sudah terisi / bukan milik; antrean menganggap selesai
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_nilai not in (0, 1, 2) then raise exception 'nilai_tidak_sah'; end if;
  update public.sesi s
     set nyeri = p_nilai
    from public.pasien p
   where s.id = p_sesi_id
     and p.id = s.pasien_id
     and s.nyeri is null
     and p.user_id = auth.uid();                         -- [V9] cabang terapis demo dihapus
  return found;
end;
$$;

create or replace function public.cabut_persetujuan()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pasien uuid;
begin
  select id into v_pasien from public.pasien where user_id = auth.uid();
  if v_pasien is null then raise exception 'tidak_terikat'; end if;
  delete from public.eskalasi where pasien_id = v_pasien;      -- [V8]
  delete from public.sesi where pasien_id = v_pasien;
  update public.pasien
     set user_id = null, persetujuan_versi = null, persetujuan_waktu = null, persetujuan_oleh = null
   where id = v_pasien;
end;
$$;

revoke execute on function public.klaim_pasien(text, text, text), public.buat_kode(uuid),
  public.lapor_nyeri(uuid, int), public.cabut_persetujuan() from public, anon;
grant execute on function public.klaim_pasien(text, text, text), public.buat_kode(uuid),
  public.lapor_nyeri(uuid, int), public.cabut_persetujuan() to authenticated;
```

Pesan galat yang dipetakan di UI: `kode_tidak_sah` → "Minta tautan baru ke fisioterapis"; `sudah_terikat` → "Akun ini sudah terhubung ke pasien lain. Hapus data dulu di beranda, atau masuk dengan akun Google lain."; `akun_terapis` → "Akun ini terdaftar sebagai fisioterapis. Keluar, lalu masuk dengan akun Google lain untuk menjadi pasien." + tombol "Keluar dan ganti akun"; `belum_daftar` → arahkan ke "Sign Up as Pasien" dengan `lanjut` ke tautan ini **[default spec]**.

### 8.6 Trigger eskalasi `cek_eskalasi` (`0003_sintetis.sql`, F14 + PRD §6.3)

```sql
create or replace function public.cek_eskalasi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tinjau timestamptz;
  v_ids uuid[];
  v_pct numeric[];
  v_urut numeric[];
  v_median numeric;
  v_n int;
  v_run int := 0;
  v_run_ids uuid[] := '{}';
  v_batas int;
  i int;
begin
  if new.rep_terukur < 5 then return null; end if;                  -- bukan titik data
  if exists (select 1 from public.eskalasi where pasien_id = new.pasien_id and ditinjau is null) then
    return null;                                                     -- sudah ada yang terbuka
  end if;

  select max(ditinjau) into v_tinjau from public.eskalasi where pasien_id = new.pasien_id;

  -- titik data: sesi ≥ 5 repetisi terukur sejak tinjauan terakhir, urut waktu
  select array_agg(id order by mulai, id), array_agg(pct_terkompensasi order by mulai, id)
    into v_ids, v_pct
    from public.sesi
   where pasien_id = new.pasien_id
     and rep_terukur >= 5
     and (v_tinjau is null or mulai > v_tinjau);

  if coalesce(array_length(v_ids, 1), 0) < 7 then return null; end if;

  -- median baseline = median 6 titik pertama, dibekukan (numeric persis, bukan percentile_cont double)
  select array_agg(x order by x) into v_urut from unnest(v_pct[1:6]) as x;
  v_median := (v_urut[3] + v_urut[4]) / 2;

  -- n = titik yang tidak tepat di median
  select count(*) into v_n from unnest(v_pct) as x where x <> v_median;

  -- run di atas median yang berakhir di sesi terbaru; titik = median dilewati, tidak memutus
  for i in reverse array_length(v_pct, 1) .. 1 loop
    continue when v_pct[i] = v_median;
    exit when v_pct[i] < v_median;
    v_run := v_run + 1;
    v_run_ids := v_ids[i] || v_run_ids;
  end loop;

  if v_run = 0 then return null; end if;
  v_batas := round(log(2, v_n::numeric) + 3);

  if v_run > v_batas then
    insert into public.eskalasi (pasien_id, dibuka, sesi_pemicu, median_baseline, panjang_run, batas)
    values (new.pasien_id, coalesce(new.selesai, now()), v_run_ids, v_median, v_run, v_batas);   -- dibuka = sesi.selesai [default spec]
  end if;
  return null;
exception when others then
  raise warning 'cek_eskalasi: %', sqlerrm;          -- tidak pernah membatalkan sisipan sesi
  return null;
end;
$$;

create trigger sesi_cek_eskalasi
  after insert on public.sesi
  for each row execute function public.cek_eskalasi();
```

Upsert `ignoreDuplicates` (`on conflict do nothing`) tidak menyalakan trigger untuk baris yang dilewati, sehingga kirim ulang aman.

### 8.7 `isi_sintetis` (`0003_sintetis.sql`, PRD §10)

```sql
create or replace function public.isi_sintetis(p_pasien_id uuid, p_pola text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pct int[];
  v_n int;
  v_k int;
  v_mulai timestamptz;
  v_resep jsonb;
  i int;
begin
  v_pct := case p_pola
    -- pola §10 (dipakai isi_contoh)
    when 'memburuk'     then array[10,15,10,15,10,15, 20,20,25,25,30,30,35,35,40]
    when 'stabil_nyeri' then array[20,15,25, 20,15,25, 20,15,25, 20,15,25, 20,15,25]
    when 'jarang'       then array[20,25]
    when 'membaik'      then array[40,35,40,35,30,30, 30,25,25,20,20,20,15,15,15]
    when 'stabil_baik'  then array[5,10,5,10,5,10, 5,10,5,10,5,10, 5,10,5]
    -- pola uji §12.2 (manual saja, tidak dipakai isi_contoh)
    when 'uji_berderau' then array[10,15,10,15,10,15, 25,20,30,15,20,35,20,30,25]
    when 'uji_median'   then array[10,20,10,20,20,10, 25,15,25,15,25,25,30,25,30,30]
  end;
  if v_pct is null then raise exception 'pola tidak dikenal: %', p_pola; end if;
  v_n := array_length(v_pct, 1);

  select jsonb_build_object(
           'gerakan', p.gerakan, 'repetisi', p.repetisi, 'sesi_per_minggu', p.sesi_per_minggu,
           'toleransi_batang', p.toleransi_batang, 'toleransi_bahu', p.toleransi_bahu,
           'durasi_persen', p.durasi_persen, 'mode_koreksi', p.mode_koreksi, 'kalimat_condong', p.kalimat_condong,
           'kandidat_condong', 'a', 'suara_condong', true, 'ambang_versi', 'sintetis')
    into v_resep
    from public.pasien p
   where p.id = p_pasien_id;

  for i in 1 .. v_n loop
    -- 3 sesi/minggu: sesi ke-i = 1 hari + (n − i)·56 jam lalu → 3 sesi dalam 7 hari terakhir, sesi pertama ±34 hari lalu
    v_mulai := case
      when p_pola = 'jarang' then now() - make_interval(days => case i when 1 then 12 else 9 end)
      else now() - interval '1 day' - (v_n - i) * interval '56 hours'
    end;
    v_k := v_pct[i] * 20 / 100;                          -- 20 repetisi terukur per sesi (2 gerakan × 10)

    insert into public.sesi (
      id, pasien_id, mulai, selesai, resep, baseline,
      rep_total, rep_terukur, rep_terkompensasi, per_gerakan,
      pct_tak_terukur, fps_median, suara, delegate, nyeri, is_sintetis)
    values (
      gen_random_uuid(), p_pasien_id, v_mulai, v_mulai + interval '12 minutes', v_resep, null,
      20, 20, v_k,
      jsonb_build_object(
        'jangkau_depan', jsonb_build_object(
          'rep_total', 10, 'rep_terukur', 10, 'rep_terkompensasi', v_k - v_k / 2,
          'per_penanda', jsonb_build_object('batang', v_k - v_k / 2, 'bahu', 0),
          'waktu_gerak_median', round((1.8 + random() * 0.3)::numeric, 2),
          'v_puncak_median', round((1.3 + random() * 0.2)::numeric, 2),
          'n_puncak_median', 1 + floor(random() * 2)::int),
        'jangkau_samping', jsonb_build_object(
          'rep_total', 10, 'rep_terukur', 10, 'rep_terkompensasi', v_k / 2,
          'per_penanda', jsonb_build_object('batang', 0, 'bahu', v_k / 2),
          'waktu_gerak_median', round((2.0 + random() * 0.3)::numeric, 2),
          'v_puncak_median', round((1.1 + random() * 0.2)::numeric, 2),
          'n_puncak_median', 1 + floor(random() * 2)::int)),
      0, round((22 + random() * 4)::numeric, 1), 'webspeech', 'GPU',
      case
        when p_pola = 'stabil_nyeri' and i = v_n then 2
        when p_pola = 'stabil_nyeri' and i = v_n - 3 then 1
        else 0
      end,
      true);
  end loop;
end;
$$;
```

Sesi disisipkan kronologis satu per satu, jadi `cek_eskalasi` ikut berjalan dan teruji. Angka kinematik sintetis berupa derau kecil; ganti setelah uji tim bila sempat (PRD §10).

### 8.8 `isi_contoh` (`0003_sintetis.sql`, F16) [V9]

Satu RPC untuk dua tombol. "Isi data contoh" (akun belum punya pasien sintetis) dan "Atur ulang data contoh" (sudah punya) sama-sama memanggil `isi_contoh()`: pasien sintetis lama milik akun ini dihapus dulu, lalu 5 pasien diisi ulang. Hasilnya selalu sama, jadi fungsi ini idempoten.

```sql
create or replace function public.isi_contoh()
returns int                                        -- jumlah pasien sintetis yang dibuat
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  r record;
begin
  -- kunci baris profil: klik ganda tidak membuat 10 pasien [default spec]
  perform 1 from public.profil where id = v_uid and peran = 'fisioterapis' for update;
  if not found then raise exception 'bukan_fisioterapis'; end if;

  -- atur ulang: sesi + eskalasi ikut terhapus lewat on delete cascade (§8.1)
  delete from public.pasien where terapis_id = v_uid and is_sintetis;

  for r in
    select * from (values
      ('Pak Wayan',  'kanan', 'memburuk'),
      ('Bu Made',    'kiri',  'stabil_nyeri'),
      ('Pak Nyoman', 'kanan', 'jarang'),
      ('Bu Ketut',   'kiri',  'membaik'),
      ('Pak Komang', 'kanan', 'stabil_baik')
    ) as v(nama, sisi, pola)
  loop
    insert into public.pasien (terapis_id, nama_panggilan, sisi_terdampak, gerakan, repetisi, sesi_per_minggu, is_sintetis)
    values (v_uid, r.nama, r.sisi, array['jangkau_depan', 'jangkau_samping'], 10, 3, true)
    returning id into v_id;
    perform public.isi_sintetis(v_id, r.pola);
  end loop;
  return 5;
end;
$$;

revoke execute on function public.isi_contoh() from public, anon;
grant execute on function public.isi_contoh() to authenticated;
revoke execute on function public.isi_sintetis(uuid, text), public.cek_eskalasi() from public, anon, authenticated;
```

Efek atur ulang pada ponsel yang terikat ke pasien sintetis lama: baris `pasien` hilang, jadi beranda ponsel itu kembali ke keadaan "belum ada resep" (§10.6), dan sesi antrean yang belum terkirim ditolak RLS lalu pindah ke `rc_gagal` (§11). Juri tinggal memindai QR baru.

Hasil yang diharapkan setelah "Isi data contoh" atau "Atur ulang data contoh":

| Pasien | Pola | Hasil di dasbor |
|---|---|---|
| Pak Wayan | baseline 10,15,10,15,10,15 (median 12,5), lalu naik sampai 40 | Eskalasi terbuka di sesi 13: run sesi 6–13 = 8 > batas round(log2(13) + 3) = 7. Baris paling atas |
| Bu Made | 20,15,25 berulang (median 20; titik 20 dilewati) | Tanpa eskalasi. Sesi terakhir nyeri 2 → lencana Nyeri |
| Pak Nyoman | 2 sesi, 12 dan 9 hari lalu | Lencana Jarang latihan (kepatuhan 0) |
| Bu Ketut | baseline median 35, lalu turun ke 15 | Grafik membaik, tanpa eskalasi |
| Pak Komang | 5 dan 10 bergantian (median 7,5) | Tanpa masalah |

Urutan F12: Wayan (eskalasi) → Made (nyeri) → Nyoman (jarang) → Ketut (15%) → Komang (5%).

## 9. Route `/api/ringkasan` (F20)

Kontrak: `POST /api/ringkasan` dengan body `{ pasien_id: uuid }` dan header `Authorization: Bearer <access_token Supabase>`. Respons `200 { sumber: 'ai' | 'templat', teks: string, alasan?: 'tanpa_kunci' | 'api_gagal' | 'kalimat' | 'angka_tidak_cocok', masukan: MasukanRingkasan }`.

`masukan` sengaja dikembalikan, supaya isi persis yang dikirim ke Gemini terlihat di tab Network (§14 no. 7) **[default spec]**.

Langkah:
```
1. token ← header; tidak ada → 401
2. sb ← createClient(URL, PUBLISHABLE_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
3. { user } ← sb.auth.getUser(token); gagal → 401                  // verifikasi JWT; service role tidak dipakai
4. pasien_id bukan uuid → 400
5. pasien ← sb.from('pasien').select('id, terapis_id, sesi_per_minggu').eq('id', pasien_id).maybeSingle()
   null atau terapis_id ≠ user.id → 403                             // RLS tetap berlaku
6. sesi ← sb.from('sesi').select('mulai, resep, rep_terukur, pct_terkompensasi, pct_tak_terukur, nyeri, per_gerakan')
          .eq('pasien_id', id).gte('mulai', kini − 14 hari).order('mulai')
   esk  ← sb.from('eskalasi').select('dibuka, median_baseline, panjang_run, batas').eq('pasien_id', id).is('ditinjau', null).maybeSingle()
7. masukan ← bangunMasukan(pasien, sesi, esk, kini)
8. tanpa GEMINI_API_KEY → templat, alasan 'tanpa_kunci'
9. teks ← fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
         header x-goog-api-key, body { systemInstruction: PROMPT, contents: [JSON.stringify(masukan)],
         generationConfig: { temperature: 0.2, maxOutputTokens: 400 } }, timeout 8 dtk)
   galat / kuota / timeout → templat, alasan 'api_gagal'
10. !cekKalimat(teks) (3–5 kalimat) → templat, alasan 'kalimat'     [default spec]
11. !cekAngka(teks, angkaSah(masukan)) → templat, alasan 'angka_tidak_cocok'
12. { sumber: 'ai', teks, masukan }
```

Masukan hanya angka. Tanpa nama, tanpa ID, tanpa tanggal absolut **[default spec: hari relatif]**:
```ts
export type MasukanRingkasan = {
  periode_hari: 14; jendela_kepatuhan_hari: 7;
  target_sesi_per_minggu: number; jumlah_sesi_periode: number; sesi_7_hari: number; kepatuhan_7_hari_persen: number;
  pct_terkompensasi_median_periode: number | null; sesi_nyeri: number;   // sesi dengan nyeri ≥ 1
  sesi: { hari_lalu: number; pct_terkompensasi: number | null; rep_terukur: number; pct_tak_terukur: number | null;
          nyeri: 0 | 1 | 2 | null; mode_koreksi: 'penuh' | 'ringkasan' | 'mati';
          waktu_gerak_median_detik: { jangkau_depan?: number; jangkau_samping?: number } }[];
  eskalasi_terbuka: null | { median_baseline: number; panjang_run: number; batas: number; hari_sejak_dibuka: number };
};
```
Angka dibulatkan ke 1 desimal (waktu gerak 2 desimal). Hanya waktu gerak yang dikirim sebagai metrik kinematik; v_puncak dan n_puncak ("kurang andal") tidak dikirim **[default spec]**.

PROMPT (systemInstruction):
> Anda menulis ringkasan data latihan rumah untuk fisioterapis. Tulis 3 sampai 5 kalimat Bahasa Indonesia, nada netral. Pakai hanya angka yang ada di JSON masukan dan tulis angka dengan digit. Jangan membuat diagnosis, jangan menebak penyebab, jangan menyarankan perubahan resep, dosis, atau tindakan. Jangan menyebut nama atau identitas apa pun. Bila data sedikit, katakan data terbatas.

`lib/ringkasan.ts` (fungsi murni, diuji di `ringkasan.test.ts`):
- `norm(x) = String(Math.round(x · 10) / 10)`.
- `angkaSah(m)`: untuk tiap daun angka v di `m`, masukkan norm(v), norm(round(v)), norm(|v|), dan norm(round(|v|)).
- `cekAngka(teks, sah)`: setiap token `/\d+(?:[.,]\d+)?/g` (tanpa tanda minus, karena "3-5" bukan angka negatif), koma diganti titik, lalu norm(parseFloat(token)) wajib ada di `sah`. Batasnya: angka yang ditulis sebagai kata ("tiga") lolos tanpa cek. Ini dicatat di README.
- `cekKalimat(teks)`: 3–5 kalimat.
- `templat(m)`, deterministik, hanya memakai angka dari `m`:
  1. "Dalam 14 hari terakhir tercatat {jumlah_sesi_periode} sesi; kepatuhan 7 hari {kepatuhan_7_hari_persen}% dari target {target} sesi per minggu."
  2. "Persentase repetisi terkompensasi sesi terakhir {x}%, median periode {y}%."
  3. "Nyeri dilaporkan (agak nyeri atau nyeri) pada {sesi_nyeri} sesi."
  4. Bila ada eskalasi: "Eskalasi terbuka: {panjang_run} sesi berturut-turut di atas median baseline {median}% (batas {batas})." Bila tidak ada: "Tidak ada eskalasi terbuka."
  5. Bila jumlah sesi 0: "Belum ada sesi dalam 14 hari terakhir."
- Tes wajib: (1) angka asing → `cekAngka` false; (2) angka masukan dengan koma desimal → true; (3) invarian `cekAngka(templat(m), angkaSah(m)) === true`.

UI kartu: sumber `ai` → label "Ringkasan AI, cek grafik sebelum memutuskan". Sumber `templat` → "Ringkasan templat, cek grafik sebelum memutuskan" **[default spec]**.

## 10. Layar dan state per rute

### 10.1 `/` Login (F01, F15) [V9]
- Saat dimuat: ada sesi → `cekPeran()`: `fisioterapis` → `/terapis`; `pasien` → `/pasien`; tanpa profil → tampilkan pilihan Sign up (akun Google sudah masuk tetapi belum memilih peran; ketuk langsung memanggil `rpc('daftar')` tanpa OAuth ulang).
- Isi halaman, dari atas:
  1. Nama + satu kalimat produk.
  2. Tombol besar (≥ 64 px) **"Login with Google"** → `masukGoogle()`.
  3. Teks "Belum punya akun? **Sign up**". Ketuk "Sign up" → dua tombol besar: **"Sign Up as Fisioterapis"** → `masukGoogle({ peran: 'fisioterapis' })` dan **"Sign Up as Pasien"** → `masukGoogle({ peran: 'pasien' })`. Di bawahnya: "Satu akun Google hanya untuk satu peran."
  4. Tautan teks kecil **"Coba latihan tanpa akun"** → `/tamu` (area ketuk ≥ 44 px).
- Tidak ada form email/kata sandi. Label tombol memakai teks Inggris persis seperti V9; sisa halaman Bahasa Indonesia.
- Galat dari `/auth/selesai` datang lewat `?galat=`: `oauth` → "Login Google gagal, coba lagi"; `peran_lain` → pesan §8.4 **[default spec]**.

`lib/supabase.ts` (Pindra):
```ts
export const supabase = createClient(URL, PUBLISHABLE_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
});
export function masukGoogle(o: { peran?: 'fisioterapis' | 'pasien'; lanjut?: string } = {}) {
  const q = new URLSearchParams();
  if (o.peran) q.set('peran', o.peran);
  if (o.lanjut?.startsWith('/') && !o.lanjut.startsWith('//')) q.set('lanjut', o.lanjut);   // path internal saja
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/auth/selesai?${q}`, queryParams: { prompt: 'select_account' } },
  });
}
export async function cekPeran(): Promise<'fisioterapis' | 'pasien' | null>;   // profil.peran milik auth.uid()
```
`prompt: 'select_account'` membuat pemilih akun Google selalu tampil, jadi akun kedua bisa dipilih di perangkat yang sama (R22).

### 10.1b `/auth/selesai` (F01) [V9]
1. `await supabase.auth.getSession()`. Saat inisialisasi, supabase-js menukar `?code=` PKCE secara otomatis. Tanpa sesi, atau query membawa `error` → `/?galat=oauth`.
2. Query membawa `peran` → `rpc('daftar', { p_peran: peran })`. Galat `peran_lain` → `signOut()` → `/?galat=peran_lain`.
3. `cekPeran()` = null (login tanpa sign up) → tampilkan dua tombol "Sign Up as Fisioterapis" / "Sign Up as Pasien" di halaman ini → `rpc('daftar')`.
4. Arahkan: `lanjut` bila ada, selain itu `fisioterapis` → `/terapis`, `pasien` → `/pasien`. Pakai `router.replace`, supaya `?code=` tidak tersisa di riwayat browser.
5. Selama proses tampil "Sedang masuk…".

### 10.2 `/terapis` Daftar prioritas (F12)
- Guard: `cekPeran() = 'fisioterapis'`, selain itu `/`. Data dari `v_prioritas` dengan urutan §8.2.
- Baris: nama panggilan, lencana teks + ikon (Eskalasi, Nyeri, Jarang latihan, Data sintetis), % terkompensasi terakhir, "X dari Y sesi 7 hari". Ketuk → detail.
- Tombol: "Pasien baru", "Muat ulang", "Keluar". Muat ulang juga saat `focus` / `visibilitychange`.
- **Data contoh (F16) [V9]**: tombol sekunder di kepala daftar. Labelnya "Isi data contoh" bila tidak ada baris `is_sintetis`, selain itu "Atur ulang data contoh".
  - Daftar kosong: kartu "Belum ada pasien" dengan dua tombol, "Pasien baru" dan "Isi data contoh" **[default spec]**.
  - "Isi data contoh" → `rpc('isi_contoh')` langsung.
  - "Atur ulang data contoh" → dialog "Pasien contoh dan semua sesinya dibuat ulang. Ponsel yang terhubung ke pasien contoh harus memindai QR baru." → "Ya, atur ulang" / "Batal" → `rpc('isi_contoh')`.
  - Selama panggilan, tombol nonaktif dengan teks "Mengisi…", lalu daftar dimuat ulang.

### 10.3 `/terapis/pasien/baru` dan edit resep (F02)
- `FormResep`: nama panggilan, sisi (kiri/kanan), gerakan (checkbox, minimal 1), repetisi 5–20, sesi/minggu 1–7, toleransi batang + bahu (Abaikan/Longgar/Normal/Ketat), % durasi 10–80 (bawaan 30), mode koreksi **Penuh/Mati**, kalimat condong (Menempel sandaran / Tetap tegak).
- Simpan baru → insert → `/terapis/pasien/[id]`. Edit → update dengan catatan "berlaku mulai sesi berikutnya".

### 10.4 `/terapis/pasien/[id]` Detail (F13, F14, F03, F20)
Bagian, berurutan dari atas:
1. Kepala: nama, sisi, lencana "Data sintetis" bila `is_sintetis`.
2. **Eskalasi terbuka** (bila ada): run chart (`Grafik`). x = sesi sejak tinjauan, y = %. Garis putus-putus "median baseline {m}%", titik `sesi_pemicu` ditebalkan, teks "run {panjang_run} > batas {batas}". Di bawahnya tabel: tanggal, % terkompensasi, repetisi terukur, % tak terukur, nyeri. Juga catatan "N sesi < 5 repetisi terukur tidak dihitung". Tombol **Tinjau** membuka 3 pilihan besar (Lanjutkan / Ubah resep / Jadwalkan tatap muka) + catatan opsional + Simpan → `update eskalasi set ditinjau = now(), ditinjau_oleh = uid, keputusan, catatan` → muat ulang. Pilihan "Ubah resep" menggulir ke form resep.
3. Tren % terkompensasi per sesi. Bentuk titik per mode: bulat "P" = Penuh, kotak "M" = Mati (bentuk + label, bukan warna saja).
4. Tabel 10 sesi terakhir: tanggal, % terkompensasi, mode, nyeri, % tak terukur. Kepatuhan "7 hari: X dari Y" **[default spec: tabel untuk nyeri/tak terukur, grafik untuk % dan waktu gerak]**.
5. Metrik kinematik per gerakan: grafik median waktu gerak (utama). Kecepatan puncak dan jumlah puncak tampil sebagai angka berlabel "kurang andal". Keterangan "2D, untuk tren pasien ini saja". Penanda bahu berlabel "penanda lemah".
6. **Ringkasan AI**: tombol → kartu (§9).
7. **Tautan perangkat**: tombol "Buat tautan perangkat" → `rpc('buat_kode')` → tautan `{origin}/k/{KODE}` + QR (`qrcode` → data URL) + tanggal kedaluwarsa + kode 8 karakter dalam huruf besar (untuk diketik bila QR gagal) + peringatan "Kode lama dibatalkan dan akun lama dilepas".
8. Edit resep (`FormResep`).

### 10.5 `/k/[kode]` Klaim + persetujuan (F03, F19)
Alur, mengikuti urutan PRD:
1. Cek akun [V9]:
   - Belum masuk → layar "Masuk untuk menghubungkan akun pasien" dengan tombol "Sign Up as Pasien" → `masukGoogle({ peran: 'pasien', lanjut: '/k/{kode}' })` dan "Login with Google" → `masukGoogle({ lanjut: '/k/{kode}' })`.
   - Peran `fisioterapis` → pesan `akun_terapis` (§8.5) + tombol "Keluar dan ganti akun" → `signOut()` → `masukGoogle({ peran: 'pasien', lanjut: '/k/{kode}' })`.
   - Tanpa profil → tombol "Sign Up as Pasien" → `rpc('daftar', { p_peran: 'pasien' })`.
   - Peran `pasien` yang sudah terikat → pesan `sudah_terikat` sebelum layar persetujuan, supaya tidak membaca persetujuan lalu gagal **[default spec]**.
2. **Layar persetujuan**: paragraf naskah A4. Tombol "Dengarkan" (ketukan ini membuka suara lalu memutar I-SETUJU-1…n) **[default spec]**. Pilihan besar: "Saya pasien" / "Saya wali atas nama pasien". Tombol "Setuju" dan "Tidak setuju".
3. Setuju → `rpc('klaim_pasien', { p_kode, p_versi: 'F19-v1', p_oleh })` → simpan `rc_resep` → `/pasien`.
4. Tidak setuju → layar "Tanpa persetujuan aplikasi tidak bisa dipakai. Hubungi fisioterapis Anda."
5. Galat dipetakan sesuai §8.5.

Kerangka naskah F19 untuk Pindra (draf; teks final milik Pindra):
1. Tujuan: membantu latihan lengan di rumah. Kamera menghitung gerakan dan memberi koreksi suara. Video tidak pernah keluar dari ponsel ini.
2. Data yang disimpan: nama panggilan, resep, dan angka tiap sesi (jumlah gerakan, gerakan yang perlu diperbaiki, laporan nyeri). Untuk ringkasan otomatis fisioterapis, hanya angka tanpa nama yang dikirim ke layanan AI Google (Gemini). Untuk masuk, email dan nama akun Google Anda disimpan oleh layanan login (Supabase Auth); fisioterapis tidak melihatnya [V9].
3. Masa simpan: [Pindra isi. **Default spec**: sampai pasien menghapus, atau sampai proyek demo ditutup, paling lama 90 hari.]
4. Hak: berhenti kapan saja. Tombol "Hapus data saya" di beranda menghapus semua sesi dan melepas akun Anda dari data pasien. Akun login Anda tetap ada sampai fitur hapus akun tersedia [V9].
5. Lokasi dan persetujuan: server Supabase di Singapura. Persetujuan diberikan oleh pasien, atau oleh wali atas nama pasien bila pasien tidak mampu.

### 10.6 `/pasien` Beranda (F04, F11, F19)
- Guard: `cekPeran() = 'pasien'`, selain itu `/`. Saat luring dipakai `rc_resep`.
- **Belum ada resep** (daring, tidak ada `pasien.user_id = uid`) [V9]: hapus `rc_resep`, lalu tampilkan:
  - "Minta fisioterapis Anda membuat resep, lalu pindai QR-nya dengan kamera ponsel."
  - Kolom kode 8 karakter (`autocapitalize="characters"`, huruf besar otomatis) + tombol "Hubungkan" → `/k/{KODE}`. Kolom ini cadangan bila QR gagal; jalur utama tetap QR tanpa mengetik (NFR-6).
  - Tautan "Coba latihan tanpa akun" dan tombol "Keluar" **[default spec]**.
  - Keadaan ini juga muncul setelah fisioterapis menekan "Atur ulang data contoh" untuk pasien contoh yang terikat ke akun ini.
- **Sudah terikat** — isi: "Halo, {nama}", kartu "7 hari terakhir: X dari Y sesi" (X dari `rc_riwayat`), tombol besar "Mulai latihan" (ketuk 1: `suara.buka()` lalu `router.push('/pasien/sesi')`), teks "N sesi menunggu dikirim" bila antrean belum kosong.
- "Hapus data saya" (tombol sekunder ≥ 44 px) → layar konfirmasi "Semua sesi latihan dihapus dan akun Anda dilepas dari data pasien. Tidak bisa dibatalkan." → "Ya, hapus" / "Batal".
  - Ya → butuh internet (luring → "Butuh internet untuk menghapus") → `rpc('cabut_persetujuan')` → hapus `rc_antrean`, `rc_gagal`, `rc_riwayat:*`, `rc_resep` → `signOut()` → `/` dengan pesan "Data dihapus" **[default spec]**.
- "Keluar" (tombol sekunder) → `signOut()` + hapus `rc_resep`. Nonaktif selama antrean belum kosong, dengan teks "Tunggu N sesi terkirim dulu", supaya sesi tidak terkirim atas nama akun lain **[default spec]**.

### 10.7 `Sesi.tsx` (dipakai `/pasien/sesi` dan `/tamu`)

Props: `{ resep: ResepSalinan & { sisi: Sisi }, pasienId?: string, simpan: boolean, tamu?: boolean, kembali: string }`.
Konfig mesin: `kandidat` = tamu ? 'a' : KANDIDAT_CONDONG, `suaraCondong` = SUARA_CONDONG.

| State | Suara | Tampil | Lanjut |
|---|---|---|---|
| `mulai` (hanya bila suara belum dibuka, misalnya URL dibuka langsung) | — | Tombol "Mulai latihan" | Ketuk → `suara.buka()` → `kamera` |
| `kamera` | — | "Menunggu izin kamera…". Setelah > 10 dtk: petunjuk ikon kamera di bilah alamat **[default spec]**. Galat per jenis: `NotAllowedError` (cara mengizinkan per browser), `NotFoundError`, `NotReadableError`, lainnya | Stream + model siap → `panduan` |
| `panduan` (F05) | I-KAMERA, I-POSISI; I-BINGKAI tiap 10 dtk selama cek gagal **[default spec]** | Teks panduan (kursi bersandaran tanpa sandaran tangan, kamera setinggi dada, 1,5–2 m, tampak depan, kepala sampai pangkuan, lanskap disarankan), pratinjau + overlay, status cek | Tanpa tombol. Begitu `buatPemantau` tidak gating (dan frame saat ini baik), otomatis → `kalibrasi`. Overlay peringatan besar di pratinjau selama gating |
| `kalibrasi` (F06) | I-KALIB, lalu N-5…N-1 tiap 1 dtk | Angka besar sebagai overlay di pratinjau, bingkai hijau. Posisi buruk di frame mana pun → hitung mundur batal seketika, suara dihentikan, kembali ke `panduan` (I-BINGKAI, jeda ≥ 5 dtk). 1 dtk pertama frame dibuang saat kalibrasi | OK → I-KALIB-OK → `gerakan[0]`. Gagal → I-KALIB-ULANG lalu ulangi. Gagal ke-3 → `panduan` + kotak bantuan |
| `gerakan` (F07–F09) | I-G1 / I-G2. Koreksi (Penuh), N-k, I-BAGUS (Penuh), I-GATING | Video cermin CSS + overlay (canvas ikut dicerminkan), video peragaan di pojok (`scaleX(-1)` untuk sisi kiri), "3 / 10" besar, nama gerakan, indikator keyakinan (bar + teks), fps kecil, tombol besar "Berhenti" | Hitungan = `repetisi` → `mesin.akhiri()` → `istirahat` (bila masih ada gerakan) atau `ringkasan` |
| `istirahat` | I-ISTIRAHAT | Hitung mundur 20 dtk | → gerakan berikutnya |
| `ringkasan` (F10) | I-SELESAI, lalu I-NYERI (bukan tamu) | Total repetisi, repetisi benar, grafik "% repetisi benar" 7 sesi terakhir (`rc_riwayat`), 3 tombol nyeri ikon + teks ≥ 44×44 (Tidak nyeri / Agak nyeri / Nyeri), tombol "Selesai" | Selesai → `kembali` |

- Berhenti: ≥ 1 repetisi → `ringkasan` (sesi disimpan); 0 repetisi → `kembali`.
- Masuk `ringkasan` dengan `simpan`: `agregatSesi` → `antrean.tambah({ jenis: 'sesi' })` → `antrean.kirim()` → tambah `rc_riwayat`. Ketuk nyeri → `antrean.tambah({ jenis: 'nyeri' })` → kirim.
- `kembali`: pasien `/pasien`, tamu `/tamu` (kembali ke form resep) **[default spec]**.
- Mode Mati: event `koreksi` tidak muncul (mesin) dan I-BAGUS tidak diputar; semua state lain sama, termasuk layar `ringkasan` [V8].
- Tamu: tanpa nyeri, tanpa grafik riwayat; tampil angka sesi ini saja **[default spec]**.

### 10.8 `/pasien/sesi`
- Guard: peran `pasien` dan terikat (atau `rc_resep` ada saat luring), selain itu `/pasien`.
- Resep dari `pasien` (daring) atau `rc_resep` (luring).
- `<Sesi simpan resep={salinan + kandidat_condong + suara_condong + ambang_versi} />`.

### 10.9 `/tamu` (F15)
- Tanpa login. Spanduk tetap "Mode tamu: data tidak disimpan".
- **Langkah 1, form resep** [V9]: `<FormResep mode="tamu" onKirim={…} />`.
  - Field: sisi lengan (dua tombol besar "Lengan kiri" / "Lengan kanan"), gerakan (checkbox, minimal 1), repetisi 5–20, toleransi batang + bahu, % durasi 10–80, mode koreksi Penuh/Mati, kalimat condong. Tanpa nama panggilan dan tanpa sesi/minggu.
  - Bawaan: jangkau depan saja, 5 repetisi, Normal / Normal, 30, Penuh, `sandaran` [V8].
  - Isian terakhir disimpan di `rc_tamu` (try/catch) **[default spec]**.
- **Langkah 2**: tombol besar "Mulai latihan" (ketukan ini juga membuka suara) → `<Sesi simpan={false} tamu kembali="/tamu" resep={{ ...isianForm, kandidat_condong: 'a', suara_condong: SUARA_CONDONG, ambang_versi: AMBANG_VERSI }} />`. Kandidat condong tamu tetap (a) [V8]. Tanpa panggilan database.
- `FormResep` milik Pindra: prop `mode: 'baru' | 'edit' | 'tamu'`. Mode `tamu` tidak memanggil Supabase, hanya `onKirim(nilai)`. Ari memakainya mulai 21.00 **[default spec]**.

### 10.10 `/uji` (F17, tidak ditautkan dari UI)
- Form sebelum tiap set: subjek (S1/S2/S3/lain), sisi lengan, gerakan, label (normal/condong/miring/elevasi), sudut target (0/10/20/30/–), posisi perangkat (depan/oblik), `rep_instruksi` (bawaan 10), mode (Penuh/Mati, bawaan Penuh).
- Tombol: Kalibrasi, Mulai set, Akhiri set, **Rekam statis 3 dtk** (tangga condong), Ekspor CSV, Hapus baris.
- Live: w, d, r, zb, Δθ, el, Δθ3D, dp, status, gating, skor, fps, delegate, jalur suara, flag condongA/B/C, miring, el.
- Baris disimpan di memori + autosave `rc_uji` (try/catch), supaya data tidak hilang saat reload **[default spec]**. Tidak ada bingkai yang disimpan.
- Nama file CSV: `uji_{subjek}_{posisi}_{yyyymmdd-hhmm}.csv`. Satu baris per repetisi (`tipe=rep`) atau per rekaman statis (`tipe=statis`, berisi median fitur + fraksi aktif kandidat selama 3 dtk). Kolom:

```
waktu_iso, subjek, sisi, gerakan, label, sudut_target, posisi, set_id, tipe, rep_ke, rep_instruksi, durasi_ms,
terukur, fraksi_tergating,
w_puncak, d_puncak, r_puncak, zb_puncak, dtheta_puncak, el_puncak, dtheta3d_puncak,
fraksi_condong_a, fraksi_condong_b, fraksi_condong_c, fraksi_miring, fraksi_el,
kep_batang_a, kep_batang_b, kep_batang_c, kep_miring, kep_bahu, terkompensasi, kandidat_aktif, ambang_versi,
waktu_gerak_10, waktu_gerak_5, v_puncak, n_puncak,
fps, delegate, jalur_suara, koreksi_kode, latensi_ms,
vis_panggul_min, vis_panggul_med, panggul_x_min, panggul_x_maks, panggul_y_min, panggul_y_maks
```
`kep_batang_x` = `fraksiBatangKandidat.x` ≥ durasi_persen/100, jadi ketiga kandidat dinilai pada repetisi yang sama. `kep_miring` dan `kep_bahu` memakai `fraksi.miring` dan `fraksi.el`.

## 11. Antrean offline dan penyimpanan lokal (F11)

```ts
export type Op = { jenis: 'sesi'; baris: BarisSesi } | { jenis: 'nyeri'; sesi_id: string; nilai: 0 | 1 | 2 };
export function tambah(op: Op): boolean;     // false bila QuotaExceededError → UI "Memori penuh, sesi tidak tersimpan"
export function kirim(): Promise<void>;      // guard sedangKirim, urut FIFO
export function jumlahSesi(): number;        // "N sesi menunggu dikirim"
```
- `sesi` → `supabase.from('sesi').upsert(baris, { onConflict: 'id', ignoreDuplicates: true })`, tanpa `.select()`.
- `nyeri` → `rpc('lapor_nyeri', { p_sesi_id, p_nilai })`. Hasil `false` dianggap selesai (idempoten).
- Sukses → hapus dari antrean. Galat jaringan / 5xx → berhenti, coba lagi nanti. Galat 4xx lain → pindah ke `rc_gagal` (tidak dibuang, supaya data tidak hilang) lalu lanjut **[default spec]**.
- Pemicu kirim: aplikasi dibuka (`layout`), event `online`, `visibilitychange` (visible), selesai sesi, ketuk nyeri.

Kunci localStorage (semua akses dibungkus try/catch):

| Kunci | Isi |
|---|---|
| `rc_resep` | `{ pasien_id, nama_panggilan, sisi_terdampak, ...kolom resep }` |
| `rc_antrean` / `rc_gagal` | `Op[]` |
| `rc_riwayat:{pasien_id}` | `{ mulai, pct_benar \| null, rep_total, rep_benar }[]`, maks 30. Dipakai untuk kartu F04 dan grafik F10 **[default spec]** |
| `rc_uji` | Baris `/uji` |
| `rc_tamu` | Isian form resep tamu terakhir (F15) **[default spec]** |
| `sb-*` | Sesi auth bawaan supabase-js, termasuk code verifier PKCE selama redirect Google |

## 12. Rencana uji P0 (ringkas dari PRD §11)

### 12.1 Daftar uji

| Uji | Cara | Lulus bila | Jam | Pemilik |
|---|---|---|---|---|
| Login Google + `daftar` [V9] | Sign Up as Fisioterapis (akun A), Sign Up as Pasien (akun P); login ulang A; akun A memanggil `daftar('pasien')`; login akun baru tanpa sign up | Profil A = fisioterapis, P = pasien; login ulang langsung ke beranda peran; `peran_lain`; akun tanpa profil diminta memilih peran | 19.00 | Pindra |
| RLS + GRANT | Akun Google tim: fisioterapis A dan B, pasien P. B membaca pasien/sesi/eskalasi/`v_prioritas` milik A; B memanggil `buat_kode(pasien A)`; P (terikat ke pasien A) membaca pasien B; P menyisipkan `pasien`; P memanggil `isi_contoh`; klien mengubah `profil.peran` | 0 baris atau galat; klien membaca tabelnya sendiri tanpa `42501` | 19.00, ulang 03.00 | Pindra |
| Data contoh [V9] | A: Isi data contoh → Tinjau Pak Wayan → Atur ulang. Klik ganda Isi. B tidak terpengaruh | 5 pasien, eskalasi Wayan terbuka lagi setelah atur ulang; klik ganda tetap 5 pasien; data B utuh | 22.30 (SQL), 03.00 (UI) | Pindra |
| Fungsi murni | `npm test` | 7 kasus §6.12 + 3 kasus §9 hijau | 23.30, 02.30 | Manta, Pindra |
| Eskalasi SQL | §12.2 | Sesuai tabel harapan | 22.30, ulang 03.00 | Pindra |
| E2E | Skrip demo A14 di production | Butir G2 | 04.00–05.00, 10.00 | Semua |
| F20 | Tab Network: `masukan` tanpa nama/ID; tes `cekAngka`; cari string kunci Gemini di `.next/static` | Tidak ada nama/ID; manipulasi angka → templat; kunci tidak ada di bundel | 03.00 | Pindra |
| Mode koreksi | Resep Mati → sesi | Tanpa K-* dan I-BAGUS; layar ringkasan tampil; `sesi.resep.mode_koreksi = 'mati'`; titik kotak "M" di F13 | 03.30 | Ari |
| Maks 1 koreksi | Penuh; condong lalu miring dalam satu repetisi | ≤ 1 koreksi terdengar; log `/uji` ≤ 1 `koreksi_kode` per baris | 03.30 | Ari, Manta |
| Offline | Mode pesawat di akhir sesi → online | 1 baris sesi, nyeri ikut, tanpa duplikat | 03.00 | Ari |
| Persetujuan + klaim | `/k` tanpa login → Sign Up as Pasien → kembali ke `/k` → klaim → kolom persetujuan terisi. Akun fisioterapis buka `/k` → `akun_terapis`. Hapus data → sesi + eskalasi hilang, `user_id` null, keluar. `buat_kode` baru → klaim ulang dengan akun lain. Kode diketik di beranda pasien | Semua benar | 03.00 | Ari, Pindra |
| Tamu [V9] | Tanpa login: tautan "Coba latihan tanpa akun" → form (ubah repetisi + mode Mati) → sesi | Sesi memakai isian form; nol permintaan ke Supabase di tab Network | 03.30 | Ari |
| Perangkat | fps + delegate di laptop dan Oppo (+ HP menengah); daftar suara id-ID lokal; suara setelah layar terkunci / ganti tab | Median fps ≥ 15 di laptop; ponsel dilaporkan apa adanya | 01.30–03.00 | Manta |
| Latensi | Log `/uji` per jalur suara | p95 ≤ 500 ms | 05.00–07.30 | Manta |
| Privasi | Rekam tab Network satu sesi penuh | Hanya JSON ke Supabase; nol media, nol TTS jaringan | 07.00 | Ari |
| Login akun luar tim [V9] | Akun Google yang bukan pemilik proyek GCP login di production; beberapa perangkat di satu Wi-Fi; tautan `/k` dibuka dari aplikasi kamera | Login sukses (consent screen In production); tanpa 429; tanpa `disallowed_useragent` | 04.30, 10.00 | Pindra |
| Kompensasi | §12.3 | Angka apa adanya, n per sel | 05.00–07.30 | Manta |

### 12.2 Uji eskalasi SQL (SQL editor, peran postgres, pada pasien uji milik profil uji)

Profil uji = akun Google tim yang sudah "Sign Up as Fisioterapis" (`profil.peran = 'fisioterapis'`), karena `profil.id` wajib ada di `auth.users` [V9].

| Langkah | Harapan |
|---|---|
| `select public.isi_sintetis('<pasien>', 'memburuk');` | 1 eskalasi: `panjang_run` 8, `batas` 7, `median_baseline` 12.5, 8 `sesi_pemicu` (sesi 6–13). Sesi 14–15 tidak membuka eskalasi kedua |
| Pasien baru, pola `stabil_nyeri` | 0 eskalasi |
| Pasien baru, pola `uji_berderau` | Memicu di sesi 13 (run 8 > 7) |
| Pasien baru, pola `uji_median` | Memicu di sesi 16 (run 8 > batas 7, n = 14). Ini hanya terjadi bila titik = median 15 dilewati; bila titik itu memutus run, run hanya 6 |
| `update public.eskalasi set ditinjau = now(), keputusan = 'lanjutkan' where pasien_id = '<pasien memburuk>';` lalu sisip 1 sesi 40% | Tidak membuka ulang (titik sejak tinjau < 7) |
| Sesi dengan `rep_terukur` 3 | Bukan titik data; tidak ada perubahan |

### 12.3 Uji kompensasi disengaja (PRD §11.1, 05.00–07.30)
- Subjek: 3 anggota tim sehat, S1 Pindra, S2 Ari, S3 Manta **[default spec]**. Posisi sesuai PRD §7, tampak depan.
- Per subjek: tangga condong (tahan statis 0/10/20/30°, 3 dtk per sudut, "Rekam statis", rujukan inklinometer di sternum), lalu 2 gerakan × 4 kondisi (normal, condong dengan sudut target, miring, elevasi) × 10 repetisi, lalu satu set gating (kursi digeser sampai panggul keluar bingkai, lalu kembali). Total 240 repetisi.
- Galat hitung = `rep_instruksi` − jumlah repetisi mesin per set. n dilaporkan per sel.
- Penyetelan: ambang dasar disetel dari **S1 saja** (spesifisitas maksimal dengan sensitivitas wajar), dibaca dari puncak per repetisi di CSV dengan spreadsheet (histogram baru ada di P1). Sens/spes hanya dari **S2 + S3**, per penanda per gerakan.
- Positif BATANG = condong + miring; negatifnya normal + elevasi. Positif BAHU = elevasi; negatifnya normal + condong + miring. Silang-pengaruh dilaporkan.
- **Keputusan 07.30** (dari S2 + S3): pilih kandidat dengan sensitivitas tertinggi pada 10° dan 20° yang spesifisitasnya pada set normal dan set miring tidak lebih rendah dari (a). Bila setara, pilih (c). Bila tidak ada kandidat yang aktif andal pada 20° → `SUARA_CONDONG = false`, penanda tetap dicatat di `/uji`, dan R3 dicatat terwujud. Kandidat terpilih tetap berlabel eksperimental.
- Keputusan penanda bahu (07.30): bila spesifisitas S2/S3 rendah, ubah bawaan toleransi bahu jadi Longgar, atau catat penanda tanpa koreksi suara (PRD §7.5).
- Keputusan panggul (PRD §18 no. 7): bila set gating menunjukkan panggul sering gagal, BATANG dimatikan untuk sesi itu sementara BAHU tetap jalan.
- Hasil masuk README, deck, dan bahan Q&A. Angka dilaporkan apa adanya, tanpa target lulus.

## 13. Definisi selesai P0 (dari PRD §16)

- [ ] URL production Vercel bisa dibuka juri; login Google berhasil untuk akun di luar tim.
- [ ] Mode tamu: form resep + kalibrasi + repetisi + koreksi suara jalan di Chrome laptop tanpa akun.
- [ ] Data contoh: "Isi data contoh" menghasilkan 5 pasien sintetis terurut dengan lencana benar; Pak Wayan berstatus eskalasi terbuka; "Atur ulang data contoh" memulihkannya.
- [ ] Alur asli: pasien baru → QR → login Google pasien + klaim di HP → sesi → sesi muncul di dasbor.
- [ ] Tinjau eskalasi menyimpan keputusan dan menutup penanda.
- [ ] Antrean offline lolos uji mode pesawat.
- [ ] Median fps ≥ 15 di laptop; angka ponsel dilaporkan apa adanya.
- [ ] p95 latensi suara ≤ 500 ms dari log, per jalur suara yang terpakai.
- [ ] Tabel sens/spes per penanda per gerakan (S2 + S3) ada di README.
- [ ] Rekaman tab Network membuktikan tidak ada bingkai yang keluar.
- [ ] Uji RLS antar-akun lolos, tanpa galat `42501`; akun pasien tidak bisa menulis sebagai fisioterapis.
- [ ] Persetujuan tercatat saat klaim; "Hapus data saya" menghapus sesi dan eskalasi.
- [ ] Pasien bisa dipindah ke akun Google lain dengan kode baru.
- [ ] Mode Mati tidak memutar koreksi maupun I-BAGUS, layar ringkasan tetap tampil; maksimal 1 koreksi terdengar per repetisi pada mode Penuh.
- [ ] Ringkasan AI (F20) tampil untuk pasien sintetis; payload ke Gemini tanpa nama dan ID; angka yang tidak ada di masukan memicu templat.
- [ ] Repo publik, README lengkap (termasuk kalimat lokasi data NFR-5) + AI Use and Third-Party Declaration, tag `submission-24h`, video ≤ 3 menit, pitch deck, submission Devpost.

## 14. Catatan PRD

Kontradiksi dan celah yang ditemukan, beserta tafsiran yang dipakai. Semua dipilih supaya sejalan dengan log §19.

1. **`r` dipakai untuk dua hal.** Di §7.5, `r` adalah rasio kandidat condong (c). Di §7.6, `r` adalah perpindahan pergelangan. Spec menamai perpindahan **`dp`**; `r` tetap kandidat (c).
2. **Label J dan "MVP sebelum J16"** (§4.1, §6.2, §11, §15) disusun untuk 24 jam yang dimulai J0. V8 menetapkan 22 jam dengan gerbang G1/G2. Peta di §0 dipakai.
3. **F08 dan §7.8 menyebut ringkasan suara R-* dan kanal visual di mode Penuh.** V8 memindahkan keduanya ke P1. Di P0, Penuh = koreksi suara + I-BAGUS + hitungan. Butir PRD §16 "Mati tidak memutar ... ringkasan, maupun kanal visual" otomatis benar di P0.
4. **`lapor_nyeri` dan `buat_kode` tertulis "RPC" tanpa security definer** (§6.3). Padahal `sesi` tidak punya kebijakan ubah, dan kolom kode/`user_id` tidak boleh diubah klien langsung. Keduanya dibuat security definer.
5. **`lapor_nyeri` dan kebijakan sisip sesi memakai syarat yang sama**, yaitu `pasien.user_id = auth.uid()`. Di v1.0 keduanya punya cabang terapis demo; V9 menghapus cabang itu bersama "Latih sebagai pasien ini".
6. **`klaim_pasien(kode)` hanya menerima kode**, padahal persetujuan (versi, waktu, oleh) dicatat saat klaim (F19). Signature diperluas jadi `klaim_pasien(p_kode, p_versi, p_oleh)`, satu panggilan atomik.
7. **§11.2 meminta "payload route F20 di tab Network berisi agregat tanpa nama dan ID".** Permintaan browser → route harus membawa `pasien_id` (untuk membaca lewat RLS), sedangkan permintaan route → Gemini terjadi di server dan tidak terlihat di tab Network. Respons route menyertakan `masukan` (JSON persis yang dikirim ke Gemini) untuk dibuktikan di tab Network.
8. **F17 menyebut CSV "per repetisi"**, padahal tangga condong §11.1 adalah tahan statis 3 dtk tanpa repetisi. `/uji` mendapat tombol "Rekam statis" dengan baris `tipe=statis`.
9. **Lampiran B "41 klip" sudah termasuk R-*** (P1). Semua tetap direkam karena murah dan Lampiran B mewajibkan lengkap; kode P0 tidak memutar R-*.
10. **§6.3 `cabut_persetujuan` tidak menyebut `eskalasi`.** V8 menambahkannya; spec mengikuti V8.
11. **F06 "kalibrasi gagal bila SD bahu > 0,02 lebar bahu" dan §7.4 "median sampel yang lolos syarat diam"** bisa dibaca sebagai syarat per jendela atau filter per sampel. Spec memakai syarat per sampel (SD 1 dtk), dan kalibrasi gagal bila < 50% sampel diam.
12. **V8 menetapkan tamu memakai kandidat (a)**, sedangkan §11.1 bisa mematikan K-CONDONG "di MVP". Tamu tetap memakai (a), tetapi `SUARA_CONDONG = false` berlaku juga untuk tamu, karena MVP mencakup tamu.
13. **§7.6 meminta hitungan suara "saat repetisi selesai"**, padahal penilaian butuh buffer sampai selesai + 0,5 dtk. Hitungan dan penilaian dikeluarkan bersama ± 0,5 dtk setelah lengan kembali (satu event).
14. **`v_prioritas` "diurutkan sesuai G11"**, padahal view tidak menjamin urutan. Urutan dibuat di klien lewat kolom bool `eskalasi_terbuka`, `lencana_nyeri`, `jarang`, lalu `pct_terakhir`. Kunci "nyeri di sesi terakhir" memakai nilai 2, sama dengan lencana.
15. **Kepatuhan pasien baru tanpa sesi = 0**, sehingga pasien yang baru dibuat juri langsung berlencana "Jarang latihan". `jarang` hanya berlaku bila pasien sudah punya ≥ 1 sesi.
16. **Median `percentile_cont` mengembalikan double precision**, sehingga titik yang sama persis dengan median bisa gagal dikenali. Median baseline dihitung numeric persis dari urutan ke-3 dan ke-4 dari 6 titik.
17. **§10 tidak memberi angka untuk Bu Ketut ("turun bertahap ke 15"), Pak Nyoman, dan Pak Komang.** Spec mengisi angka konkret (§8.7). Pola Pak Wayan dicek: memicu tepat di sesi 13 (run 8 > 7, n = 13).
18. **F14 "% tak terukur" dan kolom `pct_tak_terukur`** tidak menyebut basisnya. Spec memakai basis per repetisi.
19. **NFR-4 menyebut "service role key hanya di server"**, sedangkan F20 tidak memakai service role. Service role key tidak dipakai sama sekali dan tidak disimpan di Vercel.
20. **F13 menyebut "grafik tren ... kepatuhan, riwayat nyeri, % tak terukur"** tanpa bentuk tampilan. Grafik dipakai untuk % terkompensasi dan waktu gerak; sisanya tabel.
21. **V9: `signInWithOAuth` tidak bisa membawa metadata peran**, jadi trigger daftar lama tidak bisa dipakai. Peran dibawa lewat query `redirectTo` dan dicatat RPC `daftar` (§8.4). PRD v1.8 §6.3 sudah mengikuti.
22. **NFR-6 "nol pengetikan" vs kolom kode 8 karakter di beranda pasien** (F04 v1.8). Jalur utama tetap QR tanpa mengetik; kolom kode hanya cadangan bila QR gagal.
23. **F19 "akun dilepas", tetapi akun Google pasien tetap ada di Supabase Auth.** Menghapus `auth.users` butuh service role atau fungsi definer di skema `auth`, dan PRD menaruhnya di §4.3. Naskah F19 menyebutnya terus terang (§10.5).
24. **V9 "satu akun = satu peran" membuat alur pasien juri butuh akun Google kedua** (R22). Mitigasinya: README menyebutnya di baris pertama "cara coba", A14 menyiapkan HP tim dengan akun pasien, `prompt: 'select_account'`, dan tamu tetap tanpa akun.
25. **F15 v1.7 "juri memilih sisi lengan" dan V9 "form resep"** digabung: sisi lengan masuk form resep tamu sebagai dua tombol besar (§10.9).

## 15. Indeks default spec

Detail kecil yang diisi spec; ubah bebas bila tim punya alasan.
- Mesin: filter pada koordinat (§6.3); frame tanpa pose menahan posisi (§6.3); tergating = gagal (a) atau gating aktif (§6.5); kalibrasi per sampel (§6.6); debounce per sub-sinyal dengan urutan condong → miring → bahu (§6.8); I-BAGUS tiap 3 beruntun (§6.8); hitungan ± 0,5 dtk setelah selesai (§6.9); target repetisi termasuk tak terukur (§6.11); `pct_tak_terukur` per repetisi (§6.11); salinan resep membawa `kandidat_condong`, `suara_condong`, `ambang_versi` (§6.11).
- Suara: koreksi masuk depan antrean tanpa memotong (§7); instruksi I-* berbunyi di semua mode (§1); I-GATING jeda ≥ 5 dtk; I-BINGKAI tiap 10 dtk (§10.7).
- DB: GRANT kolom terbatas (§8.3); satu eskalasi terbuka dijaga unique index (§8.1); kode klaim 8 heks huruf besar (§8.5); `lapor_nyeri` boolean idempoten (§8.5); `isi_contoh` idempoten dengan kunci baris profil (§8.8); `eskalasi.dibuka = sesi.selesai` (§8.6); angka sintetis konkret, 20 repetisi terukur, tak terukur 0, nyeri 0 kecuali Bu Made (§8.7); `daftar` mengambil nama dari metadata Google (§8.4).
- Auth [V9]: provider Email OFF; Redirect URLs hanya production + localhost; batas sign-in ≥ 100 per 5 menit; domain `<ref>.supabase.co` di layar Google diterima (§4.1); tanpa `@supabase/ssr`, PKCE di klien (§4.4); `prompt: 'select_account'`; `lanjut` hanya path internal; `router.replace` di `/auth/selesai`; galat lewat `?galat=` (§10.1, §10.1b); pesan galat `akun_terapis` / `sudah_terikat` / `peran_lain` / `belum_daftar` (§8.4, §8.5).
- F20: hari relatif tanpa tanggal; hanya waktu gerak sebagai metrik kinematik; cek 3–5 kalimat; respons membawa `masukan`; label templat (§9).
- UI: `/` redirect sesuai peran (§10.1); kartu "Belum ada pasien" dengan dua tombol, dialog konfirmasi atur ulang (§10.2); `sudah_terikat` dicek sebelum layar persetujuan (§10.5); tombol "Dengarkan" untuk I-SETUJU (§10.5); masa simpan 90 hari sebagai placeholder (§10.5); beranda "belum ada resep" dengan kolom kode + tautan tamu, "Keluar" nonaktif selama antrean berisi (§10.6); hapus data juga mengosongkan data lokal lalu `signOut` (§10.6); petunjuk izin kamera setelah 10 dtk (§10.7); tamu tanpa nyeri dan tanpa riwayat, kembali ke form (§10.7); `FormResep mode="tamu"` + `rc_tamu` (§10.9); riwayat F04/F10 dari localStorage (§11); antrean 4xx disimpan ke `rc_gagal` (§11); `/uji` autosave (§10.10).
- Aset dan jadwal: video peragaan dengan lengan kanan (A6); CSV uji di-commit (A10); urutan subjek S1 Pindra, S2 Ari, S3 Manta (§12.3); istirahat bergilir; rencana G1 merah (§2); alur video (A16).
