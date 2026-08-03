/**
 * NotificationToast — animated toast overlay for the BA mobile app.
 * Rendered once at the root level, listens to context notifications.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, Animated, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import Colors from '../theme/colors';

const ICONS = {
  success: { name: 'checkmark-circle', color: Colors.success },
  error:   { name: 'alert-circle',     color: Colors.error   },
  warning: { name: 'warning',          color: Colors.warning  },
  info:    { name: 'information-circle', color: Colors.info  },
};

function Toast({ notification, onDismiss }) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-30)).current;
  const icon = ICONS[notification.type] || ICONS.info;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(opacity,    { toValue: 1, useNativeDriver: true, speed: 20 }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 20 }),
    ]).start();

    const timer = setTimeout(() => dismiss(), notification.duration || 3500);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -30, duration: 250, useNativeDriver: true }),
    ]).start(() => onDismiss(notification.id));
  };

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
      <Ionicons name={icon.name} size={20} color={icon.color} style={styles.toastIcon} />
      <View style={styles.toastText}>
        {notification.title && <Text style={styles.toastTitle}>{notification.title}</Text>}
        <Text style={styles.toastBody} numberOfLines={2}>{notification.message || notification.text}</Text>
      </View>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color={Colors.midGrey} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function NotificationToast() {
  const { notifications, dismissNotification } = useApp();
  const insets = useSafeAreaInsets();

  if (!notifications.length) return null;

  return (
    <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
      {notifications.slice(0, 3).map(n => (
        <Toast key={n.id} notification={n} onDismiss={dismissNotification} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
  },
  toastIcon: { flexShrink: 0 },
  toastText: { flex: 1 },
  toastTitle: { fontSize: 13, fontWeight: '700', color: Colors.charcoal, marginBottom: 2 },
  toastBody:  { fontSize: 13, color: Colors.darkGrey },
});
