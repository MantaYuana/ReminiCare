'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from './AuthLayout';
import { IkonMenu, IkonPanahKiri, IkonTutup } from './ikon';

export type ItemNav = {
  label: string;
  ikon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  aktif?: boolean;
  bahaya?: boolean;
  nonaktif?: boolean;
};

interface Props {
  judul: string;
  atas: ItemNav[];
  bawah?: ItemNav[];
  pengguna: { nama: string; peran: string };
  children: React.ReactNode;
}

const KUNCI = 'rc_sidebar';

function Item({ item, tertutup, tutupLaci }: { item: ItemNav; tertutup: boolean; tutupLaci: () => void }) {
  const kelas = `group relative flex min-h-[48px] w-full items-center gap-3 rounded-lg px-3 text-left text-base font-medium transition-colors motion-reduce:transition-none ${
    item.aktif
      ? 'bg-brand-50 text-brand-700'
      : item.bahaya
      ? 'text-red-700 hover:bg-red-50'
      : 'text-ink hover:bg-brand-50'
  } ${item.nonaktif ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : ''}`;

  const isi = (
    <>
      {item.aktif && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-brand-700" aria-hidden="true" />}
      {item.ikon}
      <span className={`whitespace-nowrap transition-opacity duration-200 motion-reduce:transition-none ${tertutup ? 'md:opacity-0' : ''}`}>
        {item.label}
      </span>
    </>
  );

  if (item.href && !item.nonaktif) {
    return (
      <Link href={item.href} className={kelas} title={item.label} aria-current={item.aktif ? 'page' : undefined} onClick={tutupLaci}>
        {isi}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={kelas}
      title={item.label}
      disabled={item.nonaktif}
      aria-current={item.aktif ? 'page' : undefined}
      onClick={() => { item.onClick?.(); tutupLaci(); }}
    >
      {isi}
    </button>
  );
}

/** Kerangka dashboard: sidebar yang bisa dibuka-tutup (laci di ponsel) dan bilah atas. */
export default function DashboardShell({ judul, atas, bawah = [], pengguna, children }: Props) {
  const [tertutup, setTertutup] = useState(false);   // hanya layar lebar: ikon saja
  const [laci, setLaci] = useState(false);           // hanya ponsel: geser masuk

  useEffect(() => {
    try { setTertutup(localStorage.getItem(KUNCI) === '1'); } catch { /* abaikan */ }
  }, []);

  function ubahTertutup() {
    setTertutup(t => {
      try { localStorage.setItem(KUNCI, t ? '0' : '1'); } catch { /* abaikan */ }
      return !t;
    });
  }

  useEffect(() => {
    if (!laci) return;
    const tutup = (e: KeyboardEvent) => { if (e.key === 'Escape') setLaci(false); };
    window.addEventListener('keydown', tutup);
    return () => window.removeEventListener('keydown', tutup);
  }, [laci]);

  const inisial = (pengguna.nama.trim()[0] ?? '?').toUpperCase();
  const tutupLaci = () => setLaci(false);

  return (
    <div className="flex min-h-screen bg-white">
      {laci && (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-30 bg-ink/40 md:hidden"
          onClick={tutupLaci}
        />
      )}

      <aside
        id="menu-samping"
        aria-label="Menu utama"
        className={`fixed inset-y-0 left-0 z-40 flex w-68 flex-col overflow-hidden border-r border-slate-200 bg-white transition-[width,translate] duration-300 ease-out motion-reduce:transition-none md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          laci ? 'translate-x-0' : '-translate-x-full'
        } ${tertutup ? 'md:w-22' : 'md:w-68'}`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-4">
          <Logo className={tertutup ? 'md:[&>span]:hidden' : ''} />
          <span className="md:hidden">
            <button type="button" onClick={tutupLaci} className="rc-btn-2 min-h-[44px]! px-2!" aria-label="Tutup menu">
              <IkonTutup />
            </button>
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          {atas.map(i => <Item key={i.label} item={i} tertutup={tertutup} tutupLaci={tutupLaci} />)}
        </nav>

        {bawah.length > 0 && (
          <div className="flex flex-col gap-1 overflow-hidden border-t border-slate-200 px-3 py-4">
            {bawah.map(i => <Item key={i.label} item={i} tertutup={tertutup} tutupLaci={tutupLaci} />)}
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <span className="md:hidden">
              <button
                type="button"
                onClick={() => setLaci(true)}
                className="rc-btn-2 px-2!"
              aria-label="Buka menu"
              aria-expanded={laci}
              aria-controls="menu-samping"
            >
              <IkonMenu />
            </button>
            </span>
            <span className="hidden md:block">
              <button
                type="button"
                onClick={ubahTertutup}
                className="rc-btn-2 px-2!"
              aria-label={tertutup ? 'Perluas menu' : 'Ciutkan menu'}
              aria-expanded={!tertutup}
              aria-controls="menu-samping"
            >
              <IkonPanahKiri className={`h-6 w-6 transition-transform duration-300 motion-reduce:transition-none ${tertutup ? 'rotate-180' : ''}`} />
            </button>
            </span>
            <h1 className="text-lg font-semibold text-brand-700 sm:text-xl">{judul}</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-base font-semibold">{pengguna.nama}</p>
              <p className="text-base text-muted">{pengguna.peran}</p>
            </div>
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-base font-semibold text-white"
            >
              {inisial}
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
