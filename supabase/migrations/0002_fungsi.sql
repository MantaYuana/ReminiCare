-- ReminiCare Migration 0002: Fungsi RPC (klaim_pasien, buat_kode, lapor_nyeri, cabut_persetujuan)
-- Berdasarkan SPEC-ReminiCare-ramping.md §8.5 dan PLAN-Backend-Pindra.md §3 Fase 2

-- ==============================================================================
-- 1. Klaim Pasien (F03 + F19)
-- ==============================================================================
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
  if exists (select 1 from public.profil where id = v_uid) then raise exception 'akun_terapis'; end if;
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

-- ==============================================================================
-- 2. Buat Kode Klaim (F03)
-- ==============================================================================
create or replace function public.buat_kode(p_pasien_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kode text := upper(left(replace(gen_random_uuid()::text, '-', ''), 8));   -- [default spec] 8 heks acak kapital
begin
  update public.pasien
     set kode_klaim = v_kode,
         kode_kedaluwarsa = now() + interval '7 days',
         user_id = null                                  -- lepas perangkat lama (F03)
   where id = p_pasien_id
     and terapis_id = auth.uid();
  if not found then raise exception 'bukan_pasien_anda'; end if;
  return v_kode;
end;
$$;

-- ==============================================================================
-- 3. Lapor Nyeri Sesi (F10)
-- ==============================================================================
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
     and (p.user_id = auth.uid()
          or (p.terapis_id = auth.uid()
              and exists (select 1 from public.profil f where f.id = auth.uid() and f.is_demo)));
  return found;
end;
$$;

-- ==============================================================================
-- 4. Cabut Persetujuan / Hapus Data Pasien (F19)
-- ==============================================================================
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
  delete from public.eskalasi where pasien_id = v_pasien;      -- [V8] hapus eskalasi
  delete from public.sesi where pasien_id = v_pasien;          -- hapus sesi
  update public.pasien
     set user_id = null, persetujuan_versi = null, persetujuan_waktu = null, persetujuan_oleh = null
   where id = v_pasien;
end;
$$;

-- ==============================================================================
-- 5. Revoke / Grant Permissions
-- ==============================================================================
revoke execute on function public.klaim_pasien(text, text, text), public.buat_kode(uuid),
  public.lapor_nyeri(uuid, int), public.cabut_persetujuan() from public, anon;
grant execute on function public.klaim_pasien(text, text, text), public.buat_kode(uuid),
  public.lapor_nyeri(uuid, int), public.cabut_persetujuan() to authenticated;

