'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, pesanGalat } from '../lib/supabase';
import { IkonPanahBawah } from './ikon';

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

type PropsUmum = {
  pasien?: DataResepPasien | null;
  onBerhasil?: (pasienId: string) => void;
  onBatal?: () => void;
};

// Mode tamu wajib membawa onKirim (dicek tsc); mode baru/edit tidak memakainya
export type FormResepProps =
  | (PropsUmum & { mode?: 'baru' | 'edit'; onKirim?: never })
  | (PropsUmum & { mode: 'tamu'; onKirim: (r: ResepTamu) => void });

const kelasInput = 'min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3 text-base focus:border-brand-700 focus:outline-none';
const kelasLabel = 'mb-1 block text-sm font-medium';

const Pilihan = ({ id, label, nilai, onUbah, children }: {
  id: string; label: string; nilai: string; onUbah: (v: string) => void; children: React.ReactNode;
}) => (
  <div>
    <label htmlFor={id} className={kelasLabel}>{label}</label>
    <div className="relative">
      <select id={id} value={nilai} onChange={e => onUbah(e.target.value)} className={`${kelasInput} appearance-none pr-10`}>
        {children}
      </select>
      <IkonPanahBawah className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2" />
    </div>
  </div>
);

const Radio = ({ nama, nilai, dipilih, onPilih, label, ket, nonaktif }: {
  nama: string; nilai: string; dipilih: boolean; onPilih?: () => void; label: string; ket: string; nonaktif?: boolean;
}) => (
  <label className={`flex min-h-[44px] items-start gap-3 ${nonaktif ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
    <input
      type="radio"
      name={nama}
      value={nilai}
      checked={dipilih}
      onChange={onPilih}
      disabled={nonaktif}
      className="mt-1 h-5 w-5 accent-brand-700"
    />
    <span className="text-base">
      {label}
      <span className="block text-sm text-muted">{ket}</span>
    </span>
  </label>
);

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

  // Dropdown gerakan: satu gerakan atau keduanya (urutan tetap depan lalu samping)
  const pilihanGerakan: 'depan' | 'samping' | 'keduanya' =
    gerakan.length >= 2 ? 'keduanya' : gerakan[0] === 'jangkau_samping' ? 'samping' : 'depan';

  const handlePilihGerakan = (v: string) => {
    setGerakan(
      v === 'keduanya' ? ['jangkau_depan', 'jangkau_samping']
      : v === 'samping' ? ['jangkau_samping']
      : ['jangkau_depan']
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (sedangSubmitRef.current) return;
    sedangSubmitRef.current = true;

    setGalat(null);
    setPesanSukses(null);

    // 1. Validasi klien persis constraint DB
    // Mode tamu: nama panggilan tidak divalidasi
    const namaBersih = namaPanggilan.trim();
    if (!isTamu && (namaBersih.length < 1 || namaBersih.length > 40)) {
      sedangSubmitRef.current = false;
      setGalat('Nama panggilan harus diisi antara 1 sampai 40 karakter.');
      return;
    }

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
    if (!isEdit && modeKoreksi !== 'penuh' && modeKoreksi !== 'mati') {
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
      onKirim?.({
        sisi_terdampak: sisiTerdampak,
        gerakan,
        repetisi: nRepetisi,
        toleransi_batang: toleransiBatang,
        toleransi_bahu: toleransiBahu,
        durasi_persen: nDurasi,
        mode_koreksi: modeKoreksi as 'penuh' | 'mati',
        kalimat_condong: kalimatCondong,
      });
      return;
    }

    // mode="edit" eksplisit tanpa id (data belum termuat) tidak boleh jatuh ke jalur insert
    if (isEdit && !pasien?.id) {
      sedangSubmitRef.current = false;
      setGalat('Data pasien belum termuat. Muat ulang halaman lalu coba lagi.');
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
    <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-5">
      {isEdit && (
        <div className="rc-info">
          <p className="font-semibold">Mode edit resep</p>
          <p>Perubahan resep ini berlaku mulai sesi berikutnya.</p>
        </div>
      )}

      {galat && (
        <div role="alert" className="rc-alert">
          <p className="font-semibold">Periksa kembali data resep</p>
          <p>{galat}</p>
        </div>
      )}

      {pesanSukses && (
        <div role="status" className="rc-ok">
          <p className="font-semibold">Pembaruan berhasil</p>
          <p>{pesanSukses}</p>
        </div>
      )}

      {!isTamu && (
        <div>
          <label htmlFor="field-nama" className={kelasLabel}>Nama panggilan pasien</label>
          <input
            id="field-nama"
            type="text"
            maxLength={40}
            value={namaPanggilan}
            onChange={(e) => setNamaPanggilan(e.target.value)}
            required
            placeholder="Contoh: Pak Wayan"
            className={kelasInput}
          />
        </div>
      )}

      <Pilihan
        id="field-sisi"
        label={isTamu ? 'Lengan yang dilatih' : 'Sisi lengan yang terdampak stroke'}
        nilai={sisiTerdampak}
        onUbah={(v) => setSisiTerdampak(v as SisiTerdampak)}
      >
        <option value="kanan">Lengan kanan</option>
        <option value="kiri">Lengan kiri</option>
      </Pilihan>

      <Pilihan id="field-gerakan" label="Gerakan yang diresepkan" nilai={pilihanGerakan} onUbah={handlePilihGerakan}>
        <option value="depan">Jangkau depan (fleksi bahu)</option>
        <option value="samping">Jangkau samping (abduksi bahu)</option>
        <option value="keduanya">Keduanya</option>
      </Pilihan>

      <div className={isTamu ? '' : 'grid gap-5 sm:grid-cols-2'}>
        <div>
          <label htmlFor="field-repetisi" className={kelasLabel}>Target repetisi per gerakan</label>
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
            required
            placeholder="5–20"
            className={`${kelasInput} sm:max-w-48`}
          />
        </div>

        {!isTamu && (
          <div>
            <label htmlFor="field-sesi-minggu" className={kelasLabel}>Target sesi per minggu</label>
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
              required
              placeholder="1–7"
              className={`${kelasInput} sm:max-w-48`}
            />
          </div>
        )}
      </div>

      <Pilihan id="field-toleransi-batang" label="Toleransi batang tubuh" nilai={toleransiBatang} onUbah={(v) => setToleransiBatang(v as TingkatToleransi)}>
        <option value="abaikan">Abaikan (tanpa deteksi batang)</option>
        <option value="longgar">Longgar (sensitivitas rendah)</option>
        <option value="normal">Normal (standar klinis)</option>
        <option value="ketat">Ketat (sensitivitas tinggi)</option>
      </Pilihan>

      <Pilihan id="field-toleransi-bahu" label="Toleransi elevasi bahu" nilai={toleransiBahu} onUbah={(v) => setToleransiBahu(v as TingkatToleransi)}>
        <option value="abaikan">Abaikan (tanpa deteksi bahu)</option>
        <option value="longgar">Longgar (sensitivitas rendah)</option>
        <option value="normal">Normal (standar klinis)</option>
        <option value="ketat">Ketat (sensitivitas tinggi)</option>
      </Pilihan>

      <div>
        <label htmlFor="field-durasi" className={kelasLabel}>Ambang durasi kompensasi (% fase gerak)</label>
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
          required
          placeholder="10–80, bawaan 30"
          className={kelasInput}
        />
      </div>

      <fieldset>
        <legend className={kelasLabel}>Mode koreksi suara</legend>
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-8">
          <Radio nama="mode_koreksi" nilai="penuh" dipilih={modeKoreksi === 'penuh'} onPilih={() => setModeKoreksi('penuh')} label="Penuh" ket="Koreksi suara aktif saat kompensasi terdeteksi" />
          <Radio nama="mode_koreksi" nilai="mati" dipilih={modeKoreksi === 'mati'} onPilih={() => setModeKoreksi('mati')} label="Mati" ket="Hanya mencatat data, tanpa koreksi suara" />
          {/* Tampil nonaktif hanya bila nilai awal dari database adalah 'ringkasan' (P1) */}
          {!isTamu && modeAsli === 'ringkasan' && (
            <Radio nama="mode_koreksi" nilai="ringkasan" dipilih={modeKoreksi === 'ringkasan'} label="Ringkasan (dipertahankan)" ket="Nilai lama (P1), tetap dipakai kecuali Anda memilih Penuh atau Mati" nonaktif />
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className={kelasLabel}>Kalimat koreksi tubuh condong</legend>
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-8">
          <Radio nama="kalimat_condong" nilai="sandaran" dipilih={kalimatCondong === 'sandaran'} onPilih={() => setKalimatCondong('sandaran')} label="Menempel sandaran" ket="“Punggung tetap menempel di sandaran kursi”" />
          <Radio nama="kalimat_condong" nilai="tegak" dipilih={kalimatCondong === 'tegak'} onPilih={() => setKalimatCondong('tegak')} label="Tetap tegak" ket="“Badan tetap tegak, jangan condong ke depan”" />
        </div>
      </fieldset>

      <div className="flex flex-col gap-3 pt-2">
        <button type="submit" disabled={sedangSimpan} className="rc-btn">
          {sedangSimpan ? 'Menyimpan resep…' : isTamu ? 'Mulai latihan' : isEdit ? 'Simpan Perubahan Resep' : 'Simpan dan Terbitkan Resep'}
        </button>

        {onBatal && (
          <button type="button" onClick={onBatal} disabled={sedangSimpan} className="rc-btn-2">
            Batal
          </button>
        )}
      </div>
    </form>
  );
}
