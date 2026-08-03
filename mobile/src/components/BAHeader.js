/**
 * BAHeader — Top navigation bar in British Airways brand style.
 * Used as the header on most screens.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../theme/colors';

export default function BAHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightIcon,
  onRightPress,
  rightLabel,
  transparent = false,
}) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : insets.top;

  return (
    <View style={[
      styles.container,
      { paddingTop: topPad + 8 },
      transparent && styles.transparent,
    ]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.darkBlue} />

      <View style={styles.row}>
        {/* Left — back button or logo */}
        <View style={styles.left}>
          {showBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="arrow-back" size={22} color={Colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>✈</Text>
              <Text style={styles.logoBA}>BA</Text>
            </View>
          )}
        </View>

        {/* Centre — title */}
        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>{title || 'British Airways'}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>

        {/* Right — action button */}
        <View style={styles.right}>
          {rightIcon || rightLabel ? (
            <TouchableOpacity onPress={onRightPress} style={styles.rightBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              {rightIcon && <Ionicons name={rightIcon} size={22} color={Colors.white} />}
              {rightLabel && <Text style={styles.rightLabel}>{rightLabel}</Text>}
            </TouchableOpacity>
          ) : (
            <View style={styles.rightPlaceholder} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.darkBlue,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  transparent: {
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: { width: 44 },
  center: { flex: 1, alignItems: 'center' },
  right: { width: 44, alignItems: 'flex-end' },
  backBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logoText: { color: Colors.white, fontSize: 18 },
  logoBA: { color: Colors.white, fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  title: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 1,
  },
  rightBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightLabel: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  rightPlaceholder: { width: 36, height: 36 },
});
