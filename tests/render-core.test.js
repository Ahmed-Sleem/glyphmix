import { describe, expect, it } from 'vitest';
import { clamp, dims, getDitherMatrix, h2r } from '../src/render-core.js';

describe('render core invariants', () => {
  it('clamps values to the requested inclusive range', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
    expect(clamp(2, 0, 1)).toBe(1);
  });

  it('computes output dimensions from grid and cell geometry', () => {
    expect(dims(120, 60, { cell: 8, ar: 1.5 })).toEqual([960, 720]);
  });

  it('parses six-digit hex colors', () => {
    expect(h2r('#2ee6c5')).toEqual([46, 230, 197]);
  });

  it('builds valid Bayer matrices at supported powers of two', () => {
    const matrix = getDitherMatrix(4);
    expect(matrix).toHaveLength(4);
    expect(matrix.flat().sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
  });
});
