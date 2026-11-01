'use client';

import { useState } from 'react';
import { supabase, pesanGalat } from '../lib/supabase';
import { IkonGoogle } from './AuthLayout';

export type PeranDaftar = 'fisioterapis' | 'pasien';

const NAMA_PERAN: Record<PeranDaftar, string> = {
  fisioterapis: 'Fisioterapis',
  pasien: 'Pasien',
};

/** Teks tombol sign up sesuai pilihan (label persis V9). */
export function labelDaftar(p: PeranDaftar | ''): string {
  return p ? `Sign Up as ${NAMA_PERAN[p]}` : 'Sign Up with Google';
}

/** Select "Daftar Sebagai" yang dipakai /daftar dan PilihPeran. */
export function PilihanPeran({ id, value, onChange }: {
  id: string;
  value: PeranDaftar | '';
  onChange: (p: PeranDaftar | '') => void;
}) {
  return (
    <>
      <label htmlFor={id} className="text-sm font-medium">Pilih Peran Anda</label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={e => onChange(e.target.value as PeranDaftar | '')}
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
    </>
  );
}

/**
 * Untuk akun yang sudah login Google tetapi belum punya peran: memanggil RPC `daftar`
 * tanpa OAuth ulang. `kunci` mengunci pilihan (mis. di /k/[kode] hanya boleh pasien).
 */
export default function PilihPeran({ kunci, onSelesai, onKeluar }: {
  kunci?: PeranDaftar;
  onSelesai: (peran: PeranDaftar) => void;
  onKeluar: () => void;
}) {
  const [pilihan, setPilihan] = useState<PeranDaftar | ''>(kunci ?? '');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  async function handleDaftar() {
    if (!pilihan) return;
    setGalat('');
    setSibuk(true);
    const { error } = await supabase.rpc('daftar', { p_peran: pilihan });
    if (error) {
      setGalat(pesanGalat(error));
      setSibuk(false);
      return;
    }
    onSelesai(pilihan);
  }

  async function handleKeluar() {
    setSibuk(true);
    await supabase.auth.signOut();
    onKeluar();
  }

  return (
    <>
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-ink">Pilih Peran Anda</h1>
        <p className="mt-2 text-sm">Akun Google Anda sudah masuk, tetapi belum punya peran.</p>
      </div>

      {galat && <div role="alert" className="rc-alert">{galat}</div>}

      <div className="flex flex-col gap-3 mt-4">
        {!kunci && <PilihanPeran id="pilih-peran" value={pilihan} onChange={setPilihan} />}

        <button onClick={handleDaftar} disabled={!pilihan || sibuk} className="rc-btn-google">
          <IkonGoogle />
          {sibuk ? 'Memproses…' : labelDaftar(pilihan)}
        </button>
        <button onClick={handleKeluar} disabled={sibuk} className="rc-btn-2">Keluar</button>
      </div>

      <p className="text-center text-sm">Satu akun Google hanya untuk satu peran.</p>
    </>
  );
}
