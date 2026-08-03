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

export default function RegisterScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { login, addNotification } = useApp();

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'First name required';
    if (!form.lastName.trim())  e.lastName  = 'Last name required';
    if (!form.email.includes('@')) e.email  = 'Valid email required';
    if (form.password.length < 8)  e.password = 'Min 8 characters';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authAPI.register(form.firstName, form.lastName, form.email.trim().toLowerCase(), form.password);
      await login(res.user, res.token);
      navigation.replace('Main');
    } catch (err) {
      addNotification({ type: 'error', title: 'Registration failed', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, fkey, placeholder, keyboardType = 'default', secureEntry = false }) => (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, errors[fkey] && styles.inputError]}>
        <TextInput
          style={styles.input}
          value={form[fkey]}
          onChangeText={set(fkey)}
          placeholder={placeholder}
          placeholderTextColor={Colors.midGrey}
          keyboardType={keyboardType}
          autoCapitalize={fkey === 'email' ? 'none' : 'words'}
          secureTextEntry={fkey === 'password' ? !showPw : false}
        />
        {fkey === 'password' && (
          <TouchableOpacity onPress={() => setShowPw(!showPw)}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.midGrey} />
          </TouchableOpacity>
        )}
      </View>
      {errors[fkey] && <Text style={styles.errorText}>{errors[fkey]}</Text>}
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={[Colors.darkBlue, Colors.blue]} style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.heroTitle}>Create Account</Text>
        <Text style={styles.heroSub}>Join the Executive Club</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Field label="First Name"   fkey="firstName" placeholder="John" />
        <Field label="Last Name"    fkey="lastName"  placeholder="Smith" />
        <Field label="Email"        fkey="email"     placeholder="john@email.com" keyboardType="email-address" />
        <Field label="Password"     fkey="password"  placeholder="Min 8 characters" />

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.7 }]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator size="small" color={Colors.white} />
            : <Text style={styles.btnText}>Create Account</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.linkHighlight}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  hero: { paddingHorizontal: 20, paddingBottom: 24 },
  backBtn: { marginBottom: 12 },
  heroTitle: { color: Colors.white, fontSize: 24, fontWeight: '800' },
  heroSub:   { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 },
  form:   { padding: Spacing.screen },
  fieldWrap: { marginBottom: 14 },
  label:  { fontSize: 13, fontWeight: '600', color: Colors.charcoal, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.lightGrey,
    borderRadius: BorderRadius.md, paddingHorizontal: 12,
    backgroundColor: Colors.offWhite, height: 50,
  },
  inputError: { borderColor: Colors.error },
  input: { flex: 1, fontSize: 15, color: Colors.charcoal },
  errorText: { color: Colors.error, fontSize: 12, marginTop: 4 },
  btn: {
    backgroundColor: Colors.darkBlue, borderRadius: BorderRadius.md,
    height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: 8, ...Shadows.md,
  },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  linkBtn: { alignItems: 'center', marginTop: 16 },
  linkText: { color: Colors.darkGrey, fontSize: 14 },
  linkHighlight: { color: Colors.blue, fontWeight: '700' },
});
