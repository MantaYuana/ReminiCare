// lib/mesin-tiruan.test.ts — failing tests first
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { buatMesinTiruan } from './mesin-tiruan.ts';
import type { EventMesin } from './kinematik/tipe.ts';

describe('mesin tiruan', () => {
  it('memancarkan 1 repetisi dengan hitungan 1 setelah 3100ms', () => {
    mock.timers.enable({ apis: ['setInterval'], now: 0 });

    const events: EventMesin[] = [];
    const mesin = buatMesinTiruan();
    mesin.mulai((e) => events.push(e));

    mock.timers.tick(3100);

    const repetisi = events.filter(e => e.jenis === 'repetisi');
    assert.equal(repetisi.length, 1);
    assert.equal((repetisi[0] as Extract<EventMesin, { jenis: 'repetisi' }>).hitungan, 1);

    mesin.berhenti();
    mock.timers.reset();
  });

  it('hitungan terakhir === 3 dan bagus === true setelah 9100ms', () => {
    mock.timers.enable({ apis: ['setInterval'], now: 0 });

    const events: EventMesin[] = [];
    const mesin = buatMesinTiruan();
    mesin.mulai((e) => events.push(e));

    mock.timers.tick(9100);

    const repetisi = events.filter(
      e => e.jenis === 'repetisi',
    ) as Extract<EventMesin, { jenis: 'repetisi' }>[];

    const terakhir = repetisi[repetisi.length - 1];
    assert.ok(terakhir, 'harus ada event repetisi');
    assert.equal(terakhir.hitungan, 3);
    assert.equal(terakhir.bagus, true); // hitungan 3 = kelipatan 3

    mesin.berhenti();
    mock.timers.reset();
  });

  it('setelah berhenti() tidak ada event baru', () => {
    mock.timers.enable({ apis: ['setInterval'], now: 0 });

    const events: EventMesin[] = [];
    const mesin = buatMesinTiruan();
    mesin.mulai((e) => events.push(e));

    mock.timers.tick(3100);
    const jumlahSebelum = events.length;

    mesin.berhenti();
    mock.timers.tick(10000);

    assert.equal(events.length, jumlahSebelum, 'tidak ada event setelah berhenti()');
    mock.timers.reset();
  });

  it('memancarkan event sampel tiap ~33ms', () => {
    mock.timers.enable({ apis: ['setInterval'], now: 0 });

    const events: EventMesin[] = [];
    const mesin = buatMesinTiruan();
    mesin.mulai((e) => events.push(e));

    mock.timers.tick(330); // ~10 sampel

    const sampel = events.filter(e => e.jenis === 'sampel');
    assert.ok(sampel.length >= 9, `harus ada ≥9 sampel, dapat ${sampel.length}`);

    mesin.berhenti();
    mock.timers.reset();
  });
});
