'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, cekPeran, pesanGalat } from '../../../lib/supabase';
import { ruteUntuk } from '../../../lib/arah';
import AuthLayout from '../../../components/AuthLayout';
import PilihPeran from '../../../components/PilihPeran';

type Tampil = 'masuk' | 'pilih' | 'galat';

function Isi() {
  const router = useRouter();
  const params = useSearchParams();
  const [tampil, setTampil] = useState<Tampil>('masuk');
  const [galat, setGalat] = useState('');
  const sudahJalan = useRef(false);

  const lanjut = params.get('lanjut');
  const peranParam = params.get('peran');
  const peran = peranParam === 'fisioterapis' || peranParam === 'pasien' ? peranParam : null;
  const adaError = params.has('error');

  useEffect(() => {
    // Efek hanya sekali (StrictMode menjalankannya dua kali di dev); `daftar` tetap idempoten bila terpanggil lagi.
    if (sudahJalan.current) return;
    sudahJalan.current = true;

    async function selesaikan() {
      if (adaError) { router.replace('/?galat=oauth'); return; }

      // supabase-js menukar ?code= sendiri saat inisialisasi; getSession menunggu penukaran itu selesai.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/?galat=oauth'); return; }

      if (peran) {
        const { error } = await supabase.rpc('daftar', { p_peran: peran });
        if (error) {
          if (error.message?.includes('peran_lain')) {
            await supabase.auth.signOut();
            router.replace('/?galat=peran_lain');
          } else {
            setGalat(pesanGalat(error));
            setTampil('galat');
          }
          return;
        }
      }

      const p = await cekPeran();
      if (p.jenis === 'tanpa_peran') { setTampil('pilih'); return; }
      router.replace(ruteUntuk(p, lanjut) ?? '/');
    }
    selesaikan();
  }, [router, adaError, peran, lanjut]);

  async function setelahPilih() {
    const p = await cekPeran();
    router.replace(ruteUntuk(p, lanjut) ?? '/');
  }

  if (tampil === 'pilih') {
    return <PilihPeran onSelesai={setelahPilih} onKeluar={() => router.replace('/')} />;
  }

  if (tampil === 'galat') {
    return (
      <>
        <div role="alert" className="rc-alert">{galat}</div>
        <button onClick={() => router.replace('/')} className="rc-btn-2">Kembali ke halaman masuk</button>
      </>
    );
  }

  return <p className="rc-sub text-center" role="status">Sedang masuk…</p>;
}

export default function Page() {
  return (
    <AuthLayout>
      <Suspense fallback={<p className="rc-sub text-center" role="status">Sedang masuk…</p>}>
        <Isi />
      </Suspense>
    </AuthLayout>
  );
}
