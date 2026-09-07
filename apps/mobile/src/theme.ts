/** Dark-first design tokens (spec §46/§47): Apple Clock × Calm × Spotify simplicity. */
export const colors = {
  bg: '#000000',
  surface: '#0E0E10',
  surface2: '#1A1A1D',
  border: '#232326',
  text: '#FFFFFF',
  textDim: '#A0A0A5',
  textMuted: '#5F5F66',
  accent: '#FFA033',
  success: '#34C759',
  warning: '#FFB800',
  danger: '#FF453A',
  spotify: '#1DB954',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export const type = {
  display: { fontSize: 76, fontWeight: '200' as const, letterSpacing: -2 },
  title: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.5 },
  headline: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 17, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  mono: { fontSize: 12, fontFamily: 'Menlo' },
} as const;
