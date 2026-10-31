'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { kodeDariQR } from '../lib/arah';
import { IkonKamera } from './ikon';

/** Area pindai QR dengan kamera belakang. Memanggil `onKode` sekali bila isi QR adalah kode klaim. */
export default function PindaiQR({ onKode }: { onKode: (kode: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const kanvas = useRef<HTMLCanvasElement>(null);
  const aliran = useRef<MediaStream | null>(null);
  const [aktif, setAktif] = useState(false);
  const [pesan, setPesan] = useState('');

  const berhenti = useCallback(() => {
    aliran.current?.getTracks().forEach(t => t.stop());
    aliran.current = null;
    setAktif(false);
  }, []);

  useEffect(() => berhenti, [berhenti]);

  useEffect(() => {
    if (!aktif) return;
    const v = video.current;
    const c = kanvas.current;
    const ctx = c?.getContext('2d', { willReadFrequently: true });
    if (!v || !c || !ctx) return;

    let selesai = false;
    const id = setInterval(() => {
      if (selesai || v.readyState < 2 || v.videoWidth === 0) return;
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const hasil = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
      if (!hasil) return;
      const kode = kodeDariQR(hasil.data);
      if (kode) {
        selesai = true;
        berhenti();
        onKode(kode);
      } else {
        setPesan('QR ini bukan kode dari ReminiCare. Arahkan ke QR dari fisioterapis.');
      }
    }, 250);

    return () => { selesai = true; clearInterval(id); };
  }, [aktif, berhenti, onKode]);

  async function mulai() {
    setPesan('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setPesan('Kamera tidak tersedia di peramban ini. Ketik kodenya di bawah.');
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      aliran.current = s;
      setAktif(true);
      // elemen video baru dirender setelah aktif = true
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
      });
    } catch {
      setPesan('Kamera tidak bisa dibuka. Izinkan akses kamera, atau ketik kodenya di bawah.');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {aktif ? (
        <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-black">
          <video ref={video} muted playsInline aria-label="Pratinjau kamera" className="h-56 w-full object-cover" />
          <canvas ref={kanvas} className="hidden" />
          <button type="button" onClick={berhenti} className="rc-btn-2 absolute right-3 top-3 min-h-[44px]! bg-white/90 px-3!">
            Tutup kamera
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={mulai}
          aria-label="Buka kamera untuk memindai QR"
          className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-ink transition-colors hover:bg-brand-50"
        >
          <IkonKamera className="h-8 w-8" />
          <span className="text-sm text-muted">Ketuk untuk memindai QR</span>
        </button>
      )}
      {pesan && <p role="alert" className="rc-info">{pesan}</p>}
    </div>
  );
}
