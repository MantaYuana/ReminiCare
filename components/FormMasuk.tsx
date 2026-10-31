'use client';

import { useState } from 'react';
import { supabase, pesanGalat } from '../lib/supabase';

type Mode = 'pilih' | 'masuk' | 'daftar';

interface PropsFormMasuk {
  onBerhasil(): void;
}

export default function FormMasuk({ onBerhasil }: PropsFormMasuk) {
  const [mode, setMode]         = useState<Mode>('masuk');
  const [email, setEmail]       = useState('');
  const [sandi, setSandi]       = useState('');
  const [nama, setNama]         = useState('');
  const [galat, setGalat]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGalat('');
    setLoading(true);
    try {
      if (mode === 'masuk') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: sandi });
        if (error) { setGalat(pesanGalat(error)); return; }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: sandi,
          options: { data: { role: 'fisioterapis', nama } },
        });
        if (error) { setGalat(pesanGalat(error)); return; }
      }
      onBerhasil();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      {galat && (
        <div role="alert" className="bg-red-50 border border-red-300 rounded-xl p-3 text-base text-red-700">
          {galat}
        </div>
      )}

      {mode === 'daftar' && (
        <div>
          <label htmlFor="nama" className="block text-base font-medium mb-1">Nama</label>
          <input
            id="nama"
            type="text"
            value={nama}
            onChange={e => setNama(e.target.value)}
            required
            autoComplete="name"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
            placeholder="Nama lengkap"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-base font-medium mb-1">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
          placeholder="email@contoh.com"
        />
      </div>

      <div>
        <label htmlFor="sandi" className="block text-base font-medium mb-1">Kata sandi</label>
        <input
          id="sandi"
          type="password"
          value={sandi}
          onChange={e => setSandi(e.target.value)}
          required
          autoComplete={mode === 'daftar' ? 'new-password' : 'current-password'}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus-visible:ring-2 focus-visible:ring-blue-500 outline-none"
          placeholder="Kata sandi"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-utama bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {loading ? 'Memproses…' : mode === 'masuk' ? 'Masuk' : 'Daftar'}
      </button>

      <button
        type="button"
        onClick={() => { setMode(m => m === 'masuk' ? 'daftar' : 'masuk'); setGalat(''); }}
        className="text-base text-blue-600 underline focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        {mode === 'masuk' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
      </button>
    </form>
  );
}
