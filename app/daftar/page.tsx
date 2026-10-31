'use client';

import { useState } from 'react';
import Link from 'next/link';
import { pesanGalat } from '../../lib/supabase';
import { mulaiLoginGoogle } from '../../lib/google';
import type { PeranDaftar } from '../../lib/google';
import AuthLayout, { IkonGoogle, useAlihkanBilaMasuk } from '../../components/AuthLayout';

const NAMA_PERAN: Record<PeranDaftar, string> = {
  fisioterapis: 'Fisioterapis',
  pasien: 'Pasien',
};

export default function Page() {
  const memeriksa = useAlihkanBilaMasuk();
  const [peran, setPeran] = useState<PeranDaftar | ''>('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  async function handleGoogle() {
    if (!peran) return;
    setGalat('');
    setSibuk(true);
    const { error } = await mulaiLoginGoogle(peran);
    if (error) {
      setGalat(pesanGalat(error));
      setSibuk(false);
    }
  }

  return (
    <AuthLayout>
      {memeriksa ? (
        <p className="rc-sub text-center" role="status">Memuat…</p>
      ) : (
        <>
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-ink">Buat Akun!</h1>
            <p className="mt-2 text-sm">Buat akun untuk melanjutkan</p>
          </div>

          {galat && <div role="alert" className="rc-alert">{galat}</div>}

          <div className="flex flex-col gap-3 mt-4">
            <label htmlFor="peran" className="text-sm font-medium">Pilih Peran Anda</label>
            <div className="relative">
              <select
                id="peran"
                value={peran}
                onChange={e => setPeran(e.target.value as PeranDaftar | '')}
                className="min-h-[44px] w-full appearance-none rounded-sm border border-black/30 bg-white px-3 pr-10 text-sm text-ink"
              >
                <option value="">Daftar Sebagai</option>
                <option value="fisioterapis">{NAMA_PERAN.fisioterapis}</option>
                <option value="pasien">{NAMA_PERAN.pasien}</option>
              </select>
              <svg
                width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink"
              >
                <path fill="currentColor" d="M7 10l5 5 5-5z" />
              </svg>
            </div>

            <button onClick={handleGoogle} disabled={!peran || sibuk} className="rc-btn-google">
              <IkonGoogle />
              {sibuk
                ? 'Membuka Google…'
                : peran ? `Sign Up as ${NAMA_PERAN[peran]}` : 'Sign Up with Google'}
            </button>
          </div>

          <p className="text-center text-sm">
            Sudah Punya Akun? <Link href="/" className="rc-tautan text-sm! font-semibold">Masuk</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
