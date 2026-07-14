import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { aviosAPI } from '../services/api';
import { colors, spacing, radius, shadow, text } from '../theme';

const TIERS = [
  { name: 'Blue',   points: '0+',    avios: 'Earn Avios on every flight',  color: '#2196f3',
    perks: ['Avios on flights', 'Companion voucher', 'Online shopping'] },
  { name: 'Bronze', points: '300+',  avios: 'Earn 25% more Avios',         color: '#cd7f32',
    perks: ['All Blue perks', 'Lounge access purchase', 'Priority boarding', 'Extra baggage'] },
  { name: 'Silver', points: '600+',  avios: 'Earn 50% more Avios',         color: '#9e9e9e',
    perks: ['All Bronze perks', 'Complimentary lounge', 'Free seat selection', 'Same-day changes'] },
  { name: 'Gold',   points: '1500+', avios: 'Earn 100% more Avios',        color: colors.gold,
    perks: ['All Silver perks', 'Concorde Room', 'First class check-in', 'Chauffeur'] },
];

const PARTNERS = [
  { name: 'Hotels',       icon: 'bed-outline',    desc: 'Earn on hotel stays',        examples: ['Marriott', 'Hilton', 'IHG'] },
  { name: 'Car Hire',     icon: 'car-outline',    desc: 'Earn while you drive',       examples: ['Avis', 'Hertz', 'Enterprise'] },
  { name: 'Shopping',     icon: 'bag-outline',    desc: 'Shop online and earn',       examples: ['Amazon', 'M&S', 'John Lewis'] },
  { name: 'Flights',      icon: 'airplane-outline',desc: 'Earn on partner airlines',  examples: ['Iberia', 'Finnair', 'Qatar'] },
];

const SPEND_OPTIONS = [
  { title: 'Reward Flights', icon: 'airplane',    avios: 'from 4,500', desc: 'Book flights using Avios' },
  { title: 'Upgrades',       icon: 'star',        avios: 'from 30,000',desc: 'Upgrade your cabin class' },
  { title: 'Hotels',         icon: 'bed',         avios: 'from 5,000', desc: 'Redeem at 100,000+ hotels' },
  { title: 'Car Hire',       icon: 'car',         avios: 'from 3,000', desc: 'Rent a car at your destination' },
];

const CALC_ROUTES = [
  { label: 'New York JFK',   value: 'JFK' },
  { label: 'Dubai DXB',      value: 'DXB' },
  { label: 'Tokyo NRT',      value: 'NRT' },
  { label: 'Sydney SYD',     value: 'SYD' },
  { label: 'Barcelona BCN',  value: 'BCN' },
  { label: 'Singapore SIN',  value: 'SIN' },
];

export default function ExecutiveClubScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isAuthenticated, user } = useApp();

  const [calcTo,      setCalcTo]      = useState('JFK');
  const [calcCabin,   setCalcCabin]   = useState('economy');
  const [calcResult,  setCalcResult]  = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [balance,     setBalance]     = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    aviosAPI.getBalance().then(setBalance).catch(() => {});
  }, [isAuthenticated]);

  const handleCalculate = async () => {
    setCalcLoading(true);
    try {
      const result = await aviosAPI.calculate('LHR', calcTo, calcCabin);
      setCalcResult(result);
    } catch {
      setCalcResult({ error: 'Could not calculate. Try again.' });
    } finally {
      setCalcLoading(false);
    }
  };

  const liveAvios = balance?.avios ?? user?.avios ?? null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
    >
      {/* Hero */}
      <LinearGradient
        colors={[colors.darkBlue, colors.blue]}
        style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}
      >
        <View style={styles.heroBadge}>
          <Ionicons name="star" size={14} color={colors.gold} />
          <Text style={styles.heroBadgeText}>Executive Club</Text>
        </View>
        <Text style={styles.heroTitle}>Unlock a World of Benefits</Text>
        <Text style={styles.heroSubtitle}>
          Join millions of members earning Avios on flights, hotels, shopping and more.
        </Text>

        {!isAuthenticated ? (
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.joinBtnText}>Join for Free</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signInBtn}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.signInBtnText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.memberInfo}>
            <Text style={styles.memberWelcome}>Welcome back, {user?.firstName}!</Text>
            <View style={styles.memberRow}>
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>{balance?.tier || user?.tier || 'Blue'} Member</Text>
              </View>
              {liveAvios !== null && (
                <View style={styles.aviosRow}>
                  <Ionicons name="star" size={13} color={colors.gold} />
                  <Text style={styles.aviosCount}>{Number(liveAvios).toLocaleString()} Avios</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </LinearGradient>

      <View style={styles.content}>
        {/* Membership Tiers */}
        <Text style={styles.sectionTitle}>Membership Tiers</Text>
        <Text style={styles.sectionSubtitle}>Climb the tiers and unlock greater rewards</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tiersScroll}>
          {TIERS.map((tier) => (
            <View key={tier.name} style={[styles.tierCard, shadow.md]}>
              <View style={[styles.tierHeader, { backgroundColor: tier.color }]}>
                <Ionicons name="star" size={22} color="rgba(255,255,255,0.8)" />
                <Text style={styles.tierName}>{tier.name}</Text>
                <Text style={styles.tierPoints}>{tier.points} Tier Points</Text>
              </View>
              <View style={styles.tierBody}>
                <Text style={styles.tierAvios}>{tier.avios}</Text>
                {tier.perks.map((p) => (
                  <View key={p} style={styles.perkRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.blue} />
                    <Text style={styles.perkText}>{p}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Earn Avios */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Earn Avios Everywhere</Text>
        <Text style={styles.sectionSubtitle}>Every purchase with our partners earns Avios</Text>
        <View style={styles.partnersGrid}>
          {PARTNERS.map((p) => (
            <View key={p.name} style={[styles.partnerCard, shadow.sm]}>
              <Ionicons name={p.icon} size={26} color={colors.blue} />
              <Text style={styles.partnerName}>{p.name}</Text>
              <Text style={styles.partnerDesc}>{p.desc}</Text>
              <View style={styles.partnerExamples}>
                {p.examples.map((ex) => (
                  <View key={ex} style={styles.exBadge}>
                    <Text style={styles.exText}>{ex}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Avios Calculator */}
        <View style={[styles.calcCard, shadow.md]}>
          <Text style={styles.calcTitle}>Avios Calculator</Text>
          <Text style={styles.calcSubtitle}>Estimate Avios for your next flight from London</Text>

          <Text style={styles.label}>Destination</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.routeScroll}>
            {CALC_ROUTES.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.routeChip, calcTo === r.value && styles.routeChipActive]}
                onPress={() => setCalcTo(r.value)}
              >
                <Text style={[styles.routeChipText, calcTo === r.value && styles.routeChipTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Cabin</Text>
          <View style={styles.cabinRow}>
            {['economy', 'premium_economy', 'business', 'first'].map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.cabinChip, calcCabin === c && styles.cabinChipActive]}
                onPress={() => setCalcCabin(c)}
              >
                <Text style={[styles.cabinChipText, calcCabin === c && styles.cabinChipTextActive]}>
                  {c === 'premium_economy' ? 'Premium' : c.charAt(0).toUpperCase() + c.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.calcBtn, calcLoading && { opacity: 0.7 }]}
            onPress={handleCalculate}
            disabled={calcLoading}
          >
            {calcLoading
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.calcBtnText}>Calculate Avios</Text>}
          </TouchableOpacity>

          {calcResult && !calcResult.error && (
            <View style={styles.calcResult}>
              <Ionicons name="star" size={24} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.calcResultLabel}>You'll earn approximately</Text>
                <Text style={styles.calcResultAvios}>
                  {Number(calcResult.avios).toLocaleString()} Avios
                </Text>
                <Text style={styles.calcResultMeta}>
                  {calcResult.distanceKm?.toLocaleString()} km · {calcResult.cabin}
                </Text>
              </View>
            </View>
          )}
          {calcResult?.error && (
            <Text style={styles.calcError}>{calcResult.error}</Text>
          )}
        </View>

        {/* Spend Options */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Spend Your Avios</Text>
        <Text style={styles.sectionSubtitle}>Use Avios for reward flights, upgrades and more</Text>
        <View style={styles.spendGrid}>
          {SPEND_OPTIONS.map((s) => (
            <View key={s.title} style={[styles.spendCard, shadow.sm]}>
              <Ionicons name={s.icon} size={30} color={colors.blue} />
              <View style={styles.aviosBadge}>
                <Text style={styles.aviosBadgeText}>{s.avios}</Text>
              </View>
              <Text style={styles.spendTitle}>{s.title}</Text>
              <Text style={styles.spendDesc}>{s.desc}</Text>
            </View>
          ))}
        </View>

        {/* Join CTA for non-members */}
        {!isAuthenticated && (
          <View style={[styles.joinCta, shadow.md]}>
            <Text style={styles.joinCtaTitle}>Ready to Start Earning?</Text>
            <Text style={styles.joinCtaDesc}>Joining is free and takes just a few minutes.</Text>
            <TouchableOpacity
              style={styles.joinCtaBtn}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.joinCtaBtnText}>Join the Executive Club Free</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },

  // Hero
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(200,169,81,0.2)',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radius.full, alignSelf: 'flex-start', marginBottom: spacing.sm,
  },
  heroBadgeText: { color: colors.gold, fontSize: 12, fontWeight: '700' },
  heroTitle: { color: colors.white, fontSize: 26, fontWeight: '800', marginBottom: 8 },
  heroSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  joinBtn: {
    backgroundColor: colors.gold, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: spacing.lg, alignItems: 'center',
  },
  joinBtnText: { color: colors.darkBlue, fontWeight: '700', fontSize: 15 },
  signInBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: spacing.lg,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },
  signInBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  memberInfo: { gap: spacing.sm },
  memberWelcome: { color: colors.white, fontSize: 17, fontWeight: '700' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tierBadge: {
    backgroundColor: colors.gold, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tierBadgeText: { color: colors.darkBlue, fontSize: 12, fontWeight: '700' },
  aviosRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aviosCount: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' },

  content: { padding: spacing.lg },

  sectionTitle: { ...text.h2, marginBottom: 4 },
  sectionSubtitle: { ...text.body, marginBottom: spacing.md },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: spacing.sm },

  // Tiers
  tiersScroll: { marginBottom: spacing.md },
  tierCard: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    overflow: 'hidden', width: 200, marginRight: spacing.sm,
  },
  tierHeader: { padding: spacing.md, alignItems: 'center', gap: 4 },
  tierName: { color: colors.white, fontSize: 20, fontWeight: '800' },
  tierPoints: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  tierBody: { padding: spacing.md },
  tierAvios: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  perkText: { fontSize: 12, color: colors.textPrimary },

  // Partners
  partnersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  partnerCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.md, width: '47%', gap: 4,
  },
  partnerName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  partnerDesc: { fontSize: 12, color: colors.textSecondary },
  partnerExamples: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  exBadge: {
    backgroundColor: colors.lightBlue, borderRadius: radius.sm,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  exText: { fontSize: 11, fontWeight: '600', color: colors.blue },

  // Calculator
  calcCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  calcTitle: { ...text.h3 },
  calcSubtitle: { ...text.body, marginBottom: spacing.sm },
  routeScroll: { marginBottom: spacing.sm },
  routeChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: colors.lightBlue, marginRight: 8,
  },
  routeChipActive: { backgroundColor: colors.blue },
  routeChipText: { fontSize: 12, fontWeight: '600', color: colors.blue },
  routeChipTextActive: { color: colors.white },
  cabinRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  cabinChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.sm, backgroundColor: colors.lightBlue,
  },
  cabinChipActive: { backgroundColor: colors.blue },
  cabinChipText: { fontSize: 12, fontWeight: '600', color: colors.blue },
  cabinChipTextActive: { color: colors.white },
  calcBtn: {
    backgroundColor: colors.blue, borderRadius: radius.md,
    paddingVertical: 13, alignItems: 'center',
  },
  calcBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  calcResult: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.goldLight, borderRadius: radius.md,
    padding: spacing.md, marginTop: spacing.md,
  },
  calcResultLabel: { fontSize: 12, color: colors.textSecondary },
  calcResultAvios: { fontSize: 20, fontWeight: '800', color: colors.darkBlue },
  calcResultMeta: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  calcError: { color: colors.error, fontSize: 13, marginTop: spacing.sm },

  // Spend
  spendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  spendCard: {
    backgroundColor: colors.white, borderRadius: radius.md,
    padding: spacing.md, width: '47%', gap: 4, alignItems: 'flex-start',
  },
  aviosBadge: {
    backgroundColor: colors.goldLight, borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  aviosBadgeText: { color: colors.gold, fontSize: 11, fontWeight: '700' },
  spendTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  spendDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

  // Join CTA
  joinCta: {
    backgroundColor: colors.darkBlue, borderRadius: radius.lg,
    padding: spacing.lg, alignItems: 'center', gap: spacing.sm,
  },
  joinCtaTitle: { color: colors.white, fontSize: 20, fontWeight: '800' },
  joinCtaDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center' },
  joinCtaBtn: {
    backgroundColor: colors.blue, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm,
  },
  joinCtaBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
