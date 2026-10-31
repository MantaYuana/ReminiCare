# Backend ReminiCare V9 (bagian Pindra) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyesuaikan backend yang sudah ada di repo (migrasi 0001–0003, `lib/supabase.ts`, dasbor `/terapis`, `FormResep`) dengan spec v1.1: login hanya Google OAuth2 untuk dua peran, satu akun = satu peran, sandbox juri diganti tombol "Isi data contoh" / "Atur ulang data contoh", dan `FormResep` punya mode tamu.

**Architecture:** Semua perubahan skema masuk satu migrasi baru `0004_v9_google.sql`. File 0001–0003 tidak disentuh, karena kemungkinan sudah dijalankan di proyek Supabase. 0004 bisa dijalankan di atas DB lama maupun DB baru (0001 → 0004). Peran dicatat RPC `daftar` setelah redirect OAuth, menggantikan trigger daftar. Klien tetap satu `supabase-js` di browser dengan alur PKCE.

**Tech Stack:** Supabase (Postgres, Auth provider Google, RLS), `@supabase/supabase-js` 2.118.0, Next.js 16 App Router (client component), `node --test`.

**Spec:** `SPEC-ReminiCare-ramping.md` v1.1 (§1, §2, §3 A18, §4.1, §8.1–§8.5, §8.8, §10.1–§10.2, §10.4, §10.9, §12–§14) dan `PRD-ReminiCare.md` v1.8 (log V9). Keduanya ada di folder lomba, bukan di repo; salin ke `docs/` sebelum mulai (spec §0). Rencana ini menggantikan `PLAN-Backend-Pindra.md` lama (v1.0, sudah dihapus dari working tree).

---

## Inventaris: repo sekarang vs spec v1.1

| Aksi | Apa | Di mana | Task |
|---|---|---|---|
| **Tambah** | Setup OAuth client Google + provider Google di Supabase (A18) | Google Cloud Console, dasbor Supabase | 1 |
| **Tambah** | Migrasi `0004_v9_google.sql`: `profil.peran`, RPC `daftar`, RLS baru, `klaim_pasien` + `lapor_nyeri` versi V9, `isi_contoh` | `supabase/migrations/` | 2, 3 |
| **Tambah** | `masukGoogle()` di `lib/supabase.ts`; fungsi murni `petakanPeran()`, `bangunRedirect()`, `pesanGalat()` + tes | `lib/peran.ts` + `lib/peran.test.ts` (baru) | 4 |
| **Tambah** | Tombol "Isi / Atur ulang data contoh" + dialog konfirmasi + kartu kosong | `app/terapis/page.tsx` | 5 |
| **Tambah** | `mode="tamu"` + `onKirim` | `components/FormResep.tsx` | 6 |
| **Ubah** | Klien Supabase: `flowType: 'pkce'`; tipe `Peran` (buang `demo`/`anonim`, tambah `pasien_baru`); `cekPeran` membaca `profil.peran`; peta `pesanGalat` | `lib/supabase.ts` | 4 |
| **Ubah** | Uji SQL: setup tanpa trigger, klaim tanpa anon, Bagian C = `isi_contoh` | `supabase/tests/uji_rls.sql`, `supabase/tests/uji_eskalasi.sql` | 2, 3 |
| **Ubah** | Teks "perangkat lama" → "akun lama" | `app/terapis/pasien/[id]/page.tsx:1916-1917`, `:2062` | 4 |
| **Ubah** | Dokumen A4, A12, A13, A14 | README, naskah, DPIA | 7 |
| **Hapus** | Trigger `pengguna_baru` + fungsi `tangani_pengguna_baru` | lewat 0004 (definisinya tetap di 0001) | 2 |
| **Hapus** | Kolom `profil.is_demo`, cabang `is_demo` di `sesi_sisip` dan `lapor_nyeri`, fungsi `buat_sandbox` | lewat 0004 | 2 |
| **Hapus** | Data sandbox lama (profil `is_demo`) dan ikatan perangkat anonim | lewat 0004 | 2 |
| **Hapus** | Spanduk "Sandbox Juri" | `app/terapis/page.tsx:156-171` | 4 |
| **Hapus** | Blok "Latih sebagai pasien ini" | `app/terapis/pasien/[id]/page.tsx:2097-2121` | 4 |
| **Hapus** | Pesan `sandbox_hanya_anonim`, `perangkat_pasien`, `Invalid login credentials`, `User already registered` | `lib/supabase.ts:126-149` | 4 |
| **Tetap** | Tabel `pasien`/`sesi`/`eskalasi`, `v_prioritas`, `cek_eskalasi`, `isi_sintetis`, `buat_kode`, `cabut_persetujuan`, route F20 (sudah 403 untuk akun pasien di `route.ts:91`), `lib/ringkasan.ts`, `Grafik.tsx`, `next.config.ts`, alur baru/edit `FormResep`, `/terapis/pasien/baru` | — | — |

Bukan lingkup Pindra (milik Ari menurut spec §5, tetapi memakai kontrak di bawah): `/`, `/auth/selesai`, `/k/[kode]`, `/pasien`, `/tamu`, `TEKS_SETUJU` di `lib/naskah.ts`.

## Global Constraints

- Login hanya Google OAuth2. Supabase Auth: provider **Google ON**, **Email OFF**, **Anonymous sign-ins OFF**.
- Consent screen Google: jenis External, scope `openid`, `email`, `profile` saja, status **In production** (bukan Testing).
- Redirect URLs Supabase: `https://<url-production>/**` dan `http://localhost:3000/**`. Site URL = URL production.
- Client secret Google hanya di dasbor Supabase, tidak di repo atau Vercel. Service role key tidak dipakai di mana pun.
- Klien: `createClient(URL, PUBLISHABLE_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } })`. Tanpa `@supabase/ssr`.
- OAuth: `signInWithOAuth({ provider: 'google', options: { redirectTo: '{origin}/auth/selesai?peran=…&lanjut=…', queryParams: { prompt: 'select_account' } } })`.
- Satu akun Google = satu peran (`'fisioterapis' | 'pasien'`). `profil.peran` hanya ditulis `daftar`, dan klien tidak punya GRANT update ke kolom itu.
- Fungsi `security definer`: `set search_path = ''`, nama objek berskema, `revoke execute … from public, anon`, `grant execute … to authenticated`.
- Label persis: "Login with Google", "Sign Up as Fisioterapis", "Sign Up as Pasien", "Isi data contoh", "Atur ulang data contoh", "Mengisi…", "Ya, atur ulang", "Batal".
- Tes JS: `npm test` (= `node --test "lib/**/*.test.ts"`, Node ≥ 22.18), impor relatif dengan ekstensi `.ts`, tanpa alias `@/`.
- Uji SQL dijalankan di SQL editor Supabase sebagai `postgres`, dibungkus `begin … rollback`.
- P1 tidak dibangun sebelum G2 hijau.

## Review Focus

1. **Consent screen tertinggal di Testing.** Juri (akun di luar tim) ditolak Google dengan "Access blocked". Dipasang di Task 1 Step 4 (login dengan akun luar tim).
2. **`lanjut` dipakai untuk open redirect** (`//evil.com`, `/\evil.com`, `https://evil.com`). Chrome mengubah `\` jadi `/`, jadi aturan spec "awali `/`, bukan `//`" belum cukup. Dipasang di tes `bangunRedirect` Task 4.
3. **Klik ganda "Isi data contoh"** membuat 10 pasien. Dijaga `for update` di `isi_contoh`, plus cek manual di Task 5 Step 4.
4. **Akun fisioterapis menekan "Sign Up as Pasien"** lalu diam-diam jadi pasien. Harus ditolak `peran_lain`. Dipasang di uji SQL Task 2.
5. **DB lama masih berisi sandbox anonim dan perangkat anonim yang terikat.** Setelah anonymous sign-in OFF, data itu jadi sampah, dan perangkat anonim masih bisa menulis sesi. 0004 membersihkannya; dicek di Task 2 Step 4.

## Kontrak untuk Ari (berlaku setelah Task 4)

```ts
// lib/supabase.ts
export const supabase: SupabaseClient;                          // PKCE, sesi di localStorage (sb-*)
export type Peran =
  | { jenis: 'keluar' }
  | { jenis: 'terapis'; uid: string; nama: string }
  | { jenis: 'pasien'; uid: string; pasienId: string }        // peran pasien, sudah terikat resep
  | { jenis: 'pasien_baru'; uid: string }                      // peran pasien, belum ada resep (F04 V9)
  | { jenis: 'tanpa_peran'; uid: string }                      // login Google, belum sign up
  | { jenis: 'luring'; uid?: string };
export async function cekPeran(): Promise<Peran>;
export function masukGoogle(o?: { peran?: 'fisioterapis' | 'pasien'; lanjut?: string }): Promise<unknown>;
export function pesanGalat(e: { message?: string; status?: number } | null): string;

// lib/peran.ts (murni, aman diimpor node --test)
export type Peran;                                              // sama dengan di atas; supabase.ts mengekspor ulang
export function lanjutAman(l: string | null | undefined): string | null;   // path internal atau null
```

| RPC | Parameter | Hasil | Galat |
|---|---|---|---|
| `daftar` | `p_peran` | `text` peran | `belum_masuk`, `peran_tidak_sah`, `peran_lain` |
| `klaim_pasien` | `p_kode`, `p_versi` (`'F19-v1'`), `p_oleh` | `uuid` | `belum_masuk`, `oleh_tidak_sah`, `akun_terapis`, `belum_daftar`, `sudah_terikat`, `kode_tidak_sah` |
| `lapor_nyeri`, `cabut_persetujuan` | tidak berubah | | |
| `buat_sandbox` | **dihapus** | | |

`FormResep` mode tamu: `<FormResep mode="tamu" pasien={isianTerakhir} onKirim={(r: ResepTamu) => …} />`. `onKirim` dipanggil sinkron dari handler submit, jadi Ari boleh memanggil `suara.buka()` di dalamnya (gestur pengguna masih berlaku).

---

### Task 1: OAuth client Google + Supabase Auth (A18, ±30 menit)

**Files:** tanpa file repo. Konfigurasi di Google Cloud Console dan dasbor Supabase.

**Interfaces:**
- Produces: provider Google aktif. Task 4 dan Ari memakainya.

- [ ] **Step 1: Google Cloud Console.** Buat proyek baru → OAuth consent screen: External, nama app "ReminiCare", scope `openid`, `email`, `profile` → **Publish app**. → Credentials → OAuth client ID jenis Web application, Authorized redirect URI `https://<ref>.supabase.co/auth/v1/callback`.
- [ ] **Step 2: Supabase → Auth → Providers.** Google ON, isi Client ID + Client Secret. Email OFF. Anonymous sign-ins OFF.
- [ ] **Step 3: Supabase → Auth → URL Configuration.** Site URL = URL production. Redirect URLs: `https://<url-production>/**`, `http://localhost:3000/**`. Di Rate limits, bila batas sign-up/sign-in di bawah 100 per 5 menit, naikkan ke 100.
- [ ] **Step 4: Verifikasi** (setelah Task 4 Step 3). Di `npm run dev`, panggil `masukGoogle()` dari console browser dengan akun Google **di luar tim**.
  Expected: muncul pemilih akun Google, lalu kembali ke `http://localhost:3000/auth/selesai?code=…` (boleh 404 bila halaman Ari belum ada), dan user baru muncul di Supabase → Authentication → Users.

### Task 2: 0004 bagian A — peran, `daftar`, RLS, pembersihan (±45 menit)

**Files:**
- Create: `supabase/migrations/0004_v9_google.sql`
- Modify: `supabase/tests/uji_rls.sql` (setup :8-21, Bagian A :52-65, Bagian B :70-108; hapus Bagian C :110-123)
- Modify: `supabase/tests/uji_eskalasi.sql:8-10`

**Interfaces:**
- Produces: `public.daftar(p_peran text) returns text`; `profil.peran text not null check in ('fisioterapis','pasien')`; `klaim_pasien` dengan galat `belum_daftar`; `buat_sandbox` hilang.

- [ ] **Step 1: Tulis ulang setup + Bagian A/B di `uji_rls.sql`.** Hapus Bagian C lama (sandbox). Setup baru, menggantikan baris 8-21:

```sql
insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@uji.local', '{"full_name":"Terapis A"}'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@uji.local', '{"name":"Terapis B"}'),
  ('dddddddd-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p@uji.local', '{"full_name":"Pasien P"}'),
  ('cccccccc-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@uji.local', '{}');

do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000000","role":"authenticated"}', true);
  assert public.daftar('fisioterapis') = 'fisioterapis', 'daftar A';
  assert public.daftar('fisioterapis') = 'fisioterapis', 'daftar A idempoten';
  begin
    perform public.daftar('pasien');
    raise exception 'GAGAL: A bisa ganti peran';
  exception when others then
    if sqlerrm not like '%peran_lain%' then raise; end if;
  end;
  perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000000","role":"authenticated"}', true);
  perform public.daftar('fisioterapis');
  perform set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000000","role":"authenticated"}', true);
  assert public.daftar('pasien') = 'pasien', 'daftar P';
  assert (select nama from public.profil where id = 'aaaaaaaa-0000-0000-0000-000000000000') = 'Terapis A', 'nama dari full_name';
  assert (select nama from public.profil where id = 'bbbbbbbb-0000-0000-0000-000000000000') = 'Terapis B', 'nama dari name';
  assert not exists (select 1 from public.profil where id = 'cccccccc-0000-0000-0000-000000000000'), 'tanpa sign up = tanpa profil';
end $$;
-- lalu insert 2 baris pasien seperti baris 19-21 lama (P terikat ke Pasien A)
```

Perubahan di Bagian A dan B:
- Semua claims `dddd…`: buang `"is_anonymous":true`.
- Bagian A, blok terapis A: tambah percobaan `update public.profil set peran = 'pasien' where id = 'aaaa…'`, yang harus jatuh ke `insufficient_privilege`.
- Bagian A, blok P: percobaan insert `pasien` sekarang harus jatuh ke `insufficient_privilege` (RLS), bukan `foreign_key_violation`.
- Bagian B, di awal sebelum nyeri P: sebagai A, `assert public.lapor_nyeri('33333333-…', 0) = false, 'terapis tidak bisa lapor nyeri'`.
- Bagian B, di akhir: sebagai `cccc…` (tanpa profil), `klaim_pasien('XXXXXXXX','F19-v1','pasien')` harus galat `%belum_daftar%`.

Di `uji_eskalasi.sql`, ganti baris 9-10 dengan insert `auth.users` tanpa metadata role, lalu `insert into public.profil (id, peran, nama) values ('eeeeeeee-0000-0000-0000-000000000000', 'fisioterapis', 'Uji');`.

- [ ] **Step 2: Jalankan `uji_rls.sql` di DB sekarang.**
  Expected: FAIL `function public.daftar(unknown) does not exist`.
- [ ] **Step 3: Tulis bagian A `0004_v9_google.sql`.** Urutan wajib, karena kebijakan bergantung pada kolom:
  1. `drop trigger if exists pengguna_baru on auth.users; drop function if exists public.tangani_pengguna_baru();`
  2. `delete from public.profil where is_demo;` — sandbox lama; cascade ke pasien → sesi → eskalasi.
  3. Lepas perangkat anonim: `update public.pasien set user_id = null, persetujuan_versi = null, persetujuan_waktu = null, persetujuan_oleh = null where user_id in (select id from auth.users where is_anonymous);`
  4. `alter table public.profil add column peran text;` → `update public.profil set peran = 'fisioterapis';` → `alter table public.profil alter column peran set not null, add constraint profil_peran_cek check (peran in ('fisioterapis', 'pasien'));`
  5. `drop policy sesi_sisip on public.sesi;` lalu `alter table public.profil drop column is_demo;` (kebijakan lama memakai kolom itu, jadi harus dibuang dulu).
  6. Buat ulang `sesi_sisip` dan ganti `pasien_sisip` (`drop policy` + `create policy`) persis spec §8.3.
  7. `drop function if exists public.buat_sandbox();`
  8. `create or replace` `daftar` (spec §8.4), `klaim_pasien` (spec §8.5, tiga cek peran), `lapor_nyeri` (spec §8.5, tanpa cabang demo).
  9. `revoke execute on function public.daftar(text) from public, anon; grant execute on function public.daftar(text) to authenticated;` (`klaim_pasien` dan `lapor_nyeri` mempertahankan GRANT dari 0002).
- [ ] **Step 4: Jalankan 0004, lalu `uji_rls.sql` dan `uji_eskalasi.sql`.**
  Expected:
  - `uji_rls.sql` selesai tanpa exception (ROLLBACK).
  - `uji_eskalasi.sql` menampilkan tabel harapan lama (memburuk 8/7/12.5/8, stabil_nyeri kosong, uji_berderau 8/7, uji_median 8/7/15), lalu terbuka 0 dan total 1.
  - `select count(*) from public.profil where peran is null` = 0.
  - `select count(*) from public.pasien p join auth.users u on u.id = p.user_id where u.is_anonymous` = 0.
- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_v9_google.sql supabase/tests/uji_rls.sql supabase/tests/uji_eskalasi.sql
git commit -m "feat(db): peran Google via daftar, hapus trigger daftar dan sandbox (V9)"
```

### Task 3: 0004 bagian B — `isi_contoh` (±30 menit)

**Files:**
- Modify: `supabase/migrations/0004_v9_google.sql` (tambah di akhir)
- Modify: `supabase/tests/uji_rls.sql` (Bagian C baru sebelum `rollback`)

**Interfaces:**
- Produces: `public.isi_contoh() returns int` (selalu 5); galat `bukan_fisioterapis`. Dipakai Task 5.

- [ ] **Step 1: Tulis Bagian C di `uji_rls.sql`.**

```sql
do $$ begin
  perform set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000000","role":"authenticated"}', true);
  begin
    perform public.isi_contoh();
    raise exception 'GAGAL: pasien bisa isi_contoh';
  exception when others then
    if sqlerrm not like '%bukan_fisioterapis%' then raise; end if;
  end;

  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000000","role":"authenticated"}', true);
  assert public.isi_contoh() = 5, 'isi pertama';
  assert (select count(*) from public.pasien where is_sintetis) = 5, '5 pasien sintetis';
  assert (select count(*) from public.v_prioritas where eskalasi_terbuka) = 1, 'Wayan eskalasi';
  update public.eskalasi set ditinjau = now(), ditinjau_oleh = 'aaaaaaaa-0000-0000-0000-000000000000', keputusan = 'lanjutkan' where ditinjau is null;
  assert (select count(*) from public.v_prioritas where eskalasi_terbuka) = 0, 'tinjau menutup';
  assert public.isi_contoh() = 5, 'atur ulang';
  assert (select count(*) from public.pasien where is_sintetis) = 5, 'tidak menggandakan';
  assert (select count(*) from public.v_prioritas where eskalasi_terbuka) = 1, 'eskalasi pulih';
  assert exists (select 1 from public.pasien where id = '11111111-0000-0000-0000-000000000000'), 'pasien non-sintetis utuh';

  perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000000","role":"authenticated"}', true);
  assert (select count(*) from public.pasien) = 1, 'B tidak terpengaruh';
end $$;
```

- [ ] **Step 2: Jalankan.**
  Expected: FAIL `function public.isi_contoh() does not exist`.
- [ ] **Step 3: Tambah `isi_contoh` ke 0004** persis spec §8.8: `for update` pada baris profil peran fisioterapis, `delete … where terapis_id = v_uid and is_sintetis`, 5 pasien (Wayan/Made/Nyoman/Ketut/Komang, pola sama dengan `buat_sandbox` lama), `return 5`, lalu revoke/grant.
- [ ] **Step 4: Jalankan bagian B 0004 dan `uji_rls.sql`.**
  Expected: selesai tanpa exception.
- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_v9_google.sql supabase/tests/uji_rls.sql
git commit -m "feat(db): isi_contoh untuk Isi/Atur ulang data contoh (F16 V9)"
```

### Task 4: `lib/supabase.ts` V9 + buang sisa demo di UI (±40 menit)

**Files:**
- Create: `lib/peran.ts` (tipe `Peran`, `petakanPeran`, `bangunRedirect`, `pesanGalat`; tanpa impor Supabase, supaya `node --test` tidak membuat klien auth)
- Create: `lib/peran.test.ts`
- Modify: `lib/supabase.ts` (opsi klien, `masukGoogle`, `cekPeran`; pindahkan `pesanGalat` ke `peran.ts` dan ekspor ulang `export { pesanGalat, type Peran } from './peran.ts'`, supaya impor pemakai lama tidak berubah)
- Modify: `app/terapis/page.tsx:156-171` (hapus spanduk), `app/terapis/pasien/[id]/page.tsx:2097-2121` (hapus blok demo), `:1916-1917` dan `:2062` (teks)

**Interfaces:**
- Consumes: `daftar`, `profil.peran` (Task 2).
- Produces: semua yang ada di "Kontrak untuk Ari", plus fungsi murni di `lib/peran.ts`: `petakanPeran(uid: string, profil: { peran: 'fisioterapis' | 'pasien'; nama: string } | null, pasienId: string | null): Peran`, `lanjutAman(l: string | null | undefined): string | null` (dipakai juga oleh `/auth/selesai` milik Ari, yang membaca `lanjut` dari URL), dan `bangunRedirect(origin: string, o: { peran?: 'fisioterapis' | 'pasien'; lanjut?: string }): string`.

- [ ] **Step 1: Tulis `lib/peran.test.ts`.**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { petakanPeran, bangunRedirect, lanjutAman, pesanGalat } from './peran.ts';

test('petakanPeran: terapis, pasien, pasien_baru, tanpa_peran', () => {
  assert.deepEqual(petakanPeran('u1', { peran: 'fisioterapis', nama: 'Ayu' }, null), { jenis: 'terapis', uid: 'u1', nama: 'Ayu' });
  assert.deepEqual(petakanPeran('u2', { peran: 'pasien', nama: 'P' }, 'p9'), { jenis: 'pasien', uid: 'u2', pasienId: 'p9' });
  assert.deepEqual(petakanPeran('u2', { peran: 'pasien', nama: 'P' }, null), { jenis: 'pasien_baru', uid: 'u2' });
  assert.deepEqual(petakanPeran('u3', null, null), { jenis: 'tanpa_peran', uid: 'u3' });
});

test('bangunRedirect: peran + lanjut internal', () => {
  assert.equal(bangunRedirect('https://x.app', { peran: 'pasien', lanjut: '/k/ABCD1234' }),
    'https://x.app/auth/selesai?peran=pasien&lanjut=%2Fk%2FABCD1234');
  assert.equal(bangunRedirect('https://x.app', {}), 'https://x.app/auth/selesai');
});

test('bangunRedirect: lanjut eksternal dibuang', () => {
  for (const l of ['//evil.com', '/\\evil.com', 'https://evil.com', 'evil.com']) {
    assert.equal(bangunRedirect('https://x.app', { lanjut: l }), 'https://x.app/auth/selesai');
    assert.equal(lanjutAman(l), null);
  }
  assert.equal(lanjutAman('/k/ABCD1234'), '/k/ABCD1234');
  assert.equal(lanjutAman(null), null);
});

test('pesanGalat: kode V9', () => {
  assert.match(pesanGalat({ message: 'peran_lain' }), /peran lain/);
  assert.match(pesanGalat({ message: 'belum_daftar' }), /Sign Up as Pasien/);
  assert.match(pesanGalat({ message: 'akun_terapis' }), /akun Google lain/);
  assert.match(pesanGalat({ message: 'bukan_fisioterapis' }), /fisioterapis/);
  assert.equal(pesanGalat({ message: 'sandbox_hanya_anonim' }), 'Terjadi galat, coba lagi');
});
```

- [ ] **Step 2: Jalankan `npm test`.**
  Expected: FAIL `petakanPeran` / `bangunRedirect` tidak diekspor.
- [ ] **Step 3: Implementasi di `lib/peran.ts` + `lib/supabase.ts`.**
  - Opsi `createClient` sesuai Global Constraints.
  - `lanjutAman`: kembalikan `l` bila lolos `/^\/(?![\/\\])/`, selain itu `null`. `bangunRedirect` memakai `lanjutAman`; tanpa parameter berarti tanpa `?`.
  - `masukGoogle(o = {})`: `signInWithOAuth` dengan `redirectTo: bangunRedirect(location.origin, o)` dan `prompt: 'select_account'`.
  - `cekPeran`: penanganan `luring`/`keluar` yang ada dipertahankan. `profil` di-select `'peran, nama'`. Query `pasien` hanya bila peran `pasien`. Hasil akhir lewat `petakanPeran`.
  - `pesanGalat`: hapus empat kode lama (lihat Inventaris), lalu tambah:

| `message` | Teks |
|---|---|
| `peran_lain` | Akun Google ini sudah terdaftar dengan peran lain. Pakai akun Google lain untuk peran ini. |
| `belum_daftar` | Akun ini belum terdaftar. Pilih "Sign Up as Pasien" dulu. |
| `bukan_fisioterapis` | Hanya akun fisioterapis yang bisa mengisi data contoh. |
| `akun_terapis` | Akun ini terdaftar sebagai fisioterapis. Keluar, lalu masuk dengan akun Google lain untuk menjadi pasien. |
| `sudah_terikat` | Akun ini sudah terhubung ke pasien lain. Hapus data dulu di beranda, atau masuk dengan akun Google lain. |
| `tidak_terikat` | Akun ini belum terhubung ke pasien. |

- Hapus spanduk sandbox dan blok "Latih sebagai pasien ini". Import `Link` tetap dipakai di tempat lain.
- Ganti "perangkat lama" → "akun lama" di dua teks.

- [ ] **Step 4: Verifikasi.** Jalankan `npm test` dan `npx tsc --noEmit`.
  Expected: semua tes lulus; tsc tanpa galat (tidak ada lagi rujukan `.demo` / `anonim`). Lalu jalankan Task 1 Step 4.
- [ ] **Step 5: Commit**

```bash
git add lib/peran.ts lib/peran.test.ts lib/supabase.ts app/terapis/page.tsx "app/terapis/pasien/[id]/page.tsx"
git commit -m "feat(auth): login Google PKCE, peran dari profil, buang sisa sandbox (V9)"
```

Begitu commit ini masuk, kabari Ari: kontrak di atas sudah siap.

### Task 5: Tombol data contoh di `/terapis` (F16, ±30 menit)

**Files:**
- Modify: `app/terapis/page.tsx` (header :184-205, keadaan kosong :241-255)

**Interfaces:**
- Consumes: `supabase.rpc('isi_contoh')` (Task 3), `pesanGalat` (Task 4).

- [ ] **Step 1: Tambah state + handler.** `adaContoh = daftarPasien.some(p => p.is_sintetis)`, `sedangIsiContoh`, `konfirmasiAturUlang`, dan ref penjaga klik ganda (pola `sedangSubmitRef` di `FormResep`). `jalankanIsiContoh()` → `rpc('isi_contoh')` → galat ke `setGalat(pesanGalat(error))`, sukses → `muatData()`.
- [ ] **Step 2: UI.**
  - Tombol sekunder (≥ 44 px) di header, berlabel "Isi data contoh" atau "Atur ulang data contoh" sesuai `adaContoh`. Selama berjalan nonaktif dengan teks "Mengisi…".
  - Kartu kosong diberi tombol kedua "Isi data contoh".
  - "Atur ulang data contoh" membuka dialog `role="alertdialog"` dengan teks persis "Pasien contoh dan semua sesinya dibuat ulang. Ponsel yang terhubung ke pasien contoh harus memindai QR baru." dan tombol "Ya, atur ulang" / "Batal".
- [ ] **Step 3: Verifikasi manual** (akun Google fisioterapis baru):
  - Isi data contoh → 5 baris dengan urutan Wayan, Made, Nyoman, Ketut, Komang, dan Wayan berlencana Eskalasi.
  - Tinjau Wayan → Atur ulang → Ya → lencana Eskalasi kembali.
  - Atur ulang → Batal → tidak ada perubahan.
- [ ] **Step 4: Klik ganda** "Isi data contoh" secepat mungkin.
  Expected: tetap 5 pasien sintetis (cek juga `select count(*) from pasien where terapis_id = '<uid>' and is_sintetis` = 5).
- [ ] **Step 5: Commit**

```bash
git add app/terapis/page.tsx
git commit -m "feat(terapis): tombol Isi/Atur ulang data contoh (F16 V9)"
```

### Task 6: `FormResep` mode tamu (F15, ±30 menit)

**Files:**
- Modify: `components/FormResep.tsx` (props :28-34, state awal :43-59, `handleSubmit` :80-257, render field nama :296 dan sesi/minggu :414, tombol submit)

**Interfaces:**
- Produces:
  - `FormResepProps` mendapat `mode?: 'baru' | 'edit' | 'tamu'` (bawaan: `pasien?.id ? 'edit' : 'baru'`) dan `onKirim?: (r: ResepTamu) => void`.
  - Tipe baru: `export type ResepTamu = { sisi_terdampak: SisiTerdampak; gerakan: JenisGerakan[]; repetisi: number; toleransi_batang: TingkatToleransi; toleransi_bahu: TingkatToleransi; durasi_persen: number; mode_koreksi: 'penuh' | 'mati'; kalimat_condong: PilihanKalimatCondong }`.

- [ ] **Step 1: Implementasi.**
  - Mode tamu: field nama panggilan dan sesi/minggu disembunyikan dan tidak divalidasi.
  - Label sisi jadi "Lengan yang dilatih" dengan opsi "Lengan kiri" / "Lengan kanan".
  - Bawaan bila `pasien` kosong: `['jangkau_depan']`, repetisi **5**, Normal/Normal, 30, `penuh`, `sandaran`.
  - Tombol submit (≥ 64 px) berlabel "Mulai latihan".
  - Submit: validasi yang sama, lalu `onKirim(nilai)` **sinkron, tanpa `await` sebelumnya** dan tanpa panggilan Supabase. `router` tidak dipakai di jalur ini.
- [ ] **Step 2: Verifikasi.** Jalankan `npx tsc --noEmit`, lalu cek manual di halaman uji sementara (atau `/tamu` milik Ari bila sudah ada): ubah ke kedua gerakan, 8 repetisi, Mati, "Tetap tegak" → `onKirim` menerima nilai itu. Tab Network: nol permintaan ke Supabase.
  Expected: tsc tanpa galat; nilai sama persis dengan isian; tanpa permintaan jaringan. Mode baru/edit di `/terapis/pasien/baru` dan detail tetap jalan.
- [ ] **Step 3: Commit**

```bash
git add components/FormResep.tsx
git commit -m "feat(resep): FormResep mode tamu untuk /tamu (F15 V9)"
```

### Task 7: Dokumen + E2E bersama (±45 menit, selesai sebelum G2)

**Files:**
- Modify: `README.md` (A13 + A14)
- Kirim ke Ari: teks persetujuan final (A4) untuk `TEKS_SETUJU` di `lib/naskah.ts`
- DPIA (A12)

- [ ] **Step 1: A4.** Tambahkan ke naskah final dua kalimat dari spec §10.5:
  - Butir 2: "Untuk masuk, email dan nama akun Google Anda disimpan oleh layanan login (Supabase Auth); fisioterapis tidak melihatnya."
  - Butir 4: "melepas akun Anda dari data pasien. Akun login Anda tetap ada sampai fitur hapus akun tersedia."
  Kirim ke Ari. Minta Manta merekam ulang klip I-SETUJU yang teksnya berubah, bila sudah terlanjur direkam.
- [ ] **Step 2: A12 DPIA.** Tambahkan jenis data "email dan nama akun Google di Supabase Auth" dan penerima "Google sebagai penyedia login".
- [ ] **Step 3: A13 README.**
  - Baris pertama "Cara coba": "Alur pasien butuh **akun Google kedua** di HP; satu akun Google hanya untuk satu peran."
  - Tambahkan tautan "Coba latihan tanpa akun".
  - Declaration ditambah "Google OAuth (login)".
- [ ] **Step 4: A14 skrip demo di README.** Laptop: Sign Up as Fisioterapis → Isi data contoh → Pak Wayan (eskalasi, run chart, Ringkasan AI) → pasien baru → QR → HP: Sign Up as Pasien dengan akun Google kedua → persetujuan → latihan → laptop: Muat ulang → Atur ulang data contoh. Siapkan satu HP tim yang sudah login sebagai pasien.
- [ ] **Step 5: E2E di production bersama Ari** (butir G2, spec §2). Jalankan skrip A14, lalu:
  - Akun fisioterapis membuka `/k/KODE` → pesan `akun_terapis`.
  - Klaim Pak Wayan dari HP → Atur ulang → HP menampilkan "belum ada resep", dan sesi antrean yang belum terkirim masuk `rc_gagal`.
  - Login dengan akun di luar tim → sukses.
  Expected: semua lolos tanpa `42501` di console klien yang sah.
- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: README cara coba V9, declaration Google OAuth, skrip demo juri"
```

---

## Catatan untuk spec

- Spec §8 menulis keadaan akhir per file (`daftar` di 0001, `isi_contoh` di 0003). Repo memakai 0004 karena 0001–0003 sudah ada dan mungkin sudah dijalankan. Hasil akhirnya sama.
- Karena 0004 dipakai di sini, migrasi Realtime P1 di spec lengkap §16.5 (`0004_realtime.sql`) jadi **`0005_realtime.sql`**.
- `bangunRedirect` lebih ketat dari spec §10.1 (juga menolak `/\`). Ini pengerasan keamanan, bukan perubahan perilaku.
- Akun email lama milik tim tidak bisa login lagi setelah Email OFF. Data uji mereka dibiarkan; hapus manual di dasbor bila mengganggu.
- `.gitignore` mengabaikan `*.md`, jadi file rencana ini perlu `git add -f` bila ingin di-commit. `README.md` sudah terlacak, jadi aman.
