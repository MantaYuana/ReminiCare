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
            <h1 className="text-4xl font-bold tracking-tight text-ink">Buat Akun</h1>
            <p className="rc-sub mt-2">Buat akun untuk melanjutkan</p>
          </div>

          {galat && <div role="alert" className="rc-alert">{galat}</div>}

          <div className="flex flex-col gap-3">
            <label htmlFor="peran" className="text-base font-medium">Pilih Peran Anda</label>
            <div className="relative">
              <select
                id="peran"
                value={peran}
                onChange={e => setPeran(e.target.value as PeranDaftar | '')}
                className="min-h-[56px] w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 pr-12 text-base text-ink"
              >
                <option value="">Daftar Sebagai</option>
                <option value="fisioterapis">{NAMA_PERAN.fisioterapis}</option>
                <option value="pasien">{NAMA_PERAN.pasien}</option>
              </select>
              <svg
                width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink"
              >
                <path fill="currentColor" d="M7 10l5 5 5-5z" />
              </svg>
            </div>

            <button onClick={handleGoogle} disabled={!peran || sibuk} className="rc-btn-google" aria-describedby="petunjuk-peran">
              <IkonGoogle />
              {sibuk
                ? 'Membuka Google…'
                : peran ? `Sign Up as ${NAMA_PERAN[peran]}` : 'Sign Up with Google'}
            </button>
            {!peran && (
              <p id="petunjuk-peran" className="text-base text-muted text-center">
                Pilih peran Anda dulu untuk mengaktifkan tombol Google.
              </p>
            )}
            <p className="text-base text-muted text-center">Satu akun Google hanya untuk satu peran.</p>
          </div>

          <p className="text-center text-base">
            Sudah Punya Akun? <Link href="/" className="rc-tautan font-semibold">Masuk</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
