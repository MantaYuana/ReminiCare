export const metadata = {
  title: 'Kebijakan Privasi — ReminiCare',
};

export default function PrivasiPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-lg p-8 sm:p-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Kebijakan Privasi
        </h1>

        <div className="space-y-8 text-lg text-gray-800 leading-relaxed">
          {/* Siapa kami */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Siapa kami
            </h2>
            <p>
              ReminiCare adalah prototipe aplikasi untuk latihan lengan pasca-stroke yang dikembangkan untuk lomba 
              Hacking Day INCEPTION 2026. Versi ini menggunakan data sintetis (dibuat oleh kode) untuk keperluan demo, 
              bukan data pasien sesungguhnya.
            </p>
          </section>

          {/* Data yang disimpan */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Data yang kami simpan
            </h2>
            <p className="mb-4">
              Kami hanya menyimpan data yang diperlukan untuk membantu fisioterapis memantau latihan Anda:
            </p>
            <ul className="list-disc list-inside space-y-3 ml-4">
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
            <p className="mt-4 font-semibold text-gray-900">
              Video kamera Anda tidak dikirim atau disimpan ke server mana pun. Pemrosesan gambar dilakukan 
              seluruhnya di perangkat Anda.
            </p>
          </section>

          {/* Untuk apa */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Untuk apa data ini digunakan
            </h2>
            <p className="mb-4">
              Data yang kami simpan digunakan untuk:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Membantu Anda berlatih dengan koreksi postur secara real-time</li>
              <li>Menampilkan kemajuan latihan Anda dalam bentuk grafik di beranda</li>
              <li>Memberi fisioterapis Anda informasi objektif untuk memantau perkembangan Anda</li>
              <li>Mendeteksi tanda perburukan yang mungkin memerlukan perhatian fisioterapis</li>
            </ul>
          </section>

          {/* Siapa yang melihat */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Siapa yang dapat melihat data Anda
            </h2>
            <p className="mb-4">
              Data latihan Anda hanya dapat diakses oleh:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                <strong>Anda sendiri:</strong> melalui beranda pasien dan grafik kemajuan
              </li>
              <li>
                <strong>Fisioterapis yang merawat Anda:</strong> hanya data pasiennya sendiri yang dapat dilihat, 
                sesuai pengamanan Row-Level Security (RLS) di database
              </li>
            </ul>
            <p className="mt-4">
              Fisioterapis lain tidak dapat melihat data Anda. Email dan nama akun Google Anda tidak ditampilkan 
              kepada fisioterapis.
            </p>
          </section>

          {/* Penerima layanan */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Penerima dan penyedia layanan
            </h2>
            <p className="mb-4">
              Untuk menjalankan aplikasi ini, kami menggunakan layanan pihak ketiga berikut:
            </p>
            <ul className="list-disc list-inside space-y-3 ml-4">
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
          </section>

          {/* Masa simpan */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Berapa lama data disimpan
            </h2>
            <p>
              Data latihan Anda disimpan selama Anda masih terhubung ke fisioterapis dan belum menghapus data. 
              Anda dapat menghapus semua data latihan kapan saja melalui tombol &quot;Hapus Data Saya&quot; 
              di beranda pasien.
            </p>
            <p className="mt-4">
              Setelah menghapus data, semua sesi latihan dan catatan eskalasi Anda akan dihapus dari database. 
              Akun login Google Anda di Supabase Auth tetap ada sampai fitur hapus akun tersedia.
            </p>
          </section>

          {/* Lokasi data */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Lokasi penyimpanan data
            </h2>
            <p className="mb-4">
              Data sintetis, server Singapura; lokasi penyimpanan untuk deployment klinis akan disesuaikan 
              dengan regulasi sektor kesehatan.
            </p>
            <p>
              Untuk versi prototipe lomba ini, data disimpan di server Supabase region Singapura (ap-southeast-1). 
              Data dienkripsi saat dikirim (HTTPS) dan saat disimpan (enkripsi at-rest).
            </p>
          </section>

          {/* Hak Anda */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Hak Anda atas data pribadi
            </h2>
            <p className="mb-4">
              Sesuai UU 27/2022 tentang Perlindungan Data Pribadi, Anda memiliki hak:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
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
          </section>

          {/* Persetujuan */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Siapa yang menyetujui
            </h2>
            <p>
              Persetujuan penggunaan aplikasi ini diberikan oleh pasien, atau oleh wali yang bertindak atas nama 
              pasien jika pasien tidak mampu memberikan persetujuan sendiri. Persetujuan dicatat dengan mencantumkan 
              versi naskah persetujuan dan waktu persetujuan diberikan.
            </p>
          </section>

          {/* Kontak */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Hubungi kami
            </h2>
            <p>
              Jika Anda memiliki pertanyaan tentang kebijakan privasi ini atau ingin menggunakan hak Anda atas 
              data pribadi, silakan hubungi kami di:
            </p>
            <p className="mt-4 font-semibold text-gray-900">
              Email: <span className="text-blue-600">&lt;email kontak tim&gt;</span>
            </p>
          </section>

          {/* Perubahan kebijakan */}
          <section className="border-t border-gray-200 pt-6 mt-8">
            <p className="text-base text-gray-600">
              <strong>Terakhir diperbarui:</strong> 1 November 2026
            </p>
            <p className="text-base text-gray-600 mt-2">
              Kami dapat memperbarui kebijakan privasi ini dari waktu ke waktu. Perubahan akan ditampilkan 
              di halaman ini dengan tanggal pembaruan yang baru.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
