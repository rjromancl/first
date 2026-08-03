import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import Colors from '../theme/colors';
import { Spacing } from '../theme/spacing';

export default function LoadingSpinner({ message = 'Loading…', size = 'large', fullScreen = false }) {
  if (fullScreen) {
    return (
      <View style={styles.fullScreen}>
        <ActivityIndicator size={size} color={Colors.blue} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    );
  }
  return (
    <View style={styles.inline}>
      <ActivityIndicator size={size} color={Colors.blue} />
      {message ? <Text style={styles.inlineMessage}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: Spacing.md, backgroundColor: Colors.offWhite,
  },
  message:       { fontSize: 14, color: Colors.darkGrey, marginTop: Spacing.sm },
  inline:        { paddingVertical: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  inlineMessage: { fontSize: 13, color: Colors.darkGrey },
});
