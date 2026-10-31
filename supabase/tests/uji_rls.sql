-- ReminiCare Test: Uji RLS, GRANT, dan RPC
-- Berdasarkan PLAN-Backend-Pindra.md §5.1 dan SPEC-ReminiCare-ramping.md §12.1
-- Dijalankan di SQL editor Supabase sebagai peran 'postgres'.
-- Seluruh pengujian dibungkus dalam begin ... rollback sehingga tidak meninggalkan data.

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

-- ==============================================================================
-- ===== Bagian A: RLS + GRANT (Uji Fase 1 / 0001_skema.sql)                =====
-- ==============================================================================

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

-- ==============================================================================
-- ===== Bagian B: RPC (Uji Fase 2 / 0002_fungsi.sql & 0003_sintetis.sql)   =====
-- ==============================================================================
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

