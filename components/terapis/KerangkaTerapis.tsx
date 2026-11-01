'use client';

import DashboardShell from '../DashboardShell';
import type { ItemNav } from '../DashboardShell';
import LayarMuat from '../LayarMuat';
import PanelProfil from './PanelProfil';
import type { Terapis } from './useTerapis';
import { IkonBeranda, IkonLatihan, IkonChat, IkonPengaturan, IkonRiwayat, IkonKeluar } from '../ikon';

interface Props {
  t: Terapis;
  halaman: 'beranda' | 'pasien';
  judul: string;
  /** Sembunyikan bilah cari dan filter. */
  tanpaCari?: boolean;
  /** Bilah cari berfungsi bila `onCari` diberikan. */
  cari?: string;
  onCari?: (nilai: string) => void;
  children: React.ReactNode;
}

/** Kerangka halaman fisioterapis: menu, panel profil (beranda saja), dan dialog atur ulang data contoh. */
export default function KerangkaTerapis({ t, halaman, judul, tanpaCari, cari, onCari, children }: Props) {
  if (t.sedangMemeriksa) {
    return <LayarMuat teks="Memeriksa izin akses fisioterapis…" />;
  }

  const atas: ItemNav[] = [
    { label: 'Beranda', ikon: <IkonBeranda />, href: '/terapis', aktif: halaman === 'beranda' },
    { label: 'Semua Pasien', ikon: <IkonLatihan />, href: '/terapis/pasien', aktif: halaman === 'pasien' },
    { label: 'Chat', ikon: <IkonChat />, nonaktif: true },
  ];

  const bawah: ItemNav[] = [
    { label: 'Settings', ikon: <IkonPengaturan />, nonaktif: true },
    {
      label: t.sedangIsiContoh ? 'Mengisi…' : t.adaContoh ? 'Atur ulang contoh' : 'Isi data contoh',
      ikon: <IkonRiwayat />,
      onClick: t.adaContoh ? () => t.setKonfirmasiAturUlang(true) : t.jalankanIsiContoh,
      nonaktif: t.sedangIsiContoh || !t.daftarSah,
    },
    { label: 'Logout', ikon: <IkonKeluar />, onClick: t.keluar, bahaya: true },
  ];

  return (
    <>
      <DashboardShell
        judul={judul}
        atas={atas}
        bawah={bawah}
        tanpaCari={tanpaCari}
        cari={cari}
        onCari={onCari}
        placeholderCari="Cari pasien…"
        panel={halaman === 'beranda' ? <PanelProfil nama={t.peran?.nama ?? ''} foto={t.foto} /> : undefined}
      >
        {children}
      </DashboardShell>

      {t.konfirmasiAturUlang && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          aria-describedby="dialog-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => { if (e.target === e.currentTarget) t.setKonfirmasiAturUlang(false); }}
          onKeyDown={e => { if (e.key === 'Escape') t.setKonfirmasiAturUlang(false); }}
        >
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="dialog-title" className="text-xl font-bold">Atur Ulang Data Contoh?</h2>
            <p id="dialog-desc" className="text-base">
              Pasien contoh dan semua sesinya dibuat ulang. Ponsel yang terhubung ke pasien contoh harus memindai QR baru.
            </p>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => t.setKonfirmasiAturUlang(false)} autoFocus className="rc-btn-2 flex-1">
                Batal
              </button>
              <button type="button" onClick={t.jalankanIsiContoh} className="flex-1 min-h-[48px] rounded-xl bg-red-600 px-4 py-2 text-base font-semibold text-white transition-colors hover:bg-red-700">
                Ya, atur ulang
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
