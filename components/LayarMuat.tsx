/** Layar tunggu tengah halaman: spinner dan teks (teks tetap ada untuk pembaca layar dan gerak dikurangi). */
export default function LayarMuat({ teks = 'Memuat…' }: { teks?: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-white p-6 text-center">
      <div
        aria-hidden="true"
        className="h-11 w-11 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700 motion-reduce:animate-none"
      />
      <p className="text-base text-muted" role="status">{teks}</p>
    </main>
  );
}
