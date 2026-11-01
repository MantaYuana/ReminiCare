import { League_Spartan, Figtree } from 'next/font/google';

// Huruf khusus landing. Dimuat dari modul ini supaya halaman lain tidak ikut mengunduhnya.
export const huruf_judul = League_Spartan({
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
  variable: '--lp-judul',
});

export const huruf_isi = Figtree({
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
  variable: '--lp-isi',
});
