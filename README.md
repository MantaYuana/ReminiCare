# ReminiCare

PWA untuk latihan lengan pasca-stroke dengan deteksi kompensasi berbasis MediaPipe Pose dan koreksi suara real-time dalam Bahasa Indonesia.

**URL:** `<URL-PROD>`

---

## Apa ini

ReminiCare membantu pasien pasca-stroke berlatih gerakan lengan di rumah dengan panduan dari fisioterapis. Kamera ponsel atau laptop mendeteksi kompensasi batang tubuh dan bahu secara real-time, memberikan koreksi suara, lalu mengirim metrik ke dasbor fisioterapis. Video tidak dikirim atau disimpan, hanya angka agregat.

---

## Cara coba

**Penting:** Alur pasien butuh **akun Google kedua** di HP; satu akun Google hanya untuk satu peran.

### Tanpa akun (mode tamu)

1. Buka `<URL-PROD>/tamu`
2. Isi resep (sisi lengan, gerakan, repetisi)
3. Klik "Mulai latihan"
4. Ikuti panduan kamera → kalibrasi → latihan dengan koreksi suara
5. Data tidak disimpan

### Untuk juri: alur lengkap fisioterapis + pasien

**Di laptop (sebagai fisioterapis):**

1. Buka `<URL-PROD>` → "Sign Up as Fisioterapis" → masuk dengan akun Google Anda
2. Klik "Isi data contoh" → dasbor terisi 5 pasien sintetis
3. Buka "Pak Wayan" (berlencana Eskalasi):
   - Lihat run chart eskalasi
   - Lihat tren % repetisi terkompensasi
   - Klik "Ringkasan AI" (menggunakan Gemini Flash F20)
4. Klik "Pasien baru":
   - Nama panggilan: `Uji Demo`
   - Sisi terdampak: Kanan
   - Gerakan: Jangkau depan
   - Repetisi: 5
   - Mode koreksi: Penuh
   - Kalimat condong: Menempel sandaran
   - Simpan
5. Pindai QR dengan HP (atau salin tautan)

**Di HP (sebagai pasien):**

6. Buka tautan QR → "Sign Up as Pasien" → masuk dengan **akun Google kedua**
7. Baca layar persetujuan → "Setuju"
8. Beranda pasien muncul → "Mulai latihan"
9. Ikuti panduan kamera → "Siap"
10. Kalibrasi 5 detik → latihan dengan koreksi suara
11. Setelah selesai, lapor nyeri (opsional) → "Selesai"

**Kembali ke laptop:**

12. Klik "Muat ulang" → sesi dari HP muncul di detail pasien
13. Klik "Atur ulang data contoh" → "Ya, atur ulang" → Pak Wayan kembali berstatus Eskalasi

**Catatan:** Siapkan 1 HP tim yang sudah login sebagai pasien untuk demo tatap muka.

---

## Arsitektur

- **Frontend:** Next.js 16 App Router, Tailwind CSS, React
- **Pose detection:** MediaPipe Pose Landmarker Lite (GPU/CPU fallback) di browser
- **Mesin kinematik:** Aturan berbasis fitur geometris, filter Butterworth 2nd order, deteksi onset/offset
- **Backend:** Supabase (Postgres + Auth Google OAuth2, region Singapura ap-southeast-1)
- **Hosting:** Vercel
- **Ringkasan AI:** Gemini Flash (hanya angka agregat, tanpa nama/ID)
- **Suara:** Web Speech API (TTS platform), klip MP3 pre-recorded

---

## Privasi dan bukti nol bingkai video

**Video kamera tidak dikirim atau disimpan.** Hanya metrik agregat (% terkompensasi, waktu gerak, kecepatan puncak) yang dikirim ke server.

### Bukti tab Network

<screenshot atau deskripsi hasil rekaman tab Network dari satu sesi lengkap>

- Payload ke Supabase: objek JSON berisi angka dan metadata, ukuran <5 KB per sesi
- Nol permintaan berisi data video atau landmark mentah
- Model MediaPipe dan audio diunduh sekali dari `/mediapipe/` dan `/audio/`, lalu di-cache

### Data yang disimpan

- **Email dan nama akun Google:** di Supabase Auth (fisioterapis tidak melihat)
- **Resep latihan:** gerakan, repetisi, toleransi
- **Hasil sesi:** % terkompensasi per repetisi, metrik kinematik, nyeri
- **Baseline kalibrasi:** parameter geometris sebagai angka ternormalisasi

Lihat [Kebijakan Privasi](<URL-PROD>/privasi) dan [DPIA](docs/DPIA-ReminiCare.md) untuk detail lengkap.

---

## Hasil uji deteksi kompensasi

<tabel sens/spes dari A11 akan diisi di Task 7 jam 07.45>

| Penanda              | Gerakan       | n   | Sensitivitas | Spesifisitas |
| -------------------- | ------------- | --- | ------------ | ------------ |
| Condong (kandidat a) | Jangkau depan | <n> | <sens>       | <spes>       |
| ...                  | ...           | ... | ...          | ...          |

**Catatan:** Hasil dari 2-3 subjek sehat (S2, S3) dengan sudut condong 0/10/20/30°, bukan pasien stroke.

---

## Batas klaim dan regulasi

### Bukan alat diagnosis

ReminiCare **tidak** mendiagnosis, menetapkan batas aman gerak, atau menggantikan fisioterapis. Keputusan tindak lanjut tetap di tangan fisioterapis.

### Jalur perangkat lunak alat kesehatan

Versi Hacking Day ini adalah **prototipe dengan data sintetis** untuk keperluan lomba. Perangkat lunak yang memantau terapi dengan keputusan di tangan klinisi dapat tergolong perangkat lunak alat kesehatan (KMK HK.01.07/MENKES/951/2026). Deployment klinis memerlukan:

- Registrasi perangkat lunak alat kesehatan
- Penyelenggaraan lewat fasilitas yankes dengan STR/SIP fisioterapis
- Server atau cloud tersertifikasi di Indonesia untuk rekam medis (Permenkes 24/2022)
- DPIA lengkap dengan persetujuan tertulis dari pasien

**Kalimat NFR-5:** Data sintetis, server Singapura; lokasi penyimpanan untuk deployment klinis akan disesuaikan dengan regulasi sektor kesehatan.

### Batas bukti

- **Klaim aman:** Umpan balik real-time dari kamera dengan MediaPipe menurunkan kompensasi batang dalam satu sesi terawasi (Kim 2026, RCT n=55). Miring lateral dari satu kamera didukung Pavlikov 2026.
- **Bukan klaim:** Koreksi suara terbukti efektif, efek bertahan setelah umpan balik dihentikan, atau aplikasi terbukti mudah dipakai lansia Indonesia (wawancara pasien/keluarga tidak dilakukan untuk prototipe ini).

---

## Keterbatasan

- Validasi hanya pada subjek sehat, bukan pasien pasca-stroke
- Wawancara fisioterapis dan keluarga pasien tidak dilakukan
- Kamera tampak depan saja (oblik 45° tidak diuji untuk prototipe)
- Hanya 2 gerakan jangkauan (PRD mencantumkan 6 gerakan)
- Deteksi kompensasi berbasis aturan, bukan ML (tidak ada dataset pasien Indonesia)

---

## Aset yang dibuat sebelum Hacking Day

Sesuai aturan lomba, aset berikut dibuat sebelum J0:

- **Dokumen:** PRD, spec, plan, wireframe, tabel ambang awal, kerangka README dan pitch deck
- **Audio:** 41 klip suara MP3 (instruksi, koreksi, hitungan)
- **Video:** 2 video peragaan gerakan (loop 5-10 dtk, <1 MB)
- **Riset:** Review literatur, verifikasi kutipan, analisis celah bukti

Tidak ada kode yang ditulis sebelum Hacking Day. Repositori `MantaYuana/ReminiCare` dibuat di J0 (31 Oktober 2026 13.00 WITA).

---

## Lisensi

MIT License. Lihat [LICENSE](LICENSE).

MediaPipe digunakan di bawah Apache License 2.0. Lihat [public/mediapipe/LICENSE](public/mediapipe/LICENSE).

---

## AI Use and Third-Party Declaration

Proyek ini menggunakan layanan dan alat berikut:

### Dependensi utama

- **MediaPipe Pose Landmarker** (Apache 2.0): deteksi pose 33 landmark di browser
- **Supabase:** database Postgres + Auth Google OAuth2
- **Vercel:** hosting dan deployment
- **Google OAuth:** autentikasi login

### AI dan asisten pengembangan

- **Gemini Flash** (Google AI): Ringkasan AI 3-5 kalimat untuk fisioterapis (F20), hanya menerima angka agregat tanpa nama/ID/tanggal
- **Asisten AI untuk pengembangan:** <daftar asisten AI yang dipakai tim untuk menulis kode, debugging, review>
- **Suara TTS:** Web Speech API (TTS platform) untuk koreksi suara real-time

### Lisensi dan atribusi

- MediaPipe: Apache 2.0
- Proyek ini: MIT
- Dependensi lain: lihat `package.json`

---

**Tag:** `submission-24h` | **Tanggal:** 1 November 2026 10.30 WITA
