import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Poppins } from 'next/font/google'
import './globals.css'
import PemicuAntrean from '../components/PemicuAntrean'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  title: 'ReminiCare',
  description: 'Aplikasi rehabilitasi fisioterapi mandiri',
}

export const viewport: Viewport = {
  themeColor: '#004F64',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" className={`${poppins.variable} ${plexMono.variable}`}>
      <body className="min-h-screen text-lg">
        <PemicuAntrean />
        {children}
      </body>
    </html>
  )
}
