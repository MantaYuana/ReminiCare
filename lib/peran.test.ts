import { test } from 'node:test';
import assert from 'node:assert/strict';
import { petakanPeran, bangunRedirect, lanjutAman, pesanGalat } from './peran.ts';

test('petakanPeran: terapis, pasien, pasien_baru, tanpa_peran', () => {
  assert.deepEqual(petakanPeran('u1', { peran: 'fisioterapis', nama: 'Ayu' }, null), { jenis: 'terapis', uid: 'u1', nama: 'Ayu' });
  assert.deepEqual(petakanPeran('u2', { peran: 'pasien', nama: 'P' }, 'p9'), { jenis: 'pasien', uid: 'u2', pasienId: 'p9' });
  assert.deepEqual(petakanPeran('u2', { peran: 'pasien', nama: 'P' }, null), { jenis: 'pasien_baru', uid: 'u2' });
  assert.deepEqual(petakanPeran('u3', null, null), { jenis: 'tanpa_peran', uid: 'u3' });
});

test('bangunRedirect: peran + lanjut internal', () => {
  assert.equal(bangunRedirect('https://x.app', { peran: 'pasien', lanjut: '/k/ABCD1234' }),
    'https://x.app/auth/selesai?peran=pasien&lanjut=%2Fk%2FABCD1234');
  assert.equal(bangunRedirect('https://x.app', {}), 'https://x.app/auth/selesai');
});

test('bangunRedirect: lanjut eksternal dibuang', () => {
  // tab/newline dibuang parser URL browser: '/\t/evil.com' menjadi '//evil.com'
  for (const l of ['//evil.com', '/\\evil.com', 'https://evil.com', 'evil.com', '/\t/evil.com', '/\n/evil.com', '/\r\n/evil.com']) {
    assert.equal(bangunRedirect('https://x.app', { lanjut: l }), 'https://x.app/auth/selesai');
    assert.equal(lanjutAman(l), null);
  }
  assert.equal(lanjutAman('/k/ABCD1234'), '/k/ABCD1234');
  assert.equal(lanjutAman(null), null);
});

test('pesanGalat: kode V9', () => {
  assert.match(pesanGalat({ message: 'peran_lain' }), /peran lain/);
  assert.match(pesanGalat({ message: 'belum_daftar' }), /Sign Up as Pasien/);
  assert.match(pesanGalat({ message: 'akun_terapis' }), /akun Google lain/);
  assert.match(pesanGalat({ message: 'bukan_fisioterapis' }), /fisioterapis/);
  assert.equal(pesanGalat({ message: 'sandbox_hanya_anonim' }), 'Terjadi galat, coba lagi');
});
