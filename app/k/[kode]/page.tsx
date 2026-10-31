'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { supabase, cekPeran, masukGoogle, pesanGalat } from '../../../lib/supabase';
import { normalKode } from '../../../lib/arah';
import { simpanResep } from '../../../lib/lokal';
import AuthLayout, { IkonGoogle } from '../../../components/AuthLayout';
import LayarSetuju from '../../../components/LayarSetuju';
import PilihPeran from '../../../components/PilihPeran';

type TampilLayar =
  | 'memuat' | 'kode_salah' | 'keluar' | 'terapis' | 'tanpa_peran'
  | 'terikat' | 'luring' | 'setuju';

function bacaKode(mentah: string | undefined): string | null {
  try { return normalKode(decodeURIComponent(mentah ?? '')); } catch { return null; }
}

export default function Page() {
  const router = useRouter();
  const params = useParams<{ kode: string }>();
  const kode = bacaKode(params.kode);
  const lanjut = '/k/' + (kode ?? '');

  const [tampil, setTampil] = useState<TampilLayar>('memuat');
  const [galat, setGalat]   = useState('');
  const [sibuk, setSibuk]   = useState(false);

  const siapkan = useCallback(async () => {
    if (!kode) { setTampil('kode_salah'); return; }
    const peran = await cekPeran();
    switch (peran.jenis) {
      case 'keluar':      setTampil('keluar'); break;
      case 'terapis':     setTampil('terapis'); break;
      case 'tanpa_peran': setTampil('tanpa_peran'); break;
      case 'pasien':      setTampil('terikat'); break;
      case 'luring':      setTampil('luring'); break;
      case 'pasien_baru': setTampil('setuju'); break;
    }
  }, [kode]);

  useEffect(() => { siapkan(); }, [siapkan]);

  async function handleGoogle(daftarPasien: boolean) {
    setGalat('');
    setSibuk(true);
    const { error } = await masukGoogle(daftarPasien ? { peran: 'pasien', lanjut } : { lanjut });
    if (error) { setGalat(pesanGalat(error)); setSibuk(false); }
  }

  async function handleGantiAkun() {
    setSibuk(true);
    await supabase.auth.signOut();
    await handleGoogle(true);
  }

  async function handleSetuju(oleh: 'pasien' | 'wali') {
    setGalat('');
    setSibuk(true);
    const { data, error } = await supabase.rpc('klaim_pasien', {
      p_kode: kode,
      p_versi: 'F19-v1',
      p_oleh: oleh,
    });

    if (error) { setGalat(pesanGalat(error)); setSibuk(false); return; }

    // Ambil resep pasien dan simpan lokal
    const { data: pasien } = await supabase
      .from('pasien')
      .select('id, nama_panggilan, sisi_terdampak, gerakan, repetisi, sesi_per_minggu, toleransi_batang, toleransi_bahu, durasi_persen, mode_koreksi, kalimat_condong')
      .eq('id', data)
      .maybeSingle();

    if (pasien) {
      simpanResep({
        pasien_id: pasien.id,
        nama_panggilan: pasien.nama_panggilan,
        sisi_terdampak: pasien.sisi_terdampak,
        gerakan: pasien.gerakan,
        repetisi: pasien.repetisi,
        sesi_per_minggu: pasien.sesi_per_minggu,
        toleransi_batang: pasien.toleransi_batang,
        toleransi_bahu: pasien.toleransi_bahu,
        durasi_persen: pasien.durasi_persen,
        mode_koreksi: pasien.mode_koreksi,
        kalimat_condong: pasien.kalimat_condong,
      });
    }

    router.replace('/pasien');
  }

  if (tampil === 'memuat') {
    return (
      <main className="rc-wrap min-h-screen items-center justify-center text-center">
        <p className="rc-sub" role="status">Memuat…</p>
      </main>
    );
  }

  if (tampil === 'setuju') {
    return (
      <main>
        {galat && (
          <div role="alert" className="rc-alert mx-5 mt-6">{galat}</div>
        )}
        <LayarSetuju onSetuju={handleSetuju} sibuk={sibuk} />
      </main>
    );
  }

  return (
    <AuthLayout>
      {tampil === 'kode_salah' && (
        <>
          <div role="alert" className="rc-alert">{pesanGalat({ message: 'kode_tidak_sah' })}</div>
          <Link href="/pasien" className="rc-btn-2">Ke beranda</Link>
        </>
      )}

      {tampil === 'keluar' && (
        <>
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">Masuk untuk menghubungkan akun pasien</h1>
            <p className="mt-3 text-sm">Gunakan akun Google Anda untuk menerima resep latihan dari fisioterapis.</p>
          </div>
          {galat && <div role="alert" className="rc-alert">{galat}</div>}
          <div className="flex flex-col gap-4">
            <button onClick={() => handleGoogle(true)} disabled={sibuk} className="rc-btn-google">
              <IkonGoogle />
              {sibuk ? 'Membuka Google…' : 'Sign Up as Pasien'}
            </button>
            <button onClick={() => handleGoogle(false)} disabled={sibuk} className="rc-btn-google">
              <IkonGoogle />
              Login with Google
            </button>
          </div>
        </>
      )}

      {tampil === 'terapis' && (
        <>
          <div role="alert" className="rc-alert">{pesanGalat({ message: 'akun_terapis' })}</div>
          {galat && <div role="alert" className="rc-alert">{galat}</div>}
          <button onClick={handleGantiAkun} disabled={sibuk} className="rc-btn-google">
            <IkonGoogle />
            Keluar dan ganti akun
          </button>
        </>
      )}

      {tampil === 'tanpa_peran' && (
        <PilihPeran kunci="pasien" onSelesai={siapkan} onKeluar={() => setTampil('keluar')} />
      )}

      {tampil === 'terikat' && (
        <>
          <div role="alert" className="rc-alert">{pesanGalat({ message: 'sudah_terikat' })}</div>
          <Link href="/pasien" className="rc-btn-2">Ke beranda pasien</Link>
        </>
      )}

      {tampil === 'luring' && (
        <>
          <div role="alert" className="rc-info">Butuh internet untuk menghubungkan akun.</div>
          <Link href="/pasien" className="rc-btn-2">Ke beranda pasien</Link>
        </>
      )}
    </AuthLayout>
  );
}
