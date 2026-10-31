-- 0003_sintetis.sql
-- Migrasi Fase 4: Eskalasi (trigger cek_eskalasi), Data Sintetis (isi_sintetis), dan Sandbox Juri (buat_sandbox)
-- Sumber kebenaran: SPEC-ReminiCare-ramping.md §8.6, §8.7, §8.8

-- 1. Trigger Eskalasi cek_eskalasi (SPEC §8.6, F14 + PRD §6.3)
create or replace function public.cek_eskalasi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tinjau timestamptz;
  v_ids uuid[];
  v_pct numeric[];
  v_urut numeric[];
  v_median numeric;
  v_n int;
  v_run int := 0;
  v_run_ids uuid[] := '{}';
  v_batas int;
  i int;
begin
  if new.rep_terukur < 5 then return null; end if;                  -- bukan titik data
  if exists (select 1 from public.eskalasi where pasien_id = new.pasien_id and ditinjau is null) then
    return null;                                                     -- sudah ada yang terbuka
  end if;

  select max(ditinjau) into v_tinjau from public.eskalasi where pasien_id = new.pasien_id;

  -- titik data: sesi ≥ 5 repetisi terukur sejak tinjauan terakhir, urut waktu
  select array_agg(id order by mulai, id), array_agg(pct_terkompensasi order by mulai, id)
    into v_ids, v_pct
    from public.sesi
   where pasien_id = new.pasien_id
     and rep_terukur >= 5
     and (v_tinjau is null or mulai > v_tinjau);

  if coalesce(array_length(v_ids, 1), 0) < 7 then return null; end if;

  -- median baseline = median 6 titik pertama, dibekukan (numeric persis, bukan percentile_cont double)
  select array_agg(x order by x) into v_urut from unnest(v_pct[1:6]) as x;
  v_median := (v_urut[3] + v_urut[4]) / 2;

  -- n = titik yang tidak tepat di median
  select count(*) into v_n from unnest(v_pct) as x where x <> v_median;

  -- run di atas median yang berakhir di sesi terbaru; titik = median dilewati, tidak memutus
  for i in reverse array_length(v_pct, 1) .. 1 loop
    continue when v_pct[i] = v_median;
    exit when v_pct[i] < v_median;
    v_run := v_run + 1;
    v_run_ids := v_ids[i] || v_run_ids;
  end loop;

  if v_run = 0 then return null; end if;
  v_batas := round(log(2, v_n::numeric) + 3);

  if v_run > v_batas then
    insert into public.eskalasi (pasien_id, dibuka, sesi_pemicu, median_baseline, panjang_run, batas)
    values (new.pasien_id, coalesce(new.selesai, now()), v_run_ids, v_median, v_run, v_batas);   -- dibuka = sesi.selesai [default spec]
  end if;
  return null;
exception when others then
  raise warning 'cek_eskalasi: %', sqlerrm;          -- tidak pernah membatalkan sisipan sesi
  return null;
end;
$$;

drop trigger if exists sesi_cek_eskalasi on public.sesi;
create trigger sesi_cek_eskalasi
  after insert on public.sesi
  for each row execute function public.cek_eskalasi();

-- 2. Fungsi Pengisi Data Sintetis isi_sintetis (SPEC §8.7, PRD §10)
create or replace function public.isi_sintetis(p_pasien_id uuid, p_pola text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pct int[];
  v_n int;
  v_k int;
  v_mulai timestamptz;
  v_resep jsonb;
  i int;
begin
  v_pct := case p_pola
    -- pola §10 (dipakai buat_sandbox)
    when 'memburuk'     then array[10,15,10,15,10,15, 20,20,25,25,30,30,35,35,40]
    when 'stabil_nyeri' then array[20,15,25, 20,15,25, 20,15,25, 20,15,25, 20,15,25]
    when 'jarang'       then array[20,25]
    when 'membaik'      then array[40,35,40,35,30,30, 30,25,25,20,20,20,15,15,15]
    when 'stabil_baik'  then array[5,10,5,10,5,10, 5,10,5,10,5,10, 5,10,5]
    -- pola uji §12.2 (manual saja, tidak dipakai buat_sandbox)
    when 'uji_berderau' then array[10,15,10,15,10,15, 25,20,30,15,20,35,20,30,25]
    when 'uji_median'   then array[10,20,10,20,20,10, 25,15,25,15,25,25,30,25,30,30]
  end;
  if v_pct is null then raise exception 'pola tidak dikenal: %', p_pola; end if;
  v_n := array_length(v_pct, 1);

  select jsonb_build_object(
           'gerakan', p.gerakan, 'repetisi', p.repetisi, 'sesi_per_minggu', p.sesi_per_minggu,
           'toleransi_batang', p.toleransi_batang, 'toleransi_bahu', p.toleransi_bahu,
           'durasi_persen', p.durasi_persen, 'mode_koreksi', p.mode_koreksi, 'kalimat_condong', p.kalimat_condong,
           'kandidat_condong', 'a', 'suara_condong', true, 'ambang_versi', 'sintetis')
    into v_resep
    from public.pasien p
   where p.id = p_pasien_id;

  for i in 1 .. v_n loop
    -- 3 sesi/minggu: sesi ke-i = 1 hari + (n − i)·56 jam lalu → 3 sesi dalam 7 hari terakhir, sesi pertama ±34 hari lalu
    v_mulai := case
      when p_pola = 'jarang' then now() - make_interval(days => case i when 1 then 12 else 9 end)
      else now() - interval '1 day' - (v_n - i) * interval '56 hours'
    end;
    v_k := v_pct[i] * 20 / 100;                          -- 20 repetisi terukur per sesi (2 gerakan × 10)

    insert into public.sesi (
      id, pasien_id, mulai, selesai, resep, baseline,
      rep_total, rep_terukur, rep_terkompensasi, per_gerakan,
      pct_tak_terukur, fps_median, suara, delegate, nyeri, is_sintetis)
    values (
      gen_random_uuid(), p_pasien_id, v_mulai, v_mulai + interval '12 minutes', v_resep, null,
      20, 20, v_k,
      jsonb_build_object(
        'jangkau_depan', jsonb_build_object(
          'rep_total', 10, 'rep_terukur', 10, 'rep_terkompensasi', v_k - v_k / 2,
          'per_penanda', jsonb_build_object('batang', v_k - v_k / 2, 'bahu', 0),
          'waktu_gerak_median', round((1.8 + random() * 0.3)::numeric, 2),
          'v_puncak_median', round((1.3 + random() * 0.2)::numeric, 2),
          'n_puncak_median', 1 + floor(random() * 2)::int),
        'jangkau_samping', jsonb_build_object(
          'rep_total', 10, 'rep_terukur', 10, 'rep_terkompensasi', v_k / 2,
          'per_penanda', jsonb_build_object('batang', 0, 'bahu', v_k / 2),
          'waktu_gerak_median', round((2.0 + random() * 0.3)::numeric, 2),
          'v_puncak_median', round((1.1 + random() * 0.2)::numeric, 2),
          'n_puncak_median', 1 + floor(random() * 2)::int)),
      0, round((22 + random() * 4)::numeric, 1), 'webspeech', 'GPU',
      case
        when p_pola = 'stabil_nyeri' and i = v_n then 2
        when p_pola = 'stabil_nyeri' and i = v_n - 3 then 1
        else 0
      end,
      true);
  end loop;
end;
$$;

-- 3. Fungsi Pembuat Sandbox Juri buat_sandbox (SPEC §8.8, F16)
create or replace function public.buat_sandbox()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  r record;
begin
  if v_uid is null or not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'sandbox_hanya_anonim';
  end if;
  if exists (select 1 from public.pasien where user_id = v_uid) then
    raise exception 'perangkat_pasien';            -- perangkat pasien tidak bisa jadi terapis demo
  end if;
  if exists (select 1 from public.profil where id = v_uid) then
    return;                                        -- sandbox sudah ada: idempoten [default spec]
  end if;

  insert into public.profil (id, nama, is_demo)
  values (v_uid, 'Terapis Demo', true)
  on conflict (id) do nothing;

  if not found then
    return;                                        -- sandbox sudah ada atau dibuat bersamaan: idempoten
  end if;

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
end;
$$;

-- 4. Pengaturan Hak Eksekusi (Grant / Revoke)
revoke execute on function public.buat_sandbox() from public, anon;
grant execute on function public.buat_sandbox() to authenticated;
revoke execute on function public.isi_sintetis(uuid, text), public.cek_eskalasi() from public, anon, authenticated;

