import { describe, it, expect } from 'vitest';
import {
  formatTransactionNo,
  generateTransactionNo,
  makeBoxId,
  generateBoxPrefix,
  boxQrPayload,
  verifyBoxQr,
  splitNetWeight,
} from './boxCodes.js';

describe('transaction number', () => {
  it('formats a date as TR-YYYYMMDDHHMMSS (local components)', () => {
    // June = month index 5
    expect(formatTransactionNo(new Date(2026, 5, 26, 14, 30, 0))).toBe('TR-20260626143000');
  });

  it('returns the base when free', () => {
    expect(generateTransactionNo([], new Date(2026, 5, 26, 14, 30, 0))).toBe('TR-20260626143000');
  });

  it('appends -2 on a same-second collision', () => {
    expect(
      generateTransactionNo(['TR-20260626143000'], new Date(2026, 5, 26, 14, 30, 0)),
    ).toBe('TR-20260626143000-2');
  });

  it('increments to -3 when both base and -2 are taken', () => {
    expect(
      generateTransactionNo(
        ['TR-20260626143000', 'TR-20260626143000-2'],
        new Date(2026, 5, 26, 14, 30, 0),
      ),
    ).toBe('TR-20260626143000-3');
  });
});

describe('box id', () => {
  it('zero-pads the sequence to 4 digits', () => {
    expect(makeBoxId('ABC', 1)).toBe('BI-ABC0001');
    expect(makeBoxId('ABC', 12)).toBe('BI-ABC0012');
  });

  it('picks 3 letters whose BI-XXX0001 is free', () => {
    expect(generateBoxPrefix([], () => 0)).toBe('AAA');
  });

  it('retries when the prefix is taken', () => {
    const seq = [0, 0, 0, 0.99, 0.99, 0.99]; // AAA (taken) then ZZZ (free)
    let i = 0;
    const rng = () => seq[i++];
    expect(generateBoxPrefix(['BI-AAA0001'], rng)).toBe('ZZZ');
  });
});

describe('box QR payload', () => {
  it('round-trips transaction + box id through sign/verify', () => {
    const p = boxQrPayload('TR-20260626143000', 'BI-ABC0001');
    expect(p.startsWith('BOX.TR-20260626143000.BI-ABC0001.')).toBe(true);
    expect(verifyBoxQr(p)).toEqual({
      transactionNo: 'TR-20260626143000',
      boxId: 'BI-ABC0001',
    });
  });

  it('rejects tampered or malformed payloads', () => {
    const p = boxQrPayload('TR-20260626143000', 'BI-ABC0001');
    expect(verifyBoxQr(p.slice(0, -1) + '0')).toBeNull(); // last sig char flipped
    expect(verifyBoxQr('garbage')).toBeNull();
    expect(verifyBoxQr('BOX.a.b')).toBeNull(); // too few parts
    expect(verifyBoxQr(null)).toBeNull();
  });
});

describe('splitNetWeight', () => {
  it('splits evenly when divisible', () => {
    expect(splitNetWeight(12, 3)).toEqual([4, 4, 4]);
  });

  it('puts the rounding remainder on the last box', () => {
    expect(splitNetWeight(10, 3)).toEqual([3.33, 3.33, 3.34]);
  });

  it('returns nulls when no weight was entered', () => {
    expect(splitNetWeight(null, 2)).toEqual([null, null]);
    expect(splitNetWeight('', 2)).toEqual([null, null]);
  });

  it('handles a single box', () => {
    expect(splitNetWeight(7.5, 1)).toEqual([7.5]);
  });
});
