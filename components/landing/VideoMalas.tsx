'use client';

import { useEffect, useRef } from 'react';

/** Video loop tanpa suara. Berkas baru diambil saat video mendekati layar, dan berhenti bila pengguna memilih gerak minimal. */
export default function VideoMalas({
  src, poster, label, segera = false,
}: { src: string; poster: string; label: string; segera?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const muat = () => {
      if (!v.getAttribute('src')) v.src = src;
      if (!kurangiGerak) v.play().catch(() => {});
    };
    if (segera || !('IntersectionObserver' in window)) { muat(); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { muat(); } else { v.pause(); }
    }, { rootMargin: '200px' });
    io.observe(v);
    return () => io.disconnect();
  }, [src, segera]);

  return (
    <video
      ref={ref}
      poster={poster}
      aria-label={label}
      muted loop playsInline
      preload="none"
      className="lp-video"
    />
  );
}
