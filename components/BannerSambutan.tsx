/** Kotak sambutan teal di paling atas beranda. */
export default function BannerSambutan({
  label,
  judul,
  children,
}: {
  label: string;
  judul: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex min-h-44 flex-col justify-start gap-3 rounded-3xl bg-brand-600 p-6 text-white sm:p-6">
      <p className="text-sm font-medium uppercase tracking-wide">{label}</p>
      <h2 className="max-w-lg text-2xl font-semibold leading-snug sm:text-3xl">{judul}</h2>
      {children}
    </section>
  );
}
