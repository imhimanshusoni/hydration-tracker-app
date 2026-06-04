// Contract tests for the glasses-first display formatters.
// 1 glass = 250 ml (GLASS_SIZE_ML). Glasses are display-only; ml stays canonical.

import {
  mlToGlasses,
  formatGlasses,
  formatGlassesShort,
  formatMlOrL,
  formatGlassesHint,
} from '../volumeFormat';

describe('mlToGlasses', () => {
  it('converts ml to glasses', () => {
    expect(mlToGlasses(250)).toBe(1);
    expect(mlToGlasses(125)).toBe(0.5);
    expect(mlToGlasses(2500)).toBe(10);
  });
});

describe('formatGlasses', () => {
  it('handles zero and negatives', () => {
    expect(formatGlasses(0)).toBe('0 glasses');
    expect(formatGlasses(-100)).toBe('0 glasses');
  });

  it('uses singular for exactly one glass and sub-one fractions', () => {
    expect(formatGlasses(250)).toBe('1 glass');
    expect(formatGlasses(125)).toBe('½ glass');
    expect(formatGlasses(62.5)).toBe('¼ glass');
  });

  it('uses plural elsewhere with vulgar fractions', () => {
    expect(formatGlasses(375)).toBe('1½ glasses');
    expect(formatGlasses(500)).toBe('2 glasses');
    expect(formatGlasses(2000)).toBe('8 glasses');
    expect(formatGlasses(2500)).toBe('10 glasses');
    expect(formatGlasses(2562.5)).toBe('10¼ glasses');
  });

  it('rounds to the nearest quarter glass', () => {
    expect(formatGlasses(150)).toBe('½ glass'); // 0.6 → 0.5
    expect(formatGlasses(300)).toBe('1¼ glasses'); // 1.2 → 1.25
  });
});

describe('formatGlassesShort', () => {
  it('returns the number-only form for big numerals', () => {
    expect(formatGlassesShort(0)).toBe('0');
    expect(formatGlassesShort(125)).toBe('½');
    expect(formatGlassesShort(250)).toBe('1');
    expect(formatGlassesShort(500)).toBe('2');
    expect(formatGlassesShort(2000)).toBe('8');
    expect(formatGlassesShort(375)).toBe('1½');
  });
});

describe('formatMlOrL', () => {
  it('shows ml below one liter', () => {
    expect(formatMlOrL(250)).toBe('250 ml');
    expect(formatMlOrL(50)).toBe('50 ml');
    expect(formatMlOrL(0)).toBe('0 ml');
  });

  it('shows liters at or above one liter, stripping trailing .0', () => {
    expect(formatMlOrL(1000)).toBe('1 L');
    expect(formatMlOrL(2000)).toBe('2 L');
    expect(formatMlOrL(2500)).toBe('2.5 L');
    expect(formatMlOrL(2550)).toBe('2.6 L');
  });
});

describe('formatGlassesHint', () => {
  it('is exact for clean quarter multiples', () => {
    expect(formatGlassesHint(250)).toBe('= 1 glass');
    expect(formatGlassesHint(125)).toBe('= ½ glass');
    expect(formatGlassesHint(500)).toBe('= 2 glasses');
  });

  it('says "about" for non-quarter amounts', () => {
    expect(formatGlassesHint(300)).toBe('= about 1¼ glasses');
    expect(formatGlassesHint(150)).toBe('= about ½ glass');
  });

  it('is empty for zero or negative', () => {
    expect(formatGlassesHint(0)).toBe('');
    expect(formatGlassesHint(-5)).toBe('');
  });
});
