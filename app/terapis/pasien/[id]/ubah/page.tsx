'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase, pesanGalat } from '../../../../../lib/supabase';
import { useTerapis } from '../../../../../components/terapis/useTerapis';
import KerangkaTerapis from '../../../../../components/terapis/KerangkaTerapis';
import FormResep from '../../../../../components/FormResep';
import type { DataResepPasien } from '../../../../../components/FormResep';
import { IkonPanahKiri } from '../../../../../components/ikon';

const KOLOM =
  'id, nama_panggilan, sisi_terdampak, gerakan, repetisi, sesi_per_minggu, toleransi_batang, toleransi_bahu, durasi_persen, mode_koreksi, kalimat_condong';

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Beri waktu sebentar supaya pesan "berhasil" dari form terbaca sebelum kembali ke detail
const JEDA_KEMBALI_MS = 1200;

export default function UbahResepPage() {
  const t = useTerapis();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [pasien, setPasien] = useState<DataResepPasien | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const jedaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (jedaRef.current) clearTimeout(jedaRef.current); }, []);

  useEffect(() => {
    if (t.sedangMemeriksa || !t.peran) return;
    if (!REGEX_UUID.test(id)) { setMemuat(false); return; }

    let aktif = true;
    (async () => {
      // RLS membatasi ke pasien milik akun ini
      const { data, error } = await supabase.from('pasien').select(KOLOM).eq('id', id).maybeSingle();
      if (!aktif) return;
      if (error) setGalat(pesanGalat(error));
      else setPasien(data as DataResepPasien | null);
      setMemuat(false);
    })();
    return () => { aktif = false; };
  }, [t.sedangMemeriksa, t.peran, id]);

  const kembali = `/terapis/pasien/${id}`;

  return (
    <KerangkaTerapis t={t} halaman="pasien" judul="Ubah resep pasien" tanpaCari>
      <div className="flex w-full flex-col gap-6">
        <div>
          <Link
            href={kembali}
            className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-base font-medium text-brand-700 transition-colors hover:bg-brand-50"
          >
            <IkonPanahKiri className="h-5 w-5" />
            Detail Pasien
          </Link>
          <h2 className="mt-2 text-3xl font-semibold">Ubah Resep Pasien</h2>
          <p className="mt-2 text-base text-muted">
            Ubah latihan rehabilitasi mandiri pasca-stroke untuk pasien. Perubahan berlaku mulai sesi berikutnya.
          </p>
        </div>

        {memuat && <p className="rc-sub" role="status">Memuat data pasien…</p>}

        {galat && <div role="alert" className="rc-alert">{galat}</div>}

        {!memuat && !galat && !pasien && (
          <div role="alert" className="rc-info">
            Pasien tidak ditemukan atau bukan milik akun Anda.{' '}
            <Link href="/terapis/pasien" className="font-semibold underline underline-offset-4">Ke Semua Pasien</Link>
          </div>
        )}

        {pasien && (
          <FormResep
            key={pasien.id}
            mode="edit"
            pasien={pasien}
            onBerhasil={() => {
              if (jedaRef.current) clearTimeout(jedaRef.current);
              jedaRef.current = setTimeout(() => router.push(kembali), JEDA_KEMBALI_MS);
            }}
          />
        )}
      </div>
    </KerangkaTerapis>
  );
}
