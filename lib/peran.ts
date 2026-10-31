/**
 * Modul peran V9: tipe Peran dan fungsi murni untuk autentikasi Google OAuth2.
 * Tanpa impor Supabase atau DOM, aman untuk node --test.
 */

export type Peran =
  | { jenis: 'keluar' }
  | { jenis: 'terapis'; uid: string; nama: string }
  | { jenis: 'pasien'; uid: string; pasienId: string }
  | { jenis: 'pasien_baru'; uid: string }
  | { jenis: 'tanpa_peran'; uid: string }
  | { jenis: 'luring'; uid?: string };

/**
 * Petakan hasil query profil dan pasien ke tipe Peran.
 * @param uid - User ID dari auth.session
 * @param profil - Row profil dengan peran dan nama, atau null bila tidak ada
 * @param pasienId - ID pasien bila user_id cocok, atau null bila tidak terikat
 */
export function petakanPeran(
  uid: string,
  profil: { peran: 'fisioterapis' | 'pasien'; nama: string } | null,
  pasienId: string | null
): Peran {
  if (!profil) {
    return { jenis: 'tanpa_peran', uid };
  }

  if (profil.peran === 'fisioterapis') {
    return { jenis: 'terapis', uid, nama: profil.nama };
  }

  // Peran pasien
  if (pasienId) {
    return { jenis: 'pasien', uid, pasienId };
  }

  return { jenis: 'pasien_baru', uid };
}

/**
 * Validasi path internal (awali `/`, bukan `//` atau `/\`).
 * Menolak open redirect seperti `//evil.com`, `/\evil.com`, `https://...`, atau `evil.com`.
 * @returns path bila lolos, null bila tidak aman
 */
export function lanjutAman(l: string | null | undefined): string | null {
  if (!l) return null;
  // Harus awali `/` tapi bukan `//` atau `/\`
  if (/^\/(?![\/\\])/.test(l)) {
    return l;
  }
  return null;
}

/**
 * Bangun URL redirect untuk OAuth2 callback.
 * @param origin - Origin situs (misal: `https://x.app` atau `http://localhost:3000`)
 * @param o - Opsi peran dan lanjut
 * @returns URL lengkap untuk `redirectTo`
 */
export function bangunRedirect(
  origin: string,
  o: { peran?: 'fisioterapis' | 'pasien'; lanjut?: string } = {}
): string {
  const base = `${origin}/auth/selesai`;
  const params = new URLSearchParams();

  if (o.peran) {
    params.set('peran', o.peran);
  }

  const lanjutBersih = lanjutAman(o.lanjut);
  if (lanjutBersih) {
    params.set('lanjut', lanjutBersih);
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/**
 * Petakan galat Supabase ke pesan pengguna (V9).
 * Menghapus kode sandbox lama dan menambah kode V9 baru.
 */
export function pesanGalat(e: { message?: string; status?: number } | null): string {
  if (!e) return 'Terjadi galat, coba lagi';

  if (e.status === 429) {
    return 'Batas percobaan tercapai, coba lagi sebentar lagi';
  }

  const msg = e.message ?? '';

  // Kode V9 baru
  if (msg.includes('peran_lain')) {
    return 'Akun Google ini sudah terdaftar dengan peran lain. Pakai akun Google lain untuk peran ini.';
  }
  if (msg.includes('belum_daftar')) {
    return 'Akun ini belum terdaftar. Pilih "Sign Up as Pasien" dulu.';
  }
  if (msg.includes('bukan_fisioterapis')) {
    return 'Hanya akun fisioterapis yang bisa mengisi data contoh.';
  }
  if (msg.includes('akun_terapis')) {
    return 'Akun ini terdaftar sebagai fisioterapis. Keluar, lalu masuk dengan akun Google lain untuk menjadi pasien.';
  }
  if (msg.includes('sudah_terikat')) {
    return 'Akun ini sudah terhubung ke pasien lain. Hapus data dulu di beranda, atau masuk dengan akun Google lain.';
  }
  if (msg.includes('tidak_terikat')) {
    return 'Akun ini belum terhubung ke pasien.';
  }

  // Kode lama yang tetap
  if (msg.includes('bukan_pasien_anda')) {
    return 'Pasien ini bukan milik akun Anda.';
  }
  if (msg.includes('kode_tidak_sah')) {
    return 'Minta tautan baru ke fisioterapis';
  }

  return 'Terjadi galat, coba lagi';
}
