import Image from 'next/image';

/** Kotak sambutan lebar di paling atas dashboard. Foto memudar ke teal di sisi kanan. */
export default function BannerSambutan({
  judul,
  teks,
  children,
}: {
  judul: string;
  teks: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-brand-700 text-white">
      <div className="absolute inset-y-0 right-0 hidden w-3/5 sm:block" aria-hidden="true">
        <Image src="/login.jpg" alt="" fill sizes="40vw" className="object-cover object-[50%_20%]" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-700 via-brand-700/70 to-brand-700/10" />
      </div>
      <div className="relative z-10 flex max-w-xl flex-col gap-4 p-6 sm:p-8">
        <div>
          <h2 className="text-2xl font-semibold leading-snug sm:text-3xl">{judul}</h2>
          <p className="mt-2 text-base text-white/90">{teks}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
