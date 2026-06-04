// Glasses-first display formatters.
// 1 glass = GLASS_SIZE_ML (250 ml). Storage stays canonical ml everywhere;
// these helpers are display-only transforms.

import { GLASS_SIZE_ML } from '../config';

const FRACTION_GLYPH: Record<string, string> = {
  '0.25': '¼',
  '0.5': '½',
  '0.75': '¾',
};

export function mlToGlasses(ml: number): number {
  return ml / GLASS_SIZE_ML;
}

// Math.round(x * 4) / 4 yields exact binary floats (0, .25, .5, .75) — no drift.
function roundToQuarter(glasses: number): number {
  return Math.round(glasses * 4) / 4;
}

// Number-only form for big UI numerals: "½", "1", "1½", "8".
export function formatGlassesShort(ml: number): string {
  if (ml <= 0) return '0';
  const rounded = roundToQuarter(mlToGlasses(ml));
  const whole = Math.floor(rounded);
  const glyph = FRACTION_GLYPH[String(rounded - whole)] ?? '';
  if (whole === 0) return glyph || '0';
  return `${whole}${glyph}`;
}

// Full form with unit: "½ glass", "1 glass", "1½ glasses", "8 glasses".
export function formatGlasses(ml: number): string {
  if (ml <= 0) return '0 glasses';
  const rounded = roundToQuarter(mlToGlasses(ml));
  const singular = rounded > 0 && rounded <= 1;
  return `${formatGlassesShort(ml)} ${singular ? 'glass' : 'glasses'}`;
}

// Exact secondary text: "250 ml" below 1 L, "2.5 L" at or above (no trailing .0).
export function formatMlOrL(ml: number): string {
  if (ml < 1000) return `${Math.round(ml)} ml`;
  // Round on the integer side first: (2550/1000).toFixed(1) is "2.5" (float 2.5499…).
  const liters = (Math.round(ml / 100) / 10).toFixed(1).replace(/\.0$/, '');
  return `${liters} L`;
}

// Live hint for custom ml input: "= 1 glass" when exact, "= about 1¼ glasses" otherwise.
export function formatGlassesHint(ml: number): string {
  if (ml <= 0) return '';
  const exact = mlToGlasses(ml) === roundToQuarter(mlToGlasses(ml));
  return `= ${exact ? '' : 'about '}${formatGlasses(ml)}`;
}
