# ReminiCare Frontend (bagian Ari) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun UI pasien ReminiCare (masuk, klaim + persetujuan, beranda, layar sesi dengan suara, mode tamu, antrean offline) sesuai SPEC P0, sampai mesin kinematik Manta terpasang dan G1/G2 hijau.

**Architecture:** Next.js App Router, semua halaman client component yang bicara ke Supabase lewat `lib/supabase.ts` (milik Pindra). Logika yang bisa diuji dipisah jadi fungsi murni di `lib/` (antrean, naskah, pemilihan suara, state layar sesi, penyaring suara per event) dan diuji `node --test`; layar diverifikasi manual. `Sesi.tsx` memakai mesin tiruan (timer) sampai Manta menyerahkan `buatMesin`, lalu dialihkan ke mesin asli tanpa mengubah penanganan event.

**Tech Stack:** Next.js (App Router, TS), Tailwind, `@supabase/supabase-js`, `@mediapipe/tasks-vision` (hanya dipakai `lib/pose.ts` Manta), Web Speech API + Web Audio, `node --test` (Node ≥ 22.18).

**Spec:** `SPEC-ReminiCare-ramping.md` (terutama §4.4, §5, §6.10, §7, §10.1, §10.5–10.9, §11, §12, §14). Backend: `PLAN-Backend-Pindra.md`. Sumber PRD v15 tidak ada di repo; spec dipakai atas persetujuan user.

## Lingkup dan pemilik file

Hanya file milik Ari (spec §5): `app/layout.tsx`, `app/globals.css`, `app/manifest.ts`, `app/page.tsx`, `app/pasien/**`, `app/tamu/**`, `app/k/**`, `components/Sesi.tsx`, `lib/suara.ts`, `lib/naskah.ts`, `lib/antrean.ts`, `public/icons/*`. Tambahan Ari (file baru, tidak bentrok): `lib/lokal.ts`, `lib/sesi-state.ts`, `lib/mesin-tiruan.ts`, `components/sesi/*.tsx`, `components/PemicuAntrean.tsx`.
Bukan lingkup: `/terapis/*`, `FormResep`, `Grafik` (Pindra); `lib/kinematik/*`, `lib/pose.ts`, `/uji`, audio, video (Manta); SQL.

## Global Constraints

- Semua teks UI Bahasa Indonesia; `<html lang="id">`; font dasar ≥ 18px; tombol utama ≥ 64 px tinggi (tombol masuk), tombol sekunder dan nyeri ≥ 44×44 px (NFR-6).
- Dependensi dipasang dengan versi persis (`npm i -E`). Tidak dipakai: pustaka grafik, SDK Gemini, pustaka PWA, state manager, framework tes.
- `tsconfig`: `"allowImportingTsExtensions": true`. Script `test`: `node --test "lib/**/*.test.ts"`. Kode di `lib/` yang diuji memakai impor relatif dengan ekstensi `.ts`, tanpa alias `@/`, tanpa `enum`/`namespace`/parameter property, dan tanpa akses DOM saat modul dimuat.
- Semua akses `localStorage` dibungkus try/catch. Kunci: `rc_resep`, `rc_antrean`, `rc_gagal`, `rc_riwayat:{pasien_id}` (maks 30).
- Video tidak pernah dikirim atau disimpan; hanya JSON ke Supabase (NFR-3).
- Suara: hanya suara id-ID `localService === true`; suara jaringan tidak pernah dipakai. iOS selalu jalur klip. `suara.buka()` WAJIB dipanggil dari handler ketukan.
- Service role key tidak dipakai di mana pun.
- Jangan membangun P1 (kanal visual, R-*, mode Ringkasan, service worker, kamera oblik) sebelum G2 hijau.
- Persetujuan: versi `'F19-v1'`; `p_oleh` ∈ `'pasien' | 'wali'`.

## Review Focus

Input atau kondisi yang tidak disebut spec tetapi akan dialami pengguna; tiap baris punya tes/langkah uji di task pemiliknya.
1. Kamera ditolak, tidak ada, atau sedang dipakai aplikasi lain → pesan sesuai jenis galat, tidak crash, ada jalan kembali (Task 8).
2. `localStorage` penuh atau diblokir (jendela privat) → `tambah` mengembalikan `false`, halaman tetap tampil (Task 2).
3. Pengguna meninggalkan layar sesi di tengah jalan (tombol Kembali, ganti rute) → track kamera dihentikan, suara dihentikan, tidak ada callback mesin yang hidup (Task 8).
4. Dua pemicu kirim bersamaan (event `online` + `visibilitychange`) → baris sesi tidak terkirim ganda (Task 2).
5. `/pasien/sesi` dibuka langsung lewat URL tanpa ketukan sebelumnya, atau Berhenti dengan 0 repetisi → muncul tombol "Mulai latihan" sebelum suara/kamera; 0 repetisi tidak menyimpan sesi (Task 4, 8).

---

### Task 1: Scaffold, konfigurasi, manifest, layout

**Files:**
- Create: `package.json`, `tsconfig.json`, `app/layout.tsx`, `app/globals.css`, `app/manifest.ts`, `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, rute kosong `app/page.tsx`, `app/pasien/page.tsx`, `app/pasien/sesi/page.tsx`, `app/tamu/page.tsx`, `app/k/[kode]/page.tsx` (masing-masing `export default function Page() { return <main>…</main> }`)

**Interfaces:**
- Produces: skrip `npm test` dan `npm run dev` yang jalan; rute kosong §5.

- [ ] **Step 1:** Cek `node -v` ≥ 22.18. Jalankan `npx create-next-app@latest` (TS, Tailwind, App Router, tanpa ESLint-opsional) di akar repo yang dibuat Pindra; bila repo sudah punya `package.json`, `git pull` dulu dan lewati langkah ini.
- [ ] **Step 2:** Pasang ulang semua dependensi dengan versi persis: `npm i -E next react react-dom @supabase/supabase-js @mediapipe/tasks-vision qrcode` dan `npm i -E -D tailwindcss @types/qrcode typescript`. Tidak ada tanda `^`/`~` di `package.json`.
- [ ] **Step 3:** Set `allowImportingTsExtensions: true` di `tsconfig.json`; tambah script `"test": "node --test \"lib/**/*.test.ts\""`.
- [ ] **Step 4:** `app/layout.tsx`: `lang="id"`, `body` font dasar 18px (Tailwind `text-lg` di `globals.css`). `app/manifest.ts` mengembalikan `MetadataRoute.Manifest` dengan `name: 'ReminiCare'`, `start_url: '/'`, `display: 'standalone'`, tiga ikon (192, 512, maskable 512). Buat tiga PNG glyph sederhana, kontras ≥ 3:1 (aset A7, 22.00; placeholder boleh dulu).
- [ ] **Step 5:** Verifikasi: `npm run dev`, buka `/`, `/pasien`, `/pasien/sesi`, `/tamu`, `/k/ABC`; semua 200. `npm test` berjalan dan melaporkan 0 tes tanpa galat. `/manifest.webmanifest` terbaca di DevTools → Application.
- [ ] **Step 6:** Commit `chore: scaffold next, rute kosong, manifest`.

### Task 2: Penyimpanan lokal + antrean offline (F11)

**Files:**
- Create: `lib/lokal.ts`, `lib/antrean.ts`
- Test: `lib/antrean.test.ts`

**Interfaces:**
- Produces (`lib/lokal.ts`): `bacaJson<T>(kunci: string, awal: T): T`, `tulisJson(kunci: string, nilai: unknown): boolean` (false bila `QuotaExceededError` atau akses ditolak), `hapus(kunci: string): void`, `bacaResep(): ResepLokal | null`, `simpanResep(r: ResepLokal): boolean`, `bacaRiwayat(pasienId: string): Riwayat[]`, `tambahRiwayat(pasienId: string, r: Riwayat): void` (pangkas ke 30 terbaru), tipe `Riwayat = { mulai: string; pct_benar: number | null; rep_total: number; rep_benar: number }`. `ResepLokal = { pasien_id: string; nama_panggilan: string; sisi_terdampak: Sisi } & Omit<ResepSalinan, 'kandidat_condong' | 'suara_condong' | 'ambang_versi'>`. Semua memakai `globalThis.localStorage` dalam try/catch.
- Produces (`lib/antrean.ts`): `type Op` (§11), `buatAntrean(dep: { simpan: PenyimpananKV; klien: KlienKirim }): { tambah(op: Op): boolean; kirim(): Promise<void>; jumlahSesi(): number }`, lalu singleton `export const { tambah, kirim, jumlahSesi } = buatAntrean(...)` memakai `supabase` dari `lib/supabase.ts` dan `localStorage`. `KlienKirim = { upsertSesi(b: BarisSesi): Promise<{ status: number | null }>; laporNyeri(id: string, n: 0|1|2): Promise<{ status: number | null; hasil: boolean | null }> }` (status `null` = galat jaringan). Pabrik menerima dependensi supaya tes tidak butuh DOM atau Supabase.
- Consumes: `BarisSesi`, `ResepSalinan`, `Sisi` dari `lib/kinematik/tipe.ts` dan `mesin.ts` (Manta). Bila belum ada pukul 18.30, commit §6.1/§6.2 spec apa adanya ke `lib/kinematik/tipe.ts` dan `BarisSesi`/`ResepSalinan` ke `lib/kinematik/mesin.ts` sebagai tipe saja; Manta menimpa tanpa diskusi.

- [ ] **Step 1: Tulis tes gagal** di `lib/antrean.test.ts` dengan `PenyimpananKV` palsu (Map) dan klien palsu. Nama tes dan asersi:
  - `kirim mengosongkan antrean bila sukses`: dua `sesi` ditambah, klien status 201 → `jumlahSesi() === 0`, `upsertSesi` dipanggil 2× berurutan (FIFO).
  - `galat jaringan menghentikan dan menyimpan`: status `null` pada op pertama → op kedua tidak dipanggil, `jumlahSesi() === 2`.
  - `5xx menghentikan`: status 503 → tetap 2 di antrean.
  - `4xx lain pindah ke rc_gagal dan lanjut`: status 400 pada op pertama → op itu ada di `rc_gagal`, op kedua tetap dikirim.
  - `nyeri hasil false dianggap selesai`: `laporNyeri` → `{ status: 200, hasil: false }` → antrean kosong.
  - `kirim bersamaan tidak menggandakan`: dua `kirim()` tanpa await antara → `upsertSesi` dipanggil tepat 1× per baris (guard `sedangKirim`).
  - `tambah mengembalikan false saat kuota penuh`: simpan palsu melempar `QuotaExceededError` → `tambah(...) === false`, tidak melempar.
  - `jumlahSesi hanya menghitung jenis sesi`: 1 sesi + 1 nyeri → 1.
- [ ] **Step 2:** `npm test` → FAIL (modul belum ada).
- [ ] **Step 3:** Implement `lib/lokal.ts` dan `lib/antrean.ts` sesuai Interfaces. Sesi: `upsert(baris, { onConflict: 'id', ignoreDuplicates: true })` tanpa `.select()`. Nyeri: `rpc('lapor_nyeri', { p_sesi_id, p_nilai })`. Jangan kirim `pct_terkompensasi`. Guard `sedangKirim` di dalam closure pabrik.
- [ ] **Step 4:** `npm test` → semua hijau.
- [ ] **Step 5:** Commit `feat: antrean offline dan penyimpanan lokal`.

### Task 3: Naskah suara (`lib/naskah.ts`)

**Files:**
- Create: `lib/naskah.ts`
- Test: `lib/naskah.test.ts`

**Interfaces:**
- Produces: `NASKAH: Record<string, string>` (kode → kalimat), `KODE_WAJIB: string[]` (daftar kode non-`I-SETUJU` dan non-`N-*` yang wajib ada), `teksSetuju(): string[]` (paragraf A4 untuk layar persetujuan, urutan = `I-SETUJU-1…n`). `import type { KodeKlip } from './suara.ts'` bila perlu.
- Consumes: kalimat persis dari PRD Lampiran A. **Dependensi terbuka:** Lampiran A tidak ada di repo. Minta Manta (yang merekam 41 klip) kirim daftar kode → kalimat; bila belum ada, isi sementara dengan kalimat pendek dan tandai `// TODO: ganti dengan Lampiran A`. Teks `NASKAH` harus sama dengan isi klip MP3, bila tidak jalur Web Speech dan jalur klip akan berbeda ucapan.

- [ ] **Step 1: Tes gagal** di `lib/naskah.test.ts`:
  - `N-1 sampai N-20 berupa kata`: `NASKAH['N-1'] === 'satu'`, `NASKAH['N-5'] === 'lima'`, `NASKAH['N-20'] === 'dua puluh'`, dan tiap `N-k` untuk k=1..20 ada.
  - `semua kode wajib punya teks tidak kosong`: untuk tiap kode di `KODE_WAJIB` (`K-CONDONG-S`, `K-CONDONG-T`, `K-MIRING`, `K-BAHU`, `I-MULAI`, `I-POSISI`, `I-KAMERA`, `I-BINGKAI`, `I-GATING`, `I-KALIB`, `I-KALIB-OK`, `I-KALIB-ULANG`, `I-G1`, `I-G2`, `I-ISTIRAHAT`, `I-BAGUS`, `R-BAIK`, `R-CUKUP`, `R-KURANG`, `I-SELESAI`, `I-NYERI`), `NASKAH[kode].trim().length > 0`.
  - `jumlah paragraf persetujuan sama dengan klip`: `teksSetuju().length` ≥ 1 dan `NASKAH['I-SETUJU-' + i]` ada untuk i = 1..panjang.
- [ ] **Step 2:** `npm test -- --test-name-pattern naskah` → FAIL.
- [ ] **Step 3:** Isi `lib/naskah.ts`. `N-k` dibangkitkan dari daftar kata satu..dua puluh. Paragraf persetujuan dari naskah final Pindra (A4, versi `F19-v1`); draf kerangka ada di spec §10.5.
- [ ] **Step 4:** Tes hijau.
- [ ] **Step 5:** Commit `feat: naskah suara`.

### Task 4: Suara (`lib/suara.ts`)

**Files:**
- Create: `lib/suara.ts`
- Test: `lib/suara.test.ts`

**Interfaces:**
- Produces (murni, diuji): `pilihSuara(daftar: { lang: string; localService: boolean }[]): number` (indeks suara pertama dengan `lang` diawali `id` dan `localService === true`, atau `-1`); `adalahIOS(n: { userAgent: string; platform: string; maxTouchPoints: number }): boolean`; `buatAntreanSuara<T>(): { masuk(item: T, prioritas?: boolean): void; ambil(): T | undefined; panjang(): number }`.
- Produces (DOM, manual): tipe `KodeKlip` dan `Suara` persis spec §7, `export const suara: Suara` singleton. `buka()` mengikuti urutan spec §7 butir 1–6. Utterance disimpan di variabel modul sampai `onend`. `ucap` mengembalikan `{ tMulai }` dari `onstart` (Web Speech) atau saat `start()` pada `AudioBufferSourceNode` (klip).
- Consumes: `NASKAH` (Task 3). Klip di `/audio/<KODE>.mp3`.

- [ ] **Step 1: Tes gagal** di `lib/suara.test.ts`:
  - `pilihSuara` mengabaikan suara jaringan: `[{lang:'id-ID',localService:false}]` → `-1`.
  - `pilihSuara` memilih id lokal pertama: `[{lang:'en-US',localService:true},{lang:'id-ID',localService:true}]` → `1`.
  - `adalahIOS` benar untuk iPhone UA, dan untuk `platform:'MacIntel'` dengan `maxTouchPoints: 5`; salah untuk `MacIntel` dengan `maxTouchPoints: 0` dan untuk Android UA.
  - `antrean suara FIFO`: masuk a, b → ambil a lalu b.
  - `prioritas masuk ke depan tanpa memotong`: masuk a, b, lalu c dengan `prioritas` → urutan ambil c, a, b.
- [ ] **Step 2:** Jalankan → FAIL.
- [ ] **Step 3:** Implement tiga fungsi murni, lalu `suara` singleton. Modul tidak boleh menyentuh `window`/`speechSynthesis`/`AudioContext` saat dimuat (supaya `node --test` bisa mengimpornya). Jalur klip: `Promise.all` unduh + `decodeAudioData` semua `KODE_WAJIB`, `N-1…N-20`, dan `I-SETUJU-n`. Bila `speechSynthesis` tidak ada, langsung jalur klip.
- [ ] **Step 4:** `npm test` hijau.
- [ ] **Step 5 (manual, Chrome laptop):** halaman sementara/DevTools: `await suara.buka()` dari ketukan; `suara.jalur` bernilai `'webspeech'` atau `'klip'`; `suara.ucap('N-3')` terdengar; `suara.ucap('K-BAHU', { prioritas: true })` saat dua `ucap` antre terdengar lebih dulu dari yang antre. Ulangi dengan DevTools → Application → paksa jalur klip (hapus pilihan suara) setelah klip masuk ke `public/audio` (21.00).
- [ ] **Step 6:** Commit `feat: suara webspeech dan klip`.

### Task 5: State layar sesi + penyaring suara per event

**Files:**
- Create: `lib/sesi-state.ts`
- Test: `lib/sesi-state.test.ts`

**Interfaces:**
- Produces:
  - `type NamaLayar = 'mulai' | 'kamera' | 'panduan' | 'kalibrasi' | 'gerakan' | 'istirahat' | 'ringkasan'`
  - `type Layar = { nama: NamaLayar; gerakanKe: number; hitungan: number; totalRep: number; gagalKalibrasi: number; bantuan: boolean }`
  - `type Aksi = { t: 'suaraSiap' } | { t: 'kameraSiap' } | { t: 'siap' } | { t: 'kalibrasi'; ok: boolean } | { t: 'repetisi'; hitungan: number } | { t: 'istirahatSelesai' } | { t: 'berhenti' }`
  - `mulaiLayar(suaraSudahBuka: boolean): Layar` (`'mulai'` bila belum, `'kamera'` bila sudah)
  - `langkah(l: Layar, a: Aksi, resep: { gerakan: Gerakan[]; repetisi: number }): { layar: Layar; keluar: boolean }` (`keluar` = kembali tanpa menyimpan)
  - `buatJuruSuara(mode: ModeKoreksi): (e: EventMesin, kini: number) => { kode: KodeKlip; prioritas?: boolean }[]`

- [ ] **Step 1: Tes gagal** di `lib/sesi-state.test.ts` (resep: `gerakan: ['jangkau_depan','jangkau_samping'], repetisi: 3`):
  - `mulaiLayar(false).nama === 'mulai'`; `mulaiLayar(true).nama === 'kamera'`.
  - Alur normal: `suaraSiap`→`kamera`, `kameraSiap`→`panduan`, `siap`→`kalibrasi`, `kalibrasi ok`→`gerakan` dengan `gerakanKe === 0`.
  - Kalibrasi gagal dua kali tetap `kalibrasi`; gagal ketiga → `panduan` dengan `bantuan === true` dan `gagalKalibrasi` kembali 0.
  - `repetisi` dengan `hitungan: 3` pada gerakan pertama → `istirahat`; `istirahatSelesai` → `gerakan` dengan `gerakanKe === 1` dan `hitungan === 0`; `hitungan: 3` pada gerakan terakhir → `ringkasan`.
  - `berhenti` dengan `totalRep >= 1` → `ringkasan`, `keluar === false`; dengan `totalRep === 0` → `keluar === true`.
  - Juru suara mode `penuh`: event `repetisi` `{hitungan: 4, bagus: true}` → `[N-4, I-BAGUS]`; `bagus: false` → `[N-4]`. Event `koreksi` kode `K-MIRING` → `[{kode:'K-MIRING', prioritas:true}]`.
  - Juru suara mode `mati`: `repetisi` bagus → hanya `[N-4]`; `koreksi` → `[]`.
  - Gating: `gating aktif:true` pada `kini=0` → `[I-GATING]`; lagi pada `kini=3000` → `[]`; pada `kini=5000` → `[I-GATING]`; `aktif:false` → `[]`. Event `sampel` → `[]`.
- [ ] **Step 2:** Jalankan → FAIL.
- [ ] **Step 3:** Implement `lib/sesi-state.ts` (murni; hanya `import type` dari `./kinematik/tipe.ts` dan `./suara.ts`). Total repetisi bertambah dengan `hitungan` terbaru (`totalRep` = jumlah semua gerakan).
- [ ] **Step 4:** Tes hijau.
- [ ] **Step 5:** Commit `feat: state layar sesi dan penyaring suara`.

### Task 6: Mesin tiruan

**Files:**
- Create: `lib/mesin-tiruan.ts`
- Test: `lib/mesin-tiruan.test.ts`

**Interfaces:**
- Produces: `buatMesinTiruan(): { mulai(cb: (e: EventMesin) => void): void; berhenti(): void }`. Perilaku spec §6.10: `sampel` tiap 33 ms, `repetisi` tiap 3 dtk (hitungan naik 1, `bagus` true pada hitungan kelipatan 3), `koreksi` pada 1 dari tiap 3 repetisi (kode acak dari 4 `KodeKoreksi`), `gating` aktif sekali tiap 20 dtk lalu tidak aktif 2 dtk kemudian.
- Consumes: `EventMesin` dari `lib/kinematik/tipe.ts`.

- [ ] **Step 1: Tes gagal** memakai `mock.timers` dari `node:test`: setelah `tick(3100)` ada tepat 1 event `repetisi` dengan `hitungan === 1`; setelah `tick(9100)` `hitungan` terakhir `=== 3` dan `bagus === true`; setelah `berhenti()` dan `tick(10000)` tidak ada event baru.
- [ ] **Step 2:** FAIL. **Step 3:** Implement dengan `setInterval`. **Step 4:** Hijau.
- [ ] **Step 5:** Commit `feat: mesin tiruan untuk UI sebelum G1`.

### Task 7: Halaman masuk `/` (F01, F15, F16)

**Files:**
- Modify: `app/page.tsx`
- Create: `components/FormMasuk.tsx`

**Interfaces:**
- Consumes (Pindra, `lib/supabase.ts`): `supabase`, `cekPeran(): Promise<Peran>`, `pesanGalat(e): string`, RPC `buat_sandbox()`. Menunggu Pindra pukul 19.00–20.00; sebelum itu pakai stub lokal dengan tanda tangan sama.
- Produces: perilaku §10.1.

- [ ] **Step 1:** Saat dimuat panggil `cekPeran()`: `terapis` → `router.replace('/terapis')`; `pasien` → `router.replace('/pasien')`; selain itu tetap.
- [ ] **Step 2:** Tiga tombol besar (≥ 64 px): "Saya fisioterapis" (membuka `FormMasuk` di tempat: email, kata sandi dengan `autocomplete` `current-password`/`new-password`, nama hanya saat daftar, tombol Masuk dan Daftar; daftar memanggil `signUp({ email, password, options: { data: { role: 'fisioterapis', nama } } })`), "Coba sebagai juri" (`signInAnonymously()` bila belum ada sesi → `rpc('buat_sandbox')` → `/terapis`), "Mode tamu" (`/tamu`). Galat lewat `pesanGalat`, tampil di `role="alert"`.
- [ ] **Step 3 (manual, setelah Pindra 19.00):** daftar terapis baru → mendarat di `/terapis`; muat ulang → tetap; "Coba sebagai juri" → `/terapis` berisi 5 pasien; tanpa jaringan → pesan galat, tombol tetap bisa diketuk ulang; tombol dapat dijangkau keyboard (Tab) dan ukuran ≥ 64 px.
- [ ] **Step 4:** Commit `feat: halaman masuk`.

### Task 8: `Sesi.tsx` (F05–F10)

**Files:**
- Create: `components/Sesi.tsx`, `components/sesi/Overlay.tsx`, `components/sesi/LayarPanduan.tsx`, `components/sesi/LayarKalibrasi.tsx`, `components/sesi/LayarGerakan.tsx`, `components/sesi/LayarIstirahat.tsx`, `components/sesi/LayarRingkasan.tsx`

**Interfaces:**
- Produces: `export default function Sesi(p: { resep: ResepSalinan & { sisi: Sisi }; pasienId?: string; simpan: boolean; tamu?: boolean; kembali: string }): JSX.Element`.
- Consumes: `langkah`, `mulaiLayar`, `buatJuruSuara` (Task 5); `suara` (Task 4); `tambah`, `kirim` dan `tambahRiwayat`, `bacaRiwayat` (Task 2); `buatMesinTiruan` (Task 6). Dari Manta: `kalibrasi`, `buatPemantau`, `buatMesin`, `agregatSesi`, `KANDIDAT_CONDONG`, `SUARA_CONDONG`, `ISTIRAHAT_MS`; dan `lib/pose.ts` dengan kontrak yang **perlu disepakati dengan Manta pukul 18.00**: `mulaiPose(video: HTMLVideoElement, onFrame: (f: FrameMentah) => void): Promise<{ delegate: 'GPU' | 'CPU'; berhenti(): void }>`, yang memanggil `getUserMedia` (640×480) dan meneruskan galat aslinya (`NotAllowedError`, `NotFoundError`, `NotReadableError`) tanpa membungkusnya. Dari Pindra: `Grafik` (`TitikGrafik`, `PropsGrafik` di plan backend §4.3) untuk grafik "% repetisi benar" di ringkasan.
- Pemilihan sumber: `NEXT_PUBLIC_MESIN_TIRUAN === '1'` memakai Task 6 tanpa kamera; selain itu memakai `mulaiPose` + `buatMesin`. Kedua jalur memanggil satu fungsi `tangani(e: EventMesin)`: meneruskan hasil `buatJuruSuara(mode)` ke `suara.ucap`, mencatat latensi koreksi (`tMulai` − `tDeteksi`) ke `console.debug`, dan mengirim `Aksi` ke reducer. Setelah `repetisi` dengan `hitungan === resep.repetisi`: `mesin.akhiri()` lalu aksi `repetisi`.

- [ ] **Step 1 (skeleton, mesin tiruan):** Render `LayarPanduan`/`LayarKalibrasi`/`LayarGerakan` sesuai tabel state §10.7 dengan reducer Task 5 sebagai satu-satunya sumber `layar.nama`. Panduan: teks (kursi bersandaran tanpa sandaran tangan, kamera setinggi dada, 1,5–2 m, tampak depan, kepala sampai pangkuan, lanskap disarankan), pratinjau + overlay, status cek dari `buatPemantau`, tombol **Siap** aktif hanya bila tidak gating; `I-KAMERA`, `I-POSISI` saat masuk; `I-BINGKAI` tiap 10 dtk selama cek gagal. Kalibrasi: hitung mundur besar, `I-KALIB` lalu `N-5…N-1` tiap 1 dtk, hasil `kalibrasi(frames, sisi)`; gagal → `I-KALIB-ULANG`.
- [ ] **Step 2 (kamera + galat):** state `kamera` menampilkan "Menunggu izin kamera…", setelah > 10 dtk petunjuk ikon kamera di bilah alamat. Galat per jenis dengan teks berbeda: `NotAllowedError` (cara mengizinkan di browser), `NotFoundError` ("Kamera tidak ditemukan"), `NotReadableError` ("Kamera dipakai aplikasi lain"), lainnya (teks umum). Semua punya tombol "Coba lagi" dan "Kembali".
- [ ] **Step 3 (gerakan):** video dicerminkan CSS (`scale-x-[-1]`, canvas overlay ikut), video peragaan di pojok (`/video/jangkau_depan.mp4` atau `jangkau_samping.mp4`, loop, tanpa suara, `scaleX(-1)` untuk sisi kiri), "3 / 10" besar, nama gerakan, indikator keyakinan (bar + teks dari `skor`), fps kecil (median dari selisih `t` frame), tombol besar **Berhenti**. `I-G1`/`I-G2` saat masuk gerakan; `istirahat` memutar `I-ISTIRAHAT` dan hitung mundur 20 dtk (`ISTIRAHAT_MS`).
- [ ] **Step 4 (cleanup, Review Focus 3):** `useEffect` yang memulai kamera/mesin mengembalikan fungsi yang memanggil `pose.berhenti()`, menghentikan semua track `stream.getTracks()`, `mesinTiruan.berhenti()`, `suara.hentikan()`, dan menandai `dibatalkan = true` supaya callback terlambat tidak memanggil `setState`.
- [ ] **Step 5 (ringkasan + simpan, F10):** masuk `ringkasan` dengan `simpan`: `agregatSesi({...})` → `tambah({ jenis: 'sesi', baris })` (bila `false`, tampilkan "Memori penuh, sesi tidak tersimpan") → `kirim()` → `tambahRiwayat(pasienId, { mulai, pct_benar, rep_total, rep_benar })`. Tampil: total repetisi, repetisi benar, `Grafik` "% repetisi benar" dari `bacaRiwayat` 7 terakhir, tiga tombol nyeri ikon + teks ≥ 44×44 (Tidak nyeri / Agak nyeri / Nyeri; hanya `!tamu`), tombol Selesai → `router.push(kembali)`. Ketuk nyeri → `tambah({ jenis: 'nyeri', sesi_id, nilai })` → `kirim()` dan tombol nyeri dinonaktifkan. `I-SELESAI`, lalu `I-NYERI` (bukan tamu). Tamu: tanpa nyeri, tanpa grafik, hanya angka sesi ini. `Berhenti` dengan 0 repetisi → `router.push(kembali)` tanpa menyimpan apa pun.
- [ ] **Step 6 (mode):** `kandidat` = `tamu ? 'a' : KANDIDAT_CONDONG`, `suaraCondong = SUARA_CONDONG`. Mode `mati` ditangani `buatJuruSuara` (Task 5); layar ringkasan tetap tampil.
- [ ] **Step 7 (verifikasi manual, `NEXT_PUBLIC_MESIN_TIRUAN=1`):** (a) alur penuh panduan → kalibrasi → gerakan 1 (3 repetisi, hitungan terdengar) → istirahat 20 dtk → gerakan 2 → ringkasan; (b) tolak izin kamera di Chrome → pesan `NotAllowedError`, "Kembali" berfungsi; (c) tutup kamera dari aplikasi lain → pesan `NotReadableError`; (d) tekan Kembali browser di tengah gerakan → lampu kamera padam, suara berhenti, tidak ada galat konsol; (e) Berhenti di repetisi 0 → kembali tanpa baris di `rc_antrean`; (f) mode `mati`: tidak ada koreksi atau I-BAGUS, ringkasan tampil.
- [ ] **Step 8:** Commit `feat: layar sesi dengan mesin tiruan`.

### Task 9: `/pasien/sesi` dan `/tamu`

**Files:**
- Modify: `app/pasien/sesi/page.tsx`, `app/tamu/page.tsx`

**Interfaces:**
- Consumes: `Sesi` (Task 8), `bacaResep`, `suara`, `cekPeran`, `supabase`. 
- Produces: perilaku §10.8–10.9.

- [ ] **Step 1:** `/tamu`: spanduk tetap "Mode tamu: data tidak disimpan"; dua tombol besar "Lengan kiri" / "Lengan kanan" yang pada ketukan memanggil `suara.buka()` lalu merender `<Sesi simpan={false} tamu kembali="/" resep={{ gerakan: ['jangkau_depan'], repetisi: 5, sesi_per_minggu: 3, toleransi_batang: 'normal', toleransi_bahu: 'normal', durasi_persen: 30, mode_koreksi: 'penuh', kalimat_condong: 'sandaran', kandidat_condong: 'a', suara_condong: SUARA_CONDONG, ambang_versi: AMBANG_VERSI, sisi }} />`. Tanpa panggilan database.
- [ ] **Step 2:** `/pasien/sesi`: resep dari `pasien` (daring) atau `bacaResep()` (luring); tanpa keduanya → pesan "Resep tidak ditemukan, hubungkan ke internet sekali" + tombol kembali. Terapis demo: `?pasien={id}` dengan guard `demo` dan pasien miliknya (query pasien lewat RLS; null → kembali ke `/terapis`), `kembali = /terapis/pasien/{id}`. Pasien: `kembali = '/pasien'`. `suara.jalur === null` (URL dibuka langsung) membuat `Sesi` mulai di layar `mulai` (Review Focus 5).
- [ ] **Step 3 (manual):** `/tamu` dengan lengan kanan → 5 repetisi → ringkasan tanpa nyeri → Selesai kembali ke `/`; buka `/pasien/sesi` langsung lewat URL → tombol "Mulai latihan" muncul dan suara belum berbunyi sebelum diketuk; matikan jaringan → resep dari `rc_resep` dipakai.
- [ ] **Step 4:** Commit `feat: rute sesi pasien dan tamu`.

### Task 10: Beranda pasien `/pasien` (F04, F11, F19 hapus data)

**Files:**
- Modify: `app/pasien/page.tsx`
- Create: `components/PemicuAntrean.tsx`
- Modify: `app/layout.tsx` (menyisipkan `<PemicuAntrean />`)

**Interfaces:**
- Consumes: `cekPeran`, `supabase`, `bacaResep`, `simpanResep`, `bacaRiwayat`, `jumlahSesi`, `kirim`, `suara`, `hapus`.
- Produces: `PemicuAntrean` client component tanpa UI yang memanggil `kirim()` saat mount, event `online`, dan `visibilitychange` (visible).

- [ ] **Step 1:** Guard: `cekPeran()` `pasien` → data dari tabel `pasien` lalu `simpanResep`; `luring` → pakai `bacaResep()`; selain itu `router.replace('/')`.
- [ ] **Step 2:** Isi: "Halo, {nama}", kartu "7 hari terakhir: X dari Y sesi" (X = jumlah `bacaRiwayat` dengan `mulai` dalam 7 hari, Y = `sesi_per_minggu`), tombol besar "Mulai latihan" (`await suara.buka()` di handler ketukan lalu `router.push('/pasien/sesi')`), teks "N sesi menunggu dikirim" bila `jumlahSesi() > 0`.
- [ ] **Step 3:** "Hapus data saya" (sekunder, ≥ 44 px) → layar konfirmasi "Semua sesi latihan dihapus dan perangkat dilepas. Tidak bisa dibatalkan." dengan "Ya, hapus" / "Batal". Ya: bila `navigator.onLine === false` tampilkan "Butuh internet untuk menghapus" dan berhenti; selain itu `rpc('cabut_persetujuan')` → hapus `rc_antrean`, `rc_gagal`, `rc_riwayat:*`, `rc_resep` → `signOut()` → `router.replace('/')` dengan pesan "Data dihapus, perangkat dilepas". Bila RPC gagal, jangan hapus data lokal; tampilkan `pesanGalat`.
- [ ] **Step 4 (manual, setelah Task 11 dan Pindra Fase 2):** beranda menampilkan nama dan kartu; mode pesawat → beranda tetap tampil dari `rc_resep`; "Hapus data saya" saat luring ditolak dengan pesan; saat daring, data hilang dan perangkat kembali ke `/`.
- [ ] **Step 5:** Commit `feat: beranda pasien, hapus data, pemicu antrean`.

### Task 11: Klaim + persetujuan `/k/[kode]` (F03, F19)

**Files:**
- Modify: `app/k/[kode]/page.tsx`
- Create: `components/sesi/LayarSetuju.tsx` (nama boleh `components/LayarSetuju.tsx`)

**Interfaces:**
- Consumes: `teksSetuju()` (Task 3), `suara.ucap('I-SETUJU-n')`, `supabase`, `cekPeran`, `pesanGalat`, `simpanResep`, RPC `klaim_pasien(p_kode, p_versi, p_oleh)`.
- Produces: perilaku §10.5.

- [ ] **Step 1:** Ambil `kode` dengan `useParams()` (bukan props `params`). Belum ada sesi → `signInAnonymously()`; peran `terapis` → tampilkan pesan `akun_terapis`.
- [ ] **Step 2:** Layar persetujuan: paragraf `teksSetuju()`; tombol "Dengarkan" (ketukan ini `await suara.buka()` lalu memutar `I-SETUJU-1…n` berurutan); radio besar "Saya pasien" / "Saya wali atas nama pasien" (wajib dipilih sebelum Setuju aktif); tombol "Setuju" dan "Tidak setuju".
- [ ] **Step 3:** Setuju → `rpc('klaim_pasien', { p_kode: kode, p_versi: 'F19-v1', p_oleh })`; sukses → ambil baris `pasien` miliknya, `simpanResep`, `router.replace('/pasien')`. Galat → `pesanGalat(error)` (`kode_tidak_sah`, `sudah_terikat`, `akun_terapis`) di `role="alert"`. Tidak setuju → layar "Tanpa persetujuan aplikasi tidak bisa dipakai. Hubungi fisioterapis Anda.".
- [ ] **Step 4 (manual):** kode valid dari dasbor (Pindra Fase 4c) di HP → persetujuan → klaim → `/pasien`; kode salah → "Minta tautan baru ke fisioterapis"; kode yang sama dipakai dua kali → `kode_tidak_sah`; setelah "Hapus data saya", kode baru dari terapis bisa diklaim ulang; kolom `persetujuan_*` terisi di Supabase.
- [ ] **Step 5:** Commit `feat: klaim perangkat dan persetujuan`.

### Task 12: Pasang mesin asli (G1, 23.00–24.00 bersama Manta)

**Files:**
- Modify: `components/Sesi.tsx`, `.env.local` / env Vercel (hapus `NEXT_PUBLIC_MESIN_TIRUAN`)

**Interfaces:**
- Consumes: `lib/pose.ts` dan `lib/kinematik/*` Manta yang sudah lolos `kinematik.test.ts`.

- [ ] **Step 1:** Matikan `NEXT_PUBLIC_MESIN_TIRUAN`; jalankan `npm test` (semua hijau) dan `npm run build` (tanpa galat tipe).
- [ ] **Step 2 (manual, butir G1 milik Ari):** di Chrome laptop: kalibrasi lalu event `repetisi` (hitungan terdengar) dan `koreksi` dari mesin asli; sesi tersimpan lewat RLS dari perangkat anon yang sudah klaim dan dari terapis demo tanpa `42501`; tidak ada galat di konsol; lampu kamera padam setelah keluar.
- [ ] **Step 3:** Perbaikan integrasi bersama Manta (batas sampai 00.30). Commit `feat: pasang mesin kinematik asli`.

### Task 13: Aksesibilitas, offline, dan uji akhir (01.30–05.00, 07.30)

**Files:**
- Modify: berkas yang gagal uji.

- [ ] **Step 1 (NFR-6):** Semua tombol memiliki nama aksesibel; fokus terlihat; teks galat memakai `role="alert"`; kontras teks ≥ 4,5:1 dan ikon/garis ≥ 3:1; indikator keyakinan dan hitungan tidak bergantung pada warna saja (teks "3 / 10", label bar).
- [ ] **Step 2 (suara di Android):** sesi di Oppo (Chrome): hitungan dan koreksi terdengar; layar dikunci atau tab diganti saat sesi → catat perilaku (suara berhenti atau tidak) untuk README, apa adanya.
- [ ] **Step 3 (offline, G2):** selesaikan sesi dan ketuk nyeri dalam mode pesawat → "1 sesi menunggu dikirim" → online → terkirim sekali, 1 baris `sesi`, nyeri ikut, tanpa duplikat (cek di Supabase). Buka tab kedua saat online untuk memicu `visibilitychange` bersamaan; tetap 1 baris.
- [ ] **Step 4 (persetujuan, G2):** klaim mengisi `persetujuan_*`; hapus data menghapus sesi dan eskalasi serta mengosongkan `user_id`; kode baru bisa diklaim ulang.
- [ ] **Step 5 (privasi, A15, 07.00–07.30):** rekam tab Network satu sesi penuh: hanya JSON ke Supabase, nol media, nol permintaan TTS jaringan; simpan potongannya untuk video.
- [ ] **Step 6:** Skrip demo A14 di production bersama tim (04.00); perbaiki yang merah saja. Commit `fix: hasil uji aksesibilitas dan offline`.

---

## Self-review (dijalankan penulis)

- **Cakupan spec:** F01/F15/F16 → Task 7, 9; F04/F11/F19 hapus → Task 2, 10; F03 klaim + F19 persetujuan → Task 11; F05–F10 → Task 8; §7 → Task 4; Lampiran A teks → Task 3; F18 manifest + ikon → Task 1; §6.10 mesin tiruan → Task 6; G1 → Task 12; G2/NFR-6/privasi → Task 13. Mode Mati dan ringkasan di semua mode → Task 5, 8.
- **Konsistensi tipe:** `Layar`, `Aksi`, `langkah`, `buatJuruSuara` didefinisikan di Task 5 dan dipakai di Task 8; `Op`/`buatAntrean` di Task 2 dipakai di Task 8, 10; `KodeKlip` di Task 4 dipakai Task 3 (impor tipe saja) dan Task 5.
- **Risiko terbuka untuk dikonfirmasi:** (1) kontrak `lib/pose.ts` dengan Manta (Task 8); (2) kalimat Lampiran A untuk `NASKAH` (Task 3); (3) tanda tangan `lib/supabase.ts` dari Pindra sudah ada di plan backend §4.1; (4) tipe Manta belum ada sebelum 18.30 (fallback di Task 2).
