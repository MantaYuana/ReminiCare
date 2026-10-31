// lib/suara.ts
// Audio output module. Pure functions (pilihSuara, adalahIOS, buatAntreanSuara)
// are safe to import in Node. The singleton `suara` only touches Web APIs at
// call-time, never at module load, so Node --test can import this file too.

import { NASKAH, KODE_WAJIB, teksSetuju } from './naskah.ts';

// ── Tipe publik ────────────────────────────────────────────────────────────

export type KodeKlip =
  | 'K-CONDONG-S' | 'K-CONDONG-T' | 'K-MIRING' | 'K-BAHU'
  | 'I-MULAI' | 'I-POSISI' | 'I-KAMERA' | 'I-BINGKAI' | 'I-GATING'
  | 'I-KALIB' | 'I-KALIB-OK' | 'I-KALIB-ULANG'
  | 'I-G1' | 'I-G2' | 'I-ISTIRAHAT' | 'I-BAGUS'
  | 'R-BAIK' | 'R-CUKUP' | 'R-KURANG'
  | 'I-SELESAI' | 'I-NYERI'
  | `N-${number}`
  | `I-SETUJU-${number}`;

export interface Suara {
  jalur: 'webspeech' | 'klip' | null;
  buka(): Promise<void>;
  ucap(kode: KodeKlip, opsi?: { prioritas?: boolean }): Promise<{ tMulai: number }>;
  sibuk(): boolean;
  hentikan(): void;
}

// ── Fungsi murni (aman di Node) ────────────────────────────────────────────

/**
 * Pilih indeks pertama dari `daftar` yang lang-nya diawali 'id' dan localService === true.
 * Kembalikan -1 bila tidak ada.
 */
export function pilihSuara(daftar: { lang: string; localService: boolean }[]): number {
  return daftar.findIndex(v => v.lang.startsWith('id') && v.localService === true);
}

/**
 * Deteksi iOS: UA mengandung iPhone/iPad/iPod, ATAU platform MacIntel dengan
 * maxTouchPoints > 1 (iPad di desktop mode).
 */
export function adalahIOS(n: { userAgent: string; platform: string; maxTouchPoints: number }): boolean {
  if (/iPhone|iPad|iPod/.test(n.userAgent)) return true;
  if (n.platform === 'MacIntel' && n.maxTouchPoints > 1) return true;
  return false;
}

/**
 * Antrean FIFO dengan dukungan prioritas.
 * masuk(item, true) menyisipkan di posisi 1 (setelah elemen pertama yang mungkin
 * sedang diputar), bukan di posisi 0 — sesuai perilaku "tidak memotong yang sedang diputar".
 */
export function buatAntreanSuara<T>(): {
  masuk(item: T, prioritas?: boolean): void;
  ambil(): T | undefined;
  panjang(): number;
} {
  const _antrian: T[] = [];
  return {
    masuk(item, prioritas = false) {
      if (prioritas && _antrian.length > 0) {
        _antrian.splice(1, 0, item); // sisip setelah elemen pertama
      } else {
        _antrian.push(item);
      }
    },
    ambil() {
      return _antrian.shift();
    },
    panjang() {
      return _antrian.length;
    },
  };
}

// ── Singleton suara (DOM, hanya di browser) ────────────────────────────────

type ItemAntrean = {
  kode: KodeKlip;
  resolve: (v: { tMulai: number }) => void;
};

function buatSingleton(): Suara {
  let _jalur: 'webspeech' | 'klip' | null = null;
  let _ctx: AudioContext | null = null;
  let _klip: Map<string, AudioBuffer> = new Map();
  let _suaraIdx = -1;
  let _sedangUcap = false;
  let _antrean = buatAntreanSuara<ItemAntrean>();

  // Simpan utterance di variabel modul agar tidak di-GC oleh Chrome
  let _utterance: SpeechSynthesisUtterance | null = null;

  function daftarKodeKlip(): string[] {
    const setuju = teksSetuju().map((_, i) => `I-SETUJU-${i + 1}`);
    const angka = Array.from({ length: 20 }, (_, i) => `N-${i + 1}`);
    return [...KODE_WAJIB, ...angka, ...setuju];
  }

  async function unduhSemua(): Promise<void> {
    if (!_ctx) return;
    const kodes = daftarKodeKlip();
    await Promise.all(
      kodes.map(async (kode) => {
        try {
          const res = await fetch(`/audio/${kode}.mp3`);
          if (!res.ok) return;
          const buf = await res.arrayBuffer();
          const decoded = await _ctx!.decodeAudioData(buf);
          _klip.set(kode, decoded);
        } catch {
          // klip tidak tersedia — fallback ke Web Speech untuk kode ini
        }
      }),
    );
  }

  function mainKlip(kode: string): Promise<{ tMulai: number }> {
    return new Promise((resolve) => {
      if (!_ctx) { resolve({ tMulai: Date.now() }); return; }
      const buf = _klip.get(kode);
      if (!buf) { resolve({ tMulai: Date.now() }); return; }
      const src = _ctx.createBufferSource();
      src.buffer = buf;
      src.connect(_ctx.destination);
      const tMulai = Date.now();
      src.start();
      resolve({ tMulai });
      src.onended = () => proses();
    });
  }

  function mainWebSpeech(kode: string): Promise<{ tMulai: number }> {
    return new Promise((resolve) => {
      const teks = NASKAH[kode] ?? kode;
      const u = new SpeechSynthesisUtterance(teks);
      _utterance = u;
      const voices = globalThis.speechSynthesis?.getVoices() ?? [];
      if (_suaraIdx >= 0 && voices[_suaraIdx]) {
        u.voice = voices[_suaraIdx];
        u.lang = voices[_suaraIdx].lang;
      }
      let resolved = false;
      u.onstart = () => {
        if (!resolved) { resolved = true; resolve({ tMulai: Date.now() }); }
      };
      u.onend = () => proses();
      u.onerror = () => { if (!resolved) { resolved = true; resolve({ tMulai: Date.now() }); } proses(); };
      globalThis.speechSynthesis?.speak(u);
    });
  }

  function proses() {
    const item = _antrean.ambil();
    if (!item) { _sedangUcap = false; return; }
    _sedangUcap = true;
    if (_jalur === 'webspeech') {
      mainWebSpeech(item.kode).then(item.resolve);
    } else {
      mainKlip(item.kode).then(item.resolve);
    }
  }

  return {
    get jalur() { return _jalur; },

    async buka(): Promise<void> {
      if (_jalur !== null) return;

      // 1. Buka AudioContext
      _ctx = new AudioContext();
      await _ctx.resume();

      // 2. Deteksi apakah iOS
      const ios = adalahIOS({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints,
      });

      // 3. Coba Web Speech (hanya non-iOS)
      if (!ios && typeof globalThis.speechSynthesis !== 'undefined') {
        let voices = globalThis.speechSynthesis.getVoices();
        if (voices.length === 0) {
          voices = await new Promise<SpeechSynthesisVoice[]>((res) => {
            const t = setTimeout(() => res([]), 1000);
            globalThis.speechSynthesis.onvoiceschanged = () => {
              clearTimeout(t);
              res(globalThis.speechSynthesis.getVoices());
            };
          });
        }

        const idx = pilihSuara(voices.map(v => ({ lang: v.lang, localService: v.localService })));
        if (idx >= 0) {
          // 4. Test apakah Web Speech mau start dalam 500 ms
          _suaraIdx = idx;
          const berhasil = await new Promise<boolean>((res) => {
            const u = new SpeechSynthesisUtterance(NASKAH['I-MULAI'] ?? 'mulai');
            _utterance = u;
            u.voice = voices[idx];
            u.lang = voices[idx].lang;
            const t = setTimeout(() => {
              globalThis.speechSynthesis.cancel();
              res(false);
            }, 500);
            u.onstart = () => { clearTimeout(t); res(true); };
            u.onerror = () => { clearTimeout(t); res(false); };
            globalThis.speechSynthesis.speak(u);
          });

          if (berhasil) {
            _jalur = 'webspeech';
            return;
          }
          globalThis.speechSynthesis.cancel();
        }
      }

      // 5. Jalur klip: unduh semua MP3
      _jalur = 'klip';
      await unduhSemua();
      // Putar I-MULAI untuk konfirmasi audio
      await mainKlip('I-MULAI');
    },

    ucap(kode, opsi = {}): Promise<{ tMulai: number }> {
      return new Promise((resolve) => {
        _antrean.masuk({ kode, resolve }, opsi.prioritas ?? false);
        if (!_sedangUcap) proses();
      });
    },

    sibuk(): boolean {
      return _sedangUcap;
    },

    hentikan(): void {
      // Kosongkan antrean
      while (_antrean.panjang() > 0) _antrean.ambil();
      _sedangUcap = false;
      if (_jalur === 'webspeech') globalThis.speechSynthesis?.cancel();
      _utterance = null;
    },
  };
}

export const suara: Suara = buatSingleton();
