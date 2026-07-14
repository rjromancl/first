import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

export default function LoadingSpinner({ message = 'Loading…', size = 'large', fullScreen = false }) {
  if (fullScreen) {
    return (
      <View style={styles.fullScreen}>
        <ActivityIndicator size={size} color={colors.blue} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    );
  }
  return (
    <View style={styles.inline}>
      <ActivityIndicator size={size} color={colors.blue} />
      {message ? <Text style={styles.inlineMessage}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.offWhite,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  inline: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  inlineMessage: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
