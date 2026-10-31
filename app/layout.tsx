import type { Metadata } from 'next'
import './globals.css'
import PemicuAntrean from '../components/PemicuAntrean'

export const metadata: Metadata = {
  title: 'ReminiCare',
  description: 'Aplikasi rehabilitasi fisioterapi mandiri',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body className="min-h-screen text-lg">
        <PemicuAntrean />
        {children}
      </body>
    </html>
  )
}
