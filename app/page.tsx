import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '../components/AuthLayout';
import AlihkanBilaMasuk from '../components/landing/AlihkanBilaMasuk';
import EfekMuncul from '../components/landing/EfekMuncul';
import TombolSuara from '../components/landing/TombolSuara';
import VideoMalas from '../components/landing/VideoMalas';
import { huruf_judul, huruf_isi } from '../components/landing/fonts';
import { IkonPutar, IkonPeringatan, IkonVideoMati, IkonCentang, IkonPanah, IkonJam } from '../components/landing/ikon';
import '../components/landing/landing.css';

export const metadata = {
  title: 'ReminiCare: latihan lengan pasca-stroke di rumah, dikoreksi lewat suara',
  description:
    'Kamera ponsel memandu latihan lengan dengan koreksi suara Bahasa Indonesia. Fisioterapis melihat angka hasilnya di dasbor. Video tidak keluar dari perangkat.',
};

const KALIMAT = [
  { kode: 'K-BAHU', saat: 'Saat bahu terangkat', teks: 'Turunkan bahu, rileks.' },
  { kode: 'K-MIRING', saat: 'Saat badan miring', teks: 'Badan jangan miring.' },
  { kode: 'K-CONDONG-T', saat: 'Saat punggung condong', teks: 'Punggung tetap tegak.' },
  { kode: 'I-BAGUS', saat: 'Saat satu repetisi benar', teks: 'Bagus, lanjutkan.' },
] as const;

const ALUR = [
  { judul: 'Fisioterapis menyusun resep', isi: 'Terapis menentukan gerakan jangkauan, jumlah repetisi per sesi, dan batas toleransi untuk tiap tanda kompensasi.' },
  { judul: 'Keluarga memindai QR', isi: 'Pindai kode QR dari fisioterapis dengan kamera ponsel. Halaman terbuka di peramban, tanpa unduh aplikasi dan tanpa mengetik.' },
  { judul: 'Pasien berlatih, dipandu suara', isi: 'Ponsel diletakkan di meja. Kamera membaca posisi lengan dan badan di perangkat, lalu suara menegur saat gerakan melenceng.' },
  { judul: 'Angka masuk ke dasbor', isi: 'Persentase repetisi benar, tanggal latihan, dan nyeri yang dilaporkan tersimpan untuk dibahas saat kontrol berikutnya.' },
];

const TITIK = [
  ['Tombol besar, tulisan jelas', 'Tombol utama lebar dan mudah ditekan. Tulisan dibuat besar agar nyaman dibaca.'],
  ['Tanpa unduhan', 'Dibuka di peramban lewat tautan atau kode QR dari fisioterapis.'],
  ['Boleh dicoba tanpa akun', 'Mode tamu membiarkan siapa saja mencoba latihan sebelum mendaftar.'],
  ['Tidak perlu menatap layar', 'Hitungan repetisi dan koreksi dibacakan, jadi pasien bisa fokus pada gerakan lengannya.'],
  ['Tetap jalan saat sinyal putus', 'Hasil sesi disimpan di perangkat dan dikirim saat internet tersambung.'],
  ['Data bisa dihapus', 'Pasien dapat menghapus semua data latihannya kapan saja.'],
];

const PASIEN = [
  { nama: 'Pasien A', status: 'Eskalasi terbuka', ikon: 'peringatan', nyeri: 'Tidak nyeri', nilai: '62%' },
  { nama: 'Pasien B', status: 'Melaporkan nyeri', ikon: 'peringatan', nyeri: 'Nyeri', nilai: '71%' },
  { nama: 'Pasien C', status: 'Jarang berlatih', ikon: 'jam', nyeri: 'Tidak nyeri', nilai: '80%' },
  { nama: 'Pasien D', status: 'Sesuai resep', ikon: 'centang', nyeri: 'Tidak nyeri', nilai: '90%' },
] as const;

const BATAS = [
  ['Masih prototipe', 'ReminiCare belum menjadi produk jadi. Datanya sintetis, dibuat oleh kode, bukan data pasien sesungguhnya.'],
  ['Bukan alat diagnosis', 'ReminiCare membantu memandu postur latihan di rumah. Ia tidak menggantikan pemeriksaan langsung oleh dokter spesialis rehabilitasi medik atau fisioterapis.'],
  ['Belum diuji pada pasien stroke', 'Prototipe ini diuji pada subjek sehat. Belum ada uji klinis pada pasien pasca-stroke.'],
  ['Resep milik tenaga kesehatan', 'Sistem tidak pernah mengubah jenis atau dosis latihan sendiri. Perubahan resep sepenuhnya wewenang tenaga kesehatan.'],
];

function IkonStatus({ jenis }: { jenis: 'peringatan' | 'jam' | 'centang' }) {
  if (jenis === 'peringatan') return <IkonPeringatan className="h-6 w-6" />;
  if (jenis === 'jam') return <IkonJam className="h-6 w-6" />;
  return <IkonCentang className="h-6 w-6" />;
}

export default function Landing() {
  return (
    <div className={`lp ${huruf_judul.variable} ${huruf_isi.variable}`}>
      <AlihkanBilaMasuk />
      <EfekMuncul />

      <header className="lp-nav">
        <nav className="lp-wrap lp-nav__isi" aria-label="Utama">
          <Link href="/" aria-label="ReminiCare, beranda" className="lp-nav__logo">
            <Logo />
          </Link>
          <div className="lp-nav__aksi">
            <Link href="/daftar" className="lp-link">Buat akun</Link>
            <Link href="/masuk" className="lp-btn">Masuk</Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero: kalimat koreksi yang diucapkan adalah pusatnya */}
        <section className="lp-hero lp-gelap" aria-labelledby="judul-hero">
          <div className="lp-wrap lp-hero__grid">
            <div className="lp-hero__teks">
              <h1 id="judul-hero">Lengan berlatih, suara mengoreksi.</h1>
              <p className="lp-lead">
                ReminiCare memandu latihan lengan pasca-stroke di rumah. Kamera ponsel membaca bahu dan badan,
                lalu suara Bahasa Indonesia menegur saat gerakannya melenceng.
              </p>
              <div className="lp-hero__aksi">
                <Link href="/tamu" className="lp-btn lp-btn--main"><IkonPutar className="h-6 w-6" />Coba latihan sekarang</Link>
                <Link href="/masuk" className="lp-btn lp-btn--sekunder">Masuk dengan Google</Link>
              </div>
              <p className="lp-hero__catatan">Tanpa akun dan tanpa unduhan. Prototipe dengan data contoh, bukan alat diagnosis.</p>
            </div>

            <div className="lp-hero__panggung lp-aqua">
              <div className="lp-giant" aria-hidden="true" />
              <div className="lp-bingkai">
                <VideoMalas
                  segera
                  src="/video/jangkau_depan.mp4"
                  poster="/landing/poster-depan.svg"
                  label="Peragaan gerakan jangkau depan, dilihat dari depan"
                />
              </div>
              <figure className="lp-ucap">
                <blockquote>“Turunkan bahu, rileks.”</blockquote>
                <TombolSuara kode="K-BAHU" teks="Turunkan bahu, rileks." />
                <figcaption className="lp-ucap__ket">Rekaman asli dari aplikasi, diputar saat bahu terangkat.</figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* Kalimat koreksi yang bisa didengar */}
        <section className="lp-suara lp-mint lp-sec" aria-labelledby="judul-suara">
          <div className="lp-wrap lp-suara__grid">
            <div className="lp-suara__kepala" data-muncul="0">
              <h2 id="judul-suara" className="lp-h2">Kalimat pendek, saat dibutuhkan.</h2>
              <p className="lp-lead">
                Ponsel membaca posisi bahu dan badan. Begitu gerakan melenceng, satu kalimat singkat terdengar,
                dan hitungan repetisi ikut dibacakan. Ketuk Dengarkan untuk memutar rekaman asli dari aplikasi.
              </p>
            </div>
            <ul className="lp-suara__daftar">
              {KALIMAT.map((k, i) => (
                <li key={k.kode} className="lp-kalimat" data-muncul={i}>
                  <div className="lp-kalimat__teks">
                    <blockquote>“{k.teks}”</blockquote>
                    <p className="lp-kalimat__saat">{k.saat}.</p>
                  </div>
                  <TombolSuara kode={k.kode} teks={k.teks} kecil />
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Cara kerja */}
        <section className="lp-alursek lp-sec" aria-labelledby="judul-alur">
          <div className="lp-wrap">
            <div className="lp-alur__kepala" data-muncul="0">
              <h2 id="judul-alur" className="lp-h2">Dari resep sampai laporan.</h2>
              <p className="lp-lead">Empat langkah, dirancang agar pasien dan pendamping lanjut usia bisa menjalankannya sendiri.</p>
            </div>
            <ol className="lp-alur" data-muncul="1">
              {ALUR.map(a => (
                <li key={a.judul}>
                  <h3>{a.judul}</h3>
                  <p>{a.isi}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Untuk pasien dan keluarga */}
        <section className="lp-keluarga lp-gelap-2 lp-sec" aria-labelledby="judul-keluarga">
          <div className="lp-wrap lp-keluarga__grid">
            <figure className="lp-keluarga__gambar" data-muncul="0">
              <div className="lp-bingkai">
                <VideoMalas
                  src="/video/jangkau_samping.mp4"
                  poster="/landing/poster-samping.svg"
                  label="Peragaan gerakan jangkau depan, dilihat dari samping"
                />
              </div>
              <figcaption>Gerakan jangkau yang sama, dilihat dari samping.</figcaption>
            </figure>
            <div className="lp-keluarga__isi">
              <h2 id="judul-keluarga" className="lp-h2" data-muncul="0">Mudah bagi pasien dan keluarga.</h2>
              <p className="lp-lead" data-muncul="1">
                Tidak ada menu berlapis dan tidak ada kolom formulir kecil. Letakkan ponsel di meja, tekan tombol besar, lalu ikuti suaranya.
              </p>
              <ul className="lp-titik">
                {TITIK.map(([j, i], n) => (
                  <li key={j} data-muncul={n % 3}>
                    <span className="lp-tanda" aria-hidden="true" />
                    <h3>{j}</h3>
                    <p>{i}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Untuk fisioterapis */}
        <section className="lp-fisio lp-mint lp-sec" aria-labelledby="judul-fisio">
          <div className="lp-wrap lp-fisio__grid">
            <div className="lp-ui" data-ui role="group" aria-label="Contoh dasbor fisioterapis dengan data sintetis" data-muncul="0">
              <div className="lp-ui__kepala">
                <p className="lp-ui__judul">Antrean pasien menurut prioritas</p>
                <span className="lp-contoh"><IkonPeringatan className="h-5 w-5" />Contoh data sintetis</span>
              </div>
              <table className="lp-tabel">
                <caption>Empat pasien contoh. Nama dan angka dibuat untuk peragaan.</caption>
                <thead>
                  <tr>
                    <th scope="col">Pasien</th>
                    <th scope="col">Penanda</th>
                    <th scope="col">Nyeri terakhir</th>
                    <th scope="col" className="lp-angka">Repetisi benar</th>
                  </tr>
                </thead>
                <tbody>
                  {PASIEN.map(p => (
                    <tr key={p.nama}>
                      <th scope="row">{p.nama}</th>
                      <td data-k="Penanda"><span className="lp-status"><IkonStatus jenis={p.ikon} />{p.status}</span></td>
                      <td data-k="Nyeri terakhir">{p.nyeri}</td>
                      <td className="lp-angka">{p.nilai}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lp-fisio__isi">
              <h2 id="judul-fisio" className="lp-h2" data-muncul="0">Tahu pasien mana yang perlu didahulukan.</h2>
              <p className="lp-lead" data-muncul="1">
                Fisioterapis melihat angka gerak dan repetisi tanpa rekaman video. Pasien dengan kompensasi yang meningkat
                atau keluhan nyeri ditandai lebih dulu.
              </p>
              <ul className="lp-poin" data-muncul="2">
                <li><span className="lp-tanda lp-tanda--teal" aria-hidden="true" /><p><strong>Urutan prioritas otomatis:</strong> eskalasi, nyeri, lalu kepatuhan rendah, lengkap dengan alasannya.</p></li>
                <li><span className="lp-tanda lp-tanda--teal" aria-hidden="true" /><p><strong>Kendali resep penuh:</strong> terapis menetapkan toleransi dan mode koreksi per pasien. Sistem tidak mengubah resep sendiri.</p></li>
                <li><span className="lp-tanda lp-tanda--teal" aria-hidden="true" /><p><strong>Tidak menggantikan grafik:</strong> setiap ringkasan disertai pengingat untuk memeriksa grafik sebelum memutuskan.</p></li>
              </ul>
              <Link href="/daftar" className="lp-btn lp-btn--main" data-muncul="3">Daftar sebagai fisioterapis</Link>
            </div>
          </div>
        </section>

        {/* Privasi */}
        <section className="lp-privasi lp-aqua lp-sec" aria-labelledby="judul-privasi">
          <div className="lp-wrap">
            <div className="lp-privasi__kepala" data-muncul="0">
              <h2 id="judul-privasi" className="lp-h2">Yang dikirim hanya angka, bukan rekaman video.</h2>
              <p className="lp-lead">Kamera ponsel membaca titik sendi langsung di peramban. Gambar tidak pernah meninggalkan perangkat pasien.</p>
            </div>
            <div className="lp-alurdata">
              <div className="lp-langkah" data-muncul="0">
                <h3>Di ponsel pasien</h3>
                <p>Bingkai video diproses saat itu juga di memori peramban. Tidak disimpan dan tidak dikirim.</p>
                <span className="lp-lencana"><IkonCentang className="h-5 w-5" />Diproses di perangkat</span>
                <span className="lp-lencana"><IkonVideoMati className="h-5 w-5" />Video tidak dikirim</span>
              </div>
              <div className="lp-langkah" data-muncul="1">
                <h3>Yang dikirim</h3>
                <p>Hanya angka ringkasan sesi, lewat HTTPS saat internet tersambung. Contoh isinya:</p>
                <span className="lp-lencana"><IkonPanah className="h-5 w-5" />Angka saja, tanpa gambar</span>
                <pre aria-label="Contoh isi kiriman"><code>{`{ "repetisi": 10,
  "benar": 8,
  "nyeri": "agak" }`}</code></pre>
              </div>
              <div className="lp-langkah" data-muncul="2">
                <h3>Di dasbor terapis</h3>
                <p>Angka tersimpan untuk laporan kemajuan. Pasien bisa menghapus semua datanya kapan saja.</p>
                <span className="lp-lencana"><IkonCentang className="h-5 w-5" />Hanya angka yang sampai</span>
              </div>
            </div>
            <p className="lp-privasi__tautan"><Link href="/privasi" className="lp-link">Baca kebijakan privasi lengkap</Link></p>
          </div>
        </section>

        {/* Batasan prototipe */}
        <section className="lp-batas lp-sec" aria-labelledby="judul-batas">
          <div className="lp-wrap lp-batas__grid">
            <div data-muncul="0">
              <h2 id="judul-batas" className="lp-h2">Hal yang perlu Anda ketahui.</h2>
            </div>
            <ul className="lp-batas__daftar">
              {BATAS.map(([j, i], n) => (
                <li key={j} data-muncul={n % 2}>
                  <h3><span className="lp-tanda lp-tanda--teal" aria-hidden="true" />{j}</h3>
                  <p>{i}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Penutup */}
        <section className="lp-tutup lp-gelap lp-sec" aria-labelledby="judul-tutup">
          <div className="lp-wrap lp-tutup__baris">
            <div className="lp-tutup__tengah lp-aqua" data-muncul="0">
              <h2 id="judul-tutup" className="lp-h2">Coba sendiri, tanpa akun.</h2>
              <p className="lp-lead">Nyalakan kamera laptop atau ponsel, lalu dengar koreksi suaranya langsung.</p>
              <div className="lp-tutup__aksi">
                <Link href="/tamu" className="lp-btn lp-btn--main"><IkonPutar className="h-6 w-6" />Coba latihan sekarang</Link>
                <Link href="/masuk" className="lp-btn lp-btn--sekunder">Masuk dengan Google</Link>
              </div>
              <p>Disarankan memakai Chrome terbaru dan mengizinkan akses kamera.</p>
            </div>
            <div className="lp-tutup__sisi" aria-hidden="false">
              <div className="lp-tutup__foto">
                <Image src="/login.jpg" alt="Fisioterapis membantu seorang pasien mengangkat lengan" fill sizes="(min-width: 960px) 20vw, 50vw" />
              </div>
              <div className="lp-tutup__warna" aria-hidden="true" />
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-kaki lp-gelap-2">
        <div className="lp-wrap">
          <p className="lp-kaki__nama" aria-hidden="true">Remini<span>Care</span></p>
          <div className="lp-kaki__grid">
            <Link href="/" aria-label="ReminiCare, beranda" className="lp-kaki__logo"><Logo /></Link>
            <nav className="lp-kaki__tautan" aria-label="Tautan kaki halaman">
              <Link href="/tamu" className="lp-link">Coba latihan</Link>
              <Link href="/daftar" className="lp-link">Buat akun</Link>
              <Link href="/masuk" className="lp-link">Masuk</Link>
              <Link href="/privasi" className="lp-link">Kebijakan Privasi</Link>
              <a href="https://github.com/MantaYuana/ReminiCare" className="lp-link">Repositori GitHub</a>
            </nav>
          </div>
          <div className="lp-kaki__bawah">
            <p>© 2026 ReminiCare. Prototipe, bukan pengganti diagnosis medis.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
