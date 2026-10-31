'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cekPeran } from '../../../../lib/supabase';
import FormResep from '../../../../components/FormResep';

export default function PasienBaruPage() {
  const router = useRouter();
  const [sedangMemeriksa, setSedangMemeriksa] = useState<boolean>(true);

  useEffect(() => {
    let aktif = true;

    async function verifikasiAkses() {
      const peran = await cekPeran();
      if (!aktif) return;

      if (peran.jenis !== 'terapis') {
        router.replace('/');
        return;
      }

      setSedangMemeriksa(false);
    }

    verifikasiAkses();

    return () => {
      aktif = false;
    };
  }, [router]);

  if (sedangMemeriksa) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-lg">
        <div className="p-8 bg-white border border-gray-200 rounded-2xl shadow-sm text-center max-w-md w-full">
          <p className="font-semibold text-gray-800">Memeriksa izin akses fisioterapis...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 text-lg">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigasi Kembali */}
        <div>
          <Link
            href="/terapis"
            className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-blue-700 hover:text-blue-900 font-semibold rounded-lg focus-visible:outline-3 focus-visible:outline-blue-600"
          >
            <span aria-hidden="true">&larr;</span> Kembali ke Daftar Pasien
          </Link>
        </div>

        {/* Header Halaman */}
        <header className="bg-white p-6 border border-gray-200 rounded-2xl shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Pendaftaran &amp; Resep Pasien Baru
          </h1>
          <p className="mt-2 text-gray-600">
            Tentukan parameter latihan rehabilitasi mandiri pasca-stroke untuk pasien. Setelah disimpan, Anda akan diarahkan ke layar detail untuk membuat kode klaim perangkat pasien.
          </p>
        </header>

        {/* Konten Formulir Resep */}
        <section className="bg-white p-6 sm:p-8 border border-gray-200 rounded-2xl shadow-sm">
          <FormResep />
        </section>
      </div>
    </main>
  );
}

