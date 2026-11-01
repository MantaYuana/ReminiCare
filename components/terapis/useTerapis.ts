'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, cekPeran, pesanGalat, type Peran } from '../../lib/supabase';

export type BarisPrioritas = {
  pasien_id: string;
  nama_panggilan: string;
  is_sintetis: boolean;
  sesi_per_minggu: number;
  eskalasi_terbuka: boolean;
  nyeri_terakhir: number | null;
  lencana_nyeri: boolean;
  sesi_7_hari: number;
  kepatuhan_7h: number | null;
  jarang: boolean;
  pct_terakhir: number | null;
  sesi_terakhir: string | null;
};

export type Terapis = ReturnType<typeof useTerapis>;

/**
 * Guard peran fisioterapis + daftar pasien terurut prioritas + aksi data contoh dan keluar.
 * Dipakai bersama oleh beranda fisioterapis dan halaman Semua Pasien.
 */
export function useTerapis() {
  const router = useRouter();

  const [peran, setPeran] = useState<Extract<Peran, { jenis: 'terapis' }> | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [sedangMemeriksa, setSedangMemeriksa] = useState(true);
  const [daftarPasien, setDaftarPasien] = useState<BarisPrioritas[]>([]);
  const [sedangMemuat, setSedangMemuat] = useState(false);
  const [sudahMuat, setSudahMuat] = useState(false);
  // true hanya setelah daftar berhasil dimuat; sudahMuat ikut true saat gagal
  const [daftarSah, setDaftarSah] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const [sedangIsiContoh, setSedangIsiContoh] = useState(false);
  const [konfirmasiAturUlang, setKonfirmasiAturUlang] = useState(false);

  // Pengaman urutan permintaan dan status unmount
  const seqRef = useRef(0);
  const aktifRef = useRef(true);
  const sedangIsiContohRef = useRef(false);

  useEffect(() => {
    aktifRef.current = true;
    return () => { aktifRef.current = false; };
  }, []);

  const muatData = useCallback(async () => {
    const seq = ++seqRef.current;
    setSedangMemuat(true);
    setGalat(null);

    try {
      const { data, error } = await supabase
        .from('v_prioritas')
        .select('*')
        .order('eskalasi_terbuka', { ascending: false })
        .order('lencana_nyeri', { ascending: false })
        .order('jarang', { ascending: false })
        .order('pct_terakhir', { ascending: false, nullsFirst: false });

      if (!aktifRef.current || seqRef.current !== seq) return;

      if (error) {
        setGalat(pesanGalat(error));
        setSedangMemuat(false);
        setSudahMuat(true);
        return;
      }

      setDaftarPasien((data as BarisPrioritas[]) || []);
      setDaftarSah(true);
      setSudahMuat(true);
    } catch (err: unknown) {
      if (!aktifRef.current || seqRef.current !== seq) return;
      setGalat(pesanGalat(err as { message?: string }));
    } finally {
      if (aktifRef.current && seqRef.current === seq) {
        setSedangMemuat(false);
        setSudahMuat(true);
      }
    }
  }, []);

  // Guard halaman: cekPeran() harus 'terapis'; selain itu router.replace('/')
  useEffect(() => {
    let aktif = true;

    async function verifikasiAkses() {
      const p = await cekPeran();
      if (!aktif) return;

      if (p.jenis !== 'terapis') {
        router.replace('/');
        return;
      }

      setPeran(p);
      setSedangMemeriksa(false);

      // Foto akun Google bila ada; selain itu panel profil memakai inisial
      const { data } = await supabase.auth.getSession();
      if (!aktif) return;
      const meta = data.session?.user.user_metadata as { avatar_url?: string; picture?: string } | undefined;
      setFoto(meta?.avatar_url ?? meta?.picture ?? null);
    }

    verifikasiAkses();
    return () => { aktif = false; };
  }, [router]);

  // Muat data awal setelah peran terverifikasi
  useEffect(() => {
    if (!sedangMemeriksa && peran) muatData();
  }, [sedangMemeriksa, peran, muatData]);

  // Muat ulang saat window focus dan tab kembali terlihat
  useEffect(() => {
    if (sedangMemeriksa || !peran) return;

    const handleFocus = () => { muatData(); };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') muatData();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sedangMemeriksa, peran, muatData]);

  const keluar = useCallback(async () => {
    await supabase.auth.signOut();
    router.replace('/');
  }, [router]);

  const jalankanIsiContoh = useCallback(async () => {
    // Pengaman klik ganda
    if (sedangIsiContohRef.current) return;
    sedangIsiContohRef.current = true;

    setSedangIsiContoh(true);
    setGalat(null);
    setKonfirmasiAturUlang(false);

    try {
      const { error } = await supabase.rpc('isi_contoh');
      if (error) {
        setGalat(pesanGalat(error));
        return;
      }
      await muatData();
    } catch (err: unknown) {
      setGalat(pesanGalat(err as { message?: string }));
    } finally {
      sedangIsiContohRef.current = false;
      setSedangIsiContoh(false);
    }
  }, [muatData]);

  // Hanya bermakna bila daftarSah: sebelum itu daftar kosong, dan tombol akan memanggil
  // isi_contoh tanpa konfirmasi atur ulang.
  const adaContoh = daftarPasien.some(p => p.is_sintetis);

  return {
    peran, foto, sedangMemeriksa,
    daftarPasien, sedangMemuat, sudahMuat, daftarSah, galat,
    muatData, keluar,
    sedangIsiContoh, jalankanIsiContoh, adaContoh,
    konfirmasiAturUlang, setKonfirmasiAturUlang,
  };
}
