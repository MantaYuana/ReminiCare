import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { perkiraanMenit, videoGerakan } from './latihan.ts';

describe('perkiraanMenit', () => {
  it('membulatkan ke atas dan minimal 1 menit', () => {
    assert.equal(perkiraanMenit(1), 1);
    assert.equal(perkiraanMenit(5), 1);
    assert.equal(perkiraanMenit(10), 2);
    assert.equal(perkiraanMenit(20), 3);
  });
});

describe('videoGerakan', () => {
  it('memetakan gerakan, bawaan jangkau depan', () => {
    assert.equal(videoGerakan('jangkau_samping'), '/video/jangkau_samping.mp4');
    assert.equal(videoGerakan('jangkau_depan'), '/video/jangkau_depan.mp4');
    assert.equal(videoGerakan('lain'), '/video/jangkau_depan.mp4');
  });
});
