import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges class strings, later ones winning on conflicting Tailwind utilities', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  it('drops falsy values (conditional classes)', () => {
    expect(cn('px-2', false && 'hidden', undefined, null)).toBe('px-2');
  });

  it('keeps non-conflicting classes together', () => {
    expect(cn('rounded-md', 'border', 'text-white')).toBe('rounded-md border text-white');
  });
});
