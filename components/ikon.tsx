// Ikon garis 24px untuk navigasi dashboard. Selalu dipasangkan dengan label teks.
type P = { className?: string };

function Dasar({ className = 'h-6 w-6', children }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export const IkonBeranda = (p: P) => (
  <Dasar {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h5v-6h4v6h5V10" /></Dasar>
);
export const IkonMain = (p: P) => (
  <Dasar {...p}><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5 3.5-5 3.5z" /></Dasar>
);
export const IkonRiwayat = (p: P) => (
  <Dasar {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Dasar>
);
export const IkonKeluar = (p: P) => (
  <Dasar {...p}><path d="M9 4H5v16h4" /><path d="M16 8l4 4-4 4" /><path d="M20 12H9" /></Dasar>
);
export const IkonHapus = (p: P) => (
  <Dasar {...p}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></Dasar>
);
export const IkonAkun = (p: P) => (
  <Dasar {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></Dasar>
);
export const IkonMenu = (p: P) => (
  <Dasar {...p}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></Dasar>
);
export const IkonTutup = (p: P) => (
  <Dasar {...p}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></Dasar>
);
export const IkonPanahKiri = (p: P) => (
  <Dasar {...p}><path d="M15 6l-6 6 6 6" /></Dasar>
);
export const IkonLengan = (p: P) => (
  <Dasar {...p}><path d="M5 20V9a3 3 0 0 1 6 0v5" /><path d="M11 14c2 0 3-1 3-3V6a2 2 0 0 1 4 0v8c0 3-2 6-6 6H5" /></Dasar>
);
