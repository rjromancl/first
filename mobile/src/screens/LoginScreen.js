import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { authAPI } from '../services/api';
import Colors from '../theme/colors';
import { Spacing, BorderRadius, Shadows } from '../theme/spacing';

export default function LoginScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { login, addNotification } = useApp();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState({});

  const validate = () => {
    const e = {};
    if (!email.trim())   e.email    = 'Email is required';
    if (!password)       e.password = 'Password is required';
    if (!email.includes('@')) e.email = 'Enter a valid email';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authAPI.login(email.trim().toLowerCase(), password);
      await login(res.user, res.token);
      navigation.replace('Main');
    } catch (err) {
      addNotification({ type: 'error', title: 'Login failed', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGuestContinue = () => navigation.replace('Main');

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={[Colors.darkBlue, Colors.blue]} style={[styles.hero, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.logoGlyph}>✈</Text>
        <Text style={styles.logoName}>British Airways</Text>
        <Text style={styles.heroSub}>Sign in to your Executive Club</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {/* Email */}
        <Text style={styles.label}>Email address</Text>
        <View style={[styles.inputWrap, errors.email && styles.inputError]}>
          <Ionicons name="mail-outline" size={18} color={Colors.midGrey} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={Colors.midGrey}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </View>
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

        {/* Password */}
        <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
        <View style={[styles.inputWrap, errors.password && styles.inputError]}>
          <Ionicons name="lock-closed-outline" size={18} color={Colors.midGrey} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={Colors.midGrey}
            secureTextEntry={!showPw}
            autoComplete="password"
          />
          <TouchableOpacity onPress={() => setShowPw(!showPw)}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.midGrey} />
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

        {/* Sign in button */}
        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Text style={styles.btnText}>Sign In</Text>
          }
        </TouchableOpacity>

        {/* Register link */}
        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkHighlight}>Register</Text></Text>
        </TouchableOpacity>

        {/* Guest */}
        <TouchableOpacity style={styles.guestBtn} onPress={handleGuestContinue}>
          <Text style={styles.guestText}>Continue as guest</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  hero: { alignItems: 'center', paddingBottom: 32, paddingHorizontal: 20 },
  logoGlyph: { fontSize: 48, color: Colors.white, marginBottom: 4 },
  logoName:  { color: Colors.white, fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  heroSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 },

  form: { padding: Spacing.screen },
  label: { fontSize: 13, fontWeight: '600', color: Colors.charcoal, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.lightGrey,
    borderRadius: BorderRadius.md, paddingHorizontal: 12,
    backgroundColor: Colors.offWhite,
    height: 50,
  },
  inputError: { borderColor: Colors.error },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: Colors.charcoal },
  errorText: { color: Colors.error, fontSize: 12, marginTop: 4 },

  btn: {
    backgroundColor: Colors.darkBlue,
    borderRadius: BorderRadius.md,
    height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: 24, ...Shadows.md,
  },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  linkBtn: { alignItems: 'center', marginTop: 16 },
  linkText: { color: Colors.darkGrey, fontSize: 14 },
  linkHighlight: { color: Colors.blue, fontWeight: '700' },

  guestBtn: {
    alignItems: 'center', marginTop: 12,
    paddingVertical: 12,
    borderWidth: 1.5, borderColor: Colors.lightGrey,
    borderRadius: BorderRadius.md,
  },
  guestText: { color: Colors.midGrey, fontSize: 14 },
});
