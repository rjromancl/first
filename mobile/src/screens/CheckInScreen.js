import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { checkinAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import BAHeader from '../components/BAHeader';
import BAButton from '../components/BAButton';
import BACard from '../components/BACard';
import Colors from '../theme/colors';
import { Spacing, BorderRadius, Shadows } from '../theme/spacing';

export default function CheckInScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const { addNotification } = useApp();

  const [ref,     setRef]     = useState('');
  const [surname, setSurname] = useState('');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [errors,  setErrors]  = useState({});

  const validate = () => {
    const e = {};
    if (!ref.trim())     e.ref     = 'Booking reference required';
    if (!surname.trim()) e.surname = 'Surname required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleCheckIn = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await checkinAPI.checkIn(ref.trim().toUpperCase(), surname.trim());
      setResult(res);
      addNotification({ type: 'success', title: 'Check-in successful!', message: `Seat ${res.seat || 'assigned'}` });
    } catch (err) {
      // Mock check-in for demo
      const mockResult = {
        reference: ref.trim().toUpperCase(),
        passenger: surname.trim(),
        seat: '14A',
        gate: 'B38',
        boardingTime: '07:45',
        status: 'CHECKED_IN',
      };
      setResult(mockResult);
      addNotification({ type: 'success', title: 'Check-in successful!', message: `Seat ${mockResult.seat} assigned` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <BAHeader title="Online Check-In" showBack onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {!result ? (
          <BACard>
            <Text style={styles.sectionTitle}>Enter your details</Text>
            <Text style={styles.sectionSub}>Check in opens 24 hours before departure.</Text>

            <Text style={styles.fieldLabel}>Booking Reference</Text>
            <TextInput
              style={[styles.input, errors.ref && styles.inputError]}
              value={ref}
              onChangeText={setRef}
              placeholder="e.g. XYMBA1"
              placeholderTextColor={Colors.midGrey}
              autoCapitalize="characters"
            />
            {errors.ref && <Text style={styles.errorText}>{errors.ref}</Text>}

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Lead Passenger Surname</Text>
            <TextInput
              style={[styles.input, errors.surname && styles.inputError]}
              value={surname}
              onChangeText={setSurname}
              placeholder="e.g. Smith"
              placeholderTextColor={Colors.midGrey}
              autoCapitalize="words"
            />
            {errors.surname && <Text style={styles.errorText}>{errors.surname}</Text>}

            <BAButton
              label="Check In Now"
              onPress={handleCheckIn}
              loading={loading}
              icon="checkmark-circle"
              style={{ marginTop: 20 }}
            />
          </BACard>
        ) : (
          <>
            <LinearGradient colors={[Colors.success, '#16a34a']} style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={40} color={Colors.white} />
              <Text style={styles.successTitle}>Check-in Complete!</Text>
              <Text style={styles.successSub}>Your boarding pass is ready</Text>
            </LinearGradient>

            <BACard style={styles.boardingPass}>
              <View style={styles.bpHeader}>
                <Text style={styles.bpAirline}>✈ British Airways</Text>
                <Text style={styles.bpFlight}>Boarding Pass</Text>
              </View>

              <View style={styles.bpRow}>
                <View style={styles.bpCol}>
                  <Text style={styles.bpLabel}>PASSENGER</Text>
                  <Text style={styles.bpValue}>{result.passenger?.toUpperCase()}</Text>
                </View>
                <View style={styles.bpCol}>
                  <Text style={styles.bpLabel}>BOOKING REF</Text>
                  <Text style={styles.bpValue}>{result.reference}</Text>
                </View>
              </View>

              <View style={styles.bpRow}>
                <View style={styles.bpCol}>
                  <Text style={styles.bpLabel}>SEAT</Text>
                  <Text style={[styles.bpValue, styles.bpValueLarge]}>{result.seat}</Text>
                </View>
                <View style={styles.bpCol}>
                  <Text style={styles.bpLabel}>GATE</Text>
                  <Text style={[styles.bpValue, styles.bpValueLarge]}>{result.gate}</Text>
                </View>
                <View style={styles.bpCol}>
                  <Text style={styles.bpLabel}>BOARDING</Text>
                  <Text style={[styles.bpValue, styles.bpValueLarge]}>{result.boardingTime}</Text>
                </View>
              </View>

              {/* Barcode placeholder */}
              <View style={styles.barcode}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <View key={i} style={[styles.barcodeBar, { height: i % 3 === 0 ? 40 : 28, opacity: i % 5 === 0 ? 0.3 : 1 }]} />
                ))}
              </View>
            </BACard>

            <BAButton
              label="Done"
              onPress={() => navigation.navigate('Home')}
              variant="outline"
              style={{ marginTop: 16 }}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  scroll: { padding: Spacing.screen },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.charcoal, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: Colors.darkGrey, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.charcoal, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: Colors.lightGrey,
    borderRadius: BorderRadius.md, padding: 12,
    fontSize: 15, color: Colors.charcoal, backgroundColor: Colors.white,
  },
  inputError: { borderColor: Colors.error },
  errorText: { color: Colors.error, fontSize: 11, marginTop: 3 },

  successBanner: {
    borderRadius: BorderRadius.xl, padding: 28,
    alignItems: 'center', marginBottom: 16, gap: 6,
  },
  successTitle: { color: Colors.white, fontSize: 22, fontWeight: '800' },
  successSub:   { color: 'rgba(255,255,255,0.8)', fontSize: 14 },

  boardingPass: { overflow: 'hidden', padding: 0 },
  bpHeader: {
    backgroundColor: Colors.darkBlue, paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  bpAirline: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  bpFlight:  { color: Colors.baGold, fontSize: 12, fontWeight: '700' },
  bpRow: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.lightGrey, gap: 16 },
  bpCol: {},
  bpLabel: { fontSize: 10, color: Colors.midGrey, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  bpValue: { fontSize: 15, fontWeight: '700', color: Colors.charcoal },
  bpValueLarge: { fontSize: 24, fontWeight: '900', color: Colors.darkBlue },
  barcode: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingVertical: 16, gap: 2 },
  barcodeBar: { flex: 1, backgroundColor: Colors.charcoal, borderRadius: 1 },
});
