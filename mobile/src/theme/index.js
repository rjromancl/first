/**
 * British Airways brand design tokens for React Native.
 * All colours, spacing, typography and shadow helpers live here.
 * Import from any screen: import { colors, spacing, text } from '../theme';
 */

export const colors = {
  // ── Brand blues ──────────────────────────────────────────────
  blue:       '#075AAA',   // BA primary blue
  darkBlue:   '#003B6E',   // Headings, hero backgrounds
  lightBlue:  '#E8F0F8',   // Subtle backgrounds, selected states
  midBlue:    '#1a6fbf',   // Hover/active tint

  // ── Gold ─────────────────────────────────────────────────────
  gold:       '#C8A951',   // Executive Club accent
  goldLight:  '#F5EAC8',   // Gold chip backgrounds

  // ── Neutrals ─────────────────────────────────────────────────
  white:      '#FFFFFF',
  offWhite:   '#F7F8FA',
  border:     '#E2E8F0',
  inputBg:    '#F1F5F9',
  textPrimary:'#1A1A2E',
  textSecondary:'#4A5568',
  textLight:  '#94A3B8',
  placeholder:'#A0AEC0',

  // ── Semantic ─────────────────────────────────────────────────
  success:    '#2e7d32',
  successBg:  '#E8F5E9',
  error:      '#C62828',
  errorBg:    '#FDECEA',
  warning:    '#E65100',
  warningBg:  '#FFF3E0',
  info:       '#075AAA',
  infoBg:     '#E8F0F8',

  // ── Cabin class badges ────────────────────────────────────────
  firstClass:   '#1A1A2E',
  business:     '#075AAA',
  premiumEcon:  '#C8A951',
  economy:      '#4A5568',
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const radius = {
  sm:   6,
  md:   12,
  lg:   20,
  full: 999,
};

export const text = {
  h1: { fontSize: 28, fontWeight: '800', color: colors.darkBlue, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700', color: colors.darkBlue },
  h3: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  h4: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  bodyLg: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
  caption: { fontSize: 12, color: colors.textLight },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.3 },
  code: { fontSize: 14, fontFamily: 'monospace', letterSpacing: 2, fontWeight: '700' },
};

/** Drop-shadow helper — spread via StyleSheet */
export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
};

/** Reusable card style */
export const card = {
  backgroundColor: colors.white,
  borderRadius: radius.md,
  padding: spacing.md,
  ...shadow.md,
};

/** Primary button */
export const btnPrimary = {
  backgroundColor: colors.blue,
  borderRadius: radius.md,
  paddingVertical: 14,
  paddingHorizontal: spacing.lg,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
};

/** Secondary button */
export const btnSecondary = {
  backgroundColor: colors.white,
  borderRadius: radius.md,
  paddingVertical: 13,
  paddingHorizontal: spacing.lg,
  alignItems: 'center',
  borderWidth: 1.5,
  borderColor: colors.blue,
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
};

/** Gold button */
export const btnGold = {
  backgroundColor: colors.gold,
  borderRadius: radius.md,
  paddingVertical: 14,
  paddingHorizontal: spacing.lg,
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
};

/** Standard text input */
export const input = {
  backgroundColor: colors.inputBg,
  borderRadius: radius.sm,
  borderWidth: 1.5,
  borderColor: colors.border,
  paddingHorizontal: spacing.md,
  paddingVertical: 12,
  fontSize: 15,
  color: colors.textPrimary,
};
