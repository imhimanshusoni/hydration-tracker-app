// Premium dark-mode design system.
// Deep navy base with cerulean + warm amber accents.
// Shifted from generic teal to a richer, more distinctive palette.

export interface AppTheme {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentSecondary: string;
  accentWarm: string;
  border: string;
  error: string;
  ringTrack: string;
  ringFill: string;
}

export const darkTheme: AppTheme = {
  background: '#060B18',
  surface: '#0D1B2A',
  surfaceElevated: '#132840',
  text: '#F0F4F8',
  textSecondary: '#7A8BA8',
  accent: '#3B9FE3',        // cerulean blue — feels like water, not generic teal
  accentSecondary: '#60CFFF', // lighter sky blue for gradients
  accentWarm: '#F0A050',     // warm amber for contrast moments
  border: '#1B2D45',
  error: '#FF6B6B',
  ringTrack: '#0F1E33',
  ringFill: '#102A4A',       // subtle fill inside ring at low progress
};

export const lightTheme: AppTheme = darkTheme;

export function getTheme(_colorScheme: string | null | undefined): AppTheme {
  return darkTheme;
}
