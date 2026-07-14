/**
 * "More" tab — gateway to screens that don't fit in the bottom tabs.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, shadow, text } from '../theme';

const MENU_ITEMS = [
  { icon: 'checkmark-done-circle-outline', label: 'Online Check-in',    desc: 'Check in 24 hours before departure', screen: 'CheckIn',      color: colors.blue },
  { icon: 'radio-button-on-outline',       label: 'Flight Status',      desc: 'Track any British Airways flight',   screen: 'FlightStatus', color: colors.blue },
  { icon: 'earth-outline',                 label: 'Destinations',       desc: 'Explore where we fly',               screen: 'Destinations', color: colors.blue },
  { icon: 'star-outline',                  label: 'Executive Club',     desc: 'Avios, tiers and rewards',           screen: 'ExecutiveClub',color: colors.gold },
  { icon: 'person-outline',               label: 'My Account',         desc: 'Sign in or create an account',       screen: 'Login',        color: colors.blue },
];

export default function MoreScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isAuthenticated, user, logout } = useApp();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.offWhite }}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
    >
      {/* Header */}
      <LinearGradient
        colors={[colors.darkBlue, colors.blue]}
        style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
      >
        {isAuthenticated ? (
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
              </Text>
            </View>
            <View>
              <Text style={styles.userName}>{user?.firstName} {user?.lastName}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>
        ) : (
          <View>
            <Text style={styles.headerTitle}>More Options</Text>
            <Text style={styles.headerSubtitle}>Sign in to access all features</Text>
          </View>
        )}
      </LinearGradient>

      <View style={styles.content}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuItem, shadow.sm]}
            onPress={() => navigation.navigate(item.screen)}
          >
            <View style={[styles.menuIcon, { backgroundColor: item.color + '18' }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
          </TouchableOpacity>
        ))}

        {isAuthenticated && (
          <TouchableOpacity
            style={[styles.menuItem, styles.logoutItem, shadow.sm]}
            onPress={logout}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.errorBg }]}>
              <Ionicons name="log-out-outline" size={22} color={colors.error} />
            </View>
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, { color: colors.error }]}>Sign Out</Text>
              <Text style={styles.menuDesc}>Sign out of your account</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* App info */}
        <View style={styles.appInfo}>
          <Ionicons name="airplane" size={20} color={colors.textLight} />
          <Text style={styles.appInfoText}>British Airways Mobile v1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  headerTitle: { color: colors.white, fontSize: 22, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 18, fontWeight: '800' },
  userName: { color: colors.white, fontSize: 17, fontWeight: '700' },
  userEmail: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },

  content: { padding: spacing.lg, gap: spacing.sm },

  menuItem: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoutItem: { marginTop: spacing.sm },
  menuIcon: {
    width: 44, height: 44, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  menuDesc: { fontSize: 12, color: colors.textLight, marginTop: 2 },

  appInfo: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    justifyContent: 'center', paddingTop: spacing.lg,
  },
  appInfoText: { fontSize: 12, color: colors.textLight },
});
