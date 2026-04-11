// Premium dark-mode design system.
// Deep navy base with teal + electric blue accents.
// Designed to feel like a luxury instrument panel.

export interface AppTheme {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentSecondary: string;
  border: string;
  error: string;
}

export const darkTheme: AppTheme = {
  background: '#0A0F1E',
  surface: '#0E2444',
  surfaceElevated: '#122D56',
  text: '#FFFFFF',
  textSecondary: '#8899BB',
  accent: '#00C9B8',
  accentSecondary: '#4D8FFF',
  border: '#1A2A4A',
  error: '#FF6B6B',
};

// Light theme maps to the same dark palette — this app is always dark.
export const lightTheme: AppTheme = darkTheme;

export function getTheme(_colorScheme: string | null | undefined): AppTheme {
  return darkTheme;
}
