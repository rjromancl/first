import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { flightsAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import BAHeader from '../components/BAHeader';
import BACard from '../components/BACard';
import BAButton from '../components/BAButton';
import Colors from '../theme/colors';
import { Spacing, BorderRadius } from '../theme/spacing';
import { MOCK_FLIGHT_STATUS } from '../utils/mockData';

function StatusBadge({ status }) {
  const config = {
    'En Route':    { bg: '#dbeafe', text: Colors.blue,    icon: 'airplane' },
    'On Time':     { bg: '#dcfce7', text: Colors.success, icon: 'checkmark-circle' },
    'Delayed':     { bg: '#fef9c3', text: Colors.warning, icon: 'time' },
    'Cancelled':   { bg: '#fee2e2', text: Colors.error,   icon: 'close-circle' },
    'Landed':      { bg: '#dcfce7', text: Colors.success, icon: 'flag' },
    'Boarding':    { bg: '#ede9fe', text: '#7c3aed',      icon: 'people' },
  };
  const c = config[status] || config['On Time'];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Ionicons name={c.icon} size={13} color={c.text} />
      <Text style={[styles.badgeText, { color: c.text }]}>{status}</Text>
    </View>
  );
}

function ProgressBar({ percent }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${percent}%` }]} />
      <View style={[styles.progressPlane, { left: `${Math.min(percent, 95)}%` }]}>
        <Ionicons name="airplane" size={16} color={Colors.white} />
      </View>
    </View>
  );
}

export default function FlightStatusScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { addNotification } = useApp();

  const [flightNum, setFlightNum] = useState('');
  const [status,    setStatus]    = useState(null);
  const [loading,   setLoading]   = useState(false);

  const handleSearch = async () => {
    if (!flightNum.trim()) return;
    setLoading(true);
    try {
      const res = await flightsAPI.getStatus({ flightNumber: flightNum.trim().toUpperCase() });
      setStatus(res);
    } catch {
      // Mock fallback
      const mock = MOCK_FLIGHT_STATUS[flightNum.trim().toUpperCase()];
      if (mock) setStatus(mock);
      else {
        setStatus({
          flightNumber: flightNum.trim().toUpperCase(),
          status: 'On Time',
          scheduledDeparture: '10:00',
          scheduledArrival: '14:30',
          gate: 'A22',
          terminal: '5',
          percentComplete: 0,
          from: 'LHR', to: 'JFK',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <BAHeader title="Flight Status" showBack onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <BACard>
          <Text style={styles.sectionTitle}>Track a Flight</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={flightNum}
              onChangeText={setFlightNum}
              placeholder="Flight number (e.g. BA117)"
              placeholderTextColor={Colors.midGrey}
              autoCapitalize="characters"
            />
            <BAButton
              label="Track"
              onPress={handleSearch}
              loading={loading}
              icon="search"
              style={styles.trackBtn}
            />
          </View>
          <Text style={styles.hint}>Or try: BA117, BA474, BA107</Text>
        </BACard>

        {status && (
          <BACard style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View>
                <Text style={styles.statusFlight}>{status.flightNumber}</Text>
                <Text style={styles.statusRoute}>{status.from} → {status.to}</Text>
              </View>
              <StatusBadge status={status.status} />
            </View>

            {status.percentComplete > 0 && (
              <View style={styles.progressSection}>
                <ProgressBar percent={status.percentComplete} />
                <View style={styles.progressLabels}>
                  <Text style={styles.progressLabel}>{status.from}</Text>
                  <Text style={styles.progressPct}>{status.percentComplete}%</Text>
                  <Text style={styles.progressLabel}>{status.to}</Text>
                </View>
              </View>
            )}

            <View style={styles.timeGrid}>
              {[
                { label: 'Scheduled Dep.', value: status.scheduledDeparture },
                { label: 'Scheduled Arr.', value: status.scheduledArrival },
                { label: 'Actual Dep.',    value: status.actualDeparture || '—' },
                { label: 'Est. Arrival',   value: status.estimatedArrival || '—' },
                { label: 'Gate',           value: status.gate || '—' },
                { label: 'Terminal',       value: status.terminal || '—' },
              ].map(item => (
                <View key={item.label} style={styles.timeCell}>
                  <Text style={styles.timeCellLabel}>{item.label}</Text>
                  <Text style={styles.timeCellValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </BACard>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  scroll: { padding: Spacing.screen, gap: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.charcoal, marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    borderWidth: 1.5, borderColor: Colors.lightGrey,
    borderRadius: BorderRadius.md, padding: 12,
    fontSize: 15, color: Colors.charcoal, backgroundColor: Colors.white,
  },
  trackBtn: { flexShrink: 0 },
  hint: { fontSize: 12, color: Colors.midGrey, marginTop: 8 },

  statusCard: { padding: Spacing.md },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  statusFlight: { fontSize: 22, fontWeight: '800', color: Colors.darkBlue },
  statusRoute:  { fontSize: 14, color: Colors.darkGrey, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  progressSection: { marginBottom: 20 },
  progressTrack: {
    height: 8, backgroundColor: Colors.lightGrey, borderRadius: 4,
    marginBottom: 6, position: 'relative', overflow: 'visible',
  },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: Colors.baSkyBlue, borderRadius: 4 },
  progressPlane: {
    position: 'absolute', top: -12,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.darkBlue,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -14,
  },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel:  { fontSize: 12, color: Colors.midGrey },
  progressPct:    { fontSize: 12, fontWeight: '700', color: Colors.darkBlue },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  timeCell: { width: '45%' },
  timeCellLabel: { fontSize: 10, color: Colors.midGrey, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 },
  timeCellValue: { fontSize: 15, fontWeight: '700', color: Colors.charcoal },
});
