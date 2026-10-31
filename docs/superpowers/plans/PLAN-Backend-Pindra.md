# Rencana Implementasi Backend ReminiCare (Pindra)

Dasar: `SPEC-ReminiCare-ramping.md` v1.0 (§2 jadwal, §4 setup, §8 SQL, §9 F20, §10.2–10.4 dasbor, §12 uji), dengan konteks dari `PRD-ReminiCare - v15.md`. Semua jam WITA. Rencana ini tidak menambah fitur di luar P0; yang ditambahkan hanya urutan kerja, cara uji, kontrak antar-anggota, dan catatan jebakan.

---

## 0. Lingkup kamu

| Area | File | Fitur |
|---|---|---|
| Infra | Supabase, Vercel, Gemini, repo | §4.1–4.3 |
| Skema + RLS + trigger daftar | `supabase/migrations/0001_skema.sql` | F01, F11 (tabel sesi), F12 (view), RLS |
| RPC | `supabase/migrations/0002_fungsi.sql` | F03, F10 (nyeri), F19 |
| Sintetis + eskalasi + sandbox | `supabase/migrations/0003_sintetis.sql` | F14, F16, §10 PRD |
| Klien data + guard peran | `lib/supabase.ts` | dipakai semua halaman |
| Dasbor | `app/terapis/page.tsx`, `app/terapis/pasien/baru/page.tsx`, `app/terapis/pasien/[id]/page.tsx` | F12, F02, F13, F14, F03 (QR) |
| Komponen | `components/FormResep.tsx`, `components/Grafik.tsx` | F02, F10/F13/F14 |
| Ringkasan AI | `app/api/ringkasan/route.ts`, `lib/ringkasan.ts`, `lib/ringkasan.test.ts` | F20 |
| Config | `next.config.ts` (`headers()` cache MediaPipe) | F18 |
| Uji SQL (usulan) | `supabase/tests/uji_rls.sql`, `supabase/tests/uji_eskalasi.sql` | §12.1–12.2 |
| Dokumen | naskah F19 (A4), DPIA (A12), README + AI Declaration (A13), skrip demo (A14), deck (A17) | — |

Bukan milik kamu, tetapi memanggil backend kamu: `/k/[kode]`, `/pasien`, `lib/antrean.ts`, `Sesi.tsx` (Ari); `lib/kinematik/*`, `/uji` (Manta). Kontraknya ada di §4.

---

## 1. Yang perlu diketahui sebelum mulai

### 1.1 PRD v1.5 vs spec (v1.7)
Spec diturunkan dari PRD v1.7, sedangkan file PRD di repo ini v1.5. Untuk backend, bedanya ada di **F14**:

| | PRD v1.5 | Spec (dipakai) |
|---|---|---|
| Aturan | % gabungan 3 sesi terakhir ≥ 3 sesi pertama + 20 poin, ≥ 15 repetisi per jendela | Median 6 titik pertama sejak tinjauan terakhir; eskalasi bila run berturut-turut di atas median > `round(log2(n) + 3)` |
| Titik data | sesi `rep_terukur > 0`, minimal 6 | sesi `rep_terukur ≥ 5`, minimal 7 |
| Kolom `eskalasi` | `pct_baseline, pct_terakhir` | `median_baseline, panjang_run, batas` |

Ikuti spec. SQL di spec §8.6 sudah memakai aturan baru.

### 1.2 Hasil cek saya atas SQL dan route di spec
Ini catatan, bukan pemblokir. Butir yang bertanda ⚠ perlu ditangani saat menulis kode.

1. **Angka sandbox sudah saya hitung ulang dan cocok.** Pak Wayan: median baseline 12,5. Di sesi 12, run 7 belum melewati batas 7. Di sesi 13, run 8 > batas `round(log2(13) + 3) = 7`, jadi eskalasi terbuka. `uji_berderau` memicu di sesi 13 dan `uji_median` di sesi 16 (n = 14, dua titik = 15 dilewati). Kepatuhan pasien sintetis = 3 sesi dalam 7 hari (jarak 56 jam), dan urutan F12 Wayan → Made → Nyoman → Ketut (15) → Komang (5) benar.
2. ⚠ **Body Gemini di spec §9 masih pseudo.** Bentuk REST `generateContent` yang benar ada di §3 Fase 7. Bila model Flash yang dipin punya mode thinking, token berpikir ikut memakan `maxOutputTokens: 400`. Akibatnya keluaran terpotong, `cekKalimat` gagal, dan yang selalu tampil templat. Atur thinking sesuai dokumentasi model itu saat pin di J0.
3. ⚠ **GRANT insert `sesi` sengaja untuk seluruh tabel.** Klien sebenarnya bisa mengisi `is_sintetis` atau `nyeri` sendiri. Jangan dipersempit ke GRANT per kolom tanpa koordinasi, karena `BarisSesi` dari `agregatSesi` (milik Manta) mengirim `nyeri: null` dan `is_sintetis: false`, dan GRANT per kolom akan membuat upsert itu gagal `42501`. Untuk P0 dibiarkan saja.
4. **`ditinjau` diisi jam klien** (`new Date().toISOString()`). Jam perangkat yang meleset bisa menggeser batas "sesi sejak tinjauan". Risikonya kecil untuk demo. Bila ada waktu, RPC kecil `tinjau_eskalasi(id, keputusan, catatan)` dengan `now()` server lebih rapi (statusnya [default spec], boleh diubah).
5. ⚠ **Upsert `ignoreDuplicates` + RLS.** Kirim ulang baris sesi yang sama harus sukses tanpa galat dan tetap menghasilkan 1 baris. Uji dari klien asli di G1, jangan hanya dari SQL editor.
6. ⚠ **Next.js terbaru: `params` di page adalah Promise.** Karena halaman dasbor adalah client component (data diambil di browser), pakai `useParams()` dari `next/navigation`.
7. ⚠ **Trigger daftar adalah titik gagal tunggal.** Galat di `tangani_pengguna_baru` memblokir semua `signUp` dan `signInAnonymously`. Uji pertama kali pukul 19.00, sebelum yang lain.
8. **Pesan galat RPC** muncul di supabase-js sebagai `error.message` (misalnya `'kode_tidak_sah'`, kode `P0001`), jadi pemetaan pesan cukup mencocokkan `message`.

---

## 2. Jadwal kolom Pindra

| Jam | Kerja | Keluaran / siapa yang menunggu |
|---|---|---|
| 17.00–18.00 | Fase 0: repo, Supabase, Vercel, Gemini, `next.config.ts` | Env siap untuk Ari; header cache untuk Manta |
| 18.00–19.00 | Fase 1: `0001_skema.sql` | — |
| **19.00** | **Uji trigger daftar + RLS 2 akun** | Lulus = Ari boleh menyambung auth |
| 19.00–20.00 | Fase 2: `0002_fungsi.sql`, `lib/supabase.ts` | Ari: `/`, `/k/[kode]` |
| 20.00–21.00 | Fase 3: `FormResep`, `/terapis/pasien/baru`, `/terapis` | — |
| **21.00** | **Draf naskah F19 (A4) ke Manta + Ari** | Manta rekam I-SETUJU pukul 00.30 |
| 21.00–22.00 | Fase 4a: `Grafik.tsx` | **Ari butuh pukul 22.00** (F10) |
| 22.00–22.30 | Fase 4b: `0003_sintetis.sql` | — |
| **22.30** | **Uji eskalasi SQL (§5.2)** | Butir G1 "Pak Wayan eskalasi" |
| 22.30–23.00 | Fase 4c: detail pasien, tombol tautan + QR (F03) | Ari bisa uji klaim |
| 23.00–24.00 | Fase 5: detail (tabel sesi + grafik tren F13); kerangka README 23.30 | — |
| **24.00 G1** | Cek butir G1 bagian kamu (§6) | — |
| 00.00–00.30 | F13 lanjut; **naskah F19 final 00.00** | — |
| 00.30–01.30 | Fase 6: run chart + Tinjau (F14) | — |
| 01.30–03.00 | Fase 7: F20 (`lib/ringkasan.ts` + tes + route + kartu UI) | — |
| 03.00–04.00 | Fase 8: RLS ulang + advisors, uji payload F20, DPIA (A12), skrip demo (A14) | Skrip demo dipakai semua pukul 04.00 |
| 04.00–05.00 | Semua: skrip demo E2E di production, perbaiki yang merah | — |
| **05.00 G2** | Feature freeze | — |
| 05.00–05.30 | **Subjek S1** di `/uji` | Manta setel ambang |
| 05.30–07.00 | Bug / P1 (hanya bila G2 hijau) | — |
| 07.00–07.30 | p95 latensi per jalur suara dari log `/uji` | README + deck |
| 07.30–08.00 | Uji §11.2 yang tersisa | — |
| 08.00–09.45 | README final + AI Use Declaration (09.30), pitch deck (09.45) | — |
| **10.00** | Smoke test production, cek batas anon (R8), buka dasbor Supabase (R7) | — |
| 10.30 / 10.45 | Tag `submission-24h` (tim) / submit Devpost | — |

**Bila terlambat, urutan potong** (yang paling akhir dipotong lebih dulu):
1. Wajib G1: 0001 + RLS, 0002, `lib/supabase.ts`, 0003 + sandbox, dan jalur simpan sesi.
2. Wajib G2: `/terapis`, `FormResep`, QR, Tinjau, F20 (jalur **templat dulu**, Gemini menyusul), hapus data.
3. Bisa disederhanakan: grafik metrik kinematik (tampilkan angka dulu), tabel sesi sebelum grafik tren.

---

## 3. Rincian per fase

### Fase 0: Setup (17.00–18.00)

- [ ] Repo `MantaYuana/ReminiCare` publik, lisensi MIT (kemungkinan sudah ada; cek saja).
- [ ] Supabase: proyek baru region **ap-southeast-1**.
  - Auth → Email ON, **Confirm email OFF**, Anonymous sign-ins ON.
  - Auth → Rate limits: anonymous sign-ins dinaikkan ke **200/jam** (bawaan 30/jam/IP).
  - Catat Project URL + **publishable key** (`sb_publishable_…`). Service role key tidak disalin ke mana pun.
- [ ] Vercel: impor repo, isi env `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`. Deploy "hello", lalu catat URL production (dipakai QR dan README).
- [ ] `.env.local` lokal dengan isi yang sama; pastikan `.env*` ada di `.gitignore`.
- [ ] Gemini: kunci dari Google AI Studio. Salin **nama model Flash persis** dari daftar model ke `GEMINI_MODEL`. Catat apakah model itu punya mode thinking dan parameter apa yang mematikan atau mengecilkannya.
- [ ] `next.config.ts` → `headers()`: source `/mediapipe/:path*`, header `Cache-Control: public, max-age=31536000, immutable`. File ini milikmu; isinya untuk Manta.
- [ ] Bila tidak sempat 18.00, kirim env ke Ari lewat kanal privat. Jangan lewat repo.

### Fase 1: `0001_skema.sql` (18.00–19.00)

Urutan isi file, sesuai spec §8.1–8.4:
1. Tabel `profil`, `pasien` (+ indeks `terapis_id`), `sesi` (+ indeks `(pasien_id, mulai)`, `pct_terkompensasi` generated **stored**), `eskalasi` (+ indeks, unique index satu eskalasi terbuka per pasien).
2. View `v_prioritas with (security_invoker = true)`.
3. `enable row level security` di 4 tabel + semua kebijakan.
4. GRANT eksplisit ke `authenticated` (termasuk GRANT per kolom untuk `pasien` dan `eskalasi`).
5. Trigger daftar `tangani_pengguna_baru` + `revoke execute`.

Jalankan di SQL editor. Bila skema perlu diubah setelah jalan: **sebelum G2** boleh drop objek `public` lalu jalankan ulang (belum ada data juri). **Setelah G2**, tulis migrasi baru `0004_…` saja.

**19.00, uji:**
- [ ] Jalur auth asli lewat REST (§5.3): daftar terapis → baris `profil` muncul; anonymous sign-in → sukses dan **tanpa** baris `profil`.
- [ ] `supabase/tests/uji_rls.sql` (§5.1) bagian A (tanpa RPC) lolos.

### Fase 2: `0002_fungsi.sql` + `lib/supabase.ts` (19.00–20.00)

- [ ] RPC `klaim_pasien(p_kode, p_versi, p_oleh)`, `buat_kode(p_pasien_id)`, `lapor_nyeri(p_sesi_id, p_nilai)`, `cabut_persetujuan()` persis spec §8.5, semuanya `security definer` + `set search_path = ''`, `revoke` dari `public, anon`, `grant` ke `authenticated`.
- [ ] Jalankan `uji_rls.sql` bagian B (RPC).
- [ ] `lib/supabase.ts` (kontrak di §4.1): singleton klien browser, `cekPeran()`, `pesanGalat()`. Kirim ke Ari begitu jadi, karena Ari butuh untuk `/` dan `/k/[kode]`.

### Fase 3: Resep + daftar prioritas (20.00–21.00)

- [ ] `components/FormResep.tsx`: field sesuai spec §10.3. Mode koreksi **hanya Penuh/Mati** di P0. Validasi di klien sama dengan constraint DB (nama 1–40 karakter, repetisi 5–20, sesi/minggu 1–7, durasi 10–80, gerakan minimal 1). Mode baru → `insert(...).select('id').single()` → `router.push('/terapis/pasien/' + id)`. Mode edit → `update` + teks "Berlaku mulai sesi berikutnya". Ukuran tombol dan teks sesuai NFR-6.
  - Insert wajib mengirim `terapis_id: uid`, karena GRANT insert memuat kolom itu dan RLS mengeceknya.
- [ ] `/terapis/pasien/baru`: guard terapis, lalu `<FormResep />`.
- [ ] `/terapis` (F12):
  - Guard: `cekPeran()` harus `terapis`; selain itu `router.replace('/')`.
  - Query `v_prioritas` dengan urutan spec §8.2:
    ```ts
    supabase.from('v_prioritas').select('*')
      .order('eskalasi_terbuka', { ascending: false })
      .order('lencana_nyeri', { ascending: false })
      .order('jarang', { ascending: false })
      .order('pct_terakhir', { ascending: false, nullsFirst: false })
    ```
  - Baris: nama, lencana teks + ikon (Eskalasi, Nyeri, Jarang latihan, Data sintetis), % terakhir, "X dari Y sesi 7 hari".
  - Tombol "Pasien baru", "Muat ulang", "Keluar" (`signOut` → `/`). Muat ulang juga saat `focus` dan `visibilitychange` (visible). Spanduk "Sandbox juri" bila `demo`.
- [ ] **21.00: kirim draf naskah F19** (sekitar 5 paragraf, kerangka spec §10.5, versi `F19-v1`). Tentukan masa simpan (placeholder spec: sampai pasien menghapus atau proyek demo ditutup, paling lama 90 hari). Satu paragraf = satu klip `I-SETUJU-n`, jadi pakai kalimat pendek yang enak dibacakan.

### Fase 4: Grafik, sintetis, QR (21.00–23.00)

**4a. `components/Grafik.tsx` (siap 22.00 untuk Ari).** SVG murni, `viewBox` responsif, kontras 3:1, bentuk titik + label (bukan warna saja), `role="img"` + `aria-label`. Props di §4.3. Uji dengan 3 kasus: F10 (7 titik "% benar"), F13 (bentuk P/M), F14 (garis acuan median + titik tebal).

**4b. `0003_sintetis.sql`.** Isinya `cek_eskalasi()` + trigger `sesi_cek_eskalasi`, `isi_sintetis(p_pasien_id, p_pola)`, `buat_sandbox()`, revoke/grant (spec §8.6–8.8). Urutannya: trigger dibuat **sebelum** `isi_sintetis` dipakai, supaya eskalasi ikut teruji.

**22.30, uji eskalasi** dengan `supabase/tests/uji_eskalasi.sql` (§5.2). Lalu uji sandbox dari klien: anonymous sign-in → `rpc('buat_sandbox')` → `/terapis` menampilkan 5 pasien dengan urutan dan lencana benar. Panggilan kedua harus idempoten (tanpa duplikat).

**4c. Detail pasien, kerangka + tautan perangkat (F03).**
- `rpc('buat_kode', { p_pasien_id })` → tautan `${location.origin}/k/${kode}` → `QRCode.toDataURL(tautan)` → tampilkan tautan, QR, tanggal kedaluwarsa (`now + 7 hari`, atau baca ulang `kode_kedaluwarsa` dari baris pasien), dan peringatan "Kode lama dibatalkan dan perangkat lama dilepas".
- Kabari Ari bahwa alur klaim sudah bisa diuji ujung ke ujung.

### Fase 5: Detail pasien F13 (23.00–00.30)

Muat paralel (satu fungsi `muat()`, dipanggil ulang setelah setiap aksi):
```ts
const [pasien, sesi, eskalasi, prioritas] = await Promise.all([
  supabase.from('pasien').select('*').eq('id', id).maybeSingle(),
  supabase.from('sesi').select('id, mulai, resep, rep_total, rep_terukur, rep_terkompensasi, pct_terkompensasi, per_gerakan, pct_tak_terukur, nyeri, is_sintetis').eq('pasien_id', id).order('mulai'),
  supabase.from('eskalasi').select('*').eq('pasien_id', id).order('dibuka'),
  supabase.from('v_prioritas').select('sesi_7_hari, sesi_per_minggu').eq('pasien_id', id).maybeSingle(),
]);
```
`pasien` null berarti bukan milikmu atau tidak ada; tampilkan "Pasien tidak ditemukan" dan tombol kembali.

Bagian, berurutan (spec §10.4):
1. Kepala: nama, sisi, lencana "Data sintetis".
2. (Fase 6) Eskalasi terbuka + run chart + Tinjau.
3. Tren % terkompensasi per sesi. Bentuk titik dari `sesi.resep.mode_koreksi`: bulat "P" = Penuh, kotak "M" = Mati.
4. Tabel 10 sesi terakhir: tanggal, %, mode, nyeri, % tak terukur, lencana sintetis per sesi. Kepatuhan "7 hari: X dari Y".
5. Metrik kinematik per gerakan: grafik median waktu gerak dari `per_gerakan[g].waktu_gerak_median`. `v_puncak_median` dan `n_puncak_median` hanya sebagai angka berlabel "kurang andal". Keterangan "2D, untuk tren pasien ini saja". Penanda bahu berlabel "penanda lemah".
6. (Fase 7) Kartu Ringkasan AI.
7. Tautan perangkat (Fase 4c).
8. Edit resep (`<FormResep pasien={...} />`).
9. Bila `demo`: tombol "Latih sebagai pasien ini" → `/pasien/sesi?pasien={id}` (halaman milik Ari).

**23.30:** kerangka README (A13), cukup judul bagian dulu.

### Fase 6: Run chart + Tinjau F14 (00.30–01.30)

- `tinjauTerakhir = max(eskalasi.ditinjau)`, dan `terbuka = eskalasi.find(e => !e.ditinjau)`.
- Titik run chart = sesi dengan `mulai > tinjauTerakhir` (atau semua bila belum pernah ditinjau) **dan** `rep_terukur ≥ 5`, sama dengan definisi titik data di trigger. Sesi lain dihitung untuk catatan "N sesi < 5 repetisi terukur tidak dihitung".
- Garis putus-putus "median baseline {m}%", titik yang id-nya ada di `sesi_pemicu` ditebalkan, teks "run {panjang_run} > batas {batas}". Di bawah grafik: tabel tanggal, %, repetisi terukur, % tak terukur, nyeri.
- **Tinjau**: 3 pilihan besar (Lanjutkan / Ubah resep / Jadwalkan tatap muka) + catatan opsional + Simpan:
  ```ts
  await supabase.from('eskalasi')
    .update({ ditinjau: new Date().toISOString(), ditinjau_oleh: uid, keputusan, catatan: catatan || null })
    .eq('id', terbuka.id);
  await muat();
  ```
  Pilihan "Ubah resep" sekaligus menggulir ke `FormResep`.
- Uji: tinjau Pak Wayan → lencana Eskalasi hilang dari `/terapis`; satu sesi baru tidak membuka ulang eskalasi.

### Fase 7: F20 Ringkasan AI (01.30–03.00)

Kerjakan **berurutan**, supaya kartu sudah jalan dengan templat sebelum Gemini disambung:

1. **`lib/ringkasan.ts`** (fungsi murni, aturan `node --test`: impor `.ts` relatif, tanpa `@/`, tanpa DOM):
   - Tipe `MasukanRingkasan` (spec §9).
   - `bangunMasukan(pasien, sesi, esk, kini)`: hanya hari relatif (`hari_lalu`), tanpa nama, ID, atau tanggal. Angka dibulatkan 1 desimal (waktu gerak 2 desimal). Hanya waktu gerak yang dikirim, tanpa `v_puncak`/`n_puncak`.
   - `norm`, `angkaSah`, `cekAngka`, `cekKalimat` (3–5 kalimat), `templat` (spec §9). Templat harus menangani `null` (misalnya "sesi terakhir belum terukur") tanpa memunculkan angka yang tidak ada di masukan.
2. **`lib/ringkasan.test.ts`**, 3 tes wajib: angka asing → `cekAngka` false; koma desimal → true; invarian `cekAngka(templat(m), angkaSah(m)) === true`, diuji untuk masukan kosong, tanpa eskalasi, dan dengan eskalasi.
3. **`app/api/ringkasan/route.ts`**, langkah 1–12 spec §9. Kerangka:
   ```ts
   export async function POST(req: Request) {
     const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
     if (!token) return Response.json({ galat: 'tanpa_token' }, { status: 401 });
     const sb = createClient(URL, PUBLISHABLE_KEY, {
       global: { headers: { Authorization: `Bearer ${token}` } },
       auth: { persistSession: false },
     });
     const { data: { user } } = await sb.auth.getUser(token);
     if (!user) return Response.json({ galat: 'token_tidak_sah' }, { status: 401 });
     // validasi uuid → 400; baca pasien → null / bukan milik → 403; baca sesi 14 hari + eskalasi terbuka
     // masukan = bangunMasukan(...); tanpa kunci → templat 'tanpa_kunci'
     // panggil Gemini (di bawah); galat/timeout → 'api_gagal'; cekKalimat → 'kalimat'; cekAngka → 'angka_tidak_cocok'
   }
   ```
   Panggilan Gemini dalam bentuk REST yang benar:
   ```ts
   const res = await fetch(
     `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent`,
     {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
       body: JSON.stringify({
         systemInstruction: { parts: [{ text: PROMPT }] },
         contents: [{ role: 'user', parts: [{ text: JSON.stringify(masukan) }] }],
         generationConfig: { temperature: 0.2, maxOutputTokens: 400 /* + pengaturan thinking sesuai model yang dipin */ },
       }),
       signal: AbortSignal.timeout(8000),
     },
   );
   if (!res.ok) throw new Error(`gemini ${res.status}`);
   const data = await res.json();
   const teks = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
   ```
   Respons selalu `200 { sumber, teks, alasan?, masukan }`. `masukan` ikut dikembalikan supaya isi yang dikirim ke Gemini terbukti di tab Network.
4. **Kartu UI** di detail: tombol "Ringkasan AI" → `fetch('/api/ringkasan', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ pasien_id }) })`. Label "Ringkasan AI, cek grafik sebelum memutuskan" atau "Ringkasan templat, cek grafik sebelum memutuskan".

### Fase 8: Pengerasan + dokumen (03.00–04.00)

- [ ] Jalankan ulang `uji_rls.sql` lengkap + `uji_eskalasi.sql` di production.
- [ ] Supabase → Advisors (Security + Performance): nol peringatan RLS mati, search_path, atau security definer view. Peringatan `auth_rls_initplan` tidak boleh ada, karena semua kebijakan memakai `(select auth.uid())`.
- [ ] F20: tab Network (`masukan` tanpa nama/ID); manipulasi angka di tes → templat; `npm run build` lalu cari kunci di bundel: `grep -r "AIza" .next/static` harus kosong.
- [ ] Route tanpa token → 401; token terapis lain → 403.
- [ ] Batas anon: sandbox + klaim dari beberapa perangkat di satu Wi-Fi tanpa 429 (04.30).
- [ ] **DPIA 1 halaman (A12)**: pemrosesan, jenis data (data kesehatan = data pribadi spesifik), tujuan, dasar persetujuan, penerima (Supabase Singapura, Vercel, Gemini untuk agregat), transfer ke luar negeri (PP 33/2026 Pasal 160–162), risiko + mitigasi, retensi, hak subjek, status prototipe data sintetis.
- [ ] **Skrip demo (A14)**: sandbox → pasien baru → QR di HP → persetujuan + klaim → latihan → sesi muncul di dasbor → Tinjau → Ringkasan AI → Hapus data → klaim ulang. Dipakai di G2, video, dan penjurian.

### Fase 9: Setelah G2

- 05.00–05.30 jadi subjek S1. 07.00–07.30 hitung p95 latensi per jalur suara dari CSV `/uji`.
- README final 09.30: apa ini, URL, cara coba (tamu, juri), arsitektur, privasi + bukti Network, tabel hasil uji (A11), batas klaim + regulasi (PRD §2), keterbatasan (wawancara tidak dilakukan; `cekAngka` tidak mengecek angka yang ditulis sebagai kata), aset pra-Hacking Day, lisensi MIT, dan **kalimat NFR-5 apa adanya**: "Data sintetis, server Singapura; lokasi penyimpanan untuk deployment klinis akan disesuaikan dengan regulasi sektor kesehatan."
- AI Use and Third-Party Declaration: MediaPipe (Apache 2.0), Supabase, Vercel, suara TTS platform, Gemini (F20), dan **asisten AI yang dipakai tim (termasuk Claude Code)**.
- Pitch deck 09.45 dengan kalimat regulasi "prototipe di jalur perangkat lunak alat kesehatan".
- 10.00: cek batas anon (R8), buka dasbor Supabase supaya proyek free tier tidak dijeda (R7), smoke test.

---

## 4. Kontrak untuk tim

### 4.1 `lib/supabase.ts` (untuk Ari)
```ts
export const supabase: SupabaseClient;   // singleton browser, publishable key, sesi di localStorage (sb-*)

export type Peran =
  | { jenis: 'keluar' }                                          // tidak ada sesi auth
  | { jenis: 'terapis'; uid: string; demo: boolean; nama: string }
  | { jenis: 'pasien'; uid: string; pasienId: string }
  | { jenis: 'tanpa_peran'; uid: string; anonim: boolean }       // anon belum klaim / belum sandbox
  | { jenis: 'luring'; uid: string };                            // ada sesi, tapi query gagal → pakai rc_resep
export async function cekPeran(): Promise<Peran>;
// getSession() → tidak ada: 'keluar'
// profil where id = uid → ada: 'terapis'
// pasien where user_id = uid → ada: 'pasien'
// galat jaringan → 'luring'; selain itu 'tanpa_peran'

export function pesanGalat(e: { message?: string; status?: number } | null): string;
```
Peta `pesanGalat` (spec §8.5 + tambahan [default spec]):

| `message` / status | Teks |
|---|---|
| `kode_tidak_sah` | Minta tautan baru ke fisioterapis |
| `sudah_terikat` | Perangkat ini sudah terikat ke pasien lain. Hapus data dulu di beranda. |
| `akun_terapis` | Keluar dari akun fisioterapis dulu |
| `perangkat_pasien` | Perangkat ini terikat ke pasien. Hapus data dulu untuk mencoba sebagai juri. |
| `tidak_terikat` | Perangkat ini belum terikat ke pasien. |
| status 429 | Batas percobaan tercapai, coba lagi sebentar lagi |
| `Invalid login credentials` | Email atau kata sandi salah |
| `User already registered` | Email sudah terdaftar |
| lainnya | Terjadi galat, coba lagi |

### 4.2 RPC

| RPC | Parameter | Hasil | Galat | Dipanggil oleh |
|---|---|---|---|---|
| `klaim_pasien` | `p_kode`, `p_versi` (`'F19-v1'`), `p_oleh` (`'pasien'`/`'wali'`) | `uuid` pasien | `belum_masuk`, `oleh_tidak_sah`, `akun_terapis`, `sudah_terikat`, `kode_tidak_sah` | Ari, `/k/[kode]` |
| `buat_kode` | `p_pasien_id` | `text` kode 8 heks kapital | `bukan_pasien_anda` | Pindra, detail |
| `lapor_nyeri` | `p_sesi_id`, `p_nilai` (0/1/2) | `boolean` (false = sudah terisi/bukan milik; antrean menganggap selesai) | `nilai_tidak_sah` | Ari, `antrean.ts` |
| `cabut_persetujuan` | — | `void` | `tidak_terikat` | Ari, `/pasien` |
| `buat_sandbox` | — | `void` (idempoten) | `sandbox_hanya_anonim`, `perangkat_pasien` | Ari, `/` |

### 4.3 `components/Grafik.tsx` (untuk Ari pukul 22.00)
```ts
export type TitikGrafik = {
  y: number | null;                 // null = celah, garis tidak disambung
  label: string;                    // label sumbu x (tanggal pendek / "S3")
  bentuk?: 'bulat' | 'kotak';       // default bulat
  huruf?: string;                   // "P" / "M" di dalam/samping titik
  tebal?: boolean;                  // titik pemicu eskalasi
};
export type PropsGrafik = {
  judul: string;                    // dipakai juga untuk aria-label
  titik: TitikGrafik[];
  yMin?: number; yMaks?: number;    // default 0..100
  satuan?: string;                  // '%', ' dtk'
  acuan?: { y: number; label: string };   // garis putus-putus (median baseline)
  tinggi?: number;                  // px, default 200
};
export default function Grafik(p: PropsGrafik): JSX.Element;
```

### 4.4 Kolom `sesi` = `BarisSesi` (untuk Manta dan Ari)
Upsert dari antrean mengirim persis: `id, pasien_id, mulai, selesai, resep, baseline, rep_total, rep_terukur, rep_terkompensasi, per_gerakan, pct_tak_terukur, fps_median, suara, delegate, nyeri (null), is_sintetis (false)`. **Jangan** kirim `pct_terkompensasi` (kolom generated). Constraint: `rep_total ≥ 1`, `0 ≤ rep_terukur ≤ rep_total`, `0 ≤ rep_terkompensasi ≤ rep_terukur`, `suara ∈ {webspeech, klip}`, `delegate ∈ {GPU, CPU}`. Upsert: `.upsert(baris, { onConflict: 'id', ignoreDuplicates: true })` tanpa `.select()`.

---

## 5. Skrip uji

### 5.1 `supabase/tests/uji_rls.sql` (kerangka)
Dijalankan di SQL editor sebagai `postgres`. Semua dibungkus `begin … rollback`, jadi tidak meninggalkan data. Pelanggaran memunculkan galat `GAGAL: …` atau `assert`.

```sql
begin;

-- data uji (trigger daftar ikut teruji)
insert into auth.users (id, aud, role, email, raw_user_meta_data, is_anonymous) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@uji.local', '{"role":"fisioterapis","nama":"A"}', false),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@uji.local', '{"role":"fisioterapis","nama":"B"}', false),
  ('dddddddd-0000-0000-0000-000000000000', 'authenticated', 'authenticated', null, '{}', true);

do $$ begin
  assert exists (select 1 from public.profil where id = 'aaaaaaaa-0000-0000-0000-000000000000'), 'trigger: profil A';
  assert not exists (select 1 from public.profil where id = 'dddddddd-0000-0000-0000-000000000000'), 'trigger: anon tanpa profil';
end $$;

insert into public.pasien (id, terapis_id, user_id, nama_panggilan, sisi_terdampak, gerakan) values
  ('11111111-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-000000000000', 'Pasien A', 'kanan', '{jangkau_depan}'),
  ('22222222-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', null, 'Pasien B', 'kiri', '{jangkau_depan}');

set local role authenticated;

-- ===== Bagian A: RLS + GRANT =====
-- terapis B
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000000","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from public.pasien) = 1, 'B hanya melihat pasiennya';
  assert (select count(*) from public.v_prioritas) = 1, 'B: v_prioritas tanpa 42501, 1 baris';
  begin
    insert into public.sesi (id, pasien_id, mulai, selesai, resep, rep_total, rep_terukur, rep_terkompensasi)
    values (gen_random_uuid(), '11111111-0000-0000-0000-000000000000', now(), now(), '{}', 1, 1, 0);
    raise exception 'GAGAL: B bisa sisip sesi pasien A';
  exception when insufficient_privilege then null;
  end;
end $$;

-- terapis A: GRANT kolom menolak ubah user_id langsung
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000000","role":"authenticated"}', true);
do $$ begin
  begin
    update public.pasien set user_id = null where id = '11111111-0000-0000-0000-000000000000';
    raise exception 'GAGAL: terapis bisa ubah user_id langsung';
  exception when insufficient_privilege then null;
  end;
end $$;

-- perangkat pasien A (anon)
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000000","role":"authenticated","is_anonymous":true}', true);
do $$ begin
  assert (select count(*) from public.pasien) = 1, 'perangkat melihat pasiennya saja';
  assert (select count(*) from public.v_prioritas) = 0, 'perangkat tidak melihat v_prioritas';
  insert into public.sesi (id, pasien_id, mulai, selesai, resep, rep_total, rep_terukur, rep_terkompensasi)
  values ('33333333-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', now(), now(), '{}', 10, 10, 2);
  begin
    insert into public.pasien (terapis_id, nama_panggilan, sisi_terdampak, gerakan)
    values ('dddddddd-0000-0000-0000-000000000000', 'x', 'kiri', '{jangkau_depan}');
    raise exception 'GAGAL: perangkat bisa membuat pasien';
  exception when foreign_key_violation or insufficient_privilege then null;
  end;
end $$;

-- ===== Bagian B: RPC (jalankan setelah 0002/0003) =====
do $$
declare v_kode text;
begin
  -- perangkat: nyeri idempoten, tidak bisa jadi sandbox
  perform set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000000","role":"authenticated","is_anonymous":true}', true);
  assert public.lapor_nyeri('33333333-0000-0000-0000-000000000000', 1) = true, 'nyeri pertama';
  assert public.lapor_nyeri('33333333-0000-0000-0000-000000000000', 2) = false, 'nyeri kedua false';
  begin
    perform public.buat_sandbox();
    raise exception 'GAGAL: perangkat pasien bisa buat_sandbox';
  exception when others then
    if sqlerrm not like '%perangkat_pasien%' then raise; end if;
  end;

  -- B tidak bisa buat_kode pasien A
  perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000000","role":"authenticated"}', true);
  begin
    perform public.buat_kode('11111111-0000-0000-0000-000000000000');
    raise exception 'GAGAL: B bisa buat_kode pasien A';
  exception when others then
    if sqlerrm not like '%bukan_pasien_anda%' then raise; end if;
  end;

  -- cabut persetujuan → sesi hilang, perangkat lepas
  perform set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000000","role":"authenticated","is_anonymous":true}', true);
  perform public.cabut_persetujuan();
  assert (select count(*) from public.pasien) = 0, 'setelah cabut, perangkat lepas';

  -- A buat kode baru → perangkat klaim ulang (huruf kecil tetap diterima)
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000000","role":"authenticated"}', true);
  assert (select count(*) from public.sesi where pasien_id = '11111111-0000-0000-0000-000000000000') = 0, 'sesi terhapus';
  v_kode := public.buat_kode('11111111-0000-0000-0000-000000000000');
  perform set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000000","role":"authenticated","is_anonymous":true}', true);
  assert public.klaim_pasien(lower(v_kode), 'F19-v1', 'wali') = '11111111-0000-0000-0000-000000000000', 'klaim ulang';
  assert (select persetujuan_oleh from public.pasien) = 'wali', 'persetujuan tercatat';

  -- terapis tidak bisa klaim
  perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000000","role":"authenticated"}', true);
  begin
    perform public.klaim_pasien('XXXXXXXX', 'F19-v1', 'pasien');
    raise exception 'GAGAL: terapis bisa klaim';
  exception when others then
    if sqlerrm not like '%akun_terapis%' then raise; end if;
  end;
end $$;

rollback;
```
Catatan: bila SQL editor menolak `insert into auth.users` karena ada kolom wajib di versi Supabase saat ini, tambahkan kolom yang diminta pesan galat (misalnya `instance_id = '00000000-0000-0000-0000-000000000000'`). Uji ini mengecek logika DB. Jalur klien asli (PostgREST, upsert ulang) tetap diuji di G1.

### 5.2 `supabase/tests/uji_eskalasi.sql` (spec §12.2)
```sql
begin;
insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'esk@uji.local', '{"role":"fisioterapis","nama":"Uji"}');

insert into public.pasien (id, terapis_id, nama_panggilan, sisi_terdampak, gerakan, is_sintetis) values
  ('e0000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000000', 'memburuk',     'kanan', '{jangkau_depan,jangkau_samping}', true),
  ('e0000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000000', 'stabil_nyeri', 'kiri',  '{jangkau_depan,jangkau_samping}', true),
  ('e0000000-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000000', 'uji_berderau', 'kanan', '{jangkau_depan,jangkau_samping}', true),
  ('e0000000-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000000', 'uji_median',   'kanan', '{jangkau_depan,jangkau_samping}', true);

select public.isi_sintetis(id, nama_panggilan) from public.pasien where terapis_id = 'eeeeeeee-0000-0000-0000-000000000000';

-- harap: memburuk 8/7/12.5/8; stabil_nyeri kosong; uji_berderau 8/7/12.5; uji_median 8/7/15
select p.nama_panggilan, e.panjang_run, e.batas, e.median_baseline, cardinality(e.sesi_pemicu) as n_pemicu
from public.pasien p left join public.eskalasi e on e.pasien_id = p.id
where p.terapis_id = 'eeeeeeee-0000-0000-0000-000000000000'
order by p.nama_panggilan;

-- tinjau, lalu satu sesi 40% setelahnya → tidak membuka ulang (titik sejak tinjau < 7)
update public.eskalasi set ditinjau = now(), keputusan = 'lanjutkan'
 where pasien_id = 'e0000000-0000-0000-0000-000000000001';
insert into public.sesi (id, pasien_id, mulai, selesai, resep, rep_total, rep_terukur, rep_terkompensasi)
values (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', now() + interval '1 minute', now() + interval '13 minutes', '{}', 20, 20, 8);
-- sesi 3 repetisi terukur → bukan titik data
insert into public.sesi (id, pasien_id, mulai, selesai, resep, rep_total, rep_terukur, rep_terkompensasi)
values (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', now() + interval '2 minutes', now() + interval '14 minutes', '{}', 3, 3, 3);

select count(*) filter (where ditinjau is null) as terbuka, count(*) as total   -- harap 0 / 1
from public.eskalasi where pasien_id = 'e0000000-0000-0000-0000-000000000001';
rollback;
```
`now()` bernilai sama sepanjang satu transaksi, jadi sesi pasca-tinjau diberi `+ 1 minute` supaya benar-benar jatuh setelah `ditinjau`.

### 5.3 Jalur auth asli lewat REST (19.00)
Pakai `curl.exe` di PowerShell (karena `curl` di sana adalah alias `Invoke-WebRequest`) atau Git Bash:
```bash
# daftar terapis → profil harus muncul
curl -X POST "$URL/auth/v1/signup" -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"a@uji.dev","password":"uji-12345","data":{"role":"fisioterapis","nama":"A"}}'
# anonymous sign-in → sukses, profil TIDAK muncul
curl -X POST "$URL/auth/v1/signup" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{}'
```
Cek tabel `profil` di dasbor. Hapus pengguna uji dari Authentication → Users setelahnya (profil ikut terhapus lewat cascade).

### 5.4 F20
- `npm test`: 3 tes ringkasan hijau.
- Tab Network: request ke route hanya membawa `pasien_id`; respons `masukan` tanpa nama, ID, atau tanggal.
- `grep -r "AIza" .next/static` kosong setelah build.
- Hapus `GEMINI_API_KEY` sementara (lokal) → `sumber: 'templat', alasan: 'tanpa_kunci'`.

---

## 6. Butir gerbang bagian kamu

**G1 (24.00)**
- [ ] Sesi tersimpan lewat RLS dari perangkat anon yang sudah klaim **dan** dari terapis demo, tanpa `42501`. Kirim ulang baris yang sama tidak menggandakan data.
- [ ] `buat_sandbox` → 5 pasien, Pak Wayan berstatus eskalasi terbuka, urutan F12 benar.
- [ ] `uji_rls.sql` dan `uji_eskalasi.sql` lolos.

**G2 (05.00, di URL production)**
- [ ] Skrip demo: sandbox → pasien baru → QR di HP → persetujuan + klaim → latihan → sesi muncul di dasbor.
- [ ] Tinjau eskalasi menutup penanda.
- [ ] F20 tampil (AI atau templat) untuk pasien sintetis.
- [ ] "Hapus data saya" lalu klaim ulang dengan kode baru berhasil.
- [ ] Mode Mati tercatat di `sesi.resep.mode_koreksi` dan tampil sebagai titik kotak "M" di F13.

---

## 7. Risiko backend

| Risiko | Tanda | Tindakan |
|---|---|---|
| Trigger daftar galat (R14 terkait) | Semua `signUp`/anon gagal "Database error saving new user" | Cek log Postgres; perbaiki fungsi dengan `create or replace`; uji §5.3 lagi |
| Lupa GRANT | Klien `42501` / `permission denied` | Tambah GRANT di migrasi, jangan lewat UI dasbor, supaya repo tetap sumber kebenaran |
| View bocor | Terapis B melihat pasien A di `v_prioritas` | Pastikan `security_invoker = true` + `where terapis_id = (select auth.uid())` |
| Batas anon habis saat juri (R8) | 429 di `/` atau `/k` | Naikkan batas di dasbor Auth; cek lagi 10.00 |
| Proyek free tier dijeda (R7) | Semua request gagal setelah penjurian lama | Buka dasbor / jalankan satu kueri harian selama periode penjurian |
| Gemini gagal / kuota habis (R21) | `sumber: 'templat'` terus | Normal, templat adalah cadangan yang sah. Pastikan bukan karena thinking memotong keluaran (`alasan: 'kalimat'`) |
| Skema berubah setelah data juri ada | — | Setelah G2 hanya migrasi baru `0004_…`, tanpa drop |
