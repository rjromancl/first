/**
 * Animated toast notifications — renders at the top of the screen.
 * Mirrors the web NotificationToast but uses Animated API.
 * Place <NotificationToast /> once inside AppLayout; it reads from context.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../theme';
import { useApp } from '../context/AppContext';

const TYPE_CONFIG = {
  success: { bg: colors.successBg, border: colors.success,  icon: 'checkmark-circle', iconColor: colors.success },
  error:   { bg: colors.errorBg,   border: colors.error,    icon: 'alert-circle',      iconColor: colors.error },
  warning: { bg: colors.warningBg, border: colors.warning,  icon: 'warning',           iconColor: colors.warning },
  info:    { bg: colors.infoBg,    border: colors.blue,     icon: 'information-circle', iconColor: colors.blue },
};

function Toast({ id, type = 'info', message }) {
  const { dismissNotification } = useApp();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity,    { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss after 4 s
    const timer = setTimeout(() => dismiss(), 4000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,   duration: 250, useNativeDriver: true }),
    ]).start(() => dismissNotification(id));
  };

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: cfg.bg, borderLeftColor: cfg.border },
        { transform: [{ translateY }], opacity },
      ]}
    >
      <Ionicons name={cfg.icon} size={20} color={cfg.iconColor} />
      <Text style={styles.toastText} numberOfLines={2}>{message}</Text>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={18} color={colors.textLight} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function NotificationToast() {
  const { notifications } = useApp();
  const insets = useSafeAreaInsets();

  if (!notifications.length) return null;

  return (
    <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
      {notifications.slice(0, 3).map((n) => (
        <Toast key={n.id} {...n} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    gap: spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    ...shadow.lg,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 18,
  },
});
