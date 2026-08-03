import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import BAHeader from '../components/BAHeader';
import Colors from '../theme/colors';
import { Spacing, BorderRadius } from '../theme/spacing';

const MENU_ITEMS = [
  { label: 'Flight Status',    icon: 'radio',           screen: 'FlightStatus',  chevron: true },
  { label: 'Destinations',     icon: 'earth',           screen: 'Destinations',  chevron: true },
  { label: 'Executive Club',   icon: 'star',            screen: 'ExecutiveClub', chevron: true },
  { label: 'Help & FAQ',       icon: 'help-circle',     screen: null,            chevron: true },
  { label: 'Privacy Policy',   icon: 'document',        screen: null,            chevron: true },
];

export default function MoreScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout } = useApp();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View style={styles.root}>
      <BAHeader title="More" />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* User card */}
        <LinearGradient colors={[Colors.darkBlue, Colors.blue]} style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {isAuthenticated && user?.firstName
                ? user.firstName.charAt(0).toUpperCase()
                : '✈'}
            </Text>
          </View>
          <View>
            <Text style={styles.userName}>
              {isAuthenticated
                ? `${user?.firstName || ''} ${user?.lastName || ''}`
                : 'Guest Traveller'}
            </Text>
            <Text style={styles.userEmail}>
              {isAuthenticated ? user?.email || 'Executive Club Member' : 'Sign in for the full experience'}
            </Text>
          </View>
        </LinearGradient>

        {/* Menu */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map(item => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuItem}
              onPress={() => item.screen && navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={styles.menuIconBox}>
                  <Ionicons name={item.icon} size={20} color={Colors.darkBlue} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
              </View>
              {item.chevron && <Ionicons name="chevron-forward" size={18} color={Colors.midGrey} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Auth section */}
        <View style={styles.menuSection}>
          {isAuthenticated ? (
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconBox, { backgroundColor: '#fee2e2' }]}>
                  <Ionicons name="log-out-outline" size={20} color={Colors.error} />
                </View>
                <Text style={[styles.menuLabel, { color: Colors.error }]}>Sign Out</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconBox}>
                    <Ionicons name="log-in-outline" size={20} color={Colors.darkBlue} />
                  </View>
                  <Text style={styles.menuLabel}>Sign In</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.midGrey} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
                <View style={styles.menuLeft}>
                  <View style={styles.menuIconBox}>
                    <Ionicons name="person-add-outline" size={20} color={Colors.darkBlue} />
                  </View>
                  <Text style={styles.menuLabel}>Create Account</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.midGrey} />
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.version}>British Airways Mobile · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: Spacing.screen, paddingVertical: 20,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  userName:   { color: Colors.white, fontSize: 16, fontWeight: '700' },
  userEmail:  { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },

  menuSection: {
    backgroundColor: Colors.white, marginTop: 12,
    marginHorizontal: Spacing.screen, borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.lightGrey,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIconBox: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: Colors.offWhite,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { fontSize: 15, fontWeight: '500', color: Colors.charcoal },

  version: {
    textAlign: 'center', color: Colors.midGrey,
    fontSize: 12, marginTop: 24, marginBottom: 8,
  },
});
