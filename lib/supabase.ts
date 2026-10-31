import { createClient, isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabasePublishableKey) {
  console.error(
    'Konfigurasi Supabase belum lengkap. Pastikan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY telah diatur di .env.local.'
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder'
);

export type Peran =
  | { jenis: 'keluar' }                                          // tidak ada sesi auth
  | { jenis: 'terapis'; uid: string; demo: boolean; nama: string }
  | { jenis: 'pasien'; uid: string; pasienId: string }
  | { jenis: 'tanpa_peran'; uid: string; anonim: boolean }       // anon belum klaim / belum sandbox
  | { jenis: 'luring'; uid?: string };                           // ada sesi, tapi query gagal → pakai rc_resep

export async function cekPeran(): Promise<Peran> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      if (isAuthRetryableFetchError(sessionError) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return { jenis: 'luring' };
      }
      return { jenis: 'keluar' };
    }

    if (!session?.user) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { jenis: 'luring' };
      }
      return { jenis: 'keluar' };
    }

    const uid = session.user.id;
    const anonim = !!session.user.is_anonymous;

    // Cek luring di browser
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { jenis: 'luring', uid };
    }

    // 1. Cek profil terapis
    const { data: profil, error: profilErr } = await supabase
      .from('profil')
      .select('nama, is_demo')
      .eq('id', uid)
      .maybeSingle();

    if (profilErr) {
      // Jika kode kosong (transport error) atau perangkat luring -> mode luring
      if (!profilErr.code || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return { jenis: 'luring', uid };
      }
      console.error('Galat saat query profil:', profilErr);
      throw profilErr;
    }

    if (profil) {
      return {
        jenis: 'terapis',
        uid,
        demo: !!profil.is_demo,
        nama: profil.nama ?? '',
      };
    }

    // 2. Cek pasien
    const { data: pasien, error: pasienErr } = await supabase
      .from('pasien')
      .select('id')
      .eq('user_id', uid)
      .maybeSingle();

    if (pasienErr) {
      // Jika kode kosong (transport error) atau perangkat luring -> mode luring
      if (!pasienErr.code || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return { jenis: 'luring', uid };
      }
      console.error('Galat saat query pasien:', pasienErr);
      throw pasienErr;
    }

    if (pasien) {
      return {
        jenis: 'pasien',
        uid,
        pasienId: pasien.id,
      };
    }

    // 3. Tanpa peran (anonim belum klaim / belum sandbox)
    return {
      jenis: 'tanpa_peran',
      uid,
      anonim,
    };
  } catch (err: unknown) {
    if (isAuthRetryableFetchError(err) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { jenis: 'luring' };
    }
    console.error('Galat di cekPeran:', err);
    return { jenis: 'keluar' };
  }
}

export function pesanGalat(e: { message?: string; status?: number } | null): string {
  if (!e) return 'Terjadi galat, coba lagi';

  if (e.status === 429) {
    return 'Batas percobaan tercapai, coba lagi sebentar lagi';
  }

  const msg = e.message ?? '';

  if (msg.includes('kode_tidak_sah')) {
    return 'Minta tautan baru ke fisioterapis';
  }
  if (msg.includes('sudah_terikat')) {
    return 'Perangkat ini sudah terikat ke pasien lain. Hapus data dulu di beranda.';
  }
  if (msg.includes('akun_terapis')) {
    return 'Keluar dari akun fisioterapis dulu';
  }
  if (msg.includes('perangkat_pasien')) {
    return 'Perangkat ini terikat ke pasien. Hapus data dulu untuk mencoba sebagai juri.';
  }
  if (msg.includes('tidak_terikat')) {
    return 'Perangkat ini belum terikat ke pasien.';
  }
  if (msg.includes('Invalid login credentials')) {
    return 'Email atau kata sandi salah';
  }
  if (msg.includes('User already registered')) {
    return 'Email sudah terdaftar';
  }

  return 'Terjadi galat, coba lagi';
}
