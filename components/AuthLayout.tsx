'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { cekPeran } from '../lib/supabase';
import { ruteUntuk } from '../lib/arah';

export type StatusMasuk = 'memeriksa' | 'siap' | 'tanpa_peran';

/**
 * Akun yang sudah masuk langsung dialihkan ke beranda perannya.
 * `tanpa_peran` (sudah login Google, belum memilih peran) dikembalikan ke halaman
 * supaya bisa menampilkan PilihPeran; `setStatus` untuk mengembalikan ke 'siap' setelah keluar.
 */
export function useAlihkanBilaMasuk(): [StatusMasuk, (s: StatusMasuk) => void] {
  const router = useRouter();
  const [status, setStatus] = useState<StatusMasuk>('memeriksa');

  useEffect(() => {
    let batal = false;
    cekPeran().then(peran => {
      if (batal) return;
      const rute = ruteUntuk(peran, null);
      if (rute) router.replace(rute);
      else setStatus(peran.jenis === 'tanpa_peran' ? 'tanpa_peran' : 'siap');
    });
    return () => { batal = true; };
  }, [router]);

  return [status, setStatus];
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {/* Ikon dekoratif; nama ditulis sebagai teks di sebelahnya */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/Logo.jpg" alt="" width={44} height={26} className="h-5 w-auto" />
      <span className="text-base font-semibold text-ink">
        Remini<span className="text-brand-600">Care</span>
      </span>
    </div>
  );
}

export function IkonGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4.1 6.8-10.1 6.8-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** Tata letak layar masuk/daftar: foto di kiri (tablet ke atas) atau banner di atas (ponsel), panel putih di kanan/bawah. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-white md:grid-cols-2">
      <div className="relative h-36 sm:h-52 md:hidden" aria-hidden="true">
        <Image src="/login.jpg" alt="" fill sizes="100vw" className="object-cover object-[50%_25%]" />
        <div className="absolute inset-0 bg-black/55" />
      </div>

      <div className="relative hidden md:block" aria-hidden="true">
        <Image
          src="/login.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover object-top"
        />
        <div className="absolute inset-0 bg-black/55" />
      </div>

      <main className="flex flex-col px-5 py-5 sm:px-8 md:px-10 md:py-6">
        <div className="flex justify-center md:justify-end">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 py-8 sm:max-w-md md:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
