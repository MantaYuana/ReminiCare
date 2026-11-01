'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { cekPeran, masukGoogle, pesanGalat } from '../../lib/supabase';
import { ruteUntuk } from '../../lib/arah';
import AuthLayout, { IkonGoogle, useAlihkanBilaMasuk } from '../../components/AuthLayout';
import PilihPeran from '../../components/PilihPeran';

// Galat dari /auth/selesai datang lewat ?galat=, pesan sukses lewat ?pesan= (SPEC §10.1)
const PESAN_URL: Record<string, string> = {
  oauth: 'Login Google gagal, coba lagi.',
  peran_lain: 'Akun Google ini sudah terdaftar dengan peran lain. Pakai akun Google lain untuk peran ini.',
};

function Isi() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useAlihkanBilaMasuk();
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const galatUrl = PESAN_URL[params.get('galat') ?? ''];
  const dihapus = params.get('pesan') === 'dihapus';

  async function handleGoogle() {
    setGalat('');
    setSibuk(true);
    const { error } = await masukGoogle();
    if (error) {
      setGalat(pesanGalat(error));
      setSibuk(false);
    }
  }

  if (status === 'memeriksa') {
    return <p className="rc-sub text-center" role="status">Memuat…</p>;
  }

  if (status === 'tanpa_peran') {
    return (
      <PilihPeran
        onSelesai={async () => router.replace(ruteUntuk(await cekPeran(), null) ?? '/')}
        onKeluar={() => setStatus('siap')}
      />
    );
  }

  return (
    <>
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-ink">Selamat Datang!</h1>
        <p className="mt-3 text-sm mb-5">Masuk ke akun Google Anda untuk melanjutkan</p>
      </div>

      {dihapus && <div role="status" className="rc-ok">Data dihapus.</div>}
      {(galatUrl || galat) && <div role="alert" className="rc-alert">{galat || galatUrl}</div>}

      <div className="flex flex-col gap-4">
        <button onClick={handleGoogle} disabled={sibuk} className="rc-btn-google">
          <IkonGoogle />
          {sibuk ? 'Membuka Google…' : 'Login with Google'}
        </button>
        <Link href="/tamu" className="rc-btn-google">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="text-brand-600">
            <path fill="currentColor" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" />
          </svg>
          Masuk Sebagai Tamu
        </Link>
      </div>

      <p className="text-center text-sm">
        Belum Punya Akun? <Link href="/daftar" className="rc-tautan text-sm! font-semibold">Buat Akun</Link>
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
