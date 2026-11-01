-- ReminiCare Migration 0005: pasien terhubung boleh melihat nama dan foto fisioterapisnya
-- Berlaku di atas 0004 (butuh profil.peran). RLS profil TIDAK dilonggarkan: akses hanya lewat RPC ini.
-- Yang keluar hanya nama dan foto profil Google fisioterapis milik pasien pemanggil; email dan kolom lain tidak ikut.

create or replace function public.terapis_saya()
returns table (nama text, foto text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    nullif(f.nama, '') as nama,
    -- hanya URL https yang dikembalikan; metadata Google bisa memakai avatar_url atau picture
    case
      when coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture') like 'https://%'
        then coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
    end as foto
  from public.pasien p
  join public.profil f on f.id = p.terapis_id
  join auth.users u on u.id = p.terapis_id
  where p.user_id = auth.uid()      -- tanpa sesi masuk, auth.uid() null: tidak ada baris
  limit 1;
$$;

revoke execute on function public.terapis_saya () from public, anon;

grant execute on function public.terapis_saya () to authenticated;
