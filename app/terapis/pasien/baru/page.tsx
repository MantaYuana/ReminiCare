'use client';

import Link from 'next/link';
import { useTerapis } from '../../../../components/terapis/useTerapis';
import KerangkaTerapis from '../../../../components/terapis/KerangkaTerapis';
import FormResep from '../../../../components/FormResep';

export default function PasienBaruPage() {
  const t = useTerapis();

  return (
    <KerangkaTerapis t={t} halaman="pasien" judul="Pendaftaran dan resep pasien" tanpaCari>
      <div className="flex max-w-5xl flex-col gap-6">
        <div>
          <Link href="/terapis/pasien" className="inline-flex min-h-[44px] items-center text-sm font-medium text-brand-700 underline underline-offset-4">
            Kembali
          </Link>
          <h2 className="mt-2 text-3xl font-semibold">Pendaftaran &amp; Resep Pasien</h2>
          <p className="mt-2 text-base text-muted">
            Tentukan latihan rehabilitasi mandiri pasca-stroke untuk pasien. Setelah disimpan, Anda diarahkan ke detail pasien untuk membuat kode klaim.
          </p>
        </div>

        <FormResep />
      </div>
    </KerangkaTerapis>
  );
}
