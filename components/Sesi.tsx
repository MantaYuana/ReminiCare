'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { ResepSalinan } from '../lib/kinematik/mesin.ts';
import { buatMesin, agregatSesi } from '../lib/kinematik/mesin.ts';
import type { Sisi, EventMesin, Baseline, KonfigSesi, FrameMentah } from '../lib/kinematik/tipe.ts';
import { KANDIDAT_CONDONG, SUARA_CONDONG, AMBANG_VERSI, ISTIRAHAT_MS, GATING } from '../lib/kinematik/tipe.ts';
import { buatPemantau, kalibrasi } from '../lib/kinematik/fitur.ts';
import { mulaiPose } from '../lib/pose.ts';
import { mulaiLayar, langkah, buatJuruSuara } from '../lib/sesi-state.ts';
import type { Layar, Aksi } from '../lib/sesi-state.ts';
import { suara } from '../lib/suara.ts';
import { tambah, kirim } from '../lib/antrean.ts';
import { tambahRiwayat, bacaRiwayat } from '../lib/lokal.ts';
import type { Riwayat } from '../lib/lokal.ts';

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

// ── Komponen ──────────────────────────────────────────────────────────────

export default function Sesi({ resep, pasienId, simpan, tamu = false, kembali }: PropsSesi) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mulaiMs  = useRef(Date.now());

  const [layar, setLayar]           = useState<Layar>(() => mulaiLayar(suara.jalur !== null));
  const [fps, setFps]               = useState(0);
  const [skor, setSkor]             = useState(0);
  const [gating, setGating]         = useState(true);   // belum ada frame dinilai = belum siap
  const [percobaanKamera, setPercobaanKamera] = useState(0);
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);
  const [nyeriSudahDipilih, setNyeriSudahDipilih] = useState(false);
  const [pesanSimpan, setPesanSimpan] = useState<string | undefined>();
  const [riwayat, setRiwayat]       = useState<Riwayat[]>([]);
  const [repBenar, setRepBenar]     = useState(0);
  const sesiIdRef                   = useRef<string | null>(null);

  const juruSuara = useRef(buatJuruSuara(resep.mode_koreksi));

  const poseRef = useRef<{ delegate: 'GPU' | 'CPU'; berhenti(): void } | null>(null);
  const pemantauRef = useRef<ReturnType<typeof buatPemantau> | null>(null);
  const mesinRef = useRef<ReturnType<typeof buatMesin> | null>(null);
  const baselineRef = useRef<Baseline | null>(null);
  const kalibFramesRef = useRef<FrameMentah[]>([]);
  const frameDtsRef = useRef<number[]>([]);
  const dtSesiRef = useRef<number[]>([]);        // semua selisih frame saat gerakan → fps_median sesi
  const lastFrameTimeRef = useRef<number | null>(null);
  const sudahSimpanRef = useRef(false);

  const layarRef = useRef(layar);
  layarRef.current = layar;
  const resepRef = useRef(resep);
  resepRef.current = resep;

  // ── Reducer helper ───────────────────────────────────────────────────────

  const kirimAksi = useCallback((a: Aksi) => {
    setLayar(l => langkah(l, a, resepRef.current).layar);
  }, []);

  // ── Handler event mesin ──────────────────────────────────────────────────

  const tangani = useCallback((e: EventMesin) => {
    const kini = Date.now();
    const klip = juruSuara.current(e, kini);
    for (const k of klip) suara.ucap(k.kode, { prioritas: k.prioritas });

    if (e.jenis === 'sampel') {
      setSkor(e.skor);
    }

    if (e.jenis === 'repetisi') {
      kirimAksi({ t: 'repetisi', hitungan: e.hitungan });
    }
  }, [kirimAksi]);

  // ── Callback onFrame dari MediaPipe ─────────────────────────────────────

  const onFrame = useCallback((f: FrameMentah) => {
    // 1. Hitung FPS dari delta frame
    if (lastFrameTimeRef.current !== null) {
      const dt = f.t - lastFrameTimeRef.current;
      if (dt > 0) {
        frameDtsRef.current.push(dt);
        if (frameDtsRef.current.length > 30) frameDtsRef.current.shift();
        if (layarRef.current.nama === 'gerakan') dtSesiRef.current.push(dt);
      }
    }
    lastFrameTimeRef.current = f.t;

    if (frameDtsRef.current.length > 0) {
      const s = [...frameDtsRef.current].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      const medianDt = s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
      if (medianDt > 0) {
        setFps(Math.round(1000 / medianDt));
      }
    }

    // 2. Rute frame sesuai layar aktif
    const l = layarRef.current;
    if (l.nama === 'panduan') {
      if (!pemantauRef.current) {
        pemantauRef.current = buatPemantau(resepRef.current.sisi);
      }
      const { gating: g, skor: sk, diDalam: dd } = pemantauRef.current.dorong(f);
      // gating baru aktif setelah 1 dtk buruk; frame buruk saat ini juga menahan tombol Siap (F05)
      setGating(g || !dd || sk < GATING.masuk);
      setSkor(sk);
    } else if (l.nama === 'kalibrasi') {
      kalibFramesRef.current.push(f);
    } else if (l.nama === 'gerakan') {
      if (!mesinRef.current && baselineRef.current) {
        const konfig: KonfigSesi = {
          sisi: resepRef.current.sisi,
          durasiPersen: resepRef.current.durasi_persen,
          tolBatang: resepRef.current.toleransi_batang,
          tolBahu: resepRef.current.toleransi_bahu,
          mode: resepRef.current.mode_koreksi,
          kalimat: resepRef.current.kalimat_condong,
          kandidat: tamu ? 'a' : KANDIDAT_CONDONG,
          suaraCondong: SUARA_CONDONG,
        };
        const m = buatMesin(konfig, baselineRef.current);
        const gAktif = resepRef.current.gerakan[l.gerakanKe] ?? 'jangkau_depan';
        m.mulaiGerakan(gAktif);
        mesinRef.current = m;
      }
      if (mesinRef.current) {
        const evs = mesinRef.current.dorong(f);
        for (const e of evs) tangani(e);
      }
    }
  }, [tamu, tangani]);

  // ── Setup kamera + PoseLandmarker (hanya 1x per sesi) ───────────────────

  useEffect(() => {
    if (layar.nama !== 'kamera') return;

    let dibatalkan = false;

    async function mulai() {
      try {
        if (!videoRef.current) return;
        const p = await mulaiPose(videoRef.current, onFrame);
        if (dibatalkan) {
          p.berhenti();
          return;
        }
        poseRef.current = p;
        kirimAksi({ t: 'kameraSiap' });
      } catch (err: unknown) {
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
      }
    }

    mulai();

    return () => {
      dibatalkan = true;
    };
  }, [layar.nama, kirimAksi, onFrame, percobaanKamera]);

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      if (poseRef.current) {
        poseRef.current.berhenti();
        poseRef.current = null;
      }
      suara.hentikan();
    };
  }, []);

  // ── Suara saat masuk layar ───────────────────────────────────────────────

  useEffect(() => {
    if (layar.nama === 'panduan') {
      suara.ucap('I-KAMERA');
      suara.ucap('I-POSISI');
    }
    if (layar.nama === 'kalibrasi') {
      kalibFramesRef.current = [];
      suara.ucap('I-KALIB');
    }
    if (layar.nama === 'gerakan') {
      suara.ucap(layar.gerakanKe === 0 ? 'I-G1' : 'I-G2');
      if (mesinRef.current) {
        const gAktif = resep.gerakan[layar.gerakanKe] ?? 'jangkau_depan';
        mesinRef.current.mulaiGerakan(gAktif);
      }
    }
    if (layar.nama === 'ringkasan') {
      suara.ucap('I-SELESAI');
      if (!tamu) suara.ucap('I-NYERI');
    }
  }, [layar.nama, layar.gerakanKe, resep.gerakan, tamu]);

  // ── Kalibrasi selesai ───────────────────────────────────────────────────

  function handleKalibrasiSelesai() {
    const frames = kalibFramesRef.current;
    kalibFramesRef.current = [];                 // percobaan ulang mulai dari frame baru
    const res = kalibrasi(frames, resep.sisi);
    if (res.ok) {
      baselineRef.current = res.baseline;
      suara.ucap('I-KALIB-OK');
      kirimAksi({ t: 'kalibrasi', ok: true });
    } else {
      suara.ucap('I-KALIB-ULANG');
      kirimAksi({ t: 'kalibrasi', ok: false });
    }
  }

  // ── Simpan sesi saat masuk ringkasan ────────────────────────────────────

  useEffect(() => {
    if (layar.nama !== 'ringkasan') return;
    if (!baselineRef.current) return;
    // sekali per sesi: re-run effect (resep/props baru) tidak boleh mengantrekan sesi kedua
    if (sudahSimpanRef.current) return;
    sudahSimpanRef.current = true;

    const sisa = mesinRef.current?.akhiri() ?? [];
    for (const e of sisa) tangani(e);

    const hasilSemua = mesinRef.current?.hasil() ?? [];

    const hitungFpsMed = () => {
      const dts = dtSesiRef.current.length > 0 ? dtSesiRef.current : frameDtsRef.current;
      if (dts.length === 0) return 30;
      const s = [...dts].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      const medianDt = s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
      return medianDt > 0 ? Math.round(1000 / medianDt) : 30;
    };

    const barisSesi = agregatSesi({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sesi-${Date.now()}`,
      pasienId: pasienId ?? 'tamu',
      mulai: new Date(mulaiMs.current).toISOString(),
      selesai: new Date().toISOString(),
      resep: {
        ...resep,
        kandidat_condong: tamu ? 'a' : KANDIDAT_CONDONG,
        suara_condong: SUARA_CONDONG,
        ambang_versi: AMBANG_VERSI,
      },
      baseline: baselineRef.current,
      hasil: hasilSemua,
      fpsMedian: hitungFpsMed(),
      suara: suara.jalur ?? 'klip',
      delegate: poseRef.current?.delegate ?? 'CPU',
    });

    const repTotal = barisSesi.rep_total;
    const repTerukur = barisSesi.rep_terukur;
    // F10: % benar = 100 − % terkompensasi, basis repetisi terukur (sama dengan dasbor)
    const repBenarHitung = repTerukur - barisSesi.rep_terkompensasi;
    setRepBenar(repBenarHitung);
    sesiIdRef.current = barisSesi.id;

    if (simpan && pasienId && layar.totalRep > 0) {
      const berhasil = tambah({ jenis: 'sesi', baris: barisSesi });
      if (berhasil) {
        kirim();
      } else {
        setPesanSimpan('Memori penuh, sesi disimpan di antrean lokal.');
      }
    }

    if (pasienId && layar.totalRep > 0) {
      tambahRiwayat(pasienId, {
        mulai: barisSesi.mulai,
        pct_benar: repTerukur > 0 ? Math.round((repBenarHitung / repTerukur) * 100) : null,
        rep_total: repTotal,
        rep_benar: repBenarHitung,
      });
      setRiwayat(bacaRiwayat(pasienId));
    }
  }, [layar.nama, layar.totalRep, simpan, pasienId, resep, tamu, tangani]);

  // ── Handler tombol nyeri ─────────────────────────────────────────────────

  function handleNyeri(nilai: 0 | 1 | 2) {
    if (!pasienId) return;
    const sid = sesiIdRef.current ?? 'pending';
    const berhasil = tambah({ jenis: 'nyeri', sesi_id: sid, nilai });
    if (berhasil) kirim();
    setNyeriSudahDipilih(true);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen">
      {/* Video kamera persisten: selalu ter-mount agar MediaPipe tidak terputus */}
      {layar.nama !== 'mulai' && (
        <div
          className={
            layar.nama === 'gerakan'
              ? 'fixed inset-0 w-full h-full z-0'
              : layar.nama === 'panduan'
              ? 'w-full max-w-lg mx-auto pt-6 px-6 aspect-video'
              : 'fixed -top-[9999px] -left-[9999px] w-[640px] h-[480px] pointer-events-none'
          }
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover rounded-xl"
            style={{ transform: 'scaleX(-1)' }}
            aria-label="Kamera latihan"
          />
        </div>
      )}

      {/* Layar mulai */}
      {layar.nama === 'mulai' && (
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
      )}

      {/* Layar kamera */}
      {layar.nama === 'kamera' && (
        <div className="flex flex-col items-center justify-center gap-6 p-6 min-h-[60vh]">
          {pesanGalat ? (
            <>
              <div role="alert" className="w-full max-w-sm bg-red-50 border border-red-300 rounded-xl p-4 text-base">
                {pesanGalat}
              </div>
              <div className="flex gap-3 w-full max-w-sm">
                <button
                  onClick={() => { setPesanGalat(null); setPercobaanKamera(n => n + 1); }}
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
            <p className="text-lg text-gray-600">Menyiapkan kamera & deteksi pose…</p>
          )}
        </div>
      )}

      {/* Layar panduan */}
      {layar.nama === 'panduan' && (
        <LayarPanduan
          bantuan={layar.bantuan}
          gating={gating}
          onSiap={() => kirimAksi({ t: 'siap' })}
        />
      )}

      {/* Layar kalibrasi */}
      {layar.nama === 'kalibrasi' && (
        // key per percobaan: kalibrasi gagal me-remount layar sehingga hitung mundur 5 dtk dimulai ulang
        <LayarKalibrasi key={layar.gagalKalibrasi} onSelesai={handleKalibrasiSelesai} />
      )}

      {/* Layar gerakan */}
      {layar.nama === 'gerakan' && (
        <LayarGerakan
          gerakan={resep.gerakan[layar.gerakanKe] ?? 'jangkau_depan'}
          sisi={resep.sisi}
          hitungan={layar.hitungan}
          totalRepPerGerakan={resep.repetisi}
          skor={skor}
          fps={fps}
          onBerhenti={() => kirimAksi({ t: 'berhenti' })}
        />
      )}

      {/* Layar istirahat */}
      {layar.nama === 'istirahat' && (
        <LayarIstirahat
          durasiMs={ISTIRAHAT_MS}
          onSelesai={() => kirimAksi({ t: 'istirahatSelesai' })}
        />
      )}

      {/* Layar ringkasan */}
      {layar.nama === 'ringkasan' && (
        <LayarRingkasan
          totalRep={layar.totalRep}
          repBenar={repBenar}
          tamu={tamu}
          riwayat={riwayat}
          pesanSimpan={pesanSimpan}
          nyeriSudahDipilih={nyeriSudahDipilih}
          onNyeri={!tamu ? handleNyeri : undefined}
          onSelesai={() => router.push(kembali)}
        />
      )}
    </div>
  );
}
