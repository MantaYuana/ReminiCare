'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from './AuthLayout';
import { IkonCari, IkonFilter, IkonMenu, IkonTutup } from './ikon';

export type ItemNav = {
  label: string;
  ikon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  aktif?: boolean;
  bahaya?: boolean;
  nonaktif?: boolean;
  /** Tampil sebagai tombol teal penuh (dipakai "Kembali ke login" di mode tamu). */
  tombol?: boolean;
};

interface Props {
  /** Judul halaman untuk pembaca layar; tidak tampil. */
  judul: string;
  atas: ItemNav[];
  bawah?: ItemNav[];
  /** Tombol di dasar sidebar, di bawah grup Settings. */
  tombol?: ItemNav;
  /** Kolom kanan (panel fisioterapis). */
  panel?: React.ReactNode;
  /** Sembunyikan bilah cari dan filter. */
  tanpaCari?: boolean;
  /** Layar penuh gelap: sidebar dan bilah atas disembunyikan, isi tetap terpasang (kamera tidak putus). */
  penuh?: boolean;
  children: React.ReactNode;
}

const KUNCI = 'rc_sidebar';

function Item({ item, tertutup, tutupLaci }: { item: ItemNav; tertutup: boolean; tutupLaci: () => void }) {
  const dasar = 'group relative flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-base font-medium transition-colors motion-reduce:transition-none';
  const warna = item.tombol
    ? 'justify-center bg-brand-600 text-ink hover:bg-brand-700 hover:text-white'
    : item.aktif
    ? 'text-brand-700'
    : item.bahaya
    ? 'text-red-600 hover:bg-red-50'
    : 'text-ink hover:bg-brand-50';
  const kelas = `${dasar} ${warna} ${tertutup ? 'md:justify-center' : ''} ${item.nonaktif ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : ''}`;

  const isi = (
    <>
      {item.ikon}
      <span className={`whitespace-nowrap transition-opacity duration-200 motion-reduce:transition-none ${tertutup ? 'md:hidden' : ''}`}>
        {item.label}
      </span>
    </>
  );

  if (item.href && !item.nonaktif) {
    return (
      <Link href={item.href} className={kelas} title={item.label} aria-label={item.label} aria-current={item.aktif ? 'page' : undefined} onClick={tutupLaci}>
        {isi}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={kelas}
      title={item.label}
      aria-label={item.label}
      disabled={item.nonaktif}
      aria-current={item.aktif ? 'page' : undefined}
      onClick={() => { item.onClick?.(); tutupLaci(); }}
    >
      {isi}
    </button>
  );
}

function Grup({ judul, tertutup, children }: { judul: string; tertutup: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className={`px-3 pb-1 text-base font-semibold tracking-wide text-ink ${tertutup ? 'md:hidden' : ''}`}>{judul}</p>
      {children}
    </div>
  );
}

/**
 * Kerangka dashboard tiga kolom: sidebar kartu (bisa diciutkan; laci di ponsel),
 * kolom tengah dengan bilah cari, dan kolom kanan opsional.
 */
export default function DashboardShell({ judul, atas, bawah = [], tombol, panel, tanpaCari, penuh, children }: Props) {
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

  const tutupLaci = () => setLaci(false);

  return (
    <div className={penuh ? 'min-h-screen bg-black' : 'flex min-h-screen bg-white md:gap-6 md:p-4'}>
      {laci && !penuh && (
        <button
          type="button"
          aria-label="Tutup menu"
          className="fixed inset-0 z-30 bg-ink/40 md:hidden"
          onClick={tutupLaci}
        />
      )}

      <div
        className={`${penuh ? 'hidden ' : ''}fixed inset-y-0 left-0 z-40 p-3 transition-[width,translate] duration-300 ease-out motion-reduce:transition-none md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:self-start md:translate-x-0 md:p-0 ${
          laci ? 'translate-x-0' : '-translate-x-full'
        } ${tertutup ? 'md:w-22' : 'md:w-64'} w-72 shrink-0`}
      >
        <aside
          id="menu-samping"
          aria-label="Menu utama"
          className="flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-[0_8px_32px_rgba(20,24,25,0.10)]"
        >
          <div className={`flex h-16 shrink-0 items-center justify-between gap-2 px-5 pt-3 ${tertutup ? 'md:justify-center md:px-0' : ''}`}>
            <Logo className={tertutup ? 'md:[&>span]:hidden' : ''} />
            <span className="md:hidden">
              <button type="button" onClick={tutupLaci} className="rc-btn-2 min-h-[44px]! border-0! px-2!" aria-label="Tutup menu">
                <IkonTutup />
              </button>
            </span>
          </div>

          <nav className="flex flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden px-3 py-6" aria-label="Navigasi">
            <Grup judul="OVERVIEW" tertutup={tertutup}>
              {atas.map(i => <Item key={i.label} item={i} tertutup={tertutup} tutupLaci={tutupLaci} />)}
            </Grup>
          </nav>

          <div className="flex flex-col gap-6 px-3 pb-5">
            {bawah.length > 0 && (
              <Grup judul="SETTINGS" tertutup={tertutup}>
                {bawah.map(i => <Item key={i.label} item={i} tertutup={tertutup} tutupLaci={tutupLaci} />)}
              </Grup>
            )}
            {tombol && <Item item={{ ...tombol, tombol: true }} tertutup={tertutup} tutupLaci={tutupLaci} />}
          </div>
        </aside>
      </div>

      <div className={penuh ? 'flex flex-col' : 'flex min-w-0 flex-1 flex-col gap-6 px-4 py-5 sm:px-6 md:p-0 xl:flex-row'}>
        <main className={`flex min-w-0 flex-1 flex-col ${penuh ? '' : 'gap-6'}`}>
          <h1 className="sr-only">{judul}</h1>

          <div className={penuh ? 'hidden' : 'flex items-center gap-3'}>
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
                <IkonMenu />
              </button>
            </span>

            {!tanpaCari && (
              <>
                <div className="relative min-w-0 flex-1">
                  <IkonCari className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                  <input
                    type="search"
                    disabled
                    aria-label="Cari latihan (belum tersedia)"
                    placeholder="Cari latihan Anda di sini…"
                    className="min-h-[52px] w-full rounded-xl border border-slate-300 bg-white pl-12 pr-4 text-base placeholder:text-muted disabled:cursor-not-allowed"
                  />
                </div>
                <button
                  type="button"
                  disabled
                  aria-label="Filter (belum tersedia)"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-muted disabled:cursor-not-allowed"
                >
                  <IkonFilter />
                </button>
              </>
            )}
          </div>

          {children}
        </main>

        {panel && (
          <aside
            aria-label="Fisioterapis Anda"
            className="rounded-3xl bg-white p-5 shadow-[0_8px_32px_rgba(20,24,25,0.10)] xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:w-72 xl:shrink-0 xl:self-start"
          >
            {panel}
          </aside>
        )}
      </div>
    </div>
  );
}
