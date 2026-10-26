import { afterEach, describe, expect, it, vi } from 'vitest';
import { songOr } from './index';

afterEach(() => vi.restoreAllMocks());

describe('songOr', () => {
  it('passes known songs through and falls back for unknown ones, warning once per id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(songOr('boss', 'level1')).toBe('boss');
    expect(songOr('t21_missing', 'level1')).toBe('level1');
    expect(songOr('t21_missing', 'level1')).toBe('level1');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
