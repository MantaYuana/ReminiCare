# Frontend ReminiCare V9 (bagian Ari) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelesaikan UI pasien ReminiCare sesuai spec v1.1:
- login Google dua peran di `/` dan `/auth/selesai`;
- klaim dengan login pasien;
- beranda dengan keadaan "belum ada resep";
- tamu dengan form resep;
- layar sesi.

Semua di atas modul `lib/` yang sudah ada.

**Architecture:** Task 1–6 rencana lama (`2026-10-31-frontend-ari.md`) sudah selesai dan tetap dipakai: `lokal`, `antrean`, `naskah`, `suara`, `sesi-state`, dan `mesin-tiruan`. Rencana ini **menggantikan Task 7–13 lama**. Halaman tetap client component yang memanggil kontrak backend V9 (`lib/supabase.ts`, `lib/peran.ts`, RPC `daftar`/`klaim_pasien`, `FormResep mode="tamu"`). Logika yang bisa diuji dipisah ke `lib/arah.ts`; layar diverifikasi manual.

**Tech Stack:** Next.js 16 App Router (client component), `@supabase/supabase-js` 2.118.0 (PKCE, sesi di localStorage), Web Speech + Web Audio, `node --test`.

**Spec:** `SPEC-ReminiCare-ramping.md` v1.1 §1, §2, §10.1, §10.1b, §10.5–§10.9, §11, §12, §14 no. 21–25 (di folder lomba; salin ke `docs/`). Kontrak backend: [2026-11-01-backend-pindra-v9.md](2026-11-01-backend-pindra-v9.md), bagian "Kontrak untuk Ari".

---

## Inventaris: repo sekarang vs spec v1.1

| Aksi | Apa | Di mana | Task |
|---|---|---|---|
| **Ubah** | Singleton antrean membuat `createClient` baru di setiap kirim. Ganti dengan `supabase` bersama dari `lib/supabase.ts`: sesi Google + PKCE + rotasi refresh token tidak boleh dipegang beberapa klien | `lib/antrean.ts:172-208` | 1 |
| **Tambah** | `components/Sesi.tsx` + `components/sesi/*` (Task 8 lama, `kembali` disesuaikan) | `components/` | 2 |
| **Tambah** | `/tamu`: `FormResep mode="tamu"` → `Sesi`, isian di `rc_tamu` | `app/tamu/page.tsx` (stub) | 3 |
| **Tambah** | `ruteUntuk`, `normalKode` + tes | `lib/arah.ts`, `lib/arah.test.ts` (baru) | 4 |
| **Tambah** | `/` login: "Login with Google", "Sign up", tautan tamu | `app/page.tsx` (stub), `components/PilihPeran.tsx` (baru) | 4 |
| **Tambah** | `/auth/selesai` | `app/auth/selesai/page.tsx` (baru) | 5 |
| **Tambah** | `/k/[kode]` dengan gerbang login pasien + persetujuan F19 | `app/k/[kode]/page.tsx` (stub), `components/LayarSetuju.tsx` | 6 |
| **Ubah** | `TEKS_SETUJU` diganti naskah A4 final dari Pindra (ada kalimat akun Google) | `lib/naskah.ts:32-38` | 6 |
| **Tambah** | `/pasien`: beranda, "belum ada resep" + kolom kode, "Hapus data saya", "Keluar"; `PemicuAntrean` | `app/pasien/page.tsx` (stub), `components/PemicuAntrean.tsx`, `app/layout.tsx` | 7 |
| **Tambah** | `/pasien/sesi` (khusus peran pasien) | `app/pasien/sesi/page.tsx` (stub) | 8 |
| **Tambah** | Pasang mesin asli (Task 12 lama) | `components/Sesi.tsx` | 9 |
| **Tambah** | Uji akhir V9 (Task 13 lama + login Google) | — | 10 |
| **Hapus dari rencana** (belum pernah dibangun) | `components/FormMasuk.tsx` (email/kata sandi), tombol "Coba sebagai juri", `signInAnonymously()`, `rpc('buat_sandbox')`, jalur terapis demo `?pasien=` di `/pasien/sesi`, `kembali` ke `/terapis/pasien/{id}`, dua tombol lengan terpisah di `/tamu` | — | — |
| **Tetap** | `lib/lokal.ts`, `lib/naskah.ts` (selain `TEKS_SETUJU`), `lib/suara.ts`, `lib/sesi-state.ts`, `lib/mesin-tiruan.ts`, `app/manifest.ts`, ikon, semua tes yang ada | — | — |

**Bergantung ke Pindra** (rencana backend):
- Task 4 backend: `lib/supabase.ts` + `lib/peran.ts` V9. Dibutuhkan Task 1, 4–8 di sini.
- Task 6 backend: `FormResep mode="tamu"`. Dibutuhkan Task 3.
- Task 1–3 backend: OAuth + migrasi 0004. Dibutuhkan untuk verifikasi login.

Sebelum kontrak itu masuk, tulis halaman memakai nama di "Kontrak untuk Ari" apa adanya; jangan membuat stub `lib/supabase.ts` sendiri.

## Global Constraints

- Label persis: "Login with Google", "Sign up", "Sign Up as Fisioterapis", "Sign Up as Pasien", "Coba latihan tanpa akun", "Keluar dan ganti akun". Teks lain Bahasa Indonesia.
- Tidak ada form email/kata sandi, tidak ada `signInAnonymously`, tidak ada `buat_sandbox`.
- Jangan panggil `exchangeCodeForSession` sendiri; `supabase-js` (PKCE, `detectSessionInUrl`) menukar `?code=` saat inisialisasi. Penukaran ganda gagal.
- `lanjut` dari URL selalu lewat `lanjutAman()` (`lib/peran.ts`). Navigasi setelah login memakai `router.replace`.
- NFR-6: teks ≥ 18 px, tombol utama ≥ 64 px, kontrol lain ≥ 44×44 px, galat di `role="alert"`, ikon selalu berlabel teks.
- `suara.buka()` hanya dari handler ketukan pengguna, termasuk di dalam `onKirim` `FormResep` (dipanggil sinkron).
- localStorage selalu lewat `bacaJson`/`tulisJson`/`hapus` (`lib/lokal.ts`). Kunci: `rc_resep`, `rc_antrean`, `rc_gagal`, `rc_riwayat:{pasien_id}`, `rc_tamu`.
- Tes: `npm test`; file `lib/` yang diuji memakai impor relatif `.ts` dan tidak mengimpor `lib/supabase.ts`.
- Kepemilikan file spec §5: Ari tidak mengubah `lib/supabase.ts`, `lib/peran.ts`, `components/FormResep.tsx`, `app/terapis/*`.
- P1 tidak dibangun sebelum G2 hijau.

## Review Focus

1. **`/auth/selesai` dimuat ulang setelah `code` terpakai, atau dibuka langsung tanpa `code`.** Jangan layar kosong atau loop; arahkan ke `/?galat=oauth`, atau ke beranda bila sesi sudah ada. Dicek di Task 5 Step 3.
2. **Pengguna membatalkan layar Google** (`?error=access_denied`) → `/` dengan "Login Google gagal, coba lagi". Dicek di Task 5 Step 3.
3. **Tautan buatan `…/auth/selesai?lanjut=//evil.com`** → `lanjut` diabaikan. Dicek di tes `ruteUntuk` Task 4.
4. **Kode diketik dengan spasi, huruf kecil, atau panjang salah** → dinormalkan atau ditolak dengan pesan, bukan dikirim mentah ke `klaim_pasien`. Dicek di tes `normalKode` Task 4.
5. **"Keluar" saat antrean masih berisi** → sesi bisa terkirim atas nama akun lain atau hilang. Tombol harus nonaktif. Dicek di Task 7 Step 4.

---

### Task 1: Antrean memakai klien Supabase bersama (±15 menit)

**Files:**
- Modify: `lib/antrean.ts:172-208` (`supabaseKey`, `dapatSingleton`)

**Interfaces:**
- Consumes: `supabase` dari `lib/supabase.ts` (backend Task 4).
- Produces: `tambah`, `kirim`, `jumlahSesi` tidak berubah.

- [ ] **Step 1: Ganti dua `createClient(...)` di `upsertSesi` dan `laporNyeri`** dengan `const { supabase } = await import('./supabase.ts');`. Impor tetap dinamis, supaya `lib/antrean.test.ts` (yang memakai `buatAntrean`) tidak memuat Supabase. Hapus `supabaseKey()`.
- [ ] **Step 2: Jalankan `npm test`.**
  Expected: semua tes `antrean` tetap hijau.
- [ ] **Step 3: Commit**

```bash
git add lib/antrean.ts
git commit -m "fix(antrean): pakai klien supabase bersama untuk sesi Google"
```

### Task 2: `Sesi.tsx` (F05–F10, ±3 jam)

**Files:** sama dengan Task 8 lama: `components/Sesi.tsx`, `components/sesi/{Overlay,LayarPanduan,LayarKalibrasi,LayarGerakan,LayarIstirahat,LayarRingkasan}.tsx`.

**Interfaces:**
- Produces: `export default function Sesi(p: { resep: ResepSalinan & { sisi: Sisi }; pasienId?: string; simpan: boolean; tamu?: boolean; kembali: string }): JSX.Element` (spec §10.7).
- Consumes: sama dengan Task 8 lama. `Grafik` dari `components/Grafik.tsx` (`TitikGrafik`, `PropsGrafik` sudah ada di repo).

- [ ] **Step 1–6:** Ikuti Task 8 lama Step 1–6 apa adanya. Bedanya: `kembali` hanya dua nilai, pasien `/pasien` dan tamu `/tamu`. Tidak ada cabang terapis demo.
- [ ] **Step 7: Verifikasi manual** (`NEXT_PUBLIC_MESIN_TIRUAN=1`): butir (a)–(f) dari Task 8 lama. Halaman uji sementara boleh merender `<Sesi simpan={false} tamu kembali="/tamu" resep={…} />` sampai Task 3 ada.
  Expected: semua butir lolos, tanpa galat konsol.
- [ ] **Step 8: Commit**

```bash
git add components/Sesi.tsx components/sesi
git commit -m "feat: layar sesi dengan mesin tiruan"
```

### Task 3: `/tamu` dengan form resep (F15, ±30 menit)

**Files:**
- Modify: `app/tamu/page.tsx`

**Interfaces:**
- Consumes: `FormResep` + `ResepTamu` (backend Task 6), `Sesi` (Task 2), `suara`, `bacaJson`/`tulisJson`, `SUARA_CONDONG`, `AMBANG_VERSI` dari `lib/kinematik/mesin.ts`.

- [ ] **Step 1: Implementasi.**
  - Tanpa cek login. Spanduk tetap "Mode tamu: data tidak disimpan".
  - State `resep: ResepTamu | null`.
  - Selama `null`, render `<FormResep mode="tamu" pasien={bacaJson('rc_tamu', null)} onKirim={…} />`. `onKirim(r)`: `suara.buka()` (tanpa `await` sebelumnya), `tulisJson('rc_tamu', r)`, `setResep(r)`.
  - Setelah terisi: `<Sesi simpan={false} tamu kembali="/tamu" resep={{ ...r, sesi_per_minggu: 3, kandidat_condong: 'a', suara_condong: SUARA_CONDONG, ambang_versi: AMBANG_VERSI, sisi: r.sisi_terdampak }} />`.
  - "Selesai" di ringkasan → `/tamu` → form muncul lagi dengan isian terakhir.
- [ ] **Step 2: Verifikasi manual.**
  - Bawaan (jangkau depan, 5 repetisi, Penuh) → sesi → ringkasan tanpa nyeri dan tanpa grafik → Selesai → form dengan isian sama.
  - Ubah ke kedua gerakan, 8 repetisi, Mati → sesi tanpa K-* dan I-BAGUS.
  - Tab Network selama form + sesi.
  Expected: nol permintaan ke Supabase.
- [ ] **Step 3: Commit**

```bash
git add app/tamu/page.tsx
git commit -m "feat: mode tamu dengan form resep (F15 V9)"
```

### Task 4: `lib/arah.ts` + halaman `/` (F01, ±45 menit)

**Files:**
- Create: `lib/arah.ts`, `lib/arah.test.ts`, `components/PilihPeran.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Peran`, `lanjutAman` dari `lib/peran.ts`; `supabase`, `cekPeran`, `masukGoogle`, `pesanGalat` dari `lib/supabase.ts`.
- Produces:
  - `ruteUntuk(p: Peran, lanjut: string | null): string | null`: `terapis` → `lanjutAman(lanjut) ?? '/terapis'`; `pasien` / `pasien_baru` → `lanjutAman(lanjut) ?? '/pasien'`; `luring` → `'/pasien'`; `tanpa_peran` / `keluar` → `null` (tetap di halaman).
  - `normalKode(s: string): string | null`: buang spasi, huruf besar; harus `/^[0-9A-F]{8}$/`, selain itu `null`.
  - `PilihPeran(p: { onSelesai(peran: 'fisioterapis' | 'pasien'): void }): JSX.Element`: dua tombol "Sign Up as Fisioterapis" / "Sign Up as Pasien" untuk akun yang **sudah** login tanpa profil; memanggil `supabase.rpc('daftar', { p_peran })`, galat lewat `pesanGalat`.

- [ ] **Step 1: Tulis `lib/arah.test.ts`.**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ruteUntuk, normalKode } from './arah.ts';

test('ruteUntuk: beranda sesuai peran', () => {
  assert.equal(ruteUntuk({ jenis: 'terapis', uid: 'u', nama: 'A' }, null), '/terapis');
  assert.equal(ruteUntuk({ jenis: 'pasien', uid: 'u', pasienId: 'p' }, null), '/pasien');
  assert.equal(ruteUntuk({ jenis: 'pasien_baru', uid: 'u' }, null), '/pasien');
  assert.equal(ruteUntuk({ jenis: 'tanpa_peran', uid: 'u' }, null), null);
  assert.equal(ruteUntuk({ jenis: 'keluar' }, null), null);
});

test('ruteUntuk: lanjut internal dipakai, eksternal dibuang', () => {
  assert.equal(ruteUntuk({ jenis: 'pasien_baru', uid: 'u' }, '/k/ABCD1234'), '/k/ABCD1234');
  assert.equal(ruteUntuk({ jenis: 'pasien_baru', uid: 'u' }, '//evil.com'), '/pasien');
  assert.equal(ruteUntuk({ jenis: 'terapis', uid: 'u', nama: 'A' }, 'https://evil.com'), '/terapis');
});

test('normalKode', () => {
  assert.equal(normalKode(' ab12cd34 '), 'AB12CD34');
  assert.equal(normalKode('AB12 CD34'), 'AB12CD34');
  assert.equal(normalKode('AB12CD3'), null);
  assert.equal(normalKode('GH12CD34'), null);
});
```

- [ ] **Step 2: Jalankan `npm test`.**
  Expected: FAIL `arah.ts` belum ada.
- [ ] **Step 3: Implementasi `lib/arah.ts`** (hanya `import type`/`import` dari `./peran.ts`) dan `PilihPeran`.
- [ ] **Step 4: Implementasi `app/page.tsx`** sesuai spec §10.1.
  - Saat dimuat, `cekPeran()` → `ruteUntuk(p, null)` → `router.replace` bila tidak `null`. Untuk `tanpa_peran`, tampilkan `PilihPeran` (`onSelesai` → `router.replace(ruteUntuk(...))`).
  - Isi halaman: nama + satu kalimat produk; tombol "Login with Google" (≥ 64 px) → `masukGoogle()`; teks "Belum punya akun? Sign up" → dua tombol Sign Up → `masukGoogle({ peran })`; kalimat "Satu akun Google hanya untuk satu peran."; tautan kecil "Coba latihan tanpa akun" → `/tamu`.
  - Query `?galat=oauth` → "Login Google gagal, coba lagi". `?galat=peran_lain` → `pesanGalat({ message: 'peran_lain' })`. `?pesan=dihapus` → "Data dihapus". Semua di `role="alert"` / `role="status"`.
- [ ] **Step 5: Verifikasi.** Jalankan `npm test`, lalu manual setelah backend Task 1–4: login dengan akun fisioterapis yang sudah ada → `/terapis`; muat ulang `/` → langsung `/terapis`; Tab menjangkau semua tombol.
  Expected: tes hijau; alur manual sesuai.
- [ ] **Step 6: Commit**

```bash
git add lib/arah.ts lib/arah.test.ts components/PilihPeran.tsx app/page.tsx
git commit -m "feat: halaman login Google dua peran (F01 V9)"
```

### Task 5: `/auth/selesai` (F01, ±30 menit)

**Files:**
- Create: `app/auth/selesai/page.tsx`

**Interfaces:**
- Consumes: `supabase`, `cekPeran`, `ruteUntuk`, `PilihPeran`, `pesanGalat`.

- [ ] **Step 1: Implementasi spec §10.1b.** Tampilkan "Sedang masuk…", lalu:
  1. Ambil `peran`, `lanjut`, `error` dari `useSearchParams()`. `error` ada → `router.replace('/?galat=oauth')`.
  2. `await supabase.auth.getSession()`. Tanpa sesi → `/?galat=oauth`.
  3. `peran` ada → `supabase.rpc('daftar', { p_peran: peran })`. Galat `peran_lain` → `signOut()` → `/?galat=peran_lain`. Galat lain → tampilkan `pesanGalat`.
  4. `p = await cekPeran()`. Bila `tanpa_peran`, render `PilihPeran`. Selain itu `router.replace(ruteUntuk(p, lanjut) ?? '/')`.

  `useSearchParams` butuh `<Suspense>` di App Router: bungkus isi halaman dalam `<Suspense fallback="Sedang masuk…">`.
- [ ] **Step 2: Verifikasi manual** (localhost, setelah backend Task 1–4):
  - akun Google baru via "Sign Up as Pasien" → `/pasien`;
  - akun yang sama via "Sign Up as Fisioterapis" → `/` dengan pesan `peran_lain`;
  - akun baru via "Login with Google" → pilihan peran tampil.
- [ ] **Step 3: Review Focus 1–2.**
  - Muat ulang `/auth/selesai?code=…` setelah sukses → langsung ke beranda peran, karena sesi sudah ada.
  - Buka `/auth/selesai` tanpa query dalam keadaan keluar → `/?galat=oauth`.
  - Batalkan di layar Google → `/?galat=oauth`.
  Expected: tidak ada layar kosong atau loop.
- [ ] **Step 4: Commit**

```bash
git add app/auth/selesai/page.tsx
git commit -m "feat: penerima redirect OAuth /auth/selesai"
```

### Task 6: `/k/[kode]` klaim + persetujuan (F03, F19, ±45 menit)

**Files:**
- Modify: `app/k/[kode]/page.tsx`, `lib/naskah.ts:32-38` (`TEKS_SETUJU`)
- Create: `components/LayarSetuju.tsx`

**Interfaces:**
- Consumes: `cekPeran`, `masukGoogle`, `supabase` (`rpc('daftar')`, `rpc('klaim_pasien')`, `signOut`), `pesanGalat`, `PilihPeran`, `teksSetuju()`, `suara`, `simpanResep`.

- [ ] **Step 1: Gerbang akun** (spec §10.5 butir 1). Ambil `kode` dengan `useParams()`, `lanjut = '/k/' + kode`, lalu `cekPeran()`:
  - `keluar` → teks "Masuk untuk menghubungkan akun pasien" + tombol "Sign Up as Pasien" → `masukGoogle({ peran: 'pasien', lanjut })` dan "Login with Google" → `masukGoogle({ lanjut })`.
  - `terapis` → `pesanGalat({ message: 'akun_terapis' })` + tombol "Keluar dan ganti akun" → `await supabase.auth.signOut()` → `masukGoogle({ peran: 'pasien', lanjut })`.
  - `tanpa_peran` → hanya tombol "Sign Up as Pasien", lewat `rpc('daftar', { p_peran: 'pasien' })`, lalu cek ulang.
  - `pasien` (sudah terikat) → `pesanGalat({ message: 'sudah_terikat' })` + tautan ke `/pasien`, **sebelum** layar persetujuan.
  - `luring` → "Butuh internet untuk menghubungkan akun".
  - `pasien_baru` → lanjut ke Step 2.
- [ ] **Step 2: Layar persetujuan + klaim.** Task 11 lama Step 2–3 apa adanya (`LayarSetuju`, "Dengarkan", "Saya pasien" / "Saya wali atas nama pasien", Setuju → `klaim_pasien(p_kode, 'F19-v1', p_oleh)` → baca baris `pasien` → `simpanResep` → `router.replace('/pasien')`; Tidak setuju → layar penolakan).
- [ ] **Step 3: `TEKS_SETUJU`.** Ganti dengan naskah A4 final dari Pindra (backend Task 7 Step 1). Pindra mengirim teks persis, termasuk kalimat akun Google. Hapus `// TODO`.
- [ ] **Step 4: Verifikasi.** Jalankan `npm test` (tes `naskah` hijau). Lalu manual di HP: QR dari dasbor → layar login → Sign Up as Pasien (akun Google kedua) → kembali ke `/k/KODE` → persetujuan → klaim → `/pasien`. Dari laptop yang login sebagai fisioterapis, buka `/k/KODE` → pesan `akun_terapis`. Akun pasien yang sudah terikat membuka kode lain → pesan `sudah_terikat`, tanpa layar persetujuan.
  Expected: semua sesuai; kolom `persetujuan_*` terisi di Supabase.
- [ ] **Step 5: Commit**

```bash
git add "app/k/[kode]/page.tsx" components/LayarSetuju.tsx lib/naskah.ts
git commit -m "feat: klaim dengan login pasien dan persetujuan F19 (V9)"
```

### Task 7: Beranda `/pasien` + `PemicuAntrean` (F04, F11, F19, ±1 jam)

**Files:**
- Modify: `app/pasien/page.tsx`, `app/layout.tsx`
- Create: `components/PemicuAntrean.tsx`

**Interfaces:**
- Consumes: `cekPeran`, `supabase`, `pesanGalat`, `normalKode`, `bacaResep`/`simpanResep`/`bacaRiwayat`/`hapus`, `jumlahSesi`/`kirim`, `suara`.
- Produces: `PemicuAntrean` (Task 10 lama, tanpa perubahan).

- [ ] **Step 1: Guard + data.** `cekPeran()`:
  - `pasien` → baca baris `pasien` → `simpanResep` → beranda;
  - `pasien_baru` → `hapus('rc_resep')` → keadaan "belum ada resep";
  - `luring` → `bacaResep()` (null → "Butuh internet sekali untuk memuat resep");
  - `terapis` / `tanpa_peran` / `keluar` → `router.replace('/')`.
- [ ] **Step 2: Keadaan "belum ada resep"** (spec §10.6).
  - Teks "Minta fisioterapis Anda membuat resep, lalu pindai QR-nya dengan kamera ponsel."
  - Kolom kode (`autoCapitalize="characters"`) + tombol "Hubungkan" → `normalKode`; `null` → "Kode terdiri dari 8 huruf/angka" di `role="alert"`, selain itu `router.push('/k/' + kode)`.
  - Tautan "Coba latihan tanpa akun" dan tombol "Keluar".
- [ ] **Step 3: Beranda terikat.** Task 10 lama Step 2–3 dengan teks V9:
  - Konfirmasi hapus: "Semua sesi latihan dihapus dan akun Anda dilepas dari data pasien. Tidak bisa dibatalkan."
  - Sukses → `router.replace('/?pesan=dihapus')`.
- [ ] **Step 4: "Keluar"** (tombol sekunder, kedua keadaan). Nonaktif bila `jumlahSesi() > 0`, dengan teks "Tunggu N sesi terkirim dulu". Selain itu `signOut()` → `hapus('rc_resep')` → `router.replace('/')`. **Review Focus 5:** dalam mode pesawat, selesaikan satu sesi → "Keluar" nonaktif → online → setelah terkirim, aktif.
- [ ] **Step 5: `PemicuAntrean`** + sisipkan di `app/layout.tsx` (Task 10 lama Step "Produces").
- [ ] **Step 6: Verifikasi manual.**
  - Akun pasien baru → keadaan "belum ada resep"; ketik kode valid huruf kecil → `/k/KODE`.
  - Akun terikat → kartu "7 hari terakhir" + "Mulai latihan"; mode pesawat → beranda dari `rc_resep`.
  - Hapus data saat luring ditolak; saat daring → `/` dengan "Data dihapus".
  - Pindra menekan "Atur ulang data contoh" untuk pasien contoh yang terikat → muat ulang beranda → keadaan "belum ada resep".
- [ ] **Step 7: Commit**

```bash
git add app/pasien/page.tsx components/PemicuAntrean.tsx app/layout.tsx
git commit -m "feat: beranda pasien V9, belum ada resep, keluar, pemicu antrean"
```

### Task 8: `/pasien/sesi` (±20 menit)

**Files:**
- Modify: `app/pasien/sesi/page.tsx`

**Interfaces:**
- Consumes: `Sesi`, `cekPeran`, `supabase`, `bacaResep`, `KANDIDAT_CONDONG`, `SUARA_CONDONG`, `AMBANG_VERSI`.

- [ ] **Step 1: Implementasi.**
  - `cekPeran()`: `pasien` → resep dari baris `pasien`; `luring` → `bacaResep()`; selain itu `router.replace('/pasien')`.
  - Render `<Sesi simpan pasienId={…} kembali="/pasien" resep={{ ...resep, kandidat_condong: KANDIDAT_CONDONG, suara_condong: SUARA_CONDONG, ambang_versi: AMBANG_VERSI, sisi: resep.sisi_terdampak }} />`.
  - Tidak ada parameter `?pasien=`.
- [ ] **Step 2: Verifikasi manual.** Task 9 lama Step 3, bagian `/pasien/sesi`: URL dibuka langsung → tombol "Mulai latihan" lebih dulu; tanpa jaringan → `rc_resep`. Tambahan: akun `pasien_baru` membuka `/pasien/sesi` → kembali ke `/pasien`.
- [ ] **Step 3: Commit**

```bash
git add app/pasien/sesi/page.tsx
git commit -m "feat: rute sesi pasien V9"
```

### Task 9: Pasang mesin asli (G1, bersama Manta)

- [ ] Ikuti Task 12 lama. Satu perubahan di Step 2: butir G1 jadi "sesi tersimpan lewat RLS dari **akun Google pasien** yang sudah klaim, tanpa `42501`". Jalur terapis demo sudah tidak ada.

### Task 10: Uji akhir V9 (01.30–05.00, 07.30)

- [ ] **Step 1–5:** Task 13 lama Step 1–5. Di Step 4, "perangkat" dibaca "akun".
- [ ] **Step 6: Tambahan V9, di URL production:**
  - Login dengan akun Google **di luar tim** (dua peran).
  - Skrip demo A14 (Pindra) memakai akun Google kedua di HP.
  - QR dipindai lewat aplikasi kamera HP. Bukan in-app browser: Instagram dan LINE ditolak Google dengan `disallowed_useragent`.
  - PWA: login dulu di tab Chrome, baru "Tambahkan ke layar utama"; buka dari ikon → tetap masuk.
- [ ] **Step 7:** Bersama tim di 04.00, perbaiki yang merah saja. Commit `fix: hasil uji akhir V9`.

---

## Catatan

- `2026-10-31-frontend-ari.md` tetap disimpan sebagai rujukan Task 8, 10, 11, 12, 13 yang dipakai ulang di sini. Task 7 dan Task 9 lama tidak berlaku lagi.
- `useSearchParams` di `/auth/selesai` dan `/` butuh `<Suspense>`; tanpa itu `next build` gagal pada halaman statis.
