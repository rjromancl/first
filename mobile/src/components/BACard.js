import React from 'react';
import { View, StyleSheet } from 'react-native';
import Colors from '../theme/colors';
import { Shadows, BorderRadius, Spacing } from '../theme/spacing';

export default function BACard({ children, style, variant = 'default' }) {
  return (
    <View style={[styles.card, VARIANTS[variant], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.md,
  },
});

const VARIANTS = {
  default: {},
  flat:    { ...Shadows.sm },
  elevated: { ...Shadows.lg },
  blue: {
    backgroundColor: Colors.darkBlue,
  },
  gradient: {
    backgroundColor: Colors.baSkyBlue,
  },
};
