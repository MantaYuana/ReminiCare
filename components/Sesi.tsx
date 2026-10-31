'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ResepSalinan } from '../lib/kinematik/mesin';
import type { Sisi, EventMesin } from '../lib/kinematik/tipe';
import { mulaiLayar, langkah, buatJuruSuara } from '../lib/sesi-state';
import type { Layar, Aksi } from '../lib/sesi-state';
import { suara } from '../lib/suara';
import { buatMesinTiruan } from '../lib/mesin-tiruan';
import { tambah, kirim } from '../lib/antrean';
import { tambahRiwayat, bacaRiwayat } from '../lib/lokal';
import type { Riwayat } from '../lib/lokal';

import LayarPanduan    from './sesi/LayarPanduan';
import LayarKalibrasi  from './sesi/LayarKalibrasi';
import LayarGerakan    from './sesi/LayarGerakan';
import LayarIstirahat  from './sesi/LayarIstirahat';
import LayarRingkasan  from './sesi/LayarRingkasan';

// ── Tipe props ────────────────────────────────────────────────────────────

export interface PropsSesi {
  resep: ResepSalinan & { sisi: Sisi };
  pasienId?: string;
  simpan: boolean;
  tamu?: boolean;
  kembali: string;
}

// ── Konstanta ─────────────────────────────────────────────────────────────

const ISTIRAHAT_MS = 20_000; // akan diganti konstanta dari mesin asli saat integrasi

// ── Komponen ──────────────────────────────────────────────────────────────

export default function Sesi({ resep, pasienId, simpan, tamu = false, kembali }: PropsSesi) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const mulaiMs  = useRef(Date.now());

  const [layar, setLayar]         = useState<Layar>(() => mulaiLayar(suara.jalur !== null));
  const [fps, setFps]             = useState(0);
  const [skor, setSkor]           = useState(0);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);
  const [nyeriSudahDipilih, setNyeriSudahDipilih] = useState(false);
  const [pesanSimpan, setPesanSimpan] = useState<string | undefined>();
  const [riwayat, setRiwayat] = useState<Riwayat[]>([]);

  const juruSuara = useRef(buatJuruSuara(resep.mode_koreksi));

  // ── Reducer helper ───────────────────────────────────────────────────────

  const kirimAksi = useCallback((a: Aksi) => {
    setLayar(l => langkah(l, a, resep).layar);
  }, [resep]);

  // ── Handler event mesin ──────────────────────────────────────────────────

  const tangani = useCallback((e: EventMesin) => {
    const kini = Date.now();
    const klip = juruSuara.current(e, kini);
    for (const k of klip) suara.ucap(k.kode, { prioritas: k.prioritas });

    if (e.jenis === 'sampel') {
      setSkor(e.skor);
      setFps(prev => {
        // Estimasi fps sederhana dari rata-rata bergulir
        return Math.round(prev * 0.9 + (1000 / ISTIRAHAT_MS) * 0.1) || 30;
      });
    }

    if (e.jenis === 'repetisi') {
      if (e.hitungan >= resep.repetisi) {
        kirimAksi({ t: 'repetisi', hitungan: e.hitungan });
      } else {
        kirimAksi({ t: 'repetisi', hitungan: e.hitungan });
      }
    }
  }, [kirimAksi, resep.repetisi]);

  // ── Setup kamera + mesin ─────────────────────────────────────────────────

  useEffect(() => {
    if (layar.nama !== 'kamera') return;

    let dibatalkan = false;
    let stream: MediaStream | null = null;
    const mesinTiruan = buatMesinTiruan();

    async function mulai() {
      const pakaiTiruan = process.env.NEXT_PUBLIC_MESIN_TIRUAN === '1';

      if (!pakaiTiruan) {
        // Minta izin kamera
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
          });
          if (dibatalkan) { stream.getTracks().forEach(t => t.stop()); return; }
          if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
          if (dibatalkan) return;
          const msg = err instanceof Error ? err.name : 'unknown';
          if (msg === 'NotAllowedError') {
            setPesanGalat('Izin kamera ditolak. Ketuk ikon kamera di bilah alamat browser untuk mengizinkan.');
          } else if (msg === 'NotFoundError') {
            setPesanGalat('Kamera tidak ditemukan. Pastikan perangkat Anda memiliki kamera.');
          } else if (msg === 'NotReadableError') {
            setPesanGalat('Kamera sedang dipakai aplikasi lain. Tutup aplikasi lain lalu coba lagi.');
          } else {
            setPesanGalat('Tidak dapat mengakses kamera. Coba lagi.');
          }
          return;
        }
      }

      if (dibatalkan) return;
      kirimAksi({ t: 'kameraSiap' });

      if (pakaiTiruan) {
        mesinTiruan.mulai((e) => {
          if (!dibatalkan) tangani(e);
        });
      }
    }

    mulai();

    return () => {
      dibatalkan = true;
      mesinTiruan.berhenti();
      stream?.getTracks().forEach(t => t.stop());
      suara.hentikan();
    };
  }, [layar.nama, kirimAksi, tangani]);

  // ── Suara saat masuk layar ───────────────────────────────────────────────

  useEffect(() => {
    if (layar.nama === 'panduan') {
      suara.ucap('I-KAMERA');
      suara.ucap('I-POSISI');
    }
    if (layar.nama === 'kalibrasi') {
      suara.ucap('I-KALIB');
    }
    if (layar.nama === 'gerakan') {
      suara.ucap(layar.gerakanKe === 0 ? 'I-G1' : 'I-G2');
    }
    if (layar.nama === 'ringkasan') {
      suara.ucap('I-SELESAI');
      if (!tamu) suara.ucap('I-NYERI');
    }
  }, [layar.nama, layar.gerakanKe, tamu]);

  // ── Simpan sesi saat masuk ringkasan ────────────────────────────────────

  useEffect(() => {
    if (layar.nama !== 'ringkasan') return;
    if (!simpan || layar.totalRep === 0) return;

    // TODO: agregatSesi akan tersedia setelah mesin asli diintegrasikan
    // Sementara simpan data minimal ke riwayat lokal
    if (pasienId) {
      tambahRiwayat(pasienId, {
        mulai: new Date(mulaiMs.current).toISOString(),
        pct_benar: layar.totalRep > 0 ? null : null,
        rep_total: layar.totalRep,
        rep_benar: layar.totalRep,
      });
      setRiwayat(bacaRiwayat(pasienId));
    }
  }, [layar.nama, layar.totalRep, simpan, pasienId]);

  // ── Handler tombol nyeri ─────────────────────────────────────────────────

  function handleNyeri(nilai: 0 | 1 | 2) {
    if (!pasienId) return;
    // sesi_id placeholder — akan diganti UUID nyata saat agregatSesi tersedia
    const berhasil = tambah({ jenis: 'nyeri', sesi_id: 'pending', nilai });
    if (berhasil) kirim();
    setNyeriSudahDipilih(true);
  }

  // ── Render per layar ─────────────────────────────────────────────────────

  // Layar mulai — muncul bila suara belum dibuka (URL dibuka langsung)
  if (layar.nama === 'mulai') {
    return (
      <div className="flex flex-col items-center justify-center gap-8 p-6 min-h-[60vh]">
        <h1 className="text-2xl font-bold">Siap latihan?</h1>
        <button
          onClick={async () => {
            await suara.buka();
            kirimAksi({ t: 'suaraSiap' });
          }}
          className="btn-utama w-full max-w-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Mulai latihan
        </button>
      </div>
    );
  }

  // Layar kamera — menunggu izin atau menampilkan error
  if (layar.nama === 'kamera') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-6 min-h-[60vh]">
        {pesanGalat ? (
          <>
            <div role="alert" className="w-full max-w-sm bg-red-50 border border-red-300 rounded-xl p-4 text-base">
              {pesanGalat}
            </div>
            <div className="flex gap-3 w-full max-w-sm">
              <button
                onClick={() => { setPesanGalat(null); }}
                className="btn-sekunder flex-1 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Coba lagi
              </button>
              <button
                onClick={() => router.push(kembali)}
                className="btn-sekunder flex-1 bg-gray-100 rounded-xl hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                Kembali
              </button>
            </div>
          </>
        ) : (
          <p className="text-lg text-gray-600">Menunggu izin kamera…</p>
        )}
      </div>
    );
  }

  if (layar.nama === 'panduan') {
    return (
      <LayarPanduan
        bantuan={layar.bantuan}
        videoRef={videoRef}
        onSiap={() => kirimAksi({ t: 'siap' })}
      />
    );
  }

  if (layar.nama === 'kalibrasi') {
    return (
      <LayarKalibrasi
        onSelesai={(ok) => kirimAksi({ t: 'kalibrasi', ok })}
      />
    );
  }

  if (layar.nama === 'gerakan') {
    return (
      <LayarGerakan
        gerakan={resep.gerakan[layar.gerakanKe] ?? 'jangkau_depan'}
        sisi={resep.sisi}
        hitungan={layar.hitungan}
        totalRepPerGerakan={resep.repetisi}
        skor={skor}
        fps={fps}
        videoRef={videoRef}
        onBerhenti={() => kirimAksi({ t: 'berhenti' })}
      />
    );
  }

  if (layar.nama === 'istirahat') {
    return (
      <LayarIstirahat
        durasiMs={ISTIRAHAT_MS}
        onSelesai={() => kirimAksi({ t: 'istirahatSelesai' })}
      />
    );
  }

  if (layar.nama === 'ringkasan') {
    return (
      <LayarRingkasan
        totalRep={layar.totalRep}
        repBenar={layar.totalRep}
        tamu={tamu}
        riwayat={riwayat}
        pesanSimpan={pesanSimpan}
        nyeriSudahDipilih={nyeriSudahDipilih}
        onNyeri={!tamu ? handleNyeri : undefined}
        onSelesai={() => router.push(kembali)}
      />
    );
  }

  return null;
}
