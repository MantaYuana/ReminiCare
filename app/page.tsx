'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, cekPeran, pesanGalat } from '../lib/supabase';
import FormMasuk from '../components/FormMasuk';

type TampilForm = 'tidak' | 'fisioterapis';

export default function Page() {
  const router  = useRouter();
  const [tampil, setTampil]   = useState<TampilForm>('tidak');
  const [galat, setGalat]     = useState('');
  const [loading, setLoading] = useState(true);

  // Redirect bila sudah login
  useEffect(() => {
    cekPeran().then(peran => {
      if (peran.jenis === 'terapis') router.replace('/terapis');
      else if (peran.jenis === 'pasien') router.replace('/pasien');
      else setLoading(false);
    });
  }, [router]);

  async function handleJuri() {
    setGalat('');
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) { setGalat(pesanGalat(error)); return; }
      }
      const { error: rpcErr } = await supabase.rpc('buat_sandbox');
      if (rpcErr) { setGalat(pesanGalat(rpcErr)); return; }
      router.replace('/terapis');
    } catch {
      setGalat('Terjadi galat, coba lagi');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-base text-gray-500">Memuat…</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center gap-6 min-h-screen p-6">
      <h1 className="text-3xl font-bold text-center">ReminiCare</h1>
      <p className="text-base text-gray-600 text-center">Aplikasi rehabilitasi fisioterapi mandiri</p>

      {galat && (
        <div role="alert" className="w-full max-w-sm bg-red-50 border border-red-300 rounded-xl p-4 text-base text-red-700">
          {galat}
        </div>
      )}

      {tampil === 'fisioterapis' ? (
        <div className="w-full max-w-sm flex flex-col gap-4">
          <FormMasuk onBerhasil={() => router.replace('/terapis')} />
          <button
            onClick={() => { setTampil('tidak'); setGalat(''); }}
            className="btn-sekunder text-base text-gray-600 underline focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
          >
            Kembali
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm flex flex-col gap-4">
          {/* Tombol utama ≥ 64px */}
          <button
            onClick={() => { setTampil('fisioterapis'); setGalat(''); }}
            className="btn-utama bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Saya fisioterapis
          </button>

          <button
            onClick={handleJuri}
            className="btn-utama bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            Coba sebagai juri
          </button>

          <button
            onClick={() => router.push('/tamu')}
            className="btn-utama bg-white border border-gray-300 text-gray-800 rounded-xl hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            Mode tamu
          </button>
        </div>
      )}
    </main>
  );
}
