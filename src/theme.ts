// Light and dark theme definitions.
// Used inline via useColorScheme() — no context provider needed.

export interface AppTheme {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  border: string;
  error: string;
}

export const lightTheme: AppTheme = {
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  accent: '#2196F3',
  border: '#E5E7EB',
  error: '#EF4444',
};

export const darkTheme: AppTheme = {
  background: '#121212',
  surface: '#1E1E1E',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  accent: '#64B5F6',
  border: '#374151',
  error: '#F87171',
};

export function getTheme(colorScheme: 'light' | 'dark' | null | undefined): AppTheme {
  return colorScheme === 'dark' ? darkTheme : lightTheme;
}
