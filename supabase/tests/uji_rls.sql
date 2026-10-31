-- ReminiCare Test: Uji RLS, GRANT, dan RPC
-- Berdasarkan 2026-11-01-backend-pindra-v9.md Task 2 dan SPEC-ReminiCare-ramping.md v1.1 §12.1
-- Dijalankan di SQL editor Supabase sebagai peran 'postgres'.
-- Seluruh pengujian dibungkus dalam begin ... rollback sehingga tidak meninggalkan data.

begin;

-- data uji: tanpa trigger daftar, profil dibuat lewat RPC daftar (V9)
insert into
    auth.users (
        id,
        aud,
        role,
        email,
        raw_user_meta_data
    )
values (
        'aaaaaaaa-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'a@uji.local',
        '{"full_name":"Terapis A"}'
    ),
    (
        'bbbbbbbb-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'b@uji.local',
        '{"name":"Terapis B"}'
    ),
    (
        'dddddddd-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'p@uji.local',
        '{"full_name":"Pasien P"}'
    ),
    (
        'cccccccc-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'c@uji.local',
        '{}'
    );

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
  perform set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000000","role":"authenticated"}', true);
  begin
    perform public.daftar('admin');
    raise exception 'GAGAL: daftar menerima peran asing';
  exception when others then
    if sqlerrm not like '%peran_tidak_sah%' then raise; end if;
  end;
  assert (select nama from public.profil where id = 'aaaaaaaa-0000-0000-0000-000000000000') = 'Terapis A', 'nama dari full_name';
  assert (select nama from public.profil where id = 'bbbbbbbb-0000-0000-0000-000000000000') = 'Terapis B', 'nama dari name';
  assert not exists (select 1 from public.profil where id = 'cccccccc-0000-0000-0000-000000000000'), 'tanpa sign up = tanpa profil';
end $$;

insert into
    public.pasien (
        id,
        terapis_id,
        user_id,
        nama_panggilan,
        sisi_terdampak,
        gerakan
    )
values (
        '11111111-0000-0000-0000-000000000000',
        'aaaaaaaa-0000-0000-0000-000000000000',
        'dddddddd-0000-0000-0000-000000000000',
        'Pasien A',
        'kanan',
        '{jangkau_depan}'
    ),
    (
        '22222222-0000-0000-0000-000000000000',
        'bbbbbbbb-0000-0000-0000-000000000000',
        null,
        'Pasien B',
        'kiri',
        '{jangkau_depan}'
    );

set local role authenticated;

-- ==============================================================================
-- ===== Bagian A: RLS + GRANT                                               =====
-- ==============================================================================

-- terapis B
select set_config (
        'request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000000","role":"authenticated"}', true
    );

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

-- terapis A: GRANT kolom menolak ubah user_id dan peran langsung
select set_config (
        'request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000000","role":"authenticated"}', true
    );

do $$ begin
  begin
    update public.pasien set user_id = null where id = '11111111-0000-0000-0000-000000000000';
    raise exception 'GAGAL: terapis bisa ubah user_id langsung';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profil set peran = 'pasien' where id = 'aaaaaaaa-0000-0000-0000-000000000000';
    raise exception 'GAGAL: klien bisa ubah peran langsung';
  exception when insufficient_privilege then null;
  end;
end $$;

-- akun pasien P (terikat ke Pasien A)
select set_config (
        'request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000000","role":"authenticated"}', true
    );

do $$ begin
  assert (select count(*) from public.pasien) = 1, 'P melihat pasiennya saja';
  assert (select count(*) from public.v_prioritas) = 0, 'P tidak melihat v_prioritas';
  insert into public.sesi (id, pasien_id, mulai, selesai, resep, rep_total, rep_terukur, rep_terkompensasi)
  values ('33333333-0000-0000-0000-000000000000', '11111111-0000-0000-0000-000000000000', now(), now(), '{}', 10, 10, 2);
  -- P punya profil (peran pasien), jadi FK lolos; yang menolak adalah RLS pasien_sisip
  begin
    insert into public.pasien (terapis_id, nama_panggilan, sisi_terdampak, gerakan)
    values ('dddddddd-0000-0000-0000-000000000000', 'x', 'kiri', '{jangkau_depan}');
    raise exception 'GAGAL: akun pasien bisa membuat pasien';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ==============================================================================
-- ===== Bagian B: RPC                                                       =====
-- ==============================================================================
do $$
declare v_kode text;
begin
  -- terapis tidak bisa lapor nyeri (cabang demo sudah dihapus)
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000000","role":"authenticated"}', true);
  assert public.lapor_nyeri('33333333-0000-0000-0000-000000000000', 0) = false, 'terapis tidak bisa lapor nyeri';

  -- P: nyeri idempoten
  perform set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000000","role":"authenticated"}', true);
  assert public.lapor_nyeri('33333333-0000-0000-0000-000000000000', 1) = true, 'nyeri pertama';
  assert public.lapor_nyeri('33333333-0000-0000-0000-000000000000', 2) = false, 'nyeri kedua false';

  -- B tidak bisa buat_kode pasien A
  perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000000","role":"authenticated"}', true);
  begin
    perform public.buat_kode('11111111-0000-0000-0000-000000000000');
    raise exception 'GAGAL: B bisa buat_kode pasien A';
  exception when others then
    if sqlerrm not like '%bukan_pasien_anda%' then raise; end if;
  end;

  -- cabut persetujuan → sesi hilang, akun P lepas
  perform set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000000","role":"authenticated"}', true);
  perform public.cabut_persetujuan();
  assert (select count(*) from public.pasien) = 0, 'setelah cabut, akun P lepas';

  -- A buat kode baru → P klaim ulang (huruf kecil tetap diterima)
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000000","role":"authenticated"}', true);
  assert (select count(*) from public.sesi where pasien_id = '11111111-0000-0000-0000-000000000000') = 0, 'sesi terhapus';
  v_kode := public.buat_kode('11111111-0000-0000-0000-000000000000');
  perform set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000000","role":"authenticated"}', true);
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

  -- login Google tanpa sign up tidak bisa klaim
  perform set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000000","role":"authenticated"}', true);
  begin
    perform public.klaim_pasien('XXXXXXXX', 'F19-v1', 'pasien');
    raise exception 'GAGAL: akun tanpa profil bisa klaim';
  exception when others then
    if sqlerrm not like '%belum_daftar%' then raise; end if;
  end;
end $$;

-- ==============================================================================
-- ===== Bagian C: isi_contoh                                                =====
-- ==============================================================================
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

rollback;