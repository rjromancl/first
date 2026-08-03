import { Platform } from 'react-native';

export const Fonts = {
  regular:    Platform.OS === 'ios' ? 'System' : 'Roboto',
  medium:     Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
  bold:       Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
};

export const FontSizes = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  30,
  hero: 38,
};

export const LineHeights = {
  tight:  1.2,
  normal: 1.5,
  loose:  1.8,
};

export const Typography = {
  h1: { fontSize: FontSizes.hero, fontWeight: '800', lineHeight: FontSizes.hero * 1.2 },
  h2: { fontSize: FontSizes.xxl,  fontWeight: '700', lineHeight: FontSizes.xxl  * 1.2 },
  h3: { fontSize: FontSizes.xl,   fontWeight: '700', lineHeight: FontSizes.xl   * 1.3 },
  h4: { fontSize: FontSizes.lg,   fontWeight: '600', lineHeight: FontSizes.lg   * 1.3 },
  body: { fontSize: FontSizes.base, fontWeight: '400', lineHeight: FontSizes.base * 1.5 },
  bodySmall: { fontSize: FontSizes.sm, fontWeight: '400', lineHeight: FontSizes.sm * 1.5 },
  caption: { fontSize: FontSizes.xs, fontWeight: '400', lineHeight: FontSizes.xs * 1.4 },
  label:  { fontSize: FontSizes.sm, fontWeight: '600', letterSpacing: 0.5 },
  button: { fontSize: FontSizes.base, fontWeight: '700', letterSpacing: 0.5 },
};
