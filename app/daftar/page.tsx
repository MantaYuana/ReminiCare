'use client';

import { useState } from 'react';
import Link from 'next/link';
import { masukGoogle, pesanGalat } from '../../lib/supabase';
import AuthLayout, { IkonGoogle, useAlihkanBilaMasuk } from '../../components/AuthLayout';
import { PilihanPeran, labelDaftar, type PeranDaftar } from '../../components/PilihPeran';

export default function Page() {
  const [status] = useAlihkanBilaMasuk();
  const [peran, setPeran] = useState<PeranDaftar | ''>('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  async function handleGoogle() {
    if (!peran) return;
    setGalat('');
    setSibuk(true);
    const { error } = await masukGoogle({ peran });
    if (error) {
      setGalat(pesanGalat(error));
      setSibuk(false);
    }
  }

  return (
    <AuthLayout>
      {status === 'memeriksa' ? (
        <p className="rc-sub text-center" role="status">Memuat…</p>
      ) : (
        <>
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-ink">Buat Akun!</h1>
            <p className="mt-2 text-sm">Buat akun untuk melanjutkan</p>
          </div>

          {galat && <div role="alert" className="rc-alert">{galat}</div>}

          <div className="flex flex-col gap-3 mt-4">
            <PilihanPeran id="peran" value={peran} onChange={setPeran} />

            <button onClick={handleGoogle} disabled={!peran || sibuk} className="rc-btn-google">
              <IkonGoogle />
              {sibuk ? 'Membuka Google…' : labelDaftar(peran)}
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
