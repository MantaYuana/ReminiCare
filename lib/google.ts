// lib/google.ts
// Sementara: memulai login Google langsung lewat supabase-js.
// TODO: ganti dengan masukGoogle() dari lib/supabase.ts (Pindra, Task 4) begitu masuk;
// itu juga yang menangani `lanjut` dengan lanjutAman().

import { supabase } from './supabase.ts';

export type PeranDaftar = 'fisioterapis' | 'pasien';

/** Mengarahkan ke Google. `peran` diteruskan ke /auth/selesai supaya RPC daftar mencatatnya. */
export function mulaiLoginGoogle(peran?: PeranDaftar) {
  const q = new URLSearchParams();
  if (peran) q.set('peran', peran);
  const sufiks = q.size > 0 ? `?${q}` : '';
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${location.origin}/auth/selesai${sufiks}`,
      queryParams: { prompt: 'select_account' },
    },
  });
}
