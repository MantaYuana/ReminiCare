'use client';

import { useEffect } from 'react';

/**
 * Bagian halaman muncul bertahap saat masuk layar. Tanpa skrip, atau bila pengguna memilih gerak minimal,
 * semua isi tetap terlihat sejak awal.
 */
export default function EfekMuncul() {
  useEffect(() => {
    const akar = document.querySelector('.lp');
    if (!akar) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

    const unsur = Array.from(akar.querySelectorAll<HTMLElement>('[data-muncul]'));
    unsur.forEach(el => {
      const urutan = Number(el.dataset.muncul) || 0;
      el.style.setProperty('--tunda', `${urutan * 80}ms`);
    });
    akar.classList.add('lp-anim');

    const io = new IntersectionObserver(daftar => {
      daftar.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('lp-tampil'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    unsur.forEach(el => io.observe(el));

    return () => { io.disconnect(); akar.classList.remove('lp-anim'); };
  }, []);
  return null;
}
