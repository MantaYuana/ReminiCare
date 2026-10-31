import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalKode } from './arah.ts';

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
