import type { Metadata } from 'next'
import './globals.css'

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
    // NFR-6: lang="id", font dasar 18px diatur di globals.css
    <html lang="id">
      <body className="min-h-screen text-lg">
        {children}
      </body>
    </html>
  )
}
