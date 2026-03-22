/**
 * Design tokens de l'application Je Le Veux.
 * Palette extraite du logo : Or, Argent, Sombre.
 *
 * Convention : ne jamais utiliser de couleurs en dur dans les composants.
 * Toujours passer par ce fichier.
 */

export const colors = {
  // ── Palette primaire (logo) ──
  gold: {
    DEFAULT: '#C9A84C',
    light: '#E8D48B',
    dark: '#A07D2E',
    muted: '#C9A84C33', // 20% opacity
    subtle: '#C9A84C0F', // 6% opacity
  },
  silver: {
    DEFAULT: '#B8B8B8',
    light: '#D4D4D4',
    dark: '#8A8A8A',
    muted: '#B8B8B833',
  },

  // ── Fonds ──
  background: {
    primary: '#0F0F12',
    card: '#1A1A20',
    surface: '#22222A',
    input: '#2A2A34',
    elevated: '#32323C',
  },

  // ── Texte ──
  text: {
    primary: '#F0EDE6',
    secondary: '#9A978E',
    muted: '#6B6860',
    inverse: '#0F0F12',
  },

  // ── Sémantique ──
  semantic: {
    success: '#5DCAA5',
    successMuted: '#5DCAA51A',
    danger: '#E24B4A',
    dangerMuted: '#E24B4A1A',
    info: '#85B7EB',
    infoMuted: '#85B7EB1A',
    warning: '#EF9F27',
    warningMuted: '#EF9F271A',
  },

  // ── Bordures ──
  border: {
    subtle: 'rgba(255, 255, 255, 0.04)',
    light: 'rgba(255, 255, 255, 0.06)',
    medium: 'rgba(255, 255, 255, 0.08)',
    goldSubtle: 'rgba(201, 168, 76, 0.06)',
    goldLight: 'rgba(201, 168, 76, 0.1)',
    goldMedium: 'rgba(201, 168, 76, 0.15)',
    goldStrong: 'rgba(201, 168, 76, 0.2)',
  },

  // ── Utilitaires ──
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 56,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

export const typography = {
  // Font families — chargées via expo-font
  fontFamily: {
    display: 'PlayfairDisplay',
    displayMedium: 'PlayfairDisplay-Medium',
    displayBold: 'PlayfairDisplay-Bold',
    body: 'DMSans',
    bodyMedium: 'DMSans-Medium',
    bodySemiBold: 'DMSans-SemiBold',
    bodyBold: 'DMSans-Bold',
    mono: 'SpaceMono',
  },
  fontSize: {
    xs: 11,
    sm: 13,
    md: 14,
    base: 15,
    lg: 18,
    xl: 22,
    '2xl': 28,
    '3xl': 36,
    '4xl': 48,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const;

export const shadows = {
  gold: {
    shadowColor: '#C9A84C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export const theme = {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
} as const;

export type Theme = typeof theme;
export default theme;
