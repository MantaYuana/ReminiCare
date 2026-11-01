// Ikon garis kecil untuk landing page. Dekoratif, selalu didampingi teks.
type P = { className?: string };

function Dasar({ className = 'h-5 w-5', children }: P & { children: React.ReactNode }) {
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

export const IkonPutar = (p: P) => (
  <Dasar {...p}><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5 3.5-5 3.5z" /></Dasar>
);
export const IkonPeringatan = (p: P) => (
  <Dasar {...p}><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.01" /></Dasar>
);
export const IkonKunci = (p: P) => (
  <Dasar {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></Dasar>
);
export const IkonPonsel = (p: P) => (
  <Dasar {...p}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></Dasar>
);
export const IkonVideoMati = (p: P) => (
  <Dasar {...p}><path d="M3 3l18 18" /><path d="M10 6h5a2 2 0 012 2v3l4-2v7M3 8v8a2 2 0 002 2h9" /></Dasar>
);
export const IkonCentang = (p: P) => (
  <Dasar {...p}><path d="M5 12l5 5 9-10" /></Dasar>
);
export const IkonJam = (p: P) => (
  <Dasar {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Dasar>
);
export const IkonSuara = (p: P) => (
  <Dasar {...p}><path d="M4 9.5v5h4l5 4v-13l-5 4z" /><path d="M16.5 9a4 4 0 010 6M19 6.5a7.5 7.5 0 010 11" /></Dasar>
);
export const IkonHenti = (p: P) => (
  <Dasar {...p}><rect x="6" y="6" width="12" height="12" rx="1.5" /></Dasar>
);
export const IkonPanah = (p: P) => (
  <Dasar {...p}><path d="M4 12h16M14 6l6 6-6 6" /></Dasar>
);
