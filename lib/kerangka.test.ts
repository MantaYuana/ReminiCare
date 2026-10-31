// lib/kerangka.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { warnaTingkat } from './kerangka.ts';

test('warnaTingkat: dasar sampai 0,5, ambar di 0,75, merah di 1 ke atas', () => {
  assert.equal(warnaTingkat(0), warnaTingkat(0.5));
  assert.equal(warnaTingkat(0.5), 'hsl(173 90% 50%)');
  assert.equal(warnaTingkat(0.75), 'hsl(38 90% 50%)');
  assert.equal(warnaTingkat(1), 'hsl(0 90% 50%)');
  assert.equal(warnaTingkat(3), warnaTingkat(1));
});
