/**
 * FlightSearchScreen — search form for booking.
 * Accepts prefill from VoiceAgent via route params.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import BAHeader from '../components/BAHeader';
import BAButton from '../components/BAButton';
import AirportInput from '../components/AirportInput';
import Colors from '../theme/colors';
import { Spacing, BorderRadius, Shadows } from '../theme/spacing';

const CABINS = [
  { key: 'economy',          label: 'Economy' },
  { key: 'premium_economy',  label: 'Premium Economy' },
  { key: 'business',         label: 'Business (Club)' },
  { key: 'first',            label: 'First Class' },
];

const CITY_LABELS = {
  LHR: 'London Heathrow',
  JFK: 'New York JFK',
  DXB: 'Dubai',
  NRT: 'Tokyo Narita',
  SYD: 'Sydney',
  BCN: 'Barcelona',
  BOM: 'Mumbai',
};

export default function FlightSearchScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();
  const { setSearchParams, searchParams, addNotification } = useApp();

  const prefillTo   = route.params?.prefillTo;
  const prefillCity = route.params?.prefillCity;
  const voicePrefill = route.params?.voicePrefill;

  const [tripType,    setTripType]    = useState(searchParams.tripType || 'return');
  const [from,        setFrom]        = useState(searchParams.from || 'LHR');
  const [to,          setTo]          = useState(searchParams.to || '');
  const [departDate,  setDepartDate]  = useState(searchParams.departDate || '');
  const [returnDate,  setReturnDate]  = useState(searchParams.returnDate || '');
  const [adults,      setAdults]      = useState(searchParams.adults || 1);
  const [children,    setChildren]    = useState(searchParams.children || 0);
  const [cabin,       setCabin]       = useState(searchParams.cabin || 'economy');
  const [errors,      setErrors]      = useState({});

  // Apply prefill from destination card or voice agent
  useEffect(() => {
    if (prefillTo)   setTo(prefillTo);
    if (voicePrefill) {
      if (voicePrefill.from)          setFrom(voicePrefill.from);
      if (voicePrefill.to)            setTo(voicePrefill.to);
      if (voicePrefill.departureDate) setDepartDate(voicePrefill.departureDate);
      if (voicePrefill.returnDate)    setReturnDate(voicePrefill.returnDate);
      if (voicePrefill.cabin)         setCabin(voicePrefill.cabin);
      if (voicePrefill.adults)        setAdults(voicePrefill.adults);
      if (voicePrefill.tripType)      setTripType(voicePrefill.tripType === 'one_way' ? 'one_way' : 'return');
    }
  }, [prefillTo, voicePrefill]);

  const swapRoutes = () => {
    const tmp = from;
    setFrom(to);
    setTo(tmp);
  };

  const validate = () => {
    const e = {};
    if (!from.trim()) e.from = 'Origin required';
    if (!to.trim())   e.to   = 'Destination required';
    if (from.trim().toUpperCase() === to.trim().toUpperCase()) e.to = 'Origin and destination must differ';
    if (!departDate)  e.departDate = 'Departure date required';
    if (tripType === 'return' && !returnDate) e.returnDate = 'Return date required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSearch = () => {
    if (!validate()) return;
    const params = {
      tripType, from: from.toUpperCase(), to: to.toUpperCase(),
      departDate, returnDate: tripType === 'return' ? returnDate : null,
      adults, children, cabin,
    };
    setSearchParams(params);
    navigation.navigate('FlightResults', { searchParams: params });
  };

  const Counter = ({ label, value, onChange, min = 0 }) => (
    <View style={styles.counterRow}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.counterControls}>
        <TouchableOpacity
          style={[styles.counterBtn, value <= min && styles.counterBtnDisabled]}
          onPress={() => value > min && onChange(value - 1)}
        >
          <Ionicons name="remove" size={18} color={value <= min ? Colors.midGrey : Colors.darkBlue} />
        </TouchableOpacity>
        <Text style={styles.counterVal}>{value}</Text>
        <TouchableOpacity style={styles.counterBtn} onPress={() => onChange(value + 1)}>
          <Ionicons name="add" size={18} color={Colors.darkBlue} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <BAHeader title="Book a Flight" showBack={false} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Trip type toggle */}
        <View style={styles.tripToggle}>
          {['return', 'one_way'].map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tripBtn, tripType === t && styles.tripBtnActive]}
              onPress={() => setTripType(t)}
            >
              <Text style={[styles.tripBtnText, tripType === t && styles.tripBtnTextActive]}>
                {t === 'return' ? 'Return' : 'One Way'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Route */}
        <View style={[styles.card, { zIndex: 20 }]}>
          <Text style={styles.cardTitle}>Route</Text>

          <AirportInput
            label="From"
            value={from ? `${from} — ${CITY_LABELS[from] || from}` : ''}
            onSelect={(code) => setFrom(code)}
            placeholder="London, LHR"
          />
          {errors.from && <Text style={styles.errorText}>{errors.from}</Text>}

          <TouchableOpacity style={styles.swapBtnRow} onPress={swapRoutes}>
            <View style={styles.swapBtnInner}>
              <Ionicons name="swap-vertical" size={18} color={Colors.white} />
              <Text style={styles.swapBtnText}>Swap</Text>
            </View>
          </TouchableOpacity>

          <AirportInput
            label="To"
            value={to ? `${to} — ${CITY_LABELS[to] || to}` : ''}
            onSelect={(code) => setTo(code)}
            placeholder="New York, JFK"
          />
          {errors.to && <Text style={styles.errorText}>{errors.to}</Text>}
        </View>

        {/* Dates */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dates</Text>
          <View style={styles.dateRow}>
            <View style={[styles.dateField, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Depart</Text>
              <TextInput
                style={[styles.dateInput, errors.departDate && styles.inputError]}
                value={departDate}
                onChangeText={setDepartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.midGrey}
              />
              {errors.departDate && <Text style={styles.errorText}>{errors.departDate}</Text>}
            </View>
            {tripType === 'return' && (
              <View style={[styles.dateField, { flex: 1, marginLeft: 10 }]}>
                <Text style={styles.fieldLabel}>Return</Text>
                <TextInput
                  style={[styles.dateInput, errors.returnDate && styles.inputError]}
                  value={returnDate}
                  onChangeText={setReturnDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.midGrey}
                />
                {errors.returnDate && <Text style={styles.errorText}>{errors.returnDate}</Text>}
              </View>
            )}
          </View>
        </View>

        {/* Passengers */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Passengers</Text>
          <Counter label="Adults"   value={adults}   onChange={setAdults}   min={1} />
          <Counter label="Children" value={children} onChange={setChildren} min={0} />
        </View>

        {/* Cabin */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cabin</Text>
          <View style={styles.cabinGrid}>
            {CABINS.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[styles.cabinChip, cabin === c.key && styles.cabinChipActive]}
                onPress={() => setCabin(c.key)}
              >
                <Text style={[styles.cabinChipText, cabin === c.key && styles.cabinChipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <BAButton
          label="Search Flights"
          onPress={handleSearch}
          size="lg"
          icon="search"
          style={styles.searchBtn}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  scroll: { padding: Spacing.screen },

  tripToggle: {
    flexDirection: 'row', marginBottom: 16,
    backgroundColor: Colors.lightGrey,
    borderRadius: BorderRadius.full, padding: 3,
  },
  tripBtn: {
    flex: 1, paddingVertical: 9,
    borderRadius: BorderRadius.full, alignItems: 'center',
  },
  tripBtnActive: { backgroundColor: Colors.white, ...Shadows.sm },
  tripBtnText: { fontSize: 14, fontWeight: '600', color: Colors.midGrey },
  tripBtnTextActive: { color: Colors.darkBlue },

  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: 14, ...Shadows.sm,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: Colors.darkGrey, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },

  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeField: { flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: Colors.midGrey, marginBottom: 4 },
  routeInput: {
    fontSize: 28, fontWeight: '800', color: Colors.darkBlue,
    borderBottomWidth: 2, borderBottomColor: Colors.lightGrey,
    paddingBottom: 4, letterSpacing: 2,
  },
  cityHint: { fontSize: 11, color: Colors.midGrey, marginTop: 3 },
  swapBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.darkBlue,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 10,
  },

  dateRow: { flexDirection: 'row', gap: 10 },
  dateField: {},
  dateInput: {
    borderWidth: 1.5, borderColor: Colors.lightGrey,
    borderRadius: BorderRadius.sm, padding: 10,
    fontSize: 14, color: Colors.charcoal,
  },

  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.lightGrey },
  counterLabel: { fontSize: 15, color: Colors.charcoal, fontWeight: '500' },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderColor: Colors.lightGrey,
    alignItems: 'center', justifyContent: 'center',
  },
  counterBtnDisabled: { borderColor: Colors.lightGrey, opacity: 0.4 },
  counterVal: { fontSize: 16, fontWeight: '700', color: Colors.charcoal, minWidth: 24, textAlign: 'center' },

  cabinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cabinChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: Colors.lightGrey,
  },
  cabinChipActive: { backgroundColor: Colors.darkBlue, borderColor: Colors.darkBlue },
  cabinChipText: { fontSize: 13, fontWeight: '600', color: Colors.darkGrey },
  cabinChipTextActive: { color: Colors.white },

  searchBtn: { marginTop: 8 },
  inputError: { borderColor: Colors.error },
  errorText: { color: Colors.error, fontSize: 11, marginTop: 3 },
  swapBtnRow: { alignItems: 'center', marginVertical: -4, zIndex: 5 },
  swapBtnInner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.darkBlue,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  swapBtnText: { color: Colors.white, fontSize: 12, fontWeight: '700' },
});
