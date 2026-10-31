-- ReminiCare Migration 0001: Skema, View, RLS, GRANT, dan Trigger Pendaftaran
-- Berdasarkan SPEC-ReminiCare-ramping.md §8.1-§8.4 dan PLAN-Backend-Pindra.md §3 Fase 1

-- ==========================================
-- 8.1 Tabel
-- ==========================================

create table public.profil (
  id uuid primary key references auth.users (id) on delete cascade,
  nama text not null default '',
  is_demo boolean not null default false,
  dibuat timestamptz not null default now()
);

create table public.pasien (
  id uuid primary key default gen_random_uuid(),
  terapis_id uuid not null references public.profil (id) on delete cascade,
  user_id uuid unique references auth.users (id) on delete set null,
  nama_panggilan text not null check (char_length(nama_panggilan) between 1 and 40),
  sisi_terdampak text not null check (sisi_terdampak in ('kiri', 'kanan')),
  gerakan text[] not null check (cardinality(gerakan) between 1 and 2 and gerakan <@ array['jangkau_depan', 'jangkau_samping']),
  repetisi int not null default 10 check (repetisi between 5 and 20),
  sesi_per_minggu int not null default 3 check (sesi_per_minggu between 1 and 7),
  toleransi_batang text not null default 'normal' check (toleransi_batang in ('abaikan', 'longgar', 'normal', 'ketat')),
  toleransi_bahu text not null default 'normal' check (toleransi_bahu in ('abaikan', 'longgar', 'normal', 'ketat')),
  durasi_persen int not null default 30 check (durasi_persen between 10 and 80),
  mode_koreksi text not null default 'penuh' check (mode_koreksi in ('penuh', 'ringkasan', 'mati')),
  kalimat_condong text not null default 'sandaran' check (kalimat_condong in ('sandaran', 'tegak')),
  kode_klaim text unique,
  kode_kedaluwarsa timestamptz,
  persetujuan_versi text,
  persetujuan_waktu timestamptz,
  persetujuan_oleh text check (persetujuan_oleh in ('pasien', 'wali')),
  is_sintetis boolean not null default false,
  dibuat timestamptz not null default now()
);
create index pasien_terapis_idx on public.pasien (terapis_id);

create table public.sesi (
  id uuid primary key,                                   -- dibuat di klien
  pasien_id uuid not null references public.pasien (id) on delete cascade,
  mulai timestamptz not null,
  selesai timestamptz not null,
  resep jsonb not null,
  baseline jsonb,
  rep_total int not null,
  rep_terukur int not null,
  rep_terkompensasi int not null,
  pct_terkompensasi numeric generated always as (rep_terkompensasi::numeric / nullif(rep_terukur, 0) * 100) stored,
  per_gerakan jsonb not null default '{}'::jsonb,
  pct_tak_terukur numeric,
  fps_median numeric,
  suara text check (suara in ('webspeech', 'klip')),
  delegate text check (delegate in ('GPU', 'CPU')),
  nyeri smallint check (nyeri in (0, 1, 2)),
  is_sintetis boolean not null default false,
  check (rep_total >= 1 and rep_terukur between 0 and rep_total and rep_terkompensasi between 0 and rep_terukur)
);
create index sesi_pasien_mulai_idx on public.sesi (pasien_id, mulai);

create table public.eskalasi (
  id uuid primary key default gen_random_uuid(),
  pasien_id uuid not null references public.pasien (id) on delete cascade,
  dibuka timestamptz not null default now(),
  sesi_pemicu uuid[] not null,
  median_baseline numeric not null,
  panjang_run int not null,
  batas int not null,
  ditinjau timestamptz,
  ditinjau_oleh uuid references public.profil (id) on delete set null,
  keputusan text check (keputusan in ('lanjutkan', 'ubah_resep', 'tatap_muka')),
  catatan text,
  check ((ditinjau is null) = (keputusan is null))
);
create index eskalasi_pasien_idx on public.eskalasi (pasien_id);
-- [default spec] satu eskalasi terbuka per pasien, dijaga DB
create unique index eskalasi_satu_terbuka on public.eskalasi (pasien_id) where ditinjau is null;

-- ==========================================
-- 8.2 View prioritas (F12 + PRD §6.1)
-- ==========================================

create view public.v_prioritas with (security_invoker = true) as
select
  p.id as pasien_id,
  p.nama_panggilan,
  p.is_sintetis,
  p.sesi_per_minggu,
  exists (select 1 from public.eskalasi e where e.pasien_id = p.id and e.ditinjau is null) as eskalasi_terbuka,
  t.nyeri as nyeri_terakhir,
  coalesce(t.nyeri = 2, false) as lencana_nyeri,
  k.n7 as sesi_7_hari,
  k.n7::numeric / p.sesi_per_minggu as kepatuhan_7h,
  (t.mulai is not null and k.n7::numeric / p.sesi_per_minggu < 0.5) as jarang,   -- [default spec] pasien tanpa sesi tidak dilabeli jarang
  t.pct_terkompensasi as pct_terakhir,
  t.mulai as sesi_terakhir
from public.pasien p
left join lateral (
  select s.nyeri, s.pct_terkompensasi, s.mulai
  from public.sesi s
  where s.pasien_id = p.id
  order by s.mulai desc
  limit 1
) t on true
cross join lateral (
  select count(*) as n7
  from public.sesi s
  where s.pasien_id = p.id and s.mulai > now() - interval '7 days'
) k
where p.terapis_id = (select auth.uid());

-- ==========================================
-- 8.3 RLS + GRANT (PRD §6.2)
-- ==========================================

alter table public.profil enable row level security;
alter table public.pasien enable row level security;
alter table public.sesi enable row level security;
alter table public.eskalasi enable row level security;

create policy profil_pilih on public.profil for select to authenticated
  using (id = (select auth.uid()));
create policy profil_ubah on public.profil for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy pasien_pilih on public.pasien for select to authenticated
  using (terapis_id = (select auth.uid()) or user_id = (select auth.uid()));
create policy pasien_sisip on public.pasien for insert to authenticated
  with check (terapis_id = (select auth.uid()));             -- FK ke profil: perangkat pasien gagal
create policy pasien_ubah on public.pasien for update to authenticated
  using (terapis_id = (select auth.uid())) with check (terapis_id = (select auth.uid()));
create policy pasien_hapus on public.pasien for delete to authenticated
  using (terapis_id = (select auth.uid()));

create policy sesi_pilih on public.sesi for select to authenticated
  using (exists (select 1 from public.pasien p where p.id = sesi.pasien_id
                 and (p.terapis_id = (select auth.uid()) or p.user_id = (select auth.uid()))));
create policy sesi_sisip on public.sesi for insert to authenticated
  with check (exists (select 1 from public.pasien p where p.id = sesi.pasien_id
                      and (p.user_id = (select auth.uid())
                           or (p.terapis_id = (select auth.uid())
                               and exists (select 1 from public.profil f where f.id = (select auth.uid()) and f.is_demo)))));
-- sesi: tanpa kebijakan ubah/hapus (nyeri lewat RPC, hapus lewat cabut_persetujuan / cascade)

create policy eskalasi_pilih on public.eskalasi for select to authenticated
  using (exists (select 1 from public.pasien p where p.id = eskalasi.pasien_id and p.terapis_id = (select auth.uid())));
create policy eskalasi_tinjau on public.eskalasi for update to authenticated
  using (exists (select 1 from public.pasien p where p.id = eskalasi.pasien_id and p.terapis_id = (select auth.uid())))
  with check (ditinjau_oleh = (select auth.uid()));
-- eskalasi: tanpa kebijakan sisip (hanya trigger security definer)

-- GRANT eksplisit (tabel baru tidak otomatis terbuka ke Data API). anon + service_role: tanpa GRANT.
grant select, update (nama) on public.profil to authenticated;
grant select, delete on public.pasien to authenticated;
-- [default spec] GRANT kolom membatasi apa yang bisa diubah langsung oleh klien. Kolom kode, user_id, persetujuan, dan is_sintetis hanya bisa diubah lewat RPC.
grant insert (terapis_id, nama_panggilan, sisi_terdampak, gerakan, repetisi, sesi_per_minggu, toleransi_batang,
              toleransi_bahu, durasi_persen, mode_koreksi, kalimat_condong) on public.pasien to authenticated;
grant update (nama_panggilan, sisi_terdampak, gerakan, repetisi, sesi_per_minggu, toleransi_batang,
              toleransi_bahu, durasi_persen, mode_koreksi, kalimat_condong) on public.pasien to authenticated;
grant select, insert on public.sesi to authenticated;
grant select on public.eskalasi to authenticated;
grant update (ditinjau, ditinjau_oleh, keputusan, catatan) on public.eskalasi to authenticated;
grant select on public.v_prioritas to authenticated;

-- ==========================================
-- 8.4 Trigger pendaftaran
-- ==========================================

create or replace function public.tangani_pengguna_baru()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'role' = 'fisioterapis' then
    insert into public.profil (id, nama)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'nama', ''));
  end if;
  return new;                       -- pengguna anonim (metadata kosong) dilewati
end;
$$;

create trigger pengguna_baru
  after insert on auth.users
  for each row execute function public.tangani_pengguna_baru();

revoke execute on function public.tangani_pengguna_baru() from public, anon, authenticated;

