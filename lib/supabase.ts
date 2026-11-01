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
  supabasePublishableKey || 'placeholder',
  {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
    },
  }
);

// Ekspor ulang tipe dan fungsi dari peran.ts supaya impor pemakai lama tidak berubah
export { pesanGalat, lanjutAman } from './peran.ts';
export type { Peran } from './peran.ts';
import { petakanPeran, bangunRedirect } from './peran.ts';
import type { Peran } from './peran.ts';

/**
 * Login dengan Google OAuth2 (PKCE).
 * @param o - Opsi peran dan lanjut untuk redirect callback
 */
export function masukGoogle(o: { peran?: 'fisioterapis' | 'pasien'; lanjut?: string } = {}) {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: bangunRedirect(location.origin, o),
      queryParams: {
        prompt: 'select_account',
      },
    },
  });
}

export async function cekPeran(): Promise<Peran> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      if (isAuthRetryableFetchError(sessionError) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return { jenis: 'luring' };
      }
      return { jenis: 'keluar' };
    }

    // Tanpa sesi tersimpan = belum masuk, luring atau tidak. (Sesi yang gagal di-refresh karena luring
    // datang lewat sessionError di atas sebagai luring tanpa uid, dan tetap diarahkan ke /pasien.)
    if (!session?.user) {
      return { jenis: 'keluar' };
    }

    const uid = session.user.id;

    // Cek luring di browser
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { jenis: 'luring', uid };
    }

    // 1. Profil dan pasien sekaligus (tidak saling bergantung): satu round trip, bukan dua
    const [
      { data: profil, error: profilErr },
      { data: pasien, error: pasienErr },
    ] = await Promise.all([
      supabase.from('profil').select('peran, nama').eq('id', uid).maybeSingle(),
      supabase.from('pasien').select('id').eq('user_id', uid).maybeSingle(),
    ]);

    if (profilErr) {
      // Jika kode kosong (transport error) atau perangkat luring -> mode luring
      if (!profilErr.code || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return { jenis: 'luring', uid };
      }
      console.error('Galat saat query profil:', profilErr);
      throw profilErr;
    }

    // 2. Hasil pasien hanya bermakna untuk peran pasien
    let pasienId: string | null = null;
    if (profil?.peran === 'pasien') {
      if (pasienErr) {
        // Jika kode kosong (transport error) atau perangkat luring -> mode luring
        if (!pasienErr.code || (typeof navigator !== 'undefined' && !navigator.onLine)) {
          return { jenis: 'luring', uid };
        }
        console.error('Galat saat query pasien:', pasienErr);
        throw pasienErr;
      }

      pasienId = pasien?.id ?? null;
    }

    // 3. Petakan ke Peran
    return petakanPeran(uid, profil, pasienId);
  } catch (err: unknown) {
    if (isAuthRetryableFetchError(err) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { jenis: 'luring' };
    }
    console.error('Galat di cekPeran:', err);
    return { jenis: 'keluar' };
  }
}
