import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { aviosAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import BAHeader from '../components/BAHeader';
import BACard from '../components/BACard';
import BAButton from '../components/BAButton';
import Colors from '../theme/colors';
import { Spacing, BorderRadius } from '../theme/spacing';

const TIERS = [
  { name: 'Blue',   min: 0,     max: 24999,  color: '#6b7280' },
  { name: 'Bronze', min: 25000, max: 49999,  color: '#cd7f32' },
  { name: 'Silver', min: 50000, max: 99999,  color: '#94a3b8' },
  { name: 'Gold',   min: 100000, max: Infinity, color: Colors.baGold },
];

const ROUTES_AVIOS = [
  { from: 'LHR', to: 'JFK', label: 'London → New York' },
  { from: 'LHR', to: 'DXB', label: 'London → Dubai' },
  { from: 'LHR', to: 'NRT', label: 'London → Tokyo' },
  { from: 'LHR', to: 'SYD', label: 'London → Sydney' },
  { from: 'LHR', to: 'BCN', label: 'London → Barcelona' },
  { from: 'LHR', to: 'BOM', label: 'London → Mumbai' },
];

export default function ExecutiveClubScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useApp();

  const [mockBalance] = useState(12500);
  const [calcFrom,  setCalcFrom]  = useState('LHR');
  const [calcTo,    setCalcTo]    = useState('JFK');
  const [calcCabin, setCalcCabin] = useState('economy');
  const [calcResult, setCalcResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const tier = TIERS.find(t => mockBalance >= t.min && mockBalance <= t.max) || TIERS[0];
  const nextTier = TIERS[TIERS.indexOf(tier) + 1];
  const tierProgress = nextTier
    ? ((mockBalance - tier.min) / (nextTier.min - tier.min)) * 100
    : 100;

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const res = await aviosAPI.calculate(calcFrom, calcTo, calcCabin);
      setCalcResult(res);
    } catch {
      // Mock calculation
      const base = { economy: 800, premium_economy: 1600, business: 4000, first: 8000 };
      const routeMultiplier = calcTo === 'JFK' ? 1.2 : calcTo === 'NRT' ? 1.8 : calcTo === 'SYD' ? 2.5 : 1;
      setCalcResult({
        aviosEarned: Math.round((base[calcCabin] || 800) * routeMultiplier),
        tierPoints: Math.round(100 * routeMultiplier),
        cabin: calcCabin,
        route: `${calcFrom}-${calcTo}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <BAHeader title="Executive Club" />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance card */}
        <LinearGradient colors={['#1a237e', '#283593']} style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View>
              <Text style={styles.balanceLabel}>AVIOS BALANCE</Text>
              <Text style={styles.balanceValue}>{mockBalance.toLocaleString()}</Text>
            </View>
            <View style={[styles.tierBadge, { borderColor: tier.color }]}>
              <Text style={[styles.tierText, { color: tier.color }]}>{tier.name}</Text>
            </View>
          </View>

          <View style={styles.tierProgress}>
            <View style={styles.tierTrack}>
              <View style={[styles.tierFill, { width: `${tierProgress}%`, backgroundColor: tier.color }]} />
            </View>
            {nextTier && (
              <Text style={styles.tierHint}>
                {(nextTier.min - mockBalance).toLocaleString()} Avios to {nextTier.name}
              </Text>
            )}
          </View>

          <Text style={styles.memberName}>
            {isAuthenticated ? `${user?.firstName || ''} ${user?.lastName || ''}` : 'Guest Member'}
          </Text>
        </LinearGradient>

        {/* Avios calculator */}
        <BACard style={styles.calcCard}>
          <Text style={styles.calcTitle}>Avios Calculator</Text>
          <Text style={styles.calcSub}>See how many Avios you'd earn</Text>

          <View style={styles.calcRoutes}>
            {ROUTES_AVIOS.map(r => (
              <TouchableOpacity
                key={r.to}
                style={[styles.routeChip, calcTo === r.to && styles.routeChipActive]}
                onPress={() => { setCalcFrom(r.from); setCalcTo(r.to); }}
              >
                <Text style={[styles.routeChipText, calcTo === r.to && styles.routeChipTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.cabinRow}>
            {['economy', 'business', 'first'].map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.cabinChip, calcCabin === c && styles.cabinChipActive]}
                onPress={() => setCalcCabin(c)}
              >
                <Text style={[styles.cabinChipText, calcCabin === c && styles.cabinChipTextActive]}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <BAButton label="Calculate" onPress={handleCalculate} loading={loading} size="sm" style={styles.calcBtn} />

          {calcResult && (
            <View style={styles.calcResult}>
              <View style={styles.calcResultItem}>
                <Text style={styles.calcResultLabel}>Avios Earned</Text>
                <Text style={styles.calcResultValue}>{calcResult.aviosEarned?.toLocaleString()}</Text>
              </View>
              <View style={styles.calcResultItem}>
                <Text style={styles.calcResultLabel}>Tier Points</Text>
                <Text style={styles.calcResultValue}>{calcResult.tierPoints}</Text>
              </View>
            </View>
          )}
        </BACard>

        {/* Benefits */}
        <BACard style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>Member Benefits</Text>
          {[
            { icon: 'airplane',     text: 'Earn Avios on every BA flight' },
            { icon: 'gift',         text: 'Avios on partner hotels & car hire' },
            { icon: 'wine',         text: 'Lounge access with Gold & Silver' },
            { icon: 'star',         text: 'Seat upgrades with Avios' },
            { icon: 'card',         text: 'Earn Avios with BA credit cards' },
            { icon: 'people',       text: 'Family account — pool Avios together' },
          ].map(b => (
            <View key={b.text} style={styles.benefitRow}>
              <Ionicons name={b.icon} size={18} color={Colors.baGold} />
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </BACard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  scroll: { padding: Spacing.screen, gap: 16 },

  balanceCard: { borderRadius: BorderRadius.xl, padding: 20 },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  balanceLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  balanceValue: { color: Colors.white, fontSize: 36, fontWeight: '900' },
  tierBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, borderWidth: 2 },
  tierText:  { fontSize: 13, fontWeight: '800' },
  tierProgress: { marginBottom: 16 },
  tierTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginBottom: 6 },
  tierFill:  { height: 6, borderRadius: 3 },
  tierHint:  { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  memberName: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  calcCard: { padding: Spacing.md },
  calcTitle: { fontSize: 16, fontWeight: '700', color: Colors.charcoal, marginBottom: 2 },
  calcSub:   { fontSize: 13, color: Colors.darkGrey, marginBottom: 12 },
  calcRoutes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  routeChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 99, borderWidth: 1.5, borderColor: Colors.lightGrey,
  },
  routeChipActive: { backgroundColor: Colors.darkBlue, borderColor: Colors.darkBlue },
  routeChipText: { fontSize: 11, color: Colors.darkGrey, fontWeight: '600' },
  routeChipTextActive: { color: Colors.white },
  cabinRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  cabinChip: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.lightGrey, alignItems: 'center',
  },
  cabinChipActive: { backgroundColor: Colors.darkBlue, borderColor: Colors.darkBlue },
  cabinChipText: { fontSize: 12, fontWeight: '600', color: Colors.darkGrey },
  cabinChipTextActive: { color: Colors.white },
  calcBtn: { alignSelf: 'flex-start' },
  calcResult: {
    flexDirection: 'row', marginTop: 14,
    backgroundColor: Colors.offWhite, borderRadius: BorderRadius.md, padding: 14, gap: 20,
  },
  calcResultItem: {},
  calcResultLabel: { fontSize: 11, color: Colors.midGrey, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  calcResultValue: { fontSize: 22, fontWeight: '800', color: Colors.darkBlue },

  benefitsCard: { padding: Spacing.md },
  benefitsTitle: { fontSize: 16, fontWeight: '700', color: Colors.charcoal, marginBottom: 12 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.lightGrey },
  benefitText: { fontSize: 14, color: Colors.charcoal, flex: 1 },
});
