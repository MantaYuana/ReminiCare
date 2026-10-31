import React from 'react';

export type TitikGrafik = {
  y: number | null; // null = celah, garis tidak disambung melewati titik ini
  label: string; // label sumbu x (misal tanggal pendek "31/10" atau sesi "S3")
  bentuk?: 'bulat' | 'kotak'; // bentuk titik (default 'bulat')
  huruf?: string; // huruf keterangan (misal "P" untuk Penuh, "M" untuk Mati)
  tebal?: boolean; // titik pemicu eskalasi (lebih besar dan bergaris tepi kontras)
};

export type PropsGrafik = {
  judul: string; // judul grafik (dipakai juga untuk aksesibilitas aria-label)
  titik: TitikGrafik[]; // daftar titik data
  yMin?: number; // batas bawah sumbu y (default 0)
  yMaks?: number; // batas atas sumbu y (default 100)
  satuan?: string; // satuan nilai (misal '%', ' dtk')
  acuan?: { y: number; label: string }; // garis acuan putus-putus (misal median baseline)
  tinggi?: number; // tinggi grafik dalam unit koordinat viewBox (default 200, bukan px literal)
};

type TitikTerhitung = {
  x: number;
  y: number;
  asli: TitikGrafik;
  indeks: number;
};

/**
 * Komponen Grafik SVG Murni (ReminiCare)
 * Memenuhi standar aksesibilitas NFR-6:
 * - Bebas pustaka grafik eksternal.
 * - Kontras elemen non-teks >= 3:1 terhadap latar putih #ffffff (sumbu, gridline, data, acuan).
 * - Perbedaan informasi tidak hanya lewat warna (bentuk titik, huruf P/M, titik tebal, garis putus-putus + label).
 *
 * Perhitungan ukuran font SVG untuk NFR-6 (teks efektif >= 18px pada lebar layar >= 320px):
 * Lebar viewBox yang dipilih = 400 unit koordinat.
 * Pada layar ponsel dengan lebar render 320px (viewport terkecil standar mobile), faktor skala SVG = 320 / 400 = 0.8.
 * Agar seluruh teks SVG hasil render pada layar (label sumbu, acuan, dan huruf titik) memiliki ukuran efektif >= 18px:
 *   font_size_svg * skala >= 18px  ==>  font_size_svg >= 18 / 0.8 = 22.5px.
 * Oleh karena itu, kita gunakan font-size: 23px pada seluruh elemen teks utama (fontSizeTeks) dan huruf penanda/acuan (fontSizeHuruf).
 * Hasil render:
 * - Pada layar 320px: 23px * 0.8 = 18.4px (>= 18px, lolos NFR-6).
 * - Pada layar 360px: 23px * (360 / 400) = 20.7px (>= 18px, lolos NFR-6).
 * - Pada layar desktop >= 400px: >= 23px.
 */
export default function Grafik({
  judul,
  titik,
  yMin = 0,
  yMaks = 100,
  satuan = '',
  acuan,
  tinggi = 200,
}: PropsGrafik): React.JSX.Element {
  // Keadaan tepi: titik kosong
  if (!titik || titik.length === 0) {
    return (
      <div
        role="img"
        aria-label={`${judul}: Belum ada data`}
        className="flex min-h-[160px] w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-lg font-medium text-slate-700"
      >
        Belum ada data
      </div>
    );
  }

  const VIEWBOX_LEBAR = 400;
  const VIEWBOX_TINGGI = tinggi;

  const padKiri = 80; // ruang untuk label sumbu y dan satuan (font 23px)
  const padKanan = 35; // ruang agar titik kanan tidak terpotong
  const padAtas = 34; // ruang agar label acuan dan titik puncak tidak terpotong di bagian atas
  const padBawah = 45; // ruang untuk tick mark dan label sumbu x

  const plotLebar = VIEWBOX_LEBAR - padKiri - padKanan;
  const plotTinggi = Math.max(VIEWBOX_TINGGI - padAtas - padBawah, 50);

  // Hindari pembagian nol bila yMin === yMaks
  const rentangY = yMaks === yMin ? 1 : yMaks - yMin;

  // Pemetaan titik & pengelompokan segmen garis (y === null memecah garis / celah)
  const segmenGaris: TitikTerhitung[][] = [];
  let segmenAktif: TitikTerhitung[] = [];
  const semuaTitikTerhitung: TitikTerhitung[] = [];

  titik.forEach((pt, idx) => {
    const x =
      titik.length === 1
        ? padKiri + plotLebar / 2
        : padKiri + (idx / (titik.length - 1)) * plotLebar;

    if (pt.y !== null && typeof pt.y === 'number' && !Number.isNaN(pt.y)) {
      // Nilai di luar [yMin, yMaks] di-clamp agar tidak keluar dari area gambar
      const yClamped = Math.max(yMin, Math.min(yMaks, pt.y));
      const yCoord = padAtas + (1 - (yClamped - yMin) / rentangY) * plotTinggi;
      const hitung: TitikTerhitung = { x, y: yCoord, asli: pt, indeks: idx };

      segmenAktif.push(hitung);
      semuaTitikTerhitung.push(hitung);
    } else {
      if (segmenAktif.length > 0) {
        segmenGaris.push(segmenAktif);
        segmenAktif = [];
      }
    }
  });

  if (segmenAktif.length > 0) {
    segmenGaris.push(segmenAktif);
  }

  // Ringkasan untuk aksesibilitas (aria-label & <title>) dengan pembulatan 1 desimal
  const titikTerakhir =
    semuaTitikTerhitung.length > 0
      ? semuaTitikTerhitung[semuaTitikTerhitung.length - 1].asli
      : null;

  const nilaiTerakhirStr =
    titikTerakhir?.y !== null && titikTerakhir?.y !== undefined
      ? Number(titikTerakhir.y.toFixed(1))
      : '';
  const nilaiAcuanStr =
    acuan && typeof acuan.y === 'number' && !Number.isNaN(acuan.y)
      ? Number(acuan.y.toFixed(1))
      : '';

  const ringkasanAria =
    semuaTitikTerhitung.length === 0
      ? `${judul}. Belum ada data nilai terukur.`
      : `${judul}. Grafik garis menampilkan ${semuaTitikTerhitung.length} titik data. Nilai terakhir: ${nilaiTerakhirStr}${satuan} pada sesi ${titikTerakhir?.label}.${
          acuan ? ` Nilai acuan ${acuan.label}: ${nilaiAcuanStr}${satuan}.` : ''
        }`;

  // Posisi Y garis acuan jika tersedia
  let yAcuan: number | null = null;
  if (acuan && typeof acuan.y === 'number' && !Number.isNaN(acuan.y)) {
    const acuanClamped = Math.max(yMin, Math.min(yMaks, acuan.y));
    yAcuan = padAtas + (1 - (acuanClamped - yMin) / rentangY) * plotTinggi;
  }

  // Label sumbu Y: yMaks, nilai tengah (1 desimal presisi), yMin
  const yTengah = Number(((yMin + yMaks) / 2).toFixed(1));
  const yTengahCoord = padAtas + plotTinggi / 2;

  // Ukuran font SVG (sesuai perhitungan NFR-6 di atas: teks >= 18px pada render 320px)
  const fontSizeTeks = 23;
  const fontSizeHuruf = 23;

  // Pencegahan tabrakan label sumbu X berdasarkan panjang label dan jarak antar titik
  const panjangLabelMaks = Math.max(...titik.map((t) => t.label.length), 1);
  const lebarPerKarakter = 14; // perkiraan lebar rata-rata per karakter pada font-size 23px
  const jarakAman = 10;
  const lebarButuh = panjangLabelMaks * lebarPerKarakter + jarakAman;

  const deltaX = titik.length > 1 ? plotLebar / (titik.length - 1) : plotLebar;
  const langkah =
    titik.length > 1 ? Math.max(1, Math.ceil(lebarButuh / deltaX)) : 1;

  const indeksDitampilkan = new Set<number>();
  if (titik.length === 1) {
    indeksDitampilkan.add(0);
  } else {
    for (let i = 0; i < titik.length; i += langkah) {
      indeksDitampilkan.add(i);
    }
    // Titik terakhir selalu wajib ditampilkan; bila bertabrakan dengan titik sebelumnya, buang titik sebelumnya
    const idxTerakhir = titik.length - 1;
    let titikSebelum = idxTerakhir - 1;
    while (titikSebelum >= 0 && !indeksDitampilkan.has(titikSebelum)) {
      titikSebelum--;
    }
    if (titikSebelum >= 0) {
      const jarakKeAkhir = (idxTerakhir - titikSebelum) * deltaX;
      if (jarakKeAkhir < lebarButuh) {
        indeksDitampilkan.delete(titikSebelum);
      }
    }
    indeksDitampilkan.add(idxTerakhir);
  }

  return (
    // Catatan: 'tinggi' adalah satuan koordinat viewBox (dengan lebar 400), bukan piksel literal di layar.
    // SVG akan berskala secara proporsional di dalam wadah responsif max-w-[640px] ini.
    <div className="mx-auto w-full max-w-[640px] overflow-hidden">
      <svg
        role="img"
        aria-label={ringkasanAria}
        viewBox={`0 0 ${VIEWBOX_LEBAR} ${VIEWBOX_TINGGI}`}
        className="w-full h-auto block select-none"
        preserveAspectRatio="xMidYMid meet"
      >
        <title>{ringkasanAria}</title>

        {/* Latar Belakang Putih */}
        <rect
          x={0}
          y={0}
          width={VIEWBOX_LEBAR}
          height={VIEWBOX_TINGGI}
          fill="#ffffff"
        />

        {/* Garis Grid Horizontal (Kontras #64748b 3.7:1 >= 3:1 terhadap putih) */}
        <line
          x1={padKiri}
          y1={padAtas}
          x2={padKiri + plotLebar}
          y2={padAtas}
          stroke="#64748b"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <line
          x1={padKiri}
          y1={yTengahCoord}
          x2={padKiri + plotLebar}
          y2={yTengahCoord}
          stroke="#64748b"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <line
          x1={padKiri}
          y1={padAtas + plotTinggi}
          x2={padKiri + plotLebar}
          y2={padAtas + plotTinggi}
          stroke="#64748b"
          strokeWidth={1}
        />

        {/* Garis Acuan Putus-putus dengan Label Teks */}
        {yAcuan !== null && acuan && (
          <g>
            <line
              x1={padKiri}
              y1={yAcuan}
              x2={padKiri + plotLebar}
              y2={yAcuan}
              stroke="#b91c1c" // Red-700, kontras 5.7:1 terhadap putih
              strokeWidth={2.5}
              strokeDasharray="6 4"
            />
            <text
              x={padKiri + plotLebar - 4}
              y={yAcuan - 6}
              textAnchor="end"
              fontSize={fontSizeHuruf}
              fontWeight="bold"
              fill="#b91c1c"
            >
              {acuan.label}: {nilaiAcuanStr}
              {satuan}
            </text>
          </g>
        )}

        {/* Sumbu Y (Garis dan Label Nilai) */}
        <line
          x1={padKiri}
          y1={padAtas}
          x2={padKiri}
          y2={padAtas + plotTinggi}
          stroke="#334155" // Slate-700, kontras 9.6:1
          strokeWidth={2}
        />
        <text
          x={padKiri - 8}
          y={padAtas + 7}
          textAnchor="end"
          fontSize={fontSizeTeks}
          fontWeight="bold"
          fill="#0f172a" // Slate-900, kontras 16.5:1
        >
          {yMaks}
          {satuan}
        </text>
        <text
          x={padKiri - 8}
          y={yTengahCoord + 7}
          textAnchor="end"
          fontSize={fontSizeTeks}
          fontWeight="bold"
          fill="#0f172a"
        >
          {yTengah}
          {satuan}
        </text>
        <text
          x={padKiri - 8}
          y={padAtas + plotTinggi + 7}
          textAnchor="end"
          fontSize={fontSizeTeks}
          fontWeight="bold"
          fill="#0f172a"
        >
          {yMin}
          {satuan}
        </text>

        {/* Sumbu X (Garis Utama) */}
        <line
          x1={padKiri}
          y1={padAtas + plotTinggi}
          x2={padKiri + plotLebar}
          y2={padAtas + plotTinggi}
          stroke="#334155"
          strokeWidth={2}
        />

        {/* Sumbu X (Tick Marks dan Label Dinamis Bebas Tabrakan) */}
        {titik.map((pt, i) => {
          const x =
            titik.length === 1
              ? padKiri + plotLebar / 2
              : padKiri + (i / (titik.length - 1)) * plotLebar;

          const tampilLabel = indeksDitampilkan.has(i);

          return (
            <g key={`x-axis-${i}`}>
              <line
                x1={x}
                y1={padAtas + plotTinggi}
                x2={x}
                y2={padAtas + plotTinggi + 6}
                stroke="#334155"
                strokeWidth={1.5}
              />
              {tampilLabel && (
                <text
                  x={x}
                  y={padAtas + plotTinggi + 26}
                  textAnchor="middle"
                  fontSize={fontSizeTeks}
                  fill="#0f172a"
                >
                  {pt.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Kondisi tepi: Semua y bernilai null */}
        {semuaTitikTerhitung.length === 0 && (
          <text
            x={padKiri + plotLebar / 2}
            y={padAtas + plotTinggi / 2}
            textAnchor="middle"
            fontSize={fontSizeTeks}
            fill="#475569"
            fontWeight="medium"
          >
            Belum ada nilai terukur
          </text>
        )}

        {/* Jalur Poliline / Segmen Garis Data */}
        {segmenGaris.map((segmen, sIdx) => {
          if (segmen.length < 2) return null;
          const d = segmen
            .map(
              (p, pIdx) =>
                `${pIdx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
            )
            .join(' ');

          return (
            <path
              key={`segmen-${sIdx}`}
              d={d}
              fill="none"
              stroke="#0369a1" // Sky-700, kontras 5.1:1
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* Titik Data (Bulat / Kotak, Tebal, dan Huruf P/M) */}
        {semuaTitikTerhitung.map((pt) => {
          const bentuk = pt.asli.bentuk ?? 'bulat';
          const tebal = !!pt.asli.tebal;
          const huruf = pt.asli.huruf;

          return (
            <g key={`titik-${pt.indeks}`}>
              {bentuk === 'bulat' ? (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={tebal ? 10 : 6}
                  fill="#0284c7"
                  stroke={tebal ? '#0f172a' : '#0369a1'} // Titik tebal bergaris tepi gelap kontras
                  strokeWidth={tebal ? 3 : 1.5}
                />
              ) : (
                <rect
                  x={pt.x - (tebal ? 9 : 5)}
                  y={pt.y - (tebal ? 9 : 5)}
                  width={tebal ? 18 : 10}
                  height={tebal ? 18 : 10}
                  fill="#0284c7"
                  stroke={tebal ? '#0f172a' : '#0369a1'}
                  strokeWidth={tebal ? 3 : 1.5}
                />
              )}

              {/* Huruf P / M tergambar di atas titik untuk pembedaan non-warna (font 23px) */}
              {huruf && (
                <text
                  x={pt.x}
                  y={pt.y - (tebal ? 16 : 12)}
                  textAnchor="middle"
                  fontSize={fontSizeHuruf}
                  fontWeight="bold"
                  fill="#0f172a"
                >
                  {huruf}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
