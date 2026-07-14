import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, shadow, text, card, btnPrimary } from '../theme';

const CABIN_OPTIONS = [
  { value: 'economy',         label: 'Economy' },
  { value: 'premium_economy', label: 'Premium' },
  { value: 'business',        label: 'Business' },
  { value: 'first',           label: 'First' },
];

const POPULAR_ROUTES = [
  { from: 'London', to: 'New York',   fromCode: 'LHR', toCode: 'JFK', price: 349 },
  { from: 'London', to: 'Dubai',      fromCode: 'LHR', toCode: 'DXB', price: 299 },
  { from: 'London', to: 'Tokyo',      fromCode: 'LHR', toCode: 'NRT', price: 649 },
  { from: 'London', to: 'Sydney',     fromCode: 'LHR', toCode: 'SYD', price: 799 },
  { from: 'London', to: 'Barcelona',  fromCode: 'LHR', toCode: 'BCN', price: 89 },
  { from: 'London', to: 'Singapore',  fromCode: 'LHR', toCode: 'SIN', price: 579 },
];

const QUICK_ACTIONS = [
  { icon: 'airplane',        label: 'Book Flight',    desc: 'Find your next trip',    screen: 'Book',        color: colors.blue },
  { icon: 'checkmark-done',  label: 'Check-in',       desc: '24 hrs before departure',screen: 'CheckIn',     color: colors.gold },
  { icon: 'briefcase',       label: 'My Booking',     desc: 'Manage your trip',       screen: 'My Trips',    color: colors.blue },
  { icon: 'star',            label: 'Executive Club', desc: 'Earn & spend Avios',     screen: 'ExecutiveClub',color: colors.gold },
];

export default function HomeScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { setSearchParams } = useApp();

  const [tripType,    setTripType]    = useState('return');
  const [from,        setFrom]        = useState('');
  const [to,          setTo]          = useState('');
  const [departDate,  setDepartDate]  = useState('');
  const [returnDate,  setReturnDate]  = useState('');
  const [passengers,  setPassengers]  = useState(1);
  const [cabin,       setCabin]       = useState('economy');

  const handleSwap = () => { setFrom(to); setTo(from); };

  const handleSearch = () => {
    setSearchParams({ tripType, from, to, departDate, returnDate, adults: passengers, cabin });
    navigation.navigate('Book');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      {/* ── Hero ── */}
      <LinearGradient
        colors={[colors.darkBlue, '#0a72d4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}
      >
        <View style={styles.heroTextRow}>
          <Ionicons name="airplane" size={20} color="rgba(255,255,255,0.7)" />
          <Text style={styles.heroBrand}>British Airways</Text>
        </View>
        <Text style={styles.heroTitle}>Fly the World{'\n'}in Comfort &amp; Style</Text>
        <Text style={styles.heroSubtitle}>
          200+ destinations worldwide. Award-winning service. Earn Avios every flight.
        </Text>

        {/* Stats row */}
        <View style={styles.heroStats}>
          {[['200+', 'Destinations'], ['100M+', 'Passengers/yr'], ['75+', 'Years flying']].map(([n, l]) => (
            <View key={l} style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{n}</Text>
              <Text style={styles.heroStatLabel}>{l}</Text>
            </View>
          ))}
        </View>

        {/* ── Search card ── */}
        <View style={styles.searchCard}>
          {/* Trip type tabs */}
          <View style={styles.tripTabs}>
            {[['return', 'Return'], ['oneway', 'One Way'], ['multicity', 'Multi-City']].map(([v, l]) => (
              <TouchableOpacity
                key={v}
                style={[styles.tripTab, tripType === v && styles.tripTabActive]}
                onPress={() => setTripType(v)}
              >
                <Text style={[styles.tripTabText, tripType === v && styles.tripTabTextActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* From / To */}
          <View style={styles.airportRow}>
            <View style={styles.airportField}>
              <Text style={styles.fieldLabel}>From</Text>
              <TextInput
                style={styles.airportInput}
                value={from}
                onChangeText={setFrom}
                placeholder="City or code"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="characters"
              />
            </View>

            <TouchableOpacity style={styles.swapBtn} onPress={handleSwap}>
              <Ionicons name="swap-horizontal" size={18} color={colors.blue} />
            </TouchableOpacity>

            <View style={styles.airportField}>
              <Text style={styles.fieldLabel}>To</Text>
              <TextInput
                style={styles.airportInput}
                value={to}
                onChangeText={setTo}
                placeholder="City or code"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Dates */}
          <View style={styles.datesRow}>
            <View style={styles.dateField}>
              <Text style={styles.fieldLabel}>Depart</Text>
              <TextInput
                style={styles.dateInput}
                value={departDate}
                onChangeText={setDepartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.placeholder}
              />
            </View>
            {tripType === 'return' && (
              <View style={styles.dateField}>
                <Text style={styles.fieldLabel}>Return</Text>
                <TextInput
                  style={styles.dateInput}
                  value={returnDate}
                  onChangeText={setReturnDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            )}
          </View>

          {/* Passengers + Cabin */}
          <View style={styles.optionsRow}>
            <View style={styles.passengersField}>
              <Text style={styles.fieldLabel}>Passengers</Text>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setPassengers(Math.max(1, passengers - 1))}
                >
                  <Ionicons name="remove" size={16} color={colors.blue} />
                </TouchableOpacity>
                <Text style={styles.counterVal}>{passengers}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setPassengers(Math.min(9, passengers + 1))}
                >
                  <Ionicons name="add" size={16} color={colors.blue} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.cabinField}>
              <Text style={styles.fieldLabel}>Cabin</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cabinScroll}>
                {CABIN_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c.value}
                    style={[styles.cabinChip, cabin === c.value && styles.cabinChipActive]}
                    onPress={() => setCabin(c.value)}
                  >
                    <Text style={[styles.cabinChipText, cabin === c.value && styles.cabinChipTextActive]}>
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
            <Ionicons name="search" size={18} color={colors.white} />
            <Text style={styles.searchBtnText}>Search Flights</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Quick Actions ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.quickCard, shadow.sm]}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View style={[styles.quickIcon, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
              <Text style={styles.quickDesc}>{item.desc}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textLight} style={styles.quickArrow} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Popular Routes ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Popular Routes</Text>
        <Text style={styles.sectionSubtitle}>From London Heathrow</Text>
        {POPULAR_ROUTES.map((route) => (
          <TouchableOpacity
            key={`${route.fromCode}-${route.toCode}`}
            style={[styles.routeCard, shadow.sm]}
            onPress={() => {
              setSearchParams({ from: route.fromCode, to: route.toCode });
              navigation.navigate('Book');
            }}
          >
            <View style={styles.routeCities}>
              <View style={styles.routeCity}>
                <Ionicons name="location" size={12} color={colors.blue} />
                <Text style={styles.routeCityText}>{route.from}</Text>
              </View>
              <Ionicons name="airplane" size={16} color={colors.textLight} style={styles.routePlane} />
              <Text style={styles.routeCityText}>{route.to}</Text>
            </View>
            <View style={styles.routePrice}>
              <Text style={styles.routePriceFrom}>From</Text>
              <Text style={styles.routePriceAmount}>£{route.price}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Executive Club CTA ── */}
      <LinearGradient
        colors={[colors.darkBlue, colors.blue]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.clubCta}
      >
        <View style={styles.clubBadge}>
          <Ionicons name="star" size={14} color={colors.gold} />
          <Text style={styles.clubBadgeText}>Executive Club</Text>
        </View>
        <Text style={styles.clubTitle}>Earn Avios on Every Flight</Text>
        <Text style={styles.clubDesc}>
          Join millions of members collecting Avios. Spend them on flights, upgrades, hotels and more.
        </Text>
        <TouchableOpacity
          style={styles.clubBtn}
          onPress={() => navigation.navigate('ExecutiveClub')}
        >
          <Ionicons name="star" size={16} color={colors.darkBlue} />
          <Text style={styles.clubBtnText}>Join for Free</Text>
        </TouchableOpacity>
      </LinearGradient>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },

  // Hero
  hero: { paddingHorizontal: spacing.lg, paddingBottom: 0 },
  heroTextRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  heroBrand: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  heroTitle: { color: colors.white, fontSize: 30, fontWeight: '800', lineHeight: 38, marginBottom: spacing.sm },
  heroSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  heroStats: { flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.lg },
  heroStat: { alignItems: 'center' },
  heroStatNum: { color: colors.white, fontSize: 20, fontWeight: '800' },
  heroStatLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 },

  // Search card
  searchCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: -spacing.xs,
    marginBottom: -spacing.xl,
    ...shadow.lg,
  },
  tripTabs: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  tripTab: {
    flex: 1, paddingVertical: 8, borderRadius: radius.sm,
    backgroundColor: colors.lightBlue, alignItems: 'center',
  },
  tripTabActive: { backgroundColor: colors.blue },
  tripTabText: { fontSize: 12, fontWeight: '600', color: colors.blue },
  tripTabTextActive: { color: colors.white },

  airportRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, marginBottom: spacing.sm },
  airportField: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4, letterSpacing: 0.3 },
  airportInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  swapBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.lightBlue,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },

  datesRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  dateField: { flex: 1 },
  dateInput: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },

  optionsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  passengersField: { flex: 1 },
  counterRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  counterBtn: { padding: 4 },
  counterVal: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 15, color: colors.textPrimary },
  cabinField: { flex: 2 },
  cabinScroll: { flexDirection: 'row' },
  cabinChip: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm,
    backgroundColor: colors.lightBlue, marginRight: 6,
  },
  cabinChipActive: { backgroundColor: colors.blue },
  cabinChipText: { fontSize: 12, fontWeight: '600', color: colors.blue },
  cabinChipTextActive: { color: colors.white },

  searchBtn: {
    ...btnPrimary,
    paddingVertical: 14,
    borderRadius: radius.md,
    gap: 8,
  },
  searchBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },

  // Sections
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + spacing.md, paddingBottom: 0 },
  sectionTitle: { ...text.h2, marginBottom: 4 },
  sectionSubtitle: { ...text.body, marginBottom: spacing.md },

  // Quick Actions
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickCard: {
    width: '47%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  quickIcon: { width: 42, height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  quickLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  quickDesc: { fontSize: 11, color: colors.textLight, lineHeight: 15 },
  quickArrow: { position: 'absolute', top: spacing.md, right: spacing.md },

  // Routes
  routeCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  routeCities: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  routeCity: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeCityText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  routePlane: { marginHorizontal: 6 },
  routePrice: { alignItems: 'flex-end' },
  routePriceFrom: { fontSize: 10, color: colors.textLight },
  routePriceAmount: { fontSize: 16, fontWeight: '800', color: colors.darkBlue },

  // Club CTA
  clubCta: { margin: spacing.lg, borderRadius: radius.lg, padding: spacing.lg },
  clubBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(200,169,81,0.2)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full, alignSelf: 'flex-start', marginBottom: spacing.sm,
  },
  clubBadgeText: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  clubTitle: { color: colors.white, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  clubDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  clubBtn: {
    ...btnGold,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: 8,
  },
  clubBtnText: { color: colors.darkBlue, fontWeight: '700', fontSize: 14 },
});

// btnGold used locally (import not available at module scope in StyleSheet)
const btnGold = {
  backgroundColor: colors.gold,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
};
