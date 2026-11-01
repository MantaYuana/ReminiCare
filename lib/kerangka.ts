// lib/kerangka.ts
// Kerangka tubuh bagian atas di atas video kamera (layar gerakan). Posisi dari landmark mentah supaya
// tidak tertinggal dari video; warna dari tingkat pelanggaran mesin (fitur ÷ ambang).

import type { FrameMentah, Tingkat } from './kinematik/tipe.ts';

const VIS_MIN = 0.5;       // sendi di bawah ini tidak digambar
const MULAI = 0.5;         // tingkat tempat warna mulai bergeser dari warna dasar
const NETRAL = 'rgba(255,255,255,0.9)';
const REDUP = 'rgba(210,210,210,0.45)';

// indeks MediaPipe: bahu 11/12, siku 13/14, pergelangan 15/16, panggul 23/24
const TULANG: [number, number, keyof Tingkat | null][] = [
  [11, 12, 'bahu'],
  [11, 23, 'batang'], [12, 24, 'batang'], [23, 24, 'batang'],
  [11, 13, null], [13, 15, null], [12, 14, null], [14, 16, null],
];
const SENDI = [11, 12, 13, 14, 15, 16, 23, 24];

// teal (173°) → kuning-ambar (38°) di tingkat 0,75 → merah (0°) di tingkat 1
export function warnaTingkat(tingkat: number): string {
  const t = Math.min(1, Math.max(0, (tingkat - MULAI) / (1 - MULAI)));
  const hue = t < 0.5 ? 173 - (173 - 38) * (t / 0.5) : 38 - 38 * ((t - 0.5) / 0.5);
  return `hsl(${Math.round(hue)} 90% 50%)`;
}

// Video selalu dicerminkan (scaleX(-1)) dan object-cover; kanvas harus menyalin keduanya.
export function gambarKerangka(
  canvas: HTMLCanvasElement,
  f: FrameMentah,
  tingkat: Tingkat | null,
  redup: boolean,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  if (!f.lm) return;

  const skala = Math.max(cw / f.W, ch / f.H);
  const dx = (cw - f.W * skala) / 2;
  const dy = (ch - f.H * skala) / 2;
  const lm = f.lm;
  const titik = (i: number) => {
    const p = lm[i];
    if (!p || (p.visibility ?? 1) < VIS_MIN) return null;
    return { x: cw - (p.x * f.W * skala + dx), y: p.y * f.H * skala + dy };
  };

  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.lineWidth = redup ? 3 : 6;
  for (const [a, b, kunci] of TULANG) {
    const pa = titik(a);
    const pb = titik(b);
    if (!pa || !pb) continue;
    const level = kunci && tingkat ? tingkat[kunci] : null;
    ctx.strokeStyle = redup ? REDUP : level === null ? NETRAL : warnaTingkat(level);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  ctx.fillStyle = redup ? REDUP : NETRAL;
  for (const i of SENDI) {
    const p = titik(i);
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, redup ? 4 : 7, 0, Math.PI * 2);
    ctx.fill();
  }
}
