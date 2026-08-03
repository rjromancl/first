import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../theme/colors';
import { Shadows } from '../theme/spacing';

export default function BAButton({
  label,
  onPress,
  variant = 'primary',  // primary | secondary | outline | ghost | danger
  size = 'md',           // sm | md | lg
  icon,
  iconRight,
  loading = false,
  disabled = false,
  style,
  labelStyle,
}) {
  const variantStyle = VARIANTS[variant] || VARIANTS.primary;
  const sizeStyle    = SIZES[size]    || SIZES.md;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[styles.base, variantStyle.btn, sizeStyle.btn, disabled && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyle.loadingColor} />
      ) : (
        <View style={styles.inner}>
          {icon && <Ionicons name={icon} size={sizeStyle.iconSize} color={variantStyle.text.color} style={styles.iconLeft} />}
          <Text style={[styles.label, variantStyle.text, sizeStyle.text, labelStyle]}>{label}</Text>
          {iconRight && <Ionicons name={iconRight} size={sizeStyle.iconSize} color={variantStyle.text.color} style={styles.iconRight} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '700', letterSpacing: 0.3 },
  disabled: { opacity: 0.45 },
  iconLeft:  { marginRight: 7 },
  iconRight: { marginLeft: 7 },
});

const VARIANTS = {
  primary: {
    btn:  { backgroundColor: Colors.darkBlue },
    text: { color: Colors.white },
    loadingColor: Colors.white,
  },
  secondary: {
    btn:  { backgroundColor: Colors.baSkyBlue },
    text: { color: Colors.white },
    loadingColor: Colors.white,
  },
  outline: {
    btn:  { backgroundColor: 'transparent', borderWidth: 2, borderColor: Colors.darkBlue },
    text: { color: Colors.darkBlue },
    loadingColor: Colors.darkBlue,
  },
  ghost: {
    btn:  { backgroundColor: 'transparent' },
    text: { color: Colors.darkBlue },
    loadingColor: Colors.darkBlue,
  },
  danger: {
    btn:  { backgroundColor: Colors.baRed },
    text: { color: Colors.white },
    loadingColor: Colors.white,
  },
};

const SIZES = {
  sm: { btn: { paddingVertical: 8,  paddingHorizontal: 14 }, text: { fontSize: 13 }, iconSize: 14 },
  md: { btn: { paddingVertical: 14, paddingHorizontal: 20 }, text: { fontSize: 15 }, iconSize: 16 },
  lg: { btn: { paddingVertical: 18, paddingHorizontal: 28 }, text: { fontSize: 17 }, iconSize: 18 },
};
