-- supabase/tests/uji_eskalasi.sql
-- Uji logika trigger eskalasi Anhøj dan fungsi data sintetis
-- Sumber kebenaran: PLAN-Backend-Pindra.md §5.2 / SPEC-ReminiCare-ramping.md §12.2
-- Dijalankan di SQL Editor Supabase sebagai peran postgres dalam transaksi begin ... rollback

begin;

-- 1. Buat data pengguna terapis uji (memicu trigger daftar profil)
insert into auth.users (id, aud, role, email, raw_user_meta_data) values
  ('eeeeeeee-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'esk@uji.local', '{"role":"fisioterapis","nama":"Uji"}');

-- 2. Buat pasien uji sintetis dengan 4 pola berbeda
insert into public.pasien (id, terapis_id, nama_panggilan, sisi_terdampak, gerakan, is_sintetis) values
  ('e0000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000000', 'memburuk',     'kanan', '{jangkau_depan,jangkau_samping}', true),
  ('e0000000-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000000', 'stabil_nyeri', 'kiri',  '{jangkau_depan,jangkau_samping}', true),
  ('e0000000-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-000000000000', 'uji_berderau', 'kanan', '{jangkau_depan,jangkau_samping}', true),
  ('e0000000-0000-0000-0000-000000000004', 'eeeeeeee-0000-0000-0000-000000000000', 'uji_median',   'kanan', '{jangkau_depan,jangkau_samping}', true);

-- 3. Isi data sesi sintetis kronologis (memicu trigger cek_eskalasi pada tiap sisipan)
select public.isi_sintetis(id, nama_panggilan) from public.pasien where terapis_id = 'eeeeeeee-0000-0000-0000-000000000000';

-- 4. Verifikasi status eskalasi per pola
-- Hasil yang diharapkan:
-- memburuk:     panjang_run = 8, batas = 7, median_baseline = 12.5, n_pemicu = 8 (sesi 6–13)
-- stabil_nyeri: kosong (tidak ada baris eskalasi karena titik 20 dilewati, nilai berulang 20,15,25)
-- uji_berderau: panjang_run = 8, batas = 7, median_baseline = 12.5
-- uji_median:   panjang_run = 8, batas = 7, median_baseline = 15 (memicu di sesi 16 saat titik = median 15 dilewati)
select p.nama_panggilan, e.panjang_run, e.batas, e.median_baseline, cardinality(e.sesi_pemicu) as n_pemicu
from public.pasien p left join public.eskalasi e on e.pasien_id = p.id
where p.terapis_id = 'eeeeeeee-0000-0000-0000-000000000000'
order by p.nama_panggilan;

-- 5. Uji Tinjau Eskalasi:
-- Terapis meninjau eskalasi dengan keputusan 'lanjutkan'
update public.eskalasi set ditinjau = now(), keputusan = 'lanjutkan'
 where pasien_id = 'e0000000-0000-0000-0000-000000000001';

-- Sisipkan 1 sesi 40% setelah peninjauan -> tidak membuka ulang eskalasi karena titik sejak tinjauan baru 1 (< 7)
insert into public.sesi (id, pasien_id, mulai, selesai, resep, rep_total, rep_terukur, rep_terkompensasi)
values (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', now() + interval '1 minute', now() + interval '13 minutes', '{}', 20, 20, 8);

-- Sisipkan 1 sesi dengan 3 repetisi terukur -> bukan titik data (rep_terukur < 5), diabaikan oleh trigger
insert into public.sesi (id, pasien_id, mulai, selesai, resep, rep_total, rep_terukur, rep_terkompensasi)
values (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', now() + interval '2 minutes', now() + interval '14 minutes', '{}', 3, 3, 3);

-- 6. Verifikasi jumlah eskalasi setelah tinjau + 1 sesi 40% + 1 sesi 3 repetisi:
-- Hasil yang diharapkan: terbuka = 0 (eskalasi lama sudah ditinjau, eskalasi baru belum terbuka), total = 1
select count(*) filter (where ditinjau is null) as terbuka, count(*) as total
from public.eskalasi where pasien_id = 'e0000000-0000-0000-0000-000000000001';

rollback;

