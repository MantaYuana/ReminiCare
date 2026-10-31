'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { pesanGalat } from '../lib/supabase';
import { mulaiLoginGoogle } from '../lib/google';
import AuthLayout, { IkonGoogle, useAlihkanBilaMasuk } from '../components/AuthLayout';

// Galat dari /auth/selesai datang lewat ?galat=, pesan sukses lewat ?pesan= (SPEC §10.1)
const PESAN_URL: Record<string, string> = {
  oauth: 'Login Google gagal, coba lagi.',
  peran_lain: 'Akun Google ini sudah terdaftar dengan peran lain. Pakai akun Google lain untuk peran ini.',
};

function Isi() {
  const params = useSearchParams();
  const memeriksa = useAlihkanBilaMasuk();
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const galatUrl = PESAN_URL[params.get('galat') ?? ''];
  const dihapus = params.get('pesan') === 'dihapus';

  async function handleGoogle() {
    setGalat('');
    setSibuk(true);
    const { error } = await mulaiLoginGoogle();
    if (error) {
      setGalat(pesanGalat(error));
      setSibuk(false);
    }
  }

  if (memeriksa) {
    return <p className="rc-sub text-center" role="status">Memuat…</p>;
  }

  return (
    <>
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-ink">Selamat Datang!</h1>
        <p className="rc-sub mt-2">Masuk ke akun Google Anda untuk melanjutkan</p>
      </div>

      {dihapus && <div role="status" className="rc-ok">Data dihapus.</div>}
      {(galatUrl || galat) && <div role="alert" className="rc-alert">{galat || galatUrl}</div>}

      <div className="flex flex-col gap-3">
        <button onClick={handleGoogle} disabled={sibuk} className="rc-btn-google">
          <IkonGoogle />
          {sibuk ? 'Membuka Google…' : 'Login with Google'}
        </button>
        <Link href="/tamu" className="rc-btn-google">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="text-brand-600">
            <path fill="currentColor" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" />
          </svg>
          Masuk Sebagai Tamu
        </Link>
      </div>

      <p className="text-center text-base">
        Belum Punya Akun? <Link href="/daftar" className="rc-tautan font-semibold">Buat Akun</Link>
      </p>
    </>
  );
}

export default function Page() {
  return (
    <AuthLayout>
      <Suspense fallback={<p className="rc-sub text-center" role="status">Memuat…</p>}>
        <Isi />
      </Suspense>
    </AuthLayout>
  );
}
