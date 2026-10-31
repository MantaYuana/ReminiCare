-- ReminiCare Migration 0004: V9 login Google (peran via daftar, tanpa trigger daftar dan sandbox)
-- Berdasarkan SPEC-ReminiCare-ramping.md v1.1 §8.3–§8.5, §8.8 dan 2026-11-01-backend-pindra-v9.md Task 2–3
-- 0001–0003 tidak diubah karena mungkin sudah dijalankan. File ini berlaku di atas DB lama maupun DB baru (0001 → 0004),
-- dan aman dijalankan ulang (semua langkah dijaga if [not] exists), jadi perbaikan di file ini cukup diterapkan dengan menjalankannya lagi.
-- Urutan langkah wajib: kebijakan lama bergantung pada kolom is_demo.

-- ==============================================================================
-- 1. Hapus trigger daftar (peran kini dicatat RPC daftar setelah redirect OAuth)
-- ==============================================================================
drop trigger if exists pengguna_baru on auth.users;

drop function if exists public.tangani_pengguna_baru ();

-- ==============================================================================
-- 2. Hapus sandbox lama (cascade ke pasien → sesi → eskalasi)
-- ==============================================================================
-- dijaga: saat dijalankan ulang, kolom is_demo sudah dibuang di langkah 5
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profil' and column_name = 'is_demo') then
    delete from public.profil where is_demo;
  end if;
end $$;

-- ==============================================================================
-- 3. Lepas perangkat anonim (anonymous sign-in OFF, perangkat lama tidak boleh menulis sesi lagi)
-- ==============================================================================
update public.pasien
set
    user_id = null,
    persetujuan_versi = null,
    persetujuan_waktu = null,
    persetujuan_oleh = null
where
    user_id in (
        select id
        from auth.users
        where
            is_anonymous
    );

-- ==============================================================================
-- 4. Kolom peran: satu akun = satu peran. Profil lama semuanya fisioterapis.
-- ==============================================================================
alter table public.profil add column if not exists peran text;

-- hanya profil lama (peran null); saat dijalankan ulang, profil pasien hasil daftar tidak boleh ikut berubah
update public.profil set peran = 'fisioterapis' where peran is null;

alter table public.profil alter column peran set not null;

alter table public.profil drop constraint if exists profil_peran_cek;

alter table public.profil
add constraint profil_peran_cek check (
    peran in ('fisioterapis', 'pasien')
);
-- tanpa GRANT update (peran): hanya RPC daftar yang menulis kolom ini

-- ==============================================================================
-- 5. Buang is_demo (kebijakan sesi_sisip lama memakai kolom ini, jadi dibuang dulu)
-- ==============================================================================
drop policy if exists sesi_sisip on public.sesi;

alter table public.profil drop column if exists is_demo;

-- ==============================================================================
-- 6. RLS baru (SPEC §8.3)
-- ==============================================================================
create policy sesi_sisip on public.sesi for
insert
    to authenticated
with
    check (
        exists (
            select 1
            from public.pasien p
            where
                p.id = sesi.pasien_id
                and p.user_id = (
                    select auth.uid ()
                )
        )
    );
-- [V9] cabang terapis demo dihapus

drop policy if exists pasien_sisip on public.pasien;

create policy pasien_sisip on public.pasien for
insert
    to authenticated
with
    check (
        terapis_id = (
            select auth.uid ()
        )
        and exists (
            select 1
            from public.profil f
            where
                f.id = (
                    select auth.uid ()
                )
                and f.peran = 'fisioterapis'
        )
    );
-- [V9] akun pasien juga punya profil, jadi FK saja tidak cukup

-- ==============================================================================
-- 7. Hapus sandbox juri (digantikan isi_contoh)
-- ==============================================================================
drop function if exists public.buat_sandbox();

-- ==============================================================================
-- 8. RPC daftar (SPEC §8.4), klaim_pasien + lapor_nyeri versi V9 (SPEC §8.5)
-- ==============================================================================
create or replace function public.daftar(p_peran text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ada text;
begin
  if v_uid is null then raise exception 'belum_masuk'; end if;
  -- sesi anonim pra-V9 masih bisa hidup lewat refresh token; V9 hanya menerima akun Google
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'anonim_ditolak'; end if;
  if p_peran not in ('fisioterapis', 'pasien') then raise exception 'peran_tidak_sah'; end if;

  -- on conflict: dua panggilan bersamaan (dua tab) tidak menabrak primary key
  insert into public.profil (id, peran, nama)
  select v_uid, p_peran, left(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), 80)
    from auth.users u
   where u.id = v_uid
  on conflict (id) do nothing;

  select peran into v_ada from public.profil where id = v_uid;
  if v_ada is null then raise exception 'belum_masuk'; end if;
  if v_ada <> p_peran then raise exception 'peran_lain'; end if;
  return v_ada;                                           -- idempoten: sign up ulang dengan peran sama
end;
$$;

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

-- ==============================================================================
-- 9. Revoke / Grant (klaim_pasien dan lapor_nyeri mempertahankan GRANT dari 0002)
-- ==============================================================================
revoke execute on function public.daftar (text) from public, anon;

grant execute on function public.daftar (text) to authenticated;

-- ==============================================================================
-- 10. isi_contoh (SPEC §8.8)
-- ==============================================================================
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

revoke execute on function public.isi_contoh () from public, anon;

grant execute on function public.isi_contoh () to authenticated;