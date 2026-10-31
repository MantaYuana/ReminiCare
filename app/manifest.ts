import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ReminiCare',
    short_name: 'ReminiCare',
    description: 'Aplikasi rehabilitasi fisioterapi mandiri',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        // @ts-expect-error – 'maskable' valid per W3C spec, belum ada di tipe Next.js
        purpose: 'maskable',
      },
    ],
  }
}
