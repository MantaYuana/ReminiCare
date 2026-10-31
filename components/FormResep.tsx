'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, pesanGalat } from '../lib/supabase';

export type SisiTerdampak = 'kiri' | 'kanan';
export type JenisGerakan = 'jangkau_depan' | 'jangkau_samping';
export type TingkatToleransi = 'abaikan' | 'longgar' | 'normal' | 'ketat';
export type ModeKoreksiResep = 'penuh' | 'ringkasan' | 'mati';
export type PilihanKalimatCondong = 'sandaran' | 'tegak';

export type DataResepPasien = {
  id?: string;
  nama_panggilan?: string;
  sisi_terdampak?: SisiTerdampak;
  gerakan?: JenisGerakan[];
  repetisi?: number;
  sesi_per_minggu?: number;
  toleransi_batang?: TingkatToleransi;
  toleransi_bahu?: TingkatToleransi;
  durasi_persen?: number;
  mode_koreksi?: ModeKoreksiResep;
  kalimat_condong?: PilihanKalimatCondong;
  [key: string]: unknown;
};

export type ResepTamu = {
  sisi_terdampak: SisiTerdampak;
  gerakan: JenisGerakan[];
  repetisi: number;
  toleransi_batang: TingkatToleransi;
  toleransi_bahu: TingkatToleransi;
  durasi_persen: number;
  mode_koreksi: 'penuh' | 'mati';
  kalimat_condong: PilihanKalimatCondong;
};

export interface FormResepProps {
  mode?: 'baru' | 'edit' | 'tamu';
  pasien?: DataResepPasien | null;
  onBerhasil?: (pasienId: string) => void;
  onBatal?: () => void;
  onKirim?: (r: ResepTamu) => void;
}

export default function FormResep({ mode, pasien, onBerhasil, onBatal, onKirim }: FormResepProps) {
  const router = useRouter();
  const modeAktual = mode ?? (pasien?.id ? 'edit' : 'baru');
  const isEdit = modeAktual === 'edit';
  const isTamu = modeAktual === 'tamu';

  // Catatan siklus hidup: komponen ini menginisialisasi state dari props.pasien saat dipasang (mount).
  // Jika data pasien dimuat secara asinkron dari server/DB, komponen pemanggil wajib menyertakan key unik,
  // misalnya <FormResep key={pasien.id} pasien={pasien} />, agar state form terisi dengan data yang benar.
  const modeAsli = pasien?.mode_koreksi;

  const [namaPanggilan, setNamaPanggilan] = useState<string>(pasien?.nama_panggilan ?? '');
  const [sisiTerdampak, setSisiTerdampak] = useState<SisiTerdampak>(pasien?.sisi_terdampak ?? 'kanan');
  const [gerakan, setGerakan] = useState<JenisGerakan[]>(
    pasien?.gerakan && pasien.gerakan.length > 0 ? pasien.gerakan : ['jangkau_depan']
  );
  // Hindari value={NaN} dengan mengizinkan string kosong saat input dikosongkan
  // Mode tamu: repetisi bawaan 5, bukan 10
  const [repetisi, setRepetisi] = useState<number | ''>(pasien?.repetisi ?? (isTamu ? 5 : 10));
  const [sesiPerMinggu, setSesiPerMinggu] = useState<number | ''>(pasien?.sesi_per_minggu ?? 3);
  const [toleransiBatang, setToleransiBatang] = useState<TingkatToleransi>(pasien?.toleransi_batang ?? 'normal');
  const [toleransiBahu, setToleransiBahu] = useState<TingkatToleransi>(pasien?.toleransi_bahu ?? 'normal');
  const [durasiPersen, setDurasiPersen] = useState<number | ''>(pasien?.durasi_persen ?? 30);
  const [modeKoreksi, setModeKoreksi] = useState<ModeKoreksiResep>(
    pasien?.mode_koreksi ?? 'penuh'
  );
  const [kalimatCondong, setKalimatCondong] = useState<PilihanKalimatCondong>(
    pasien?.kalimat_condong === 'tegak' ? 'tegak' : 'sandaran'
  );

  const [sedangSimpan, setSedangSimpan] = useState<boolean>(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);

  // Pengaman submit berulang (double click/submit)
  const sedangSubmitRef = useRef<boolean>(false);

  const handleToggleGerakan = (g: JenisGerakan) => {
    setGerakan((prev) => {
      if (prev.includes(g)) {
        if (prev.length <= 1) return prev; // Minimal 1 gerakan wajib dipilih
        return prev.filter((item) => item !== g);
      } else {
        if (prev.length >= 2) return prev; // Maksimal 2 gerakan di P0
        return [...prev, g];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (sedangSubmitRef.current) return;
    sedangSubmitRef.current = true;

    setGalat(null);
    setPesanSukses(null);

    // 1. Validasi klien persis constraint DB
    // Mode tamu: nama panggilan tidak divalidasi
    if (!isTamu) {
      const namaBersih = namaPanggilan.trim();
      if (namaBersih.length < 1 || namaBersih.length > 40) {
        sedangSubmitRef.current = false;
        setGalat('Nama panggilan harus diisi antara 1 sampai 40 karakter.');
        return;
      }
    }
    const namaBersih = isTamu ? '' : namaPanggilan.trim();

    if (sisiTerdampak !== 'kiri' && sisiTerdampak !== 'kanan') {
      sedangSubmitRef.current = false;
      setGalat('Pilih salah satu sisi terdampak (kiri atau kanan).');
      return;
    }

    if (!gerakan || gerakan.length < 1 || gerakan.length > 2) {
      sedangSubmitRef.current = false;
      setGalat('Pilih 1 atau 2 gerakan latihan.');
      return;
    }

    const nRepetisi = Number(repetisi);
    if (repetisi === '' || !Number.isInteger(nRepetisi) || nRepetisi < 5 || nRepetisi > 20) {
      sedangSubmitRef.current = false;
      setGalat('Target repetisi harus berupa bilangan bulat antara 5 sampai 20.');
      return;
    }

    // Mode tamu: sesi per minggu tidak divalidasi
    let nSesiMinggu = 3;
    if (!isTamu) {
      nSesiMinggu = Number(sesiPerMinggu);
      if (sesiPerMinggu === '' || !Number.isInteger(nSesiMinggu) || nSesiMinggu < 1 || nSesiMinggu > 7) {
        sedangSubmitRef.current = false;
        setGalat('Frekuensi latihan harus berupa bilangan bulat antara 1 sampai 7 sesi per minggu.');
        return;
      }
    }

    if (!['abaikan', 'longgar', 'normal', 'ketat'].includes(toleransiBatang)) {
      sedangSubmitRef.current = false;
      setGalat('Toleransi batang tubuh tidak valid.');
      return;
    }

    if (!['abaikan', 'longgar', 'normal', 'ketat'].includes(toleransiBahu)) {
      sedangSubmitRef.current = false;
      setGalat('Toleransi elevasi bahu tidak valid.');
      return;
    }

    const nDurasi = Number(durasiPersen);
    if (durasiPersen === '' || !Number.isInteger(nDurasi) || nDurasi < 10 || nDurasi > 80) {
      sedangSubmitRef.current = false;
      setGalat('Persentase durasi kompensasi harus berupa bilangan bulat antara 10 sampai 80%.');
      return;
    }

    // Validasi mode koreksi: formulir baru dan tamu hanya Penuh atau Mati; mode edit mempertahankan 'ringkasan' jika belum diubah
    if (modeKoreksi !== 'penuh' && modeKoreksi !== 'mati' && modeKoreksi !== 'ringkasan') {
      sedangSubmitRef.current = false;
      setGalat('Mode koreksi pada formulir hanya boleh Penuh atau Mati.');
      return;
    }
    if ((!isEdit || isTamu) && modeKoreksi !== 'penuh' && modeKoreksi !== 'mati') {
      sedangSubmitRef.current = false;
      setGalat('Mode koreksi pada formulir baru hanya boleh Penuh atau Mati.');
      return;
    }

    if (kalimatCondong !== 'sandaran' && kalimatCondong !== 'tegak') {
      sedangSubmitRef.current = false;
      setGalat('Pilihan kalimat koreksi condong tidak valid.');
      return;
    }

    // Mode tamu: panggil onKirim secara sinkron
    if (isTamu) {
      sedangSubmitRef.current = false;
      if (onKirim) {
        const nilaiTamu: ResepTamu = {
          sisi_terdampak: sisiTerdampak,
          gerakan,
          repetisi: nRepetisi,
          toleransi_batang: toleransiBatang,
          toleransi_bahu: toleransiBahu,
          durasi_persen: nDurasi,
          mode_koreksi: modeKoreksi as 'penuh' | 'mati',
          kalimat_condong: kalimatCondong,
        };
        onKirim(nilaiTamu);
      }
      return;
    }

    setSedangSimpan(true);

    try {
      if (isEdit && pasien?.id) {
        // Mode edit: HANYA kolom yang di-GRANT untuk UPDATE (tanpa terapis_id, id, kode_klaim, user_id, persetujuan_*, is_sintetis)
        const payloadUpdate = {
          nama_panggilan: namaBersih,
          sisi_terdampak: sisiTerdampak,
          gerakan,
          repetisi: nRepetisi,
          sesi_per_minggu: nSesiMinggu,
          toleransi_batang: toleransiBatang,
          toleransi_bahu: toleransiBahu,
          durasi_persen: nDurasi,
          mode_koreksi: modeKoreksi,
          kalimat_condong: kalimatCondong,
        };

        const { data: dataUpdate, error: errUpdate } = await supabase
          .from('pasien')
          .update(payloadUpdate)
          .eq('id', pasien.id)
          .select('id');

        if (errUpdate) {
          sedangSubmitRef.current = false;
          setGalat(pesanGalat(errUpdate));
          setSedangSimpan(false);
          return;
        }

        if (!dataUpdate || dataUpdate.length === 0) {
          sedangSubmitRef.current = false;
          setGalat('Gagal memperbarui resep: data pasien tidak ditemukan atau Anda tidak memiliki hak akses.');
          setSedangSimpan(false);
          return;
        }

        sedangSubmitRef.current = false;
        setPesanSukses('Resep berhasil diperbarui. Berlaku mulai sesi berikutnya.');
        setSedangSimpan(false);

        if (onBerhasil) {
          onBerhasil(pasien.id);
        }
      } else {
        // Mode baru: Wajib menyertakan terapis_id = uid, dan HANYA kolom yang di-GRANT untuk INSERT
        const { data: { session }, error: errSession } = await supabase.auth.getSession();
        if (errSession || !session?.user?.id) {
          sedangSubmitRef.current = false;
          setGalat('Sesi autentikasi tidak ditemukan. Silakan masuk kembali.');
          setSedangSimpan(false);
          return;
        }

        const uid = session.user.id;

        const payloadInsert = {
          terapis_id: uid,
          nama_panggilan: namaBersih,
          sisi_terdampak: sisiTerdampak,
          gerakan,
          repetisi: nRepetisi,
          sesi_per_minggu: nSesiMinggu,
          toleransi_batang: toleransiBatang,
          toleransi_bahu: toleransiBahu,
          durasi_persen: nDurasi,
          mode_koreksi: modeKoreksi,
          kalimat_condong: kalimatCondong,
        };

        const { data: dataBaru, error: errInsert } = await supabase
          .from('pasien')
          .insert(payloadInsert)
          .select('id')
          .single();

        if (errInsert || !dataBaru) {
          sedangSubmitRef.current = false;
          setGalat(pesanGalat(errInsert));
          setSedangSimpan(false);
          return;
        }

        // Jangan setSedangSimpan(false) sebelum navigasi agar tombol tetap disabled saat perpindahan rute
        if (onBerhasil) {
          sedangSubmitRef.current = false;
          onBerhasil(dataBaru.id);
        } else {
          router.push(`/terapis/pasien/${dataBaru.id}`);
        }
      }
    } catch (err: unknown) {
      sedangSubmitRef.current = false;
      setGalat(pesanGalat(err as { message?: string }));
      setSedangSimpan(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-2xl mx-auto space-y-6 text-lg">
      {/* Peringatan Mode Edit */}
      {isEdit && (
        <div className="p-4 bg-amber-50 border-2 border-amber-400 text-amber-900 rounded-xl flex items-center gap-3">
          <span aria-hidden="true" className="text-2xl font-bold">ℹ️</span>
          <div>
            <p className="font-bold text-lg">Mode Edit Resep</p>
            <p className="text-lg text-amber-800">Perubahan resep ini berlaku mulai sesi berikutnya.</p>
          </div>
        </div>
      )}

      {/* Tampilan Galat */}
      {galat && (
        <div role="alert" className="p-4 bg-red-50 border-2 border-red-500 text-red-900 rounded-xl flex items-start gap-3">
          <span aria-hidden="true" className="text-2xl">⚠️</span>
          <div>
            <p className="font-bold text-lg">Periksa Kembali Data Resep</p>
            <p className="text-lg">{galat}</p>
          </div>
        </div>
      )}

      {/* Tampilan Sukses */}
      {pesanSukses && (
        <div role="status" className="p-4 bg-green-50 border-2 border-green-500 text-green-900 rounded-xl flex items-start gap-3">
          <span aria-hidden="true" className="text-2xl">✅</span>
          <div>
            <p className="font-bold text-lg">Pembaruan Berhasil</p>
            <p className="text-lg">{pesanSukses}</p>
          </div>
        </div>
      )}

      {/* 1. Nama Panggilan — disembunyikan di mode tamu */}
      {!isTamu && (
        <div className="space-y-2">
          <label htmlFor="field-nama" className="block font-semibold text-gray-900 text-lg">
            Nama Panggilan Pasien <span className="text-red-600">*</span>
          </label>
          <p className="text-lg text-gray-600" id="hint-nama">
            Nama sapaan pasien untuk instruksi suara ramah (1–40 karakter).
          </p>
          <input
            id="field-nama"
            type="text"
            maxLength={40}
            value={namaPanggilan}
            onChange={(e) => setNamaPanggilan(e.target.value)}
            aria-describedby="hint-nama"
            required
            placeholder="Contoh: Pak Wayan"
            className="w-full min-h-[44px] px-4 py-2 border-2 border-gray-300 rounded-xl text-lg focus:border-blue-600 focus:outline-none"
          />
        </div>
      )}

      {/* 2. Sisi Terdampak */}
      <fieldset className="space-y-2">
        <legend className="block font-semibold text-gray-900 text-lg">
          {isTamu ? 'Lengan yang Dilatih' : 'Sisi Lengan Terdampak Stroke'} <span className="text-red-600">*</span>
        </legend>
        <p className="text-lg text-gray-600">
          {isTamu ? 'Pilih lengan yang ingin Anda latih.' : 'Sisi tubuh hemiparesis yang dilatih menggunakan kamera.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label className={`min-h-[44px] flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
            sisiTerdampak === 'kanan' ? 'border-blue-600 bg-blue-50 font-semibold' : 'border-gray-200 hover:bg-gray-50'
          }`}>
            <input
              type="radio"
              name="sisi_terdampak"
              value="kanan"
              checked={sisiTerdampak === 'kanan'}
              onChange={() => setSisiTerdampak('kanan')}
              className="w-6 h-6 text-blue-600"
            />
            <span className="text-lg">{isTamu ? 'Lengan kanan' : 'Lengan Kanan'}</span>
          </label>
          <label className={`min-h-[44px] flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
            sisiTerdampak === 'kiri' ? 'border-blue-600 bg-blue-50 font-semibold' : 'border-gray-200 hover:bg-gray-50'
          }`}>
            <input
              type="radio"
              name="sisi_terdampak"
              value="kiri"
              checked={sisiTerdampak === 'kiri'}
              onChange={() => setSisiTerdampak('kiri')}
              className="w-6 h-6 text-blue-600"
            />
            <span className="text-lg">{isTamu ? 'Lengan kiri' : 'Lengan Kiri'}</span>
          </label>
        </div>
      </fieldset>

      {/* 3. Gerakan Latihan */}
      <fieldset className="space-y-2">
        <legend className="block font-semibold text-gray-900 text-lg">
          Gerakan Latihan yang Diresepkan <span className="text-red-600">*</span>
        </legend>
        <p className="text-lg text-gray-600">
          Pilih minimal 1 gerakan latihan (maksimal 2 pada fase P0).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label className={`min-h-[44px] flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
            gerakan.includes('jangkau_depan') ? 'border-blue-600 bg-blue-50 font-semibold' : 'border-gray-200 hover:bg-gray-50'
          }`}>
            <input
              type="checkbox"
              value="jangkau_depan"
              checked={gerakan.includes('jangkau_depan')}
              onChange={() => handleToggleGerakan('jangkau_depan')}
              className="w-6 h-6 rounded text-blue-600"
            />
            <span className="text-lg">Jangkau Depan (Fleksi Bahu)</span>
          </label>
          <label className={`min-h-[44px] flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
            gerakan.includes('jangkau_samping') ? 'border-blue-600 bg-blue-50 font-semibold' : 'border-gray-200 hover:bg-gray-50'
          }`}>
            <input
              type="checkbox"
              value="jangkau_samping"
              checked={gerakan.includes('jangkau_samping')}
              onChange={() => handleToggleGerakan('jangkau_samping')}
              className="w-6 h-6 rounded text-blue-600"
            />
            <span className="text-lg">Jangkau Samping (Abduksi Bahu)</span>
          </label>
        </div>
      </fieldset>

      {/* 4. Target Repetisi & Sesi per Minggu */}
      <div className={isTamu ? 'space-y-4' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
        <div className="space-y-2">
          <label htmlFor="field-repetisi" className="block font-semibold text-gray-900 text-lg">
            Target Repetisi per Gerakan <span className="text-red-600">*</span>
          </label>
          <p className="text-lg text-gray-600" id="hint-repetisi">
            {isTamu ? 'Rentang 5–20 repetisi (bawaan: 5).' : 'Rentang 5–20 repetisi (bawaan: 10).'}
          </p>
          <input
            id="field-repetisi"
            type="number"
            min={5}
            max={20}
            step={1}
            value={repetisi}
            onChange={(e) => {
              const val = e.target.value;
              setRepetisi(val === '' ? '' : parseInt(val, 10));
            }}
            aria-describedby="hint-repetisi"
            required
            className="w-full min-h-[44px] px-4 py-2 border-2 border-gray-300 rounded-xl text-lg focus:border-blue-600 focus:outline-none"
          />
        </div>

        {!isTamu && (
          <div className="space-y-2">
            <label htmlFor="field-sesi-minggu" className="block font-semibold text-gray-900 text-lg">
              Target Sesi per Minggu <span className="text-red-600">*</span>
            </label>
            <p className="text-lg text-gray-600" id="hint-sesi-minggu">Rentang 1–7 sesi dalam seminggu (bawaan: 3).</p>
            <input
              id="field-sesi-minggu"
              type="number"
              min={1}
              max={7}
              step={1}
              value={sesiPerMinggu}
              onChange={(e) => {
                const val = e.target.value;
                setSesiPerMinggu(val === '' ? '' : parseInt(val, 10));
              }}
              aria-describedby="hint-sesi-minggu"
              required
              className="w-full min-h-[44px] px-4 py-2 border-2 border-gray-300 rounded-xl text-lg focus:border-blue-600 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* 5. Toleransi Kompensasi Batang & Bahu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="field-toleransi-batang" className="block font-semibold text-gray-900 text-lg">
            Toleransi Batang Tubuh
          </label>
          <p className="text-lg text-gray-600" id="hint-tol-batang">Ambang condong &amp; miring badan.</p>
          <select
            id="field-toleransi-batang"
            value={toleransiBatang}
            onChange={(e) => setToleransiBatang(e.target.value as TingkatToleransi)}
            aria-describedby="hint-tol-batang"
            className="w-full min-h-[44px] px-4 py-2 border-2 border-gray-300 rounded-xl text-lg focus:border-blue-600 focus:outline-none bg-white"
          >
            <option value="abaikan">Abaikan (Tanpa deteksi batang)</option>
            <option value="longgar">Longgar (Sensitivitas rendah)</option>
            <option value="normal">Normal (Standar klinis)</option>
            <option value="ketat">Ketat (Sensitivitas tinggi)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="field-toleransi-bahu" className="block font-semibold text-gray-900 text-lg">
            Toleransi Elevasi Bahu
          </label>
          <p className="text-lg text-gray-600" id="hint-tol-bahu">Ambang bahu terangkat (penanda lemah).</p>
          <select
            id="field-toleransi-bahu"
            value={toleransiBahu}
            onChange={(e) => setToleransiBahu(e.target.value as TingkatToleransi)}
            aria-describedby="hint-tol-bahu"
            className="w-full min-h-[44px] px-4 py-2 border-2 border-gray-300 rounded-xl text-lg focus:border-blue-600 focus:outline-none bg-white"
          >
            <option value="abaikan">Abaikan (Tanpa deteksi bahu)</option>
            <option value="longgar">Longgar (Sensitivitas rendah)</option>
            <option value="normal">Normal (Standar klinis)</option>
            <option value="ketat">Ketat (Sensitivitas tinggi)</option>
          </select>
        </div>
      </div>

      {/* 6. Durasi Persen Kompensasi */}
      <div className="space-y-2">
        <label htmlFor="field-durasi" className="block font-semibold text-gray-900 text-lg">
          Ambang Durasi Kompensasi (% fase gerak)
        </label>
        <p className="text-lg text-gray-600" id="hint-durasi">
          Fraksi waktu repetisi saat kompensasi aktif agar dihitung terkompensasi (10–80%, bawaan: 30%).
        </p>
        <input
          id="field-durasi"
          type="number"
          min={10}
          max={80}
          step={5}
          value={durasiPersen}
          onChange={(e) => {
            const val = e.target.value;
            setDurasiPersen(val === '' ? '' : parseInt(val, 10));
          }}
          aria-describedby="hint-durasi"
          required
          className="w-full min-h-[44px] px-4 py-2 border-2 border-gray-300 rounded-xl text-lg focus:border-blue-600 focus:outline-none"
        />
      </div>

      {/* 7. Mode Koreksi (Hanya Penuh / Mati di P0 dan mode tamu; mempertahankan 'ringkasan' bila nilai DB asli) */}
      <fieldset className="space-y-2">
        <legend className="block font-semibold text-gray-900 text-lg">
          Mode Koreksi Suara <span className="text-red-600">*</span>
        </legend>
        <p className="text-lg text-gray-600">
          {isTamu ? 'Pilih apakah Anda ingin mendengar koreksi suara atau berlatih tanpa koreksi.' : 'Di fase P0, formulir menyediakan pilihan mode Penuh atau Mati.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label className={`min-h-[44px] flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
            modeKoreksi === 'penuh' ? 'border-blue-600 bg-blue-50 font-semibold' : 'border-gray-200 hover:bg-gray-50'
          }`}>
            <input
              type="radio"
              name="mode_koreksi"
              value="penuh"
              checked={modeKoreksi === 'penuh'}
              onChange={() => setModeKoreksi('penuh')}
              className="w-6 h-6 mt-0.5 text-blue-600"
            />
            <div>
              <span className="block text-lg">Penuh</span>
              <span className="block text-lg font-normal text-gray-600">Koreksi suara aktif saat kompensasi terdeteksi</span>
            </div>
          </label>
          <label className={`min-h-[44px] flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
            modeKoreksi === 'mati' ? 'border-blue-600 bg-blue-50 font-semibold' : 'border-gray-200 hover:bg-gray-50'
          }`}>
            <input
              type="radio"
              name="mode_koreksi"
              value="mati"
              checked={modeKoreksi === 'mati'}
              onChange={() => setModeKoreksi('mati')}
              className="w-6 h-6 mt-0.5 text-blue-600"
            />
            <div>
              <span className="block text-lg">Mati</span>
              <span className="block text-lg font-normal text-gray-600">Pencatatan data tanpa koreksi suara audio</span>
            </div>
          </label>

          {/* Opsi nonaktif bila nilai awal dari database adalah 'ringkasan' (P1) — tidak tampil di mode tamu */}
          {!isTamu && modeAsli === 'ringkasan' && (
            <div className={`sm:col-span-2 min-h-[44px] flex items-start gap-3 p-3 border-2 rounded-xl ${
              modeKoreksi === 'ringkasan' ? 'border-gray-400 bg-gray-100 font-semibold' : 'border-gray-200 bg-gray-50 opacity-60'
            }`}>
              <input
                type="radio"
                name="mode_koreksi"
                value="ringkasan"
                checked={modeKoreksi === 'ringkasan'}
                disabled
                className="w-6 h-6 mt-0.5 text-gray-500 cursor-not-allowed"
              />
              <div>
                <span className="block text-lg">Ringkasan (dipertahankan)</span>
                <span className="block text-lg font-normal text-gray-600">
                  Resep ini sebelumnya memakai mode Ringkasan (P1). Nilai ini tetap dipertahankan kecuali Anda memilih Penuh atau Mati.
                </span>
              </div>
            </div>
          )}
        </div>
      </fieldset>

      {/* 8. Kalimat Koreksi Condong */}
      <fieldset className="space-y-2">
        <legend className="block font-semibold text-gray-900 text-lg">
          Kalimat Koreksi Tubuh Condong
        </legend>
        <p className="text-lg text-gray-600">
          Instruksi suara yang diputar saat pasien memajukan badan berlebih.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label className={`min-h-[44px] flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
            kalimatCondong === 'sandaran' ? 'border-blue-600 bg-blue-50 font-semibold' : 'border-gray-200 hover:bg-gray-50'
          }`}>
            <input
              type="radio"
              name="kalimat_condong"
              value="sandaran"
              checked={kalimatCondong === 'sandaran'}
              onChange={() => setKalimatCondong('sandaran')}
              className="w-6 h-6 mt-0.5 text-blue-600"
            />
            <div>
              <span className="block text-lg">Menempel sandaran</span>
              <span className="block text-lg font-normal text-gray-600">&ldquo;Punggung tetap menempel di sandaran kursi&rdquo;</span>
            </div>
          </label>
          <label className={`min-h-[44px] flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-colors ${
            kalimatCondong === 'tegak' ? 'border-blue-600 bg-blue-50 font-semibold' : 'border-gray-200 hover:bg-gray-50'
          }`}>
            <input
              type="radio"
              name="kalimat_condong"
              value="tegak"
              checked={kalimatCondong === 'tegak'}
              onChange={() => setKalimatCondong('tegak')}
              className="w-6 h-6 mt-0.5 text-blue-600"
            />
            <div>
              <span className="block text-lg">Tetap tegak</span>
              <span className="block text-lg font-normal text-gray-600">&ldquo;Badan tetap tegak, jangan condong ke depan&rdquo;</span>
            </div>
          </label>
        </div>
      </fieldset>

      {/* Tombol Aksi NFR-6: Tombol utama ≥ 64px, kontrol lain ≥ 44×44px */}
      <div className="pt-4 space-y-3">
        <button
          type="submit"
          disabled={sedangSimpan}
          className="w-full min-h-[64px] px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl rounded-xl shadow-md transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          {sedangSimpan ? (
            <span>Menyimpan resep...</span>
          ) : isTamu ? (
            <span>Mulai latihan</span>
          ) : isEdit ? (
            <span>Simpan Perubahan Resep</span>
          ) : (
            <span>Simpan dan Terbitkan Resep</span>
          )}
        </button>

        {onBatal && (
          <button
            type="button"
            onClick={onBatal}
            disabled={sedangSimpan}
            className="w-full min-h-[44px] px-4 py-2 border-2 border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Batal
          </button>
        )}
      </div>
    </form>
  );
}
