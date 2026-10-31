'use client';

import Link from 'next/link';
import { useTerapis } from '../../../../components/terapis/useTerapis';
import KerangkaTerapis from '../../../../components/terapis/KerangkaTerapis';
import FormResep from '../../../../components/FormResep';
import { IkonPanahKiri } from '../../../../components/ikon';

export default function PasienBaruPage() {
  const t = useTerapis();

  return (
    <KerangkaTerapis t={t} halaman="pasien" judul="Pendaftaran dan resep pasien" tanpaCari>
      <div className="flex w-full flex-col gap-6">
        <div>
          <Link
            href="/terapis/pasien"
            className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-base font-medium text-brand-700 transition-colors hover:bg-brand-50"
          >
            <IkonPanahKiri className="h-5 w-5" />
            Semua Pasien
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
