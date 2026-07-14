import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { authAPI } from '../services/api';
import { colors, spacing, radius, shadow, text, card } from '../theme';

export default function LoginScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { login, addNotification } = useApp();

  const [mode,     setMode]     = useState('login');   // 'login' | 'register'
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [form,     setForm]     = useState({
    email: '', password: '', firstName: '', lastName: '', confirmPwd: '',
  });

  const field = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    setError('');
    if (mode === 'register' && form.password !== form.confirmPwd) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      let result;
      if (mode === 'login') {
        result = await authAPI.login(form.email, form.password);
      } else {
        result = await authAPI.register(form.firstName, form.lastName, form.email, form.password);
      }
      await login(result.user, result.token);
      addNotification({
        type: 'success',
        message: mode === 'login'
          ? `Welcome back, ${result.user.firstName}!`
          : `Account created! Welcome to the Executive Club.`,
      });
      navigation.navigate('MainTabs');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <LinearGradient
          colors={[colors.darkBlue, colors.blue]}
          style={[styles.header, { paddingTop: insets.top + spacing.xl }]}
        >
          <View style={styles.logoWrap}>
            <Ionicons name="airplane" size={32} color={colors.white} />
          </View>
          <Text style={styles.headerTitle}>British Airways</Text>
          <Text style={styles.headerSubtitle}>
            {mode === 'login'
              ? 'Sign in to manage bookings and earn Avios'
              : 'Join the Executive Club — it's free'}
          </Text>
        </LinearGradient>

        {/* Card */}
        <View style={styles.cardWrap}>
          <View style={[styles.card, shadow.lg]}>
            {/* Mode tabs */}
            <View style={styles.tabs}>
              {[['login', 'Sign In'], ['register', 'Register']].map(([v, l]) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.tab, mode === v && styles.tabActive]}
                  onPress={() => { setMode(v); setError(''); }}
                >
                  <Text style={[styles.tabText, mode === v && styles.tabTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Register fields */}
            {mode === 'register' && (
              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>First Name</Text>
                  <TextInput
                    style={styles.input}
                    value={form.firstName}
                    onChangeText={(v) => field('firstName', v)}
                    placeholder="John"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="words"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Last Name</Text>
                  <TextInput
                    style={styles.input}
                    value={form.lastName}
                    onChangeText={(v) => field('lastName', v)}
                    placeholder="Smith"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(v) => field('email', v)}
              placeholder="your@email.com"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.pwdWrap}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={form.password}
                onChangeText={(v) => field('password', v)}
                placeholder={mode === 'register' ? 'Min. 8 characters' : 'Your password'}
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showPwd}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <TouchableOpacity
                onPress={() => setShowPwd((s) => !s)}
                style={styles.pwdToggle}
              >
                <Ionicons
                  name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textLight}
                />
              </TouchableOpacity>
            </View>

            {mode === 'register' && (
              <>
                <Text style={[styles.label, { marginTop: spacing.sm }]}>Confirm Password</Text>
                <TextInput
                  style={styles.input}
                  value={form.confirmPwd}
                  onChangeText={(v) => field('confirmPwd', v)}
                  placeholder="Repeat your password"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry
                />
              </>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={styles.submitBtnText}>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                  </Text>}
            </TouchableOpacity>

            {/* Demo hint */}
            <View style={styles.demoBox}>
              <Text style={styles.demoText}>
                <Text style={{ fontWeight: '700' }}>Demo: </Text>
                demo@ba.com / demo1234
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },

  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  logoWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle:    { color: colors.white, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  headerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  cardWrap: { paddingHorizontal: spacing.lg, marginTop: -spacing.xl },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },

  tabs: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.lg },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center',
    borderRadius: radius.sm, backgroundColor: colors.lightBlue,
  },
  tabActive: { backgroundColor: colors.blue },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.blue },
  tabTextActive: { color: colors.white },

  nameRow: { flexDirection: 'row', gap: spacing.sm },

  label: {
    fontSize: 12, fontWeight: '600', color: colors.textSecondary,
    marginBottom: 6, marginTop: spacing.sm, letterSpacing: 0.3,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 0,
  },

  pwdWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingRight: spacing.sm,
  },
  pwdToggle: { padding: 8 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.errorBg,
    borderRadius: radius.sm, padding: spacing.sm,
    marginTop: spacing.sm,
  },
  errorText: { flex: 1, color: colors.error, fontSize: 13, fontWeight: '600' },

  submitBtn: {
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  submitBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  demoBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.lightBlue,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  demoText: { fontSize: 12, color: colors.textSecondary },
});
