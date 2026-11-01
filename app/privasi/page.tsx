import Link from 'next/link';
import { Logo } from '../../components/AuthLayout';

export const metadata = {
  title: 'Kebijakan Privasi — ReminiCare',
};

const EMAIL_KONTAK = 'gunamanta.yuana@gmail.com';

const daftar = 'list-disc space-y-3 pl-6 marker:text-brand-600';

type Bagian = { id: string; judul: string; isi: React.ReactNode };

const BAGIAN: Bagian[] = [
  {
    id: 'siapa-kami',
    judul: 'Siapa kami',
    isi: (
      <p>
        ReminiCare adalah prototipe aplikasi untuk latihan lengan pasca-stroke yang dikembangkan untuk lomba
        Hacking Day INCEPTION 2026. Versi ini menggunakan data sintetis (dibuat oleh kode) untuk keperluan demo,
        bukan data pasien sesungguhnya.
      </p>
    ),
  },
  {
    id: 'data-disimpan',
    judul: 'Data yang kami simpan',
    isi: (
      <>
        <p>Kami hanya menyimpan data yang diperlukan untuk membantu fisioterapis memantau latihan Anda:</p>
        <ul className={daftar}>
          <li>
            <strong>Email dan nama akun Google Anda:</strong> disimpan oleh layanan login (Supabase Auth)
            untuk memungkinkan Anda masuk. Fisioterapis tidak melihat informasi ini.
          </li>
          <li>
            <strong>Resep latihan:</strong> gerakan, jumlah repetisi, dan pengaturan toleransi yang ditentukan
            oleh fisioterapis Anda.
          </li>
          <li>
            <strong>Hasil latihan:</strong> angka agregat seperti persentase repetisi yang benar, waktu gerak,
            dan kecepatan. Kami menyimpan angka-angka ini, bukan video atau gambar Anda.
          </li>
          <li>
            <strong>Nyeri yang Anda laporkan:</strong> skala sederhana (tidak nyeri / agak nyeri / nyeri)
            setelah latihan.
          </li>
          <li>
            <strong>Baseline kalibrasi:</strong> parameter geometris tubuh Anda (jarak bahu, tinggi batang tubuh)
            sebagai angka ternormalisasi, diukur setiap kali latihan.
          </li>
        </ul>
        <p className="rounded-xl bg-brand-50 p-4 font-semibold text-brand-700">
          Video kamera Anda tidak dikirim atau disimpan ke server mana pun. Pemrosesan gambar dilakukan
          seluruhnya di perangkat Anda.
        </p>
      </>
    ),
  },
  {
    id: 'kegunaan',
    judul: 'Untuk apa data ini digunakan',
    isi: (
      <>
        <p>Data yang kami simpan digunakan untuk:</p>
        <ul className={daftar}>
          <li>Membantu Anda berlatih dengan koreksi postur secara real-time</li>
          <li>Menampilkan kemajuan latihan Anda dalam bentuk grafik di beranda</li>
          <li>Memberi fisioterapis Anda informasi objektif untuk memantau perkembangan Anda</li>
          <li>Mendeteksi tanda perburukan yang mungkin memerlukan perhatian fisioterapis</li>
        </ul>
      </>
    ),
  },
  {
    id: 'siapa-melihat',
    judul: 'Siapa yang dapat melihat data Anda',
    isi: (
      <>
        <p>Data latihan Anda hanya dapat diakses oleh:</p>
        <ul className={daftar}>
          <li>
            <strong>Anda sendiri:</strong> melalui beranda pasien dan grafik kemajuan
          </li>
          <li>
            <strong>Fisioterapis yang merawat Anda:</strong> hanya data pasiennya sendiri yang dapat dilihat,
            sesuai pengamanan Row-Level Security (RLS) di database
          </li>
        </ul>
        <p>
          Fisioterapis lain tidak dapat melihat data Anda. Email dan nama akun Google Anda tidak ditampilkan
          kepada fisioterapis.
        </p>
        <p>
          Sebaliknya, setelah terhubung, beranda Anda menampilkan nama dan foto profil Google fisioterapis Anda.
          Foto itu dimuat langsung dari server Google.
        </p>
      </>
    ),
  },
  {
    id: 'penyedia-layanan',
    judul: 'Penerima dan penyedia layanan',
    isi: (
      <>
        <p>Untuk menjalankan aplikasi ini, kami menggunakan layanan pihak ketiga berikut:</p>
        <ul className={daftar}>
          <li>
            <strong>Supabase</strong> (Singapura): menyimpan data latihan dan menyediakan layanan autentikasi.
            Supabase memiliki sertifikasi SOC 2 Type II dan ISO 27001.
          </li>
          <li>
            <strong>Vercel</strong> (global): hosting aplikasi web.
          </li>
          <li>
            <strong>Google</strong>: penyedia login dengan akun Google (OAuth).
          </li>
          <li>
            <strong>Gemini API (Google)</strong>: menghasilkan ringkasan AI untuk fisioterapis. Yang dikirim
            hanya angka agregat 14 hari terakhir, tanpa nama, ID pasien, atau tanggal.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'masa-simpan',
    judul: 'Berapa lama data disimpan',
    isi: (
      <>
        <p>
          Data latihan Anda disimpan selama Anda masih terhubung ke fisioterapis dan belum menghapus data.
          Anda dapat menghapus semua data latihan kapan saja melalui tombol &quot;Hapus Data Saya&quot;
          di beranda pasien.
        </p>
        <p>
          Setelah menghapus data, semua sesi latihan dan catatan eskalasi Anda akan dihapus dari database.
          Akun login Google Anda di Supabase Auth tetap ada sampai fitur hapus akun tersedia.
        </p>
      </>
    ),
  },
  {
    id: 'lokasi-data',
    judul: 'Lokasi penyimpanan data',
    isi: (
      <>
        <p>
          Data sintetis, server Singapura; lokasi penyimpanan untuk deployment klinis akan disesuaikan
          dengan regulasi sektor kesehatan.
        </p>
        <p>
          Untuk versi prototipe lomba ini, data disimpan di server Supabase region Singapura (ap-southeast-1).
          Data dienkripsi saat dikirim (HTTPS) dan saat disimpan (enkripsi at-rest).
        </p>
      </>
    ),
  },
  {
    id: 'hak-anda',
    judul: 'Hak Anda atas data pribadi',
    isi: (
      <>
        <p>Sesuai UU 27/2022 tentang Perlindungan Data Pribadi, Anda memiliki hak:</p>
        <ul className={daftar}>
          <li>
            <strong>Hak akses:</strong> melihat data latihan Anda di beranda dan grafik kemajuan
          </li>
          <li>
            <strong>Hak penghapusan:</strong> menghapus semua data latihan melalui &quot;Hapus Data Saya&quot;
          </li>
          <li>
            <strong>Hak penarikan persetujuan:</strong> menghapus data sekaligus menarik persetujuan Anda
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'persetujuan',
    judul: 'Siapa yang menyetujui',
    isi: (
      <p>
        Persetujuan penggunaan aplikasi ini diberikan oleh pasien, atau oleh wali yang bertindak atas nama
        pasien jika pasien tidak mampu memberikan persetujuan sendiri. Persetujuan dicatat dengan mencantumkan
        versi naskah persetujuan dan waktu persetujuan diberikan.
      </p>
    ),
  },
  {
    id: 'kontak',
    judul: 'Hubungi kami',
    isi: (
      <>
        <p>
          Jika Anda memiliki pertanyaan tentang kebijakan privasi ini atau ingin menggunakan hak Anda atas
          data pribadi, silakan hubungi kami di:
        </p>
        <a
          href={`mailto:${EMAIL_KONTAK}`}
          className="inline-flex min-h-[48px] w-fit items-center rounded-xl bg-brand-700 px-5 text-base font-semibold text-white transition-colors hover:bg-brand-800"
        >
          {EMAIL_KONTAK}
        </a>
      </>
    ),
  },
];

export default function PrivasiPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <Link href="/" className="rc-tautan">Kembali ke beranda</Link>
        </div>

        <header className="mt-10 max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-brand-700 sm:text-5xl">Kebijakan Privasi</h1>
          <p className="mt-3 text-base text-muted">
            Terakhir diperbarui 1 November 2026. Ringkasnya: kami hanya menyimpan angka hasil latihan,
            video Anda tidak pernah meninggalkan perangkat.
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
          <nav aria-label="Daftar isi" className="w-full shrink-0 lg:sticky lg:top-8 lg:w-64">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Daftar isi</p>
            <ol className="flex flex-col gap-1 rounded-2xl border border-slate-200 p-3 lg:border-0 lg:p-0">
              {BAGIAN.map((b, i) => (
                <li key={b.id}>
                  <a
                    href={`#${b.id}`}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-2 text-base text-ink transition-colors hover:bg-brand-50 hover:text-brand-700"
                  >
                    <span aria-hidden="true" className="w-5 shrink-0 text-sm tabular-nums text-muted">{i + 1}</span>
                    {b.judul}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0 max-w-3xl flex-1 space-y-12">
            {BAGIAN.map((b, i) => (
              <section key={b.id} id={b.id} aria-labelledby={`judul-${b.id}`} className="scroll-mt-8 space-y-4 text-base leading-relaxed">
                <h2 id={`judul-${b.id}`} className="flex items-baseline gap-3 text-2xl font-semibold text-ink">
                  <span aria-hidden="true" className="text-lg tabular-nums text-brand-600">{String(i + 1).padStart(2, '0')}</span>
                  {b.judul}
                </h2>
                {b.isi}
              </section>
            ))}

            <p className="border-t border-slate-200 pt-6 text-sm text-muted">
              Kami dapat memperbarui kebijakan privasi ini dari waktu ke waktu. Perubahan akan ditampilkan
              di halaman ini dengan tanggal pembaruan yang baru.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
