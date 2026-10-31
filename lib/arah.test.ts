import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalKode, ruteUntuk } from './arah.ts';

describe('normalKode', () => {
  it('membuang spasi dan membesarkan huruf', () => {
    assert.equal(normalKode(' ab12cd34 '), 'AB12CD34');
    assert.equal(normalKode('AB12 CD34'), 'AB12CD34');
  });

  it('menolak panjang selain 8', () => {
    assert.equal(normalKode('AB12CD3'), null);
    assert.equal(normalKode('AB12CD345'), null);
    assert.equal(normalKode(''), null);
  });

  it('menolak karakter bukan heksadesimal', () => {
    assert.equal(normalKode('GH12CD34'), null);
    assert.equal(normalKode('AB12CD3!'), null);
  });
});

describe('ruteUntuk', () => {
  it('beranda sesuai peran', () => {
    assert.equal(ruteUntuk({ jenis: 'terapis', uid: 'u', nama: 'A' }, null), '/terapis');
    assert.equal(ruteUntuk({ jenis: 'pasien', uid: 'u', pasienId: 'p' }, null), '/pasien');
    assert.equal(ruteUntuk({ jenis: 'pasien_baru', uid: 'u' }, null), '/pasien');
    assert.equal(ruteUntuk({ jenis: 'luring' }, null), '/pasien');
    assert.equal(ruteUntuk({ jenis: 'tanpa_peran', uid: 'u' }, null), null);
    assert.equal(ruteUntuk({ jenis: 'keluar' }, null), null);
  });

  it('lanjut internal dipakai, eksternal dibuang', () => {
    assert.equal(ruteUntuk({ jenis: 'pasien_baru', uid: 'u' }, '/k/ABCD1234'), '/k/ABCD1234');
    assert.equal(ruteUntuk({ jenis: 'pasien_baru', uid: 'u' }, '//evil.com'), '/pasien');
    assert.equal(ruteUntuk({ jenis: 'terapis', uid: 'u', nama: 'A' }, 'https://evil.com'), '/terapis');
    assert.equal(ruteUntuk({ jenis: 'pasien', uid: 'u', pasienId: 'p' }, '/\\evil.com'), '/pasien');
  });

  it('luring mengabaikan lanjut; tanpa_peran/keluar tetap di halaman', () => {
    assert.equal(ruteUntuk({ jenis: 'luring' }, '/k/ABCD1234'), '/pasien');
    assert.equal(ruteUntuk({ jenis: 'tanpa_peran', uid: 'u' }, '/k/ABCD1234'), null);
    assert.equal(ruteUntuk({ jenis: 'keluar' }, '/k/ABCD1234'), null);
  });
});
