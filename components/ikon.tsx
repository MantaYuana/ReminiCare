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
export const IkonPanahKanan = (p: P) => (
  <Dasar {...p}><path d="M9 6l6 6-6 6" /></Dasar>
);
export const IkonLatihan = (p: P) => (
  <Dasar {...p}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M9 12l2 2 4-4" /></Dasar>
);
export const IkonChat = (p: P) => (
  <Dasar {...p}><path d="M5 5h14v11H10l-5 4z" /><path d="M9 10h6" /></Dasar>
);
export const IkonPengaturan = (p: P) => (
  <Dasar {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
  </Dasar>
);
export const IkonCari = (p: P) => (
  <Dasar {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></Dasar>
);
export const IkonFilter = (p: P) => (
  <Dasar {...p}><path d="M4 5h16l-6 7v6l-4 2v-8z" /></Dasar>
);
export const IkonKamera = (p: P) => (
  <Dasar {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Dasar>
);
export const IkonPeringatan = (p: P) => (
  <Dasar {...p}><path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17.5v.01" /></Dasar>
);
export const IkonBel = (p: P) => (
  <Dasar {...p}><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z" /><path d="M10 21h4" /></Dasar>
);
export const IkonPesan = (p: P) => (
  <Dasar {...p}><rect x="4" y="6" width="16" height="12" rx="3" /><path d="M4.5 8l7.5 5 7.5-5" /></Dasar>
);
export const IkonTitikTiga = (p: P) => (
  <Dasar {...p}><path d="M12 5v.01M12 12v.01M12 19v.01" strokeWidth="3" /></Dasar>
);
export const IkonPanahBawah = (p: P) => (
  <Dasar {...p}><path d="M6 9l6 6 6-6" /></Dasar>
);
export const IkonTambah = (p: P) => (
  <Dasar {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Dasar>
);
export const IkonLengan = (p: P) => (
  <Dasar {...p}><path d="M5 20V9a3 3 0 0 1 6 0v5" /><path d="M11 14c2 0 3-1 3-3V6a2 2 0 0 1 4 0v8c0 3-2 6-6 6H5" /></Dasar>
);
