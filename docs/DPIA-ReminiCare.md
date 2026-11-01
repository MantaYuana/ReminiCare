# Data Protection Impact Assessment (DPIA) ReminiCare

**Versi:** 1.0  
**Tanggal:** 1 November 2026  
**Status:** Prototipe data sintetis untuk lomba Hacking Day INCEPTION 2026

## 1. Ringkasan Pemrosesan

ReminiCare adalah PWA untuk latihan lengan pasca-stroke dengan deteksi kompensasi berbasis MediaPipe Pose. Kamera ponsel atau laptop menjalankan pemrosesan pose di browser, hanya mengirim metrik agregat (bukan video) ke server untuk tinjauan fisioterapis.

## 2. Jenis Data yang Diproses

### Data Pribadi Spesifik (Data Kesehatan)
- **Metrik latihan:** persentase repetisi terkompensasi, kepatuhan sesi, metrik kinematik (waktu gerak, kecepatan puncak)
- **Nyeri yang dilaporkan:** skala sederhana (tidak nyeri / agak nyeri / nyeri)
- **Baseline kalibrasi:** parameter geometris tubuh (jarak bahu, tinggi batang, sudut, kedalaman bahu) sebagai angka ternormalisasi

### Data Pribadi Umum
- **Email dan nama akun Google:** disimpan oleh Supabase Auth untuk autentikasi. Fisioterapis tidak melihat data ini.
- **Nama panggilan pasien:** dimasukkan oleh fisioterapis untuk identifikasi di dasbor
- **Resep latihan:** gerakan, repetisi, toleransi, mode koreksi (ditentukan fisioterapis)
- **Persetujuan:** versi naskah, waktu, identitas penyetuju (pasien atau wali)

### Data yang TIDAK Disimpan
- **Bingkai video kamera:** diproses di perangkat dan tidak dikirim ke server
- **Landmark pose mentah:** hanya agregat hasil perhitungan yang disimpan
- **Identitas resmi:** NIK, nomor rekam medis, alamat

## 3. Tujuan Pemrosesan

- Memfasilitasi latihan fisioterapi jarak jauh dengan koreksi postur real-time
- Menyediakan data objektif kepada fisioterapis untuk memantau kemajuan pasien
- Mendeteksi indikasi perburukan kompensasi yang memerlukan eskalasi ke fisioterapis
- Memungkinkan fisioterapis menyesuaikan program latihan berdasarkan data

## 4. Dasar Hukum

**Persetujuan** (UU 27/2022 Pasal 20 ayat 1): Pasien atau wali menyetujui secara eksplisit pada layar persetujuan saat klaim akun. Persetujuan mencakup tujuan, jenis data, penerima, dan hak subjek data.

## 5. Penerima Data

| Penerima | Jenis Data | Tujuan | Lokasi |
|----------|-----------|--------|--------|
| **Supabase** (penyedia database) | Semua data sesi dan profil | Penyimpanan dan autentikasi | Singapura (ap-southeast-1) |
| **Vercel** (hosting) | Log akses, header HTTP | Hosting aplikasi | Global (CDN) |
| **Google** (OAuth provider) | Email, nama akun | Autentikasi login | Global |
| **Gemini API** (Google) | Agregat angka 14 hari (tanpa nama, ID, atau tanggal) | Ringkasan AI untuk fisioterapis | Global |
| **Fisioterapis yang merawat** | Data latihan pasiennya | Pemantauan klinis | Perangkat fisioterapis |

## 6. Transfer Data Lintas Negara

Data disimpan di server Supabase region Singapura. Transfer ke luar negeri (Indonesia → Singapura) mengikuti PP 33/2026 Pasal 160–162:

- **Penilaian:** Supabase memiliki sertifikasi SOC 2 Type II dan ISO 27001. Data kesehatan dienkripsi in-transit (HTTPS) dan at-rest.
- **Catatan siklus transfer:** Data dikirim dari browser pasien/fisioterapis di Indonesia → Supabase Singapura → dikembalikan ke browser saat ditampilkan.
- **Pembatasan:** Untuk deployment klinis, lokasi penyimpanan akan disesuaikan dengan regulasi sektor kesehatan. Penyimpanan rekam medis elektronik fasyankes wajib di fasilitas dalam negeri (Permenkes 24/2022 Pasal 22).

## 7. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Akses tidak sah ke data kesehatan | Tinggi | Row-Level Security (RLS) Postgres: setiap pengguna hanya bisa membaca/menulis data mereka sendiri atau pasien mereka |
| Kebocoran data saat transmisi | Sedang | HTTPS wajib, koneksi tidak aman ditolak browser |
| Identifikasi dari video | Tinggi | Video tidak dikirim atau disimpan; hanya angka agregat |
| Halusinasi LLM (Ringkasan AI) | Sedang | Masukan hanya angka terstruktur tanpa nama/ID, keluaran diverifikasi dengan cek angka, prompt melarang diagnosis, label "Ringkasan AI, cek grafik sebelum memutuskan" |
| Kehilangan akses akun Google | Sedang | Belum ada mekanisme pemulihan; akan ditambahkan di versi produksi |
| Penyalahgunaan data untuk iklan | Rendah (prototipe) | Gemini tier gratis membolehkan Google menggunakan data; untuk klinis akan diupgrade ke tier berbayar dengan DPA |

## 8. Masa Simpan dan Retensi

- **Data latihan aktif:** Selama pasien terikat ke akun dan belum menghapus data
- **Setelah "Hapus Data Saya":** Sesi dan eskalasi dihapus langsung; akun Google di Supabase Auth tetap ada (penghapusan akun masuk roadmap)
- **Data sintetis lomba:** Akan dihapus setelah penilaian lomba selesai

## 9. Hak Subjek Data (UU 27/2022)

| Hak | Implementasi |
|-----|--------------|
| Hak akses (Pasal 23) | Pasien melihat grafik dan ringkasan di beranda |
| Hak penghapusan (Pasal 26) | Tombol "Hapus Data Saya" di beranda pasien |
| Hak penarikan persetujuan (Pasal 21) | Penghapusan data sekaligus menarik persetujuan |
| Hak portabilitas | Belum diimplementasikan; akan ditambahkan (ekspor CSV) |

## 10. Penilaian Kebutuhan dan Proporsionalitas

- **Minimisasi data:** Video tidak disimpan, landmark hanya dihitung jadi angka
- **Akurasi:** Baseline dikalibrasi setiap sesi, ambang disetel dari data uji
- **Transparansi:** Layar persetujuan menjelaskan data yang disimpan dan tujuannya
- **Keamanan:** RLS, HTTPS, kunci API hanya di server
- **Akuntabilitas:** Keputusan tindak lanjut tetap di tangan fisioterapis, bukan otomatis

## 11. Status Prototipe

Versi Hacking Day ini adalah **prototipe dengan data sintetis**, bukan produk yang diedarkan. Data pasien sintetis dibuat oleh kode untuk keperluan demo lomba. Deployment klinis memerlukan:

1. Registrasi sebagai perangkat lunak alat kesehatan (KMK HK.01.07/MENKES/951/2026)
2. Penyelenggaraan lewat fasilitas yankes dengan STR/SIP fisioterapis
3. DPIA lengkap dengan konsultasi pemangku kepentingan
4. Persetujuan tertulis dari pasien
5. Server atau cloud tersertifikasi di Indonesia untuk rekam medis
6. Gemini tier berbayar dengan Data Processing Agreement

## 12. Kontak

Untuk pertanyaan terkait perlindungan data, hubungi: **<email kontak tim>**

---

**Catatan NFR-5:** Data sintetis, server Singapura; lokasi penyimpanan untuk deployment klinis akan disesuaikan dengan regulasi sektor kesehatan.
