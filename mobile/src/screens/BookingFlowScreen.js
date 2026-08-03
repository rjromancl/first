/**
 * BookingFlowScreen — 3-step wizard: Passenger Details → Payment → Done.
 * Accepts voice-prefilled passenger data via route.params.voicePax.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { bookingsAPI } from '../services/api';
import BAHeader from '../components/BAHeader';
import BAButton from '../components/BAButton';
import BACard from '../components/BACard';
import Colors from '../theme/colors';
import { Spacing, BorderRadius, Shadows } from '../theme/spacing';

const STEPS = ['Passenger', 'Payment', 'Review'];

function StepIndicator({ current }) {
  return (
    <View style={styles.stepRow}>
      {STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, i < current && styles.stepDone, i === current && styles.stepActive]}>
              {i < current
                ? <Ionicons name="checkmark" size={14} color={Colors.white} />
                : <Text style={[styles.stepNum, i === current && styles.stepNumActive]}>{i + 1}</Text>
              }
            </View>
            <Text style={[styles.stepLabel, i === current && styles.stepLabelActive]}>{s}</Text>
          </View>
          {i < STEPS.length - 1 && <View style={[styles.stepLine, i < current && styles.stepLineDone]} />}
        </React.Fragment>
      ))}
    </View>
  );
}

function PassengerStep({ pax, setPax, voicePax, errors }) {
  const fields = [
    { key: 'firstName',   label: 'First Name',    placeholder: 'John',         keyboard: 'default' },
    { key: 'lastName',    label: 'Last Name',      placeholder: 'Smith',        keyboard: 'default' },
    { key: 'phone',       label: 'Phone',          placeholder: '+44 7700 000000', keyboard: 'phone-pad' },
    { key: 'nationality', label: 'Nationality',    placeholder: 'British',      keyboard: 'default' },
  ];

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Passenger Details</Text>
      {voicePax?.firstName && (
        <View style={styles.voiceFillBanner}>
          <Ionicons name="mic" size={14} color={Colors.white} />
          <Text style={styles.voiceFillText}>Voice-filled — review and confirm</Text>
        </View>
      )}
      {fields.map(f => (
        <View key={f.key} style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>{f.label}</Text>
          <TextInput
            style={[styles.input, errors[f.key] && styles.inputError]}
            value={pax[f.key] || ''}
            onChangeText={v => setPax(prev => ({ ...prev, [f.key]: v }))}
            placeholder={f.placeholder}
            placeholderTextColor={Colors.midGrey}
            keyboardType={f.keyboard}
            autoCapitalize={f.key === 'phone' ? 'none' : 'words'}
          />
          {errors[f.key] && <Text style={styles.errorText}>{errors[f.key]}</Text>}
        </View>
      ))}
    </View>
  );
}

function PaymentStep({ card, setCard, errors }) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Payment</Text>
      <View style={styles.payNotice}>
        <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
        <Text style={styles.payNoticeText}>Secure sandbox payment — no real charges</Text>
      </View>

      {[
        { key: 'name',   label: 'Cardholder Name', placeholder: 'John Smith',      keyboard: 'default' },
        { key: 'number', label: 'Card Number',      placeholder: '4242 4242 4242 4242', keyboard: 'numeric' },
      ].map(f => (
        <View key={f.key} style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>{f.label}</Text>
          <TextInput
            style={[styles.input, errors[f.key] && styles.inputError]}
            value={card[f.key] || ''}
            onChangeText={v => setCard(prev => ({ ...prev, [f.key]: v }))}
            placeholder={f.placeholder}
            placeholderTextColor={Colors.midGrey}
            keyboardType={f.keyboard}
          />
          {errors[f.key] && <Text style={styles.errorText}>{errors[f.key]}</Text>}
        </View>
      ))}

      <View style={styles.cardRow}>
        <View style={[styles.fieldWrap, { flex: 1 }]}>
          <Text style={styles.fieldLabel}>Expiry</Text>
          <TextInput
            style={[styles.input, errors.expiry && styles.inputError]}
            value={card.expiry || ''}
            onChangeText={v => setCard(prev => ({ ...prev, expiry: v }))}
            placeholder="MM/YY"
            placeholderTextColor={Colors.midGrey}
            keyboardType="numeric"
            maxLength={5}
          />
          {errors.expiry && <Text style={styles.errorText}>{errors.expiry}</Text>}
        </View>
        <View style={[styles.fieldWrap, { flex: 1, marginLeft: 12 }]}>
          <Text style={styles.fieldLabel}>CVV</Text>
          <TextInput
            style={[styles.input, errors.cvv && styles.inputError]}
            value={card.cvv || ''}
            onChangeText={v => setCard(prev => ({ ...prev, cvv: v }))}
            placeholder="123"
            placeholderTextColor={Colors.midGrey}
            keyboardType="numeric"
            maxLength={4}
            secureTextEntry
          />
          {errors.cvv && <Text style={styles.errorText}>{errors.cvv}</Text>}
        </View>
      </View>
    </View>
  );
}

function ReviewStep({ flight, pax, card, searchParams }) {
  const cabin = searchParams?.cabin || 'economy';
  const price = flight?.price?.[cabin] || flight?.displayPrice || 'N/A';
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review Booking</Text>

      <BACard style={styles.reviewCard}>
        <Text style={styles.reviewSection}>Flight</Text>
        <Text style={styles.reviewLine}>{flight?.flightNumber} · {flight?.from} → {flight?.to}</Text>
        <Text style={styles.reviewLine}>{flight?.departure} – {flight?.arrival} · {flight?.duration}</Text>
        <Text style={styles.reviewLine}>Cabin: {cabin} · {searchParams?.adults || 1} adult(s)</Text>
        <Text style={styles.reviewPrice}>£{price} per person</Text>
      </BACard>

      <BACard style={[styles.reviewCard, { marginTop: 12 }]}>
        <Text style={styles.reviewSection}>Passenger</Text>
        <Text style={styles.reviewLine}>{pax.firstName} {pax.lastName}</Text>
        <Text style={styles.reviewLine}>{pax.phone}</Text>
        <Text style={styles.reviewLine}>{pax.nationality}</Text>
      </BACard>

      <BACard style={[styles.reviewCard, { marginTop: 12 }]}>
        <Text style={styles.reviewSection}>Payment</Text>
        <Text style={styles.reviewLine}>**** **** **** {(card.number || '').slice(-4)}</Text>
        <Text style={styles.reviewLine}>{card.name}</Text>
      </BACard>
    </View>
  );
}

export default function BookingFlowScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();
  const { addBooking, addNotification } = useApp();

  const { flight, searchParams, voicePax } = route.params || {};

  const [step,    setStep]    = useState(0);
  const [pax,     setPax]     = useState({ firstName: '', lastName: '', phone: '', nationality: '' });
  const [card,    setCard]    = useState({ name: '', number: '', expiry: '', cvv: '' });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);

  // Apply voice-prefilled passenger data
  useEffect(() => {
    if (voicePax) {
      setPax(prev => ({
        ...prev,
        firstName:   voicePax.firstName   || prev.firstName,
        lastName:    voicePax.lastName    || prev.lastName,
        phone:       voicePax.phone       || prev.phone,
        nationality: voicePax.nationality || prev.nationality,
      }));
    }
  }, [voicePax]);

  const validateStep = () => {
    const e = {};
    if (step === 0) {
      if (!pax.firstName.trim()) e.firstName = 'Required';
      if (!pax.lastName.trim())  e.lastName  = 'Required';
      if (!pax.phone.trim())     e.phone     = 'Required';
      if (!pax.nationality.trim()) e.nationality = 'Required';
    }
    if (step === 1) {
      if (!card.name.trim())   e.name   = 'Required';
      if ((card.number || '').replace(/\s/g, '').length < 12) e.number = 'Invalid card number';
      if (!card.expiry.match(/^\d{2}\/\d{2}$/)) e.expiry = 'Use MM/YY';
      if ((card.cvv || '').length < 3) e.cvv = 'Invalid CVV';
    }
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
      return;
    }

    // Final step — confirm booking
    setLoading(true);
    try {
      const cabin = searchParams?.cabin || 'economy';
      const mockRef = 'BA' + Math.random().toString(36).slice(2, 8).toUpperCase();

      // Try real API, fall back to mock booking
      let booking;
      try {
        const traveler = {
          id: '1',
          dateOfBirth: '1990-01-01',
          name: { firstName: pax.firstName, lastName: pax.lastName },
          contact: { phones: [{ number: pax.phone, deviceType: 'MOBILE', countryCallingCode: '44' }] },
          documents: [{ documentType: 'PASSPORT', number: 'P1234567', nationality: pax.nationality, isHolder: true }],
        };
        const res = await bookingsAPI.create(flight, [traveler]);
        booking = res;
      } catch {
        // API unavailable — use mock
        booking = {
          id: mockRef,
          reference: mockRef,
          pnr: mockRef,
          status: 'CONFIRMED',
          flight,
          passenger: pax,
          cabin,
          price: flight?.price?.[cabin] || 0,
          bookedAt: new Date().toISOString(),
        };
      }

      addBooking(booking);
      addNotification({ type: 'success', title: 'Booking confirmed!', message: `Your reference is ${booking.reference || booking.id}` });
      navigation.replace('BookingConfirm', { booking });

    } catch (err) {
      addNotification({ type: 'error', title: 'Booking failed', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const STEP_CONTENT = [
    <PassengerStep key="pax" pax={pax} setPax={setPax} voicePax={voicePax} errors={errors} />,
    <PaymentStep   key="pay" card={card} setCard={setCard} errors={errors} />,
    <ReviewStep    key="rev" flight={flight} pax={pax} card={card} searchParams={searchParams} />,
  ];

  return (
    <View style={styles.root}>
      <BAHeader
        title="Complete Booking"
        showBack={step === 0}
        onBack={() => navigation.goBack()}
      />

      <StepIndicator current={step} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {STEP_CONTENT[step]}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {step > 0 && (
          <BAButton
            label="Back"
            onPress={() => setStep(s => s - 1)}
            variant="outline"
            style={styles.backFooterBtn}
          />
        )}
        <BAButton
          label={step === STEPS.length - 1 ? 'Confirm Booking' : 'Continue'}
          onPress={handleNext}
          loading={loading}
          iconRight={step < STEPS.length - 1 ? 'chevron-forward' : 'checkmark-circle'}
          style={step > 0 ? styles.nextBtnPartial : styles.nextBtnFull}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  scroll: { padding: Spacing.screen },

  stepRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.lightGrey },
  stepItem: { alignItems: 'center' },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.lightGrey, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stepActive: { backgroundColor: Colors.darkBlue },
  stepDone:   { backgroundColor: Colors.success },
  stepNum:     { fontSize: 12, fontWeight: '700', color: Colors.midGrey },
  stepNumActive: { color: Colors.white },
  stepLabel:   { fontSize: 10, color: Colors.midGrey, fontWeight: '600' },
  stepLabelActive: { color: Colors.darkBlue },
  stepLine:    { flex: 1, height: 2, backgroundColor: Colors.lightGrey, marginHorizontal: 4, marginBottom: 12 },
  stepLineDone: { backgroundColor: Colors.success },

  stepContent: {},
  stepTitle: { fontSize: 18, fontWeight: '700', color: Colors.charcoal, marginBottom: 16 },

  voiceFillBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.baSkyBlue, borderRadius: BorderRadius.sm,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12,
  },
  voiceFillText: { color: Colors.white, fontSize: 12, fontWeight: '600' },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.charcoal, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: Colors.lightGrey,
    borderRadius: BorderRadius.md, padding: 12,
    fontSize: 15, color: Colors.charcoal,
    backgroundColor: Colors.white,
  },
  inputError: { borderColor: Colors.error },
  errorText: { color: Colors.error, fontSize: 11, marginTop: 3 },

  payNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f0fdf4', borderRadius: BorderRadius.sm,
    padding: 10, marginBottom: 14,
  },
  payNoticeText: { color: Colors.success, fontSize: 12, fontWeight: '500' },
  cardRow: { flexDirection: 'row' },

  reviewCard: { padding: Spacing.md },
  reviewSection: { fontSize: 11, fontWeight: '800', color: Colors.midGrey, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  reviewLine:  { fontSize: 14, color: Colors.charcoal, marginBottom: 3 },
  reviewPrice: { fontSize: 18, fontWeight: '800', color: Colors.darkBlue, marginTop: 6 },

  footer: {
    flexDirection: 'row', padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.lightGrey,
    gap: 10,
  },
  backFooterBtn: { flex: 0.4 },
  nextBtnPartial: { flex: 0.6 },
  nextBtnFull: { flex: 1 },
});
