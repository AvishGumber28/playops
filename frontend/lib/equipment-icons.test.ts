import { describe, it, expect } from 'vitest';
import { equipmentIcon } from './equipment-icons';

describe('equipmentIcon', () => {
  it('matches each seeded sport item to its own icon', () => {
    expect(equipmentIcon('Basketball').icon).toBe('🏀');
    expect(equipmentIcon('Cricket Bat').icon).toBe('🏏');
    expect(equipmentIcon('Football').icon).toBe('⚽');
  });

  it('matches case-insensitively', () => {
    expect(equipmentIcon('FOOTBALL').icon).toBe('⚽');
  });

  it('falls back to a neutral crate icon for anything unrecognized, instead of guessing', () => {
    // Regression: a typo'd item name ("crikcet ball") used to hit a
    // generic /ball/i catch-all and render a misleading tennis-ball icon.
    // That catch-all is gone - an unmatched name must fall back cleanly.
    expect(equipmentIcon('crikcet ball').icon).toBe('📦');
    expect(equipmentIcon('Table Tennis Paddle').icon).toBe('📦');
  });

  it('does not cross-match an unrelated item purely because it contains "ball"', () => {
    expect(equipmentIcon('Volleyball').icon).toBe('🏐');
    expect(equipmentIcon('Medicine Ball').icon).toBe('📦');
  });
});
