'use client';

import { useState, useRef, useEffect } from 'react';
import type { FrameMentah, Baseline, EventMesin, Sisi, Gerakan } from '../../lib/kinematik/tipe.ts';
import { buatMesin } from '../../lib/kinematik/mesin.ts';
import { kalibrasi } from '../../lib/kinematik/fitur.ts';
import { mulaiPose } from '../../lib/pose.ts';
import { suara } from '../../lib/suara.ts';
import {
  type MetaSet,
  barisRep,
  barisStatis,
  keCsv,
  namaFile,
} from '../../lib/uji.ts';

export default function UjiPage() {
  const [meta, setMeta] = useState<MetaSet>({
    subjek: 'S1',
    sisi: 'kanan',
    gerakan: 'jangkau_depan',
    label: 'normal',
    sudut: 0,
    posisi: 'depan',
    repInstruksi: 10,
    mode: 'penuh',
    durasiPersen: 30,
  });

  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [status, setStatus] = useState<'mati' | 'siap' | 'kalibrasi' | 'set_aktif' | 'rekam_statis'>('mati');
  const [pesan, setPesan] = useState<string>('');
  const [baris, setBaris] = useState<Record<string, string | number>[]>([]);
  const [fps, setFps] = useState<number>(0);
  const [delegate, setDelegate] = useState<string>('-');

  // Live metrics display
  const [live, setLive] = useState<{
    w: number; d: number; r: number; zb: number;
    dTheta: number; el: number; dTheta3d: number; dp: number;
    repStatus: string; gating: boolean; skor: number;
    condongA: boolean; condongB: boolean; condongC: boolean;
    miring: boolean; penandaEl: boolean;
  }>({
    w: 0, d: 0, r: 0, zb: 0,
    dTheta: 0, el: 0, dTheta3d: 0, dp: 0,
    repStatus: 'DIAM', gating: false, skor: 0,
    condongA: false, condongB: false, condongC: false,
    miring: false, penandaEl: false,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const poseRef = useRef<{ delegate: 'GPU' | 'CPU'; berhenti(): void } | null>(null);
  const mesinRef = useRef<ReturnType<typeof buatMesin> | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;

  const kalibFramesRef = useRef<FrameMentah[]>([]);
  const statisSampelRef = useRef<Extract<EventMesin, { jenis: 'sampel' }>[]>([]);
  const latensiRef = useRef<number | null>(null);
  const frameTimesRef = useRef<number[]>([]);

  // Load saved rows on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rc_uji');
      if (saved) {
        setBaris(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  async function mulaiKamera() {
    if (!videoRef.current) return;
    try {
      setPesan('Memulai kamera & MediaPipe...');
      await suara.buka();
      const p = await mulaiPose(videoRef.current, onFrame);
      poseRef.current = p;
      setDelegate(p.delegate);
      setStatus('siap');
      setPesan(`Kamera aktif (${p.delegate})`);
    } catch (err: unknown) {
      setPesan(`Gagal menyalakan kamera: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function hentikanKamera() {
    if (poseRef.current) {
      poseRef.current.berhenti();
      poseRef.current = null;
    }
    setStatus('mati');
    setPesan('Kamera dimatikan.');
  }

  useEffect(() => {
    return () => {
      if (poseRef.current) {
        poseRef.current.berhenti();
      }
    };
  }, []);

  function onFrame(f: FrameMentah) {
    // FPS tracking
    const now = performance.now();
    frameTimesRef.current.push(now);
    while (frameTimesRef.current.length > 0 && frameTimesRef.current[0] < now - 1000) {
      frameTimesRef.current.shift();
    }
    const curFps = frameTimesRef.current.length;
    setFps(curFps);

    if (poseRef.current) {
      setDelegate(poseRef.current.delegate);
    }

    const curStatus = statusRef.current;
    if (curStatus === 'kalibrasi') {
      kalibFramesRef.current.push(f);
      return;
    }

    if (curStatus === 'set_aktif' || curStatus === 'rekam_statis') {
      if (!mesinRef.current) return;
      const evs = mesinRef.current.dorong(f);

      for (const ev of evs) {
        if (ev.jenis === 'sampel') {
          setLive({
            w: ev.fitur.w,
            d: ev.fitur.d,
            r: ev.fitur.r,
            zb: ev.fitur.zb,
            dTheta: ev.fitur.dTheta,
            el: ev.fitur.el,
            dTheta3d: ev.fitur.dTheta3d,
            dp: ev.fitur.dp,
            repStatus: ev.status,
            gating: ev.gating,
            skor: ev.skor,
            condongA: ev.penanda.condongA,
            condongB: ev.penanda.condongB,
            condongC: ev.penanda.condongC,
            miring: ev.penanda.miring,
            penandaEl: ev.penanda.el,
          });

          if (curStatus === 'rekam_statis') {
            statisSampelRef.current.push(ev);
          }
        } else if (ev.jenis === 'koreksi') {
          suara.ucap(ev.kode, { prioritas: true }).then(() => {
            latensiRef.current = performance.now() - ev.tDeteksi;
          });
        } else if (ev.jenis === 'repetisi' && curStatus === 'set_aktif') {
          const row = barisRep(metaRef.current, ev.hasil, {
            waktuIso: new Date().toISOString(),
            fps: curFps,
            delegate: poseRef.current?.delegate ?? 'CPU',
            jalurSuara: suara.jalur ?? 'webspeech',
            latensiMs: latensiRef.current,
          });
          latensiRef.current = null;
          setBaris(prev => {
            const next = [...prev, row];
            try {
              localStorage.setItem('rc_uji', JSON.stringify(next));
            } catch {}
            return next;
          });
        }
      }
    }
  }

  function handleMulaiKalibrasi() {
    if (status !== 'siap') return;
    kalibFramesRef.current = [];
    setStatus('kalibrasi');
    setPesan('Kalibrasi diam 5 detik... Mohon tetap diam tegak.');

    setTimeout(() => {
      const frames = [...kalibFramesRef.current];
      const res = kalibrasi(frames, metaRef.current.sisi);
      if (res.ok) {
        setBaseline(res.baseline);
        setStatus('siap');
        setPesan(`Kalibrasi BERHASIL: SW0 = ${res.baseline.SW0.toFixed(1)}px, h0 = ${res.baseline.h0.toFixed(3)}`);
      } else {
        setStatus('siap');
        setPesan(`Kalibrasi GAGAL: ${res.alasan}`);
      }
    }, 5000);
  }

  function handleMulaiSet() {
    if (!baselineRef.current) {
      alert('Harap lakukan kalibrasi terlebih dahulu.');
      return;
    }
    const m = buatMesin(
      {
        sisi: meta.sisi,
        durasiPersen: meta.durasiPersen,
        tolBatang: 'normal',
        tolBahu: 'normal',
        mode: meta.mode,
        kalimat: 'sandaran',
        kandidat: 'a',
        suaraCondong: true,
      },
      baselineRef.current,
    );
    m.mulaiGerakan(meta.gerakan);
    mesinRef.current = m;
    latensiRef.current = null;
    setStatus('set_aktif');
    setPesan(`Set aktif: ${meta.subjek} - ${meta.gerakan} (${meta.label})`);
  }

  function handleAkhiriSet() {
    if (status !== 'set_aktif' || !mesinRef.current) return;
    const sisa = mesinRef.current.akhiri();
    for (const ev of sisa) {
      if (ev.jenis === 'repetisi') {
        const row = barisRep(metaRef.current, ev.hasil, {
          waktuIso: new Date().toISOString(),
          fps,
          delegate: poseRef.current?.delegate ?? 'CPU',
          jalurSuara: suara.jalur ?? 'webspeech',
          latensiMs: latensiRef.current,
        });
        setBaris(prev => {
          const next = [...prev, row];
          try {
            localStorage.setItem('rc_uji', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    }
    setStatus('siap');
    setPesan('Set diakhiri.');
  }

  function handleRekamStatis() {
    if (!baselineRef.current) {
      alert('Harap lakukan kalibrasi terlebih dahulu.');
      return;
    }
    const m = buatMesin(
      {
        sisi: meta.sisi,
        durasiPersen: meta.durasiPersen,
        tolBatang: 'normal',
        tolBahu: 'normal',
        mode: 'mati',
        kalimat: 'sandaran',
        kandidat: 'a',
        suaraCondong: true,
      },
      baselineRef.current,
    );
    m.mulaiGerakan(meta.gerakan);
    mesinRef.current = m;
    statisSampelRef.current = [];
    setStatus('rekam_statis');
    setPesan(`Merekam statis 3 dtk: ${meta.subjek} - ${meta.sudut}°...`);

    setTimeout(() => {
      const sampel = [...statisSampelRef.current];
      const row = barisStatis(metaRef.current, sampel, new Date().toISOString());
      setBaris(prev => {
        const next = [...prev, row];
        try {
          localStorage.setItem('rc_uji', JSON.stringify(next));
        } catch {}
        return next;
      });
      setStatus('siap');
      setPesan(`Rekam statis selesai (${sampel.length} sampel tersimpan).`);
    }, 3000);
  }

  function handleEksporCsv() {
    if (baris.length === 0) {
      alert('Belum ada baris data untuk diekspor.');
      return;
    }
    const csv = keCsv(baris);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = namaFile(meta.subjek, meta.posisi, new Date());
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleHapusBaris() {
    if (confirm('Hapus semua baris data uji?')) {
      setBaris([]);
      try {
        localStorage.removeItem('rc_uji');
      } catch {}
      setPesan('Semua baris data dihapus.');
    }
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b pb-3">
        <h1 className="text-2xl font-bold">ReminiCare — Layar Pengujian Kinematik (/uji, F17)</h1>
        <div className="text-sm space-x-2">
          <span className="font-semibold">FPS: {fps}</span>
          <span className="font-semibold">Delegate: {delegate}</span>
          <span className="font-semibold">Jalur: {suara.jalur ?? '-'}</span>
          <span className="font-semibold">Status: <span className="text-blue-600 uppercase">{status}</span></span>
        </div>
      </div>

      {pesan && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded">
          {pesan}
        </div>
      )}

      {/* Kontrol Kamera & Tombol Utama */}
      <div className="flex flex-wrap gap-2 items-center">
        {status === 'mati' ? (
          <button
            onClick={mulaiKamera}
            className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700"
          >
            Mulai Kamera
          </button>
        ) : (
          <button
            onClick={hentikanKamera}
            className="px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700"
          >
            Hentikan Kamera
          </button>
        )}

        <button
          onClick={handleMulaiKalibrasi}
          disabled={status !== 'siap'}
          className="px-4 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          Kalibrasi (5 dtk)
        </button>

        <button
          onClick={handleMulaiSet}
          disabled={status !== 'siap'}
          className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          Mulai Set
        </button>

        <button
          onClick={handleAkhiriSet}
          disabled={status !== 'set_aktif'}
          className="px-4 py-2 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          Akhiri Set
        </button>

        <button
          onClick={handleRekamStatis}
          disabled={status !== 'siap'}
          className="px-4 py-2 bg-purple-600 text-white rounded font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          Rekam Statis (3 dtk)
        </button>

        <button
          onClick={handleEksporCsv}
          disabled={baris.length === 0}
          className="px-4 py-2 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          Ekspor CSV ({baris.length})
        </button>

        <button
          onClick={handleHapusBaris}
          disabled={baris.length === 0}
          className="px-4 py-2 bg-gray-600 text-white rounded font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          Hapus Baris
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form MetaSet */}
        <div className="border rounded p-4 space-y-4 bg-gray-50">
          <h2 className="font-semibold text-lg border-b pb-2">Form Parameter Set</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-gray-700 font-medium">Subjek</label>
              <select
                value={meta.subjek}
                onChange={e => setMeta({ ...meta, subjek: e.target.value })}
                className="w-full mt-1 border rounded p-1.5 bg-white"
              >
                <option value="S1">S1 (Pindra)</option>
                <option value="S2">S2 (Ari)</option>
                <option value="S3">S3 (Manta)</option>
                <option value="lain">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium">Sisi Lengan</label>
              <select
                value={meta.sisi}
                onChange={e => setMeta({ ...meta, sisi: e.target.value as Sisi })}
                className="w-full mt-1 border rounded p-1.5 bg-white"
              >
                <option value="kanan">Kanan</option>
                <option value="kiri">Kiri</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium">Gerakan</label>
              <select
                value={meta.gerakan}
                onChange={e => setMeta({ ...meta, gerakan: e.target.value as Gerakan })}
                className="w-full mt-1 border rounded p-1.5 bg-white"
              >
                <option value="jangkau_depan">Jangkau Depan</option>
                <option value="jangkau_samping">Jangkau Samping</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium">Label Kompensasi</label>
              <select
                value={meta.label}
                onChange={e => setMeta({ ...meta, label: e.target.value as MetaSet['label'] })}
                className="w-full mt-1 border rounded p-1.5 bg-white"
              >
                <option value="normal">Normal</option>
                <option value="condong">Condong</option>
                <option value="miring">Miring</option>
                <option value="elevasi">Elevasi</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium">Sudut Target</label>
              <select
                value={meta.sudut === null ? 'null' : String(meta.sudut)}
                onChange={e => setMeta({ ...meta, sudut: e.target.value === 'null' ? null : Number(e.target.value) as 0 | 10 | 20 | 30 })}
                className="w-full mt-1 border rounded p-1.5 bg-white"
              >
                <option value="0">0°</option>
                <option value="10">10°</option>
                <option value="20">20°</option>
                <option value="30">30°</option>
                <option value="null">- (null)</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium">Posisi Perangkat</label>
              <select
                value={meta.posisi}
                onChange={e => setMeta({ ...meta, posisi: e.target.value as 'depan' | 'oblik' })}
                className="w-full mt-1 border rounded p-1.5 bg-white"
              >
                <option value="depan">Depan (0°)</option>
                <option value="oblik">Oblik (30°)</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-medium">Target Rep</label>
              <input
                type="number"
                value={meta.repInstruksi}
                onChange={e => setMeta({ ...meta, repInstruksi: Number(e.target.value) })}
                className="w-full mt-1 border rounded p-1.5 bg-white"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-medium">Mode Koreksi</label>
              <select
                value={meta.mode}
                onChange={e => setMeta({ ...meta, mode: e.target.value as 'penuh' | 'mati' })}
                className="w-full mt-1 border rounded p-1.5 bg-white"
              >
                <option value="penuh">Penuh</option>
                <option value="mati">Mati</option>
              </select>
            </div>
          </div>
        </div>

        {/* Video feed */}
        <div className="border rounded p-4 flex flex-col items-center justify-center bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full max-h-64 object-contain"
          />
        </div>

        {/* Live Metrics */}
        <div className="border rounded p-4 space-y-2 bg-gray-50 text-xs">
          <h2 className="font-semibold text-sm border-b pb-1">Metrik Langsung (Event Sampel)</h2>
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>w: <span className="font-semibold">{live.w.toFixed(4)}</span></div>
            <div>d: <span className="font-semibold">{live.d.toFixed(4)}</span></div>
            <div>r: <span className="font-semibold">{live.r.toFixed(4)}</span></div>
            <div>zb: <span className="font-semibold">{live.zb.toFixed(4)}</span></div>
            <div>Δθ: <span className="font-semibold">{live.dTheta.toFixed(2)}°</span></div>
            <div>el: <span className="font-semibold">{live.el.toFixed(4)}</span></div>
            <div>Δθ3D: <span className="font-semibold">{live.dTheta3d.toFixed(2)}°</span></div>
            <div>dp: <span className="font-semibold">{live.dp.toFixed(4)}</span></div>
            <div>Status: <span className="font-bold text-blue-600">{live.repStatus}</span></div>
            <div>Gating: <span className={live.gating ? 'text-red-600 font-bold' : 'text-green-600'}>{live.gating ? 'AKTIF' : 'LEPAS'}</span></div>
            <div>Skor: <span className="font-semibold">{live.skor.toFixed(2)}</span></div>
            <div>FPS: <span className="font-semibold">{fps}</span></div>
          </div>
          <div className="border-t pt-1 space-y-1">
            <div className="font-semibold">Flag Aktif:</div>
            <div className="flex flex-wrap gap-1 font-mono text-[11px]">
              <span className={`px-1 rounded ${live.condongA ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>condongA</span>
              <span className={`px-1 rounded ${live.condongB ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>condongB</span>
              <span className={`px-1 rounded ${live.condongC ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>condongC</span>
              <span className={`px-1 rounded ${live.miring ? 'bg-amber-500 text-white' : 'bg-gray-200'}`}>miring</span>
              <span className={`px-1 rounded ${live.penandaEl ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}>elevasi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Data Rekaman */}
      <div className="border rounded p-4 bg-white space-y-2">
        <h2 className="font-semibold text-lg">Tabel Data Rekaman ({baris.length} baris tersimpan)</h2>
        <div className="overflow-x-auto max-h-96">
          <table className="min-w-full text-xs text-left border-collapse">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-2 border">#</th>
                <th className="p-2 border">Waktu</th>
                <th className="p-2 border">Subjek</th>
                <th className="p-2 border">Set ID</th>
                <th className="p-2 border">Tipe</th>
                <th className="p-2 border">Rep Ke</th>
                <th className="p-2 border">Durasi ms</th>
                <th className="p-2 border">Terukur</th>
                <th className="p-2 border">Kompensasi</th>
                <th className="p-2 border">w puncak</th>
                <th className="p-2 border">d puncak</th>
                <th className="p-2 border">r puncak</th>
                <th className="p-2 border">Koreksi</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-2 border font-mono">{idx + 1}</td>
                  <td className="p-2 border font-mono">{String(b.waktu_iso).slice(11, 19)}</td>
                  <td className="p-2 border">{b.subjek}</td>
                  <td className="p-2 border">{b.set_id}</td>
                  <td className="p-2 border font-semibold uppercase">{b.tipe}</td>
                  <td className="p-2 border text-center">{b.rep_ke}</td>
                  <td className="p-2 border font-mono">{b.durasi_ms}</td>
                  <td className="p-2 border text-center">{b.terukur}</td>
                  <td className="p-2 border text-center">{b.terkompensasi}</td>
                  <td className="p-2 border font-mono">{typeof b.w_puncak === 'number' ? b.w_puncak.toFixed(3) : b.w_puncak}</td>
                  <td className="p-2 border font-mono">{typeof b.d_puncak === 'number' ? b.d_puncak.toFixed(3) : b.d_puncak}</td>
                  <td className="p-2 border font-mono">{typeof b.r_puncak === 'number' ? b.r_puncak.toFixed(3) : b.r_puncak}</td>
                  <td className="p-2 border font-mono text-red-600">{b.koreksi_kode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
