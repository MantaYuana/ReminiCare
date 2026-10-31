// lib/mesin-tiruan.ts
// Simulated motion engine for UI development before the real pose engine is integrated.
// Emits EventMesin at fixed intervals via setInterval so mock.timers works in tests.

import type { EventMesin, KodeKoreksi } from './kinematik/tipe.ts';

const INTERVAL_SAMPEL_MS   = 33;
const INTERVAL_REPETISI_MS = 3000;
const INTERVAL_GATING_MS   = 20000;
const DURASI_GATING_OFF_MS = 2000;

const KODE_KOREKSI: KodeKoreksi[] = [
  'K-CONDONG-S',
  'K-CONDONG-T',
  'K-MIRING',
  'K-BAHU',
];

export function buatMesinTiruan(): {
  mulai(cb: (e: EventMesin) => void): void;
  berhenti(): void;
} {
  let _ids: ReturnType<typeof setInterval>[] = [];
  let _hitungan = 0;
  let _tGatingMulai = 0;

  return {
    mulai(cb) {
      // Reset state
      _hitungan = 0;
      _tGatingMulai = 0;

      // sampel tiap 33ms
      _ids.push(setInterval(() => {
        cb({
          jenis: 'sampel',
          t: Date.now(),
          status: 'BERGERAK',
          gating: false,
          skor: 0.8,
          diDalam: true,
          fitur: { w: null, d: null, r: null, zb: null, el: null },
          penanda: {
            batang: null, bahu: null, vPuncak: null, nPuncak: null,
            koreksi: null,
            visPanggulMin: 0.9, visPanggulMed: 0.95,
            panggulMin: { x: 0.4, y: 0.7 },
            panggulMaks: { x: 0.6, y: 0.7 },
          },
        });
      }, INTERVAL_SAMPEL_MS));

      // repetisi tiap 3 detik
      _ids.push(setInterval(() => {
        _hitungan++;
        const bagus = _hitungan % 3 === 0;

        cb({
          jenis: 'repetisi',
          hitungan: _hitungan,
          bagus,
          hasil: {
            gerakan: 'jangkau_depan',
            bagus,
            tMulai: Date.now() - INTERVAL_REPETISI_MS,
            tSelesai: Date.now(),
            penanda: {
              batang: null, bahu: null, vPuncak: null, nPuncak: null,
              koreksi: null,
              visPanggulMin: 0.9, visPanggulMed: 0.95,
              panggulMin: { x: 0.4, y: 0.7 },
              panggulMaks: { x: 0.6, y: 0.7 },
            },
          },
        });

        // koreksi pada 1 dari tiap 3 repetisi (hitungan yang bukan kelipatan 3)
        if (_hitungan % 3 === 1) {
          const kode = KODE_KOREKSI[(_hitungan - 1) % KODE_KOREKSI.length];
          cb({
            jenis: 'koreksi',
            sub: 'condong',
            kode,
            tDeteksi: Date.now(),
          });
        }
      }, INTERVAL_REPETISI_MS));

      // gating: aktif sekali tiap 20 detik, lalu tidak aktif 2 detik kemudian
      _ids.push(setInterval(() => {
        _tGatingMulai = Date.now();
        cb({ jenis: 'gating', aktif: true, t: _tGatingMulai });

        // jadwalkan gating off setelah 2 detik
        const id = setTimeout(() => {
          cb({ jenis: 'gating', aktif: false, t: Date.now() });
        }, DURASI_GATING_OFF_MS);
        _ids.push(id as unknown as ReturnType<typeof setInterval>);
      }, INTERVAL_GATING_MS));
    },

    berhenti() {
      for (const id of _ids) clearInterval(id);
      _ids = [];
    },
  };
}
