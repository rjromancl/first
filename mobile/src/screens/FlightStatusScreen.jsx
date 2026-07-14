import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { flightsAPI } from '../services/api';
import PageHeader from '../components/PageHeader';
import { colors, spacing, radius, shadow, text } from '../theme';

const STATUS_CONFIG = {
  'on-time':   { color: colors.success,   bg: colors.successBg,  label: 'On Time' },
  'delayed':   { color: colors.error,     bg: colors.errorBg,    label: 'Delayed' },
  'scheduled': { color: colors.blue,      bg: colors.lightBlue,  label: 'Scheduled' },
  'landed':    { color: '#6b6b6b',        bg: '#f0f0f0',         label: 'Landed' },
  'boarding':  { color: colors.warning,   bg: colors.warningBg,  label: 'Boarding' },
  'cancelled': { color: colors.error,     bg: colors.errorBg,    label: 'Cancelled' },
  'unknown':   { color: '#6b6b6b',        bg: '#f0f0f0',         label: 'Unknown' },
};

export default function FlightStatusScreen() {
  const insets = useSafeAreaInsets();

  const [searchType, setSearchType] = useState('flight');
  const [flightNum,  setFlightNum]  = useState('');
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [date,       setDate]       = useState(new Date().toISOString().split('T')[0]);
  const [results,    setResults]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await flightsAPI.getStatus({
        flightNumber: searchType === 'flight' ? flightNum.trim().toUpperCase() : undefined,
        from: searchType === 'route' ? from.trim().toUpperCase() : undefined,
        to:   searchType === 'route' ? to.trim().toUpperCase()   : undefined,
        date,
      });
      setResults(Array.isArray(data) ? data : [data]);
    } catch (err) {
      setError(err.message || 'Could not retrieve flight status. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
      keyboardShouldPersistTaps="handled"
    >
      <PageHeader
        title="Flight Status"
        subtitle="Real-time information on British Airways flights"
      />

      <View style={styles.content}>
        {/* Search card */}
        <View style={[styles.searchCard, shadow.md]}>
          {/* Type tabs */}
          <View style={styles.typeTabs}>
            {[['flight', 'By Flight Number'], ['route', 'By Route']].map(([v, l]) => (
              <TouchableOpacity
                key={v}
                style={[styles.typeTab, searchType === v && styles.typeTabActive]}
                onPress={() => setSearchType(v)}
              >
                <Text style={[styles.typeTabText, searchType === v && styles.typeTabTextActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {searchType === 'flight' ? (
            <>
              <Text style={styles.label}>Flight Number</Text>
              <TextInput
                style={[styles.input, styles.bigInput]}
                value={flightNum}
                onChangeText={setFlightNum}
                placeholder="e.g. BA117"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="characters"
              />
              <Text style={styles.tryText}>Try: BA117 · BA204 · BA016</Text>
            </>
          ) : (
            <View style={styles.routeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>From</Text>
                <TextInput
                  style={styles.input}
                  value={from}
                  onChangeText={setFrom}
                  placeholder="LHR"
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="characters"
                  maxLength={3}
                />
              </View>
              <Ionicons name="airplane" size={18} color={colors.textLight} style={styles.routeIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>To</Text>
                <TextInput
                  style={styles.input}
                  value={to}
                  onChangeText={setTo}
                  placeholder="JFK"
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="characters"
                  maxLength={3}
                />
              </View>
            </View>
          )}

          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.placeholder}
          />

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.searchBtn, loading && { opacity: 0.7 }]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <>
                  <Ionicons name="search" size={18} color={colors.white} />
                  <Text style={styles.searchBtnText}>Check Status</Text>
                </>}
          </TouchableOpacity>
        </View>

        {/* Results */}
        {results && results.length === 0 && !error && (
          <View style={styles.emptyState}>
            <Ionicons name="airplane-outline" size={48} color={colors.textLight} />
            <Text style={styles.emptyText}>No flights found for your search.</Text>
          </View>
        )}

        {results && results.map((flight, i) => {
          const sc = STATUS_CONFIG[flight.status] || STATUS_CONFIG.unknown;
          return (
            <View key={`${flight.flightNumber}${i}`} style={[styles.resultCard, shadow.md]}>
              {/* Card header */}
              <View style={styles.resultHeader}>
                <View style={styles.flightNumRow}>
                  <View style={styles.baLogoBox}>
                    <Text style={styles.baLogoText}>BA</Text>
                  </View>
                  <View>
                    <Text style={styles.flightNum}>{flight.flightNumber}</Text>
                    <Text style={styles.aircraft}>{flight.aircraft}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.color }]}>
                    {flight.statusLabel || sc.label}
                  </Text>
                </View>
              </View>

              {/* Route */}
              <View style={styles.routeRow2}>
                <View style={styles.routePoint}>
                  <Text style={styles.routeTime}>{flight.scheduledDep}</Text>
                  {flight.actualDep && flight.actualDep !== flight.scheduledDep && (
                    <Text style={styles.actualTime}>Act: {flight.actualDep}</Text>
                  )}
                  <Text style={styles.routeLabel}>Departure</Text>
                </View>

                <View style={styles.routeMiddle}>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${flight.progress || 0}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{flight.progress || 0}% complete</Text>
                  <Text style={styles.routeRoute}>{flight.route}</Text>
                </View>

                <View style={[styles.routePoint, { alignItems: 'flex-end' }]}>
                  <Text style={styles.routeTime}>{flight.scheduledArr}</Text>
                  {flight.actualArr && flight.actualArr !== flight.scheduledArr && (
                    <Text style={styles.actualTime}>Act: {flight.actualArr}</Text>
                  )}
                  <Text style={styles.routeLabel}>Arrival</Text>
                </View>
              </View>

              {/* Details */}
              <View style={styles.detailsGrid}>
                {[
                  ['Terminal', flight.terminal || 'TBD'],
                  ['Gate',     flight.gate     || 'TBD'],
                  ['Aircraft', flight.aircraft || '—'],
                  ['Progress', `${flight.progress || 0}%`],
                ].map(([k, v]) => (
                  <View key={k} style={styles.detailItem}>
                    <Text style={styles.detailKey}>{k}</Text>
                    <Text style={styles.detailVal}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: spacing.lg },

  searchCard: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  typeTabs: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  typeTab: {
    flex: 1, paddingVertical: 9, alignItems: 'center',
    borderRadius: radius.sm, backgroundColor: colors.lightBlue,
  },
  typeTabActive: { backgroundColor: colors.blue },
  typeTabText: { fontSize: 13, fontWeight: '600', color: colors.blue },
  typeTabTextActive: { color: colors.white },

  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: spacing.sm, letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: radius.sm,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: 15, color: colors.textPrimary,
  },
  bigInput: { fontSize: 22, fontWeight: '700', letterSpacing: 2, textAlign: 'center' },
  tryText: { fontSize: 11, color: colors.textLight, marginTop: 6 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  routeIcon: { marginBottom: 14 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.errorBg, borderRadius: radius.sm,
    padding: spacing.sm, marginTop: spacing.sm,
  },
  errorText: { flex: 1, color: colors.error, fontSize: 13, fontWeight: '600' },
  searchBtn: {
    backgroundColor: colors.blue, borderRadius: radius.md,
    paddingVertical: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: spacing.lg,
  },
  searchBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },

  emptyState: { alignItems: 'center', padding: spacing.xxl, gap: spacing.md },
  emptyText: { color: colors.textLight, fontSize: 14 },

  // Result card
  resultCard: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md,
  },
  resultHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.md,
  },
  flightNumRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  baLogoBox: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: colors.darkBlue, alignItems: 'center', justifyContent: 'center',
  },
  baLogoText: { color: colors.white, fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  flightNum: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  aircraft: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full },
  statusText: { fontSize: 12, fontWeight: '700' },

  routeRow2: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  routePoint: { flex: 1 },
  routeTime: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  actualTime: { fontSize: 11, color: colors.warning, marginTop: 1 },
  routeLabel: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  routeMiddle: { flex: 2, alignItems: 'center', gap: 4 },
  progressBarBg: {
    width: '100%', height: 6, borderRadius: 3,
    backgroundColor: colors.lightBlue, overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: colors.blue, borderRadius: 3 },
  progressText: { fontSize: 11, color: colors.textLight },
  routeRoute: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },

  detailsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
  },
  detailItem: { width: '22%' },
  detailKey: { fontSize: 10, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailVal: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
});
