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

import Langkah         from './sesi/Langkah';
import LayarPanduan    from './sesi/LayarPanduan';
import LayarKalibrasi  from './sesi/LayarKalibrasi';
import LayarGerakan    from './sesi/LayarGerakan';
import LayarIstirahat  from './sesi/LayarIstirahat';
import LayarRingkasan  from './sesi/LayarRingkasan';
import DashboardShell   from './DashboardShell';
import type { ItemNav } from './DashboardShell';
import { IkonBeranda, IkonLatihan, IkonChat, IkonPengaturan, IkonKeluar } from './ikon';

// ── Tipe props ────────────────────────────────────────────────────────────

export interface PropsSesi {
  resep: ResepSalinan & { sisi: Sisi };
  pasienId?: string;
  simpan: boolean;
  tamu?: boolean;
  kembali: string;
  /** Dipanggil saat "Selesai" ditekan; bila ada menggantikan router.push(kembali). */
  onSelesai?: () => void;
}

type Ringkas = { total: number; benar: number; pct: number | null };

// ── Komponen ──────────────────────────────────────────────────────────────

export default function Sesi({ resep, pasienId, simpan, tamu = false, kembali, onSelesai }: PropsSesi) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mulaiMs  = useRef(Date.now());

  const [layar, setLayar]           = useState<Layar>(() => mulaiLayar(suara.jalur !== null));
  const [fps, setFps]               = useState(0);
  const [skor, setSkor]             = useState(0);
  const [gating, setGating]         = useState(true);   // belum ada frame dinilai = belum siap
  const [pesanGalat, setPesanGalat] = useState<string | null>(null);
  const [percobaan, setPercobaan]   = useState(0);
  const [nyeriSudahDipilih, setNyeriSudahDipilih] = useState(false);
  const [pesanSimpan, setPesanSimpan] = useState<string | undefined>();
  const [riwayat, setRiwayat]       = useState<Riwayat[]>([]);
  const [ringkas, setRingkas]       = useState<Ringkas>({ total: 0, benar: 0, pct: null });

  const juruSuara = useRef(buatJuruSuara(resep.mode_koreksi));

  const poseRef = useRef<{ delegate: 'GPU' | 'CPU'; berhenti(): void } | null>(null);
  const pemantauRef = useRef<ReturnType<typeof buatPemantau> | null>(null);
  const mesinRef = useRef<ReturnType<typeof buatMesin> | null>(null);
  const baselineRef = useRef<Baseline | null>(null);
  const kalibFramesRef = useRef<FrameMentah[]>([]);
  const frameDtsRef = useRef<number[]>([]);
  const dtSesiRef = useRef<number[]>([]);        // semua selisih frame saat gerakan → fps_median sesi
  const lastFrameTimeRef = useRef<number | null>(null);
  const sesiIdRef = useRef<string | null>(null);   // id sesi yang disimpan; dipakai laporan nyeri
  const tersimpanRef = useRef(false);

  const layarRef = useRef(layar);
  layarRef.current = layar;
  const resepRef = useRef(resep);
  resepRef.current = resep;
  const kembaliRef = useRef(kembali);
  kembaliRef.current = kembali;

  // ── Reducer helper ───────────────────────────────────────────────────────

  const kirimAksi = useCallback((a: Aksi) => {
    const { layar: baru, keluar } = langkah(layarRef.current, a, resepRef.current);
    if (keluar) {
      router.push(kembaliRef.current);   // Berhenti sebelum ada repetisi: tidak menyimpan apa pun
      return;
    }
    layarRef.current = baru;             // langsung, supaya beberapa event dalam satu frame berurutan
    setLayar(baru);
  }, [router]);

  // ── Handler event mesin ──────────────────────────────────────────────────

  const tangani = useCallback((e: EventMesin) => {
    const klip = juruSuara.current(e, Date.now());
    for (const k of klip) suara.ucap(k.kode, { prioritas: k.prioritas });

    if (e.jenis === 'sampel') setSkor(e.skor);
    if (e.jenis === 'gating') setGating(e.aktif);
    if (e.jenis === 'repetisi') kirimAksi({ t: 'repetisi', hitungan: e.hitungan });
  }, [kirimAksi]);

  // ── Callback onFrame dari MediaPipe ─────────────────────────────────────

  const onFrame = useCallback((f: FrameMentah) => {
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
      if (medianDt > 0) setFps(Math.round(1000 / medianDt));
    }

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
        const r = resepRef.current;
        const konfig: KonfigSesi = {
          sisi: r.sisi,
          durasiPersen: r.durasi_persen,
          tolBatang: r.toleransi_batang,
          tolBahu: r.toleransi_bahu,
          mode: r.mode_koreksi,
          kalimat: r.kalimat_condong,
          kandidat: tamu ? 'a' : KANDIDAT_CONDONG,
          suaraCondong: SUARA_CONDONG,
        };
        const m = buatMesin(konfig, baselineRef.current);
        m.mulaiGerakan(r.gerakan[l.gerakanKe] ?? 'jangkau_depan');
        mesinRef.current = m;
      }
      if (mesinRef.current) {
        for (const e of mesinRef.current.dorong(f)) tangani(e);
      }
    }
  }, [tamu, tangani]);

  // ── Setup kamera + PoseLandmarker (sekali per sesi; ulang saat "Coba lagi") ─

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
          setPesanGalat('Izin kamera ditolak. Ketuk ikon kamera atau gembok di bilah alamat browser, pilih Izinkan, lalu coba lagi.');
        } else if (msg === 'NotFoundError') {
          setPesanGalat('Kamera tidak ditemukan. Pastikan perangkat Anda punya kamera.');
        } else if (msg === 'NotReadableError') {
          setPesanGalat('Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu, lalu coba lagi.');
        } else {
          setPesanGalat('Kamera atau deteksi gerakan tidak bisa dimulai. Coba lagi.');
        }
      }
    }

    mulai();

    return () => { dibatalkan = true; };
  }, [layar.nama, percobaan, kirimAksi, onFrame]);

  // Cleanup saat unmount: lampu kamera padam, suara berhenti
  useEffect(() => {
    return () => {
      poseRef.current?.berhenti();
      poseRef.current = null;
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
        mesinRef.current.mulaiGerakan(resep.gerakan[layar.gerakanKe] ?? 'jangkau_depan');
      }
    }
    if (layar.nama === 'istirahat') suara.ucap('I-ISTIRAHAT');
    if (layar.nama === 'ringkasan') {
      suara.ucap('I-SELESAI');
      if (!tamu) suara.ucap('I-NYERI');
    }
  }, [layar.nama, layar.gerakanKe, resep.gerakan, tamu]);

  // I-BINGKAI tiap 10 dtk selama cek posisi di panduan belum lolos
  useEffect(() => {
    if (layar.nama !== 'panduan' || !gating) return;
    const id = setInterval(() => suara.ucap('I-BINGKAI'), 10_000);
    return () => clearInterval(id);
  }, [layar.nama, gating]);

  // ── Kalibrasi selesai ───────────────────────────────────────────────────

  function handleKalibrasiSelesai() {
    const frames = kalibFramesRef.current;
    kalibFramesRef.current = [];         // percobaan berikutnya mulai dari kosong
    const res = kalibrasi(frames, resep.sisi);
    if (res.ok) {
      baselineRef.current = res.baseline;
      suara.ucap('I-KALIB-OK');
    } else {
      suara.ucap('I-KALIB-ULANG');
    }
    kirimAksi({ t: 'kalibrasi', ok: res.ok });
  }

  // ── Simpan sesi sekali saat masuk ringkasan ─────────────────────────────

  useEffect(() => {
    if (layar.nama !== 'ringkasan' || tersimpanRef.current) return;
    tersimpanRef.current = true;

    // Kamera tidak diperlukan lagi
    const delegate = poseRef.current?.delegate ?? 'CPU';
    poseRef.current?.berhenti();
    poseRef.current = null;

    if (!baselineRef.current || !mesinRef.current) return;

    mesinRef.current.akhiri();           // repetisi terakhir yang masih tertunda ikut dinilai
    const hasilSemua = mesinRef.current.hasil();
    if (hasilSemua.length === 0) return;

    const dts = dtSesiRef.current.length > 0 ? dtSesiRef.current : frameDtsRef.current;
    const s = [...dts].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    const medianDt = s.length === 0 ? 0 : s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
    const fpsMedian = medianDt > 0 ? Math.round(1000 / medianDt) : 30;

    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sesi-${Date.now()}`;
    const barisSesi = agregatSesi({
      id,
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
      fpsMedian,
      suara: suara.jalur ?? 'klip',
      delegate,
    });

    // "Benar" = terukur dan tidak terkompensasi; persentase atas repetisi terukur (F10)
    const benar = barisSesi.rep_terukur - barisSesi.rep_terkompensasi;
    const pct = barisSesi.rep_terukur > 0 ? Math.round((benar / barisSesi.rep_terukur) * 100) : null;
    setRingkas({ total: barisSesi.rep_total, benar, pct });

    if (simpan && pasienId) {
      sesiIdRef.current = id;
      if (tambah({ jenis: 'sesi', baris: barisSesi })) {
        kirim();
      } else {
        setPesanSimpan('Memori ponsel penuh, sesi ini tidak tersimpan.');
      }
      tambahRiwayat(pasienId, {
        mulai: barisSesi.mulai,
        pct_benar: pct,
        rep_total: barisSesi.rep_total,
        rep_benar: benar,
      });
      setRiwayat(bacaRiwayat(pasienId));
    }
  }, [layar.nama, simpan, pasienId, resep, tamu]);

  // ── Handler tombol nyeri ─────────────────────────────────────────────────

  function handleNyeri(nilai: 0 | 1 | 2) {
    if (!sesiIdRef.current) return;      // sesi tidak tersimpan (mis. memori penuh): tidak ada yang dilaporkan
    if (tambah({ jenis: 'nyeri', sesi_id: sesiIdRef.current, nilai })) kirim();
    setNyeriSudahDipilih(true);
  }

  function handleSelesai() {
    if (onSelesai) onSelesai();
    else router.push(kembali);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const kamera = layar.nama === 'panduan' || layar.nama === 'kalibrasi';
  const menuAtas: ItemNav[] = [
    { label: 'Beranda', ikon: <IkonBeranda />, href: kembali },
    { label: 'Semua Latihan', ikon: <IkonLatihan />, nonaktif: true },
    { label: 'Chat', ikon: <IkonChat />, nonaktif: true },
  ];
  const tahap = layar.nama === 'panduan' ? 0 : layar.nama === 'kalibrasi' ? 1 : null;

  return (
    <DashboardShell
      judul="Sesi latihan"
      atas={menuAtas}
      bawah={tamu ? [] : [{ label: 'Settings', ikon: <IkonPengaturan />, nonaktif: true }]}
      tombol={tamu ? { label: 'Kembali Ke Login', ikon: <IkonKeluar />, href: '/' } : undefined}
      tanpaCari
      penuh={layar.nama === 'gerakan'}
    >
      {/* Penanda tahap (slot tetap supaya <video> di bawah tidak dipasang ulang) */}
      {tahap !== null ? <Langkah aktif={tahap} /> : <span hidden />}

      {/* Satu <video> kamera yang selalu terpasang, supaya mesin pose tidak terputus.
          Posisi di pohon tetap; hanya kelasnya yang berganti per layar. */}
      {layar.nama !== 'mulai' ? (
        <div
          className={
            layar.nama === 'gerakan'
              ? 'fixed inset-0 z-0 h-full w-full'
              : kamera
              ? 'w-full'
              : 'pointer-events-none fixed -left-[9999px] -top-[9999px] h-[480px] w-[640px]'
          }
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full ${layar.nama === 'gerakan' ? 'h-full object-cover' : 'aspect-video max-h-[60vh] rounded-2xl border border-slate-300 bg-slate-900 object-contain'}`}
            style={{ transform: 'scaleX(-1)' }}
            aria-label="Kamera latihan"
          />
        </div>
      ) : <span hidden />}

      {layar.nama === 'mulai' && (
        <div className="rc-wrap min-h-[80vh] justify-center text-center">
          <h1 className="rc-judul">Siap berlatih?</h1>
          <p className="rc-sub">Aplikasi akan memakai kamera dan suara untuk memandu Anda.</p>
          <button
            onClick={async () => {
              await suara.buka();
              kirimAksi({ t: 'suaraSiap' });
            }}
            className="rc-btn"
          >
            Mulai latihan
          </button>
        </div>
      )}

      {layar.nama === 'kamera' && (
        <div className="rc-wrap min-h-[70vh] items-center justify-center text-center">
          {pesanGalat ? (
            <>
              <h1 className="rc-judul">Kamera belum bisa dipakai</h1>
              <div role="alert" className="rc-alert text-left">{pesanGalat}</div>
              <div className="flex w-full gap-3">
                <button
                  onClick={() => { setPesanGalat(null); setPercobaan(n => n + 1); }}
                  className="rc-btn flex-1"
                >
                  Coba lagi
                </button>
                <button onClick={() => router.push(kembali)} className="rc-btn-2 flex-1">
                  Kembali
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="rc-judul">Menyiapkan kamera</h1>
              <p className="rc-sub" role="status">
                Bila browser meminta izin kamera, pilih Izinkan. Deteksi gerakan sedang dimuat.
              </p>
            </>
          )}
        </div>
      )}

      {layar.nama === 'panduan' && (
        <LayarPanduan bantuan={layar.bantuan} gating={gating} onSiap={() => kirimAksi({ t: 'siap' })} />
      )}

      {layar.nama === 'kalibrasi' && (
        <LayarKalibrasi key={layar.gagalKalibrasi} onSelesai={handleKalibrasiSelesai} />
      )}

      {layar.nama === 'gerakan' && (
        <LayarGerakan
          gerakan={resep.gerakan[layar.gerakanKe] ?? 'jangkau_depan'}
          sisi={resep.sisi}
          hitungan={layar.hitungan}
          totalRepPerGerakan={resep.repetisi}
          skor={skor}
          fps={fps}
          gating={gating}
          onBerhenti={() => kirimAksi({ t: 'berhenti' })}
        />
      )}

      {layar.nama === 'istirahat' && (
        <LayarIstirahat durasiMs={ISTIRAHAT_MS} onSelesai={() => kirimAksi({ t: 'istirahatSelesai' })} />
      )}

      {layar.nama === 'ringkasan' && (
        <LayarRingkasan
          totalRep={ringkas.total}
          repBenar={ringkas.benar}
          pctBenar={ringkas.pct}
          tamu={tamu}
          riwayat={riwayat}
          pesanSimpan={pesanSimpan}
          nyeriSudahDipilih={nyeriSudahDipilih}
          onNyeri={!tamu ? handleNyeri : undefined}
          onSelesai={handleSelesai}
        />
      )}
    </DashboardShell>
  );
}
