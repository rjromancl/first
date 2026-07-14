import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkinAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import PageHeader from '../components/PageHeader';
import { colors, spacing, radius, shadow, text } from '../theme';

export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const { addNotification } = useApp();

  const [ref,         setRef]         = useState('');
  const [surname,     setSurname]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [boardingPass,setBoardingPass]= useState(null);

  const handleCheckIn = async () => {
    if (!ref.trim() || !surname.trim()) { setError('Please fill in all fields.'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await checkinAPI.checkIn(ref.trim().toUpperCase(), surname.trim());
      setBoardingPass(result.boardingPass);
      addNotification({
        type: 'success',
        message: result.alreadyCheckedIn
          ? 'Already checked in — boarding pass retrieved.'
          : 'Check-in successful!',
      });
    } catch (err) {
      setError(err.message || 'Check-in failed. Verify your reference and surname.');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: `British Airways Boarding Pass\nFlight: ${boardingPass.flight?.number}\nPassenger: ${boardingPass.passenger?.name}\nSeat: ${boardingPass.flight?.seat}\nGate: ${boardingPass.flight?.gate || 'TBD'}` });
    } catch {}
  };

  const handleReset = () => {
    setBoardingPass(null);
    setRef('');
    setSurname('');
    setError('');
  };

  if (boardingPass) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <PageHeader title="You're Checked In!" subtitle="Your boarding pass is ready" />

        <View style={styles.content}>
          {/* Success icon */}
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>

          {/* Boarding Pass card */}
          <View style={[styles.bpCard, shadow.lg]}>
            {/* Header strip */}
            <View style={styles.bpHeader}>
              <View style={styles.bpHeaderLeft}>
                <Ionicons name="airplane" size={20} color={colors.white} />
                <Text style={styles.bpHeaderText}>British Airways</Text>
              </View>
              <Text style={styles.bpFlight}>{boardingPass.flight?.number}</Text>
            </View>

            {/* Route */}
            <View style={styles.bpRoute}>
              <View style={styles.bpPoint}>
                <Text style={styles.bpCode}>{boardingPass.flight?.from}</Text>
                <Text style={styles.bpTime}>{boardingPass.flight?.departure}</Text>
                <Text style={styles.bpLabel}>Departure</Text>
              </View>
              <View style={styles.bpMiddle}>
                <View style={styles.bpLine} />
                <Ionicons name="airplane" size={20} color={colors.blue} />
                <View style={styles.bpLine} />
              </View>
              <View style={[styles.bpPoint, { alignItems: 'flex-end' }]}>
                <Text style={styles.bpCode}>{boardingPass.flight?.to}</Text>
                <Text style={styles.bpTime}>{boardingPass.flight?.arrival || '—'}</Text>
                <Text style={styles.bpLabel}>Arrival</Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.bpDivider}>
              <View style={styles.bpNotch} />
              <View style={styles.bpDash} />
              <View style={[styles.bpNotch, { right: -12, left: 'auto' }]} />
            </View>

            {/* Details grid */}
            <View style={styles.bpGrid}>
              {[
                ['Passenger', boardingPass.passenger?.name],
                ['Date', boardingPass.flight?.date],
                ['Boarding', boardingPass.flight?.boarding],
                ['Seat', boardingPass.flight?.seat],
                ['Cabin', boardingPass.flight?.cabin],
                ['Gate', boardingPass.flight?.gate || 'TBD'],
                ['Terminal', boardingPass.flight?.terminal],
                ['Ref', boardingPass.reference],
              ].map(([label, value]) => (
                <View key={label} style={styles.bpGridItem}>
                  <Text style={styles.bpGridLabel}>{label}</Text>
                  <Text style={styles.bpGridValue}>{value || '—'}</Text>
                </View>
              ))}
            </View>

            {/* Barcode placeholder */}
            <View style={styles.bpBarcode}>
              <View style={styles.barcodeLines}>
                {Array.from({ length: 30 }).map((_, i) => (
                  <View
                    key={i}
                    style={[styles.barcodeLine, { width: i % 3 === 0 ? 3 : 1.5 }]}
                  />
                ))}
              </View>
              <Text style={styles.barcodeText}>{boardingPass.reference}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.bpActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={colors.blue} />
              <Text style={styles.actionBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => addNotification({ type: 'info', message: 'Boarding pass emailed!' })}>
              <Ionicons name="mail-outline" size={20} color={colors.blue} />
              <Text style={styles.actionBtnText}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleReset}>
              <Text style={styles.actionBtnSecondaryText}>Check In Another</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
      <PageHeader
        title="Online Check-in"
        subtitle="Check in from 24 hours before your flight"
      />

      <View style={styles.content}>
        <View style={[styles.formCard, shadow.md]}>
          <Text style={styles.formTitle}>Enter Your Details</Text>
          <Text style={styles.formDesc}>
            Check-in opens 24 hours before departure and closes 1 hour before.
          </Text>

          <Text style={styles.label}>Booking Reference</Text>
          <TextInput
            style={[styles.input, styles.refInput]}
            value={ref}
            onChangeText={(v) => setRef(v.toUpperCase())}
            placeholder="e.g. XYMBA1"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
            maxLength={6}
          />

          <Text style={styles.label}>Surname (as on passport)</Text>
          <TextInput
            style={styles.input}
            value={surname}
            onChangeText={setSurname}
            placeholder="e.g. Wilson"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="words"
          />

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleCheckIn}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.white} />
              : <>
                  <Ionicons name="checkmark" size={18} color={colors.white} />
                  <Text style={styles.submitBtnText}>Check In Now</Text>
                </>}
          </TouchableOpacity>
        </View>

        {/* Demo shortcuts */}
        <View style={[styles.demoCard, shadow.sm]}>
          <Text style={styles.demoTitle}>Demo Bookings</Text>
          {[
            { ref: 'XYMBA1', surname: 'Wilson',  label: 'XYMBA1 / Wilson — Business LHR→JFK' },
            { ref: 'PLCNR7', surname: 'Johnson', label: 'PLCNR7 / Johnson — Economy LHR→CDG' },
          ].map((d) => (
            <TouchableOpacity
              key={d.ref}
              style={styles.demoBtn}
              onPress={() => { setRef(d.ref); setSurname(d.surname); }}
            >
              <Ionicons name="airplane-outline" size={14} color={colors.blue} />
              <Text style={styles.demoBtnText}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: spacing.lg },

  formCard: {
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md,
  },
  formTitle: { ...text.h3, marginBottom: 6 },
  formDesc: { ...text.body, marginBottom: spacing.md },

  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: spacing.sm, letterSpacing: 0.3 },
  input: {
    backgroundColor: colors.inputBg, borderRadius: radius.sm,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: 15, color: colors.textPrimary,
  },
  refInput: { letterSpacing: 4, fontWeight: '700', fontSize: 18, textAlign: 'center' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.errorBg, borderRadius: radius.sm,
    padding: spacing.sm, marginTop: spacing.sm,
  },
  errorText: { flex: 1, color: colors.error, fontSize: 13, fontWeight: '600' },

  submitBtn: {
    backgroundColor: colors.blue, borderRadius: radius.md,
    paddingVertical: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: spacing.lg,
  },
  submitBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },

  demoCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md },
  demoTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  demoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  demoBtnText: { fontSize: 13, color: colors.blue, fontWeight: '600' },

  // Boarding pass
  successIcon: { alignItems: 'center', paddingVertical: spacing.lg },
  bpCard: { backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.lg },
  bpHeader: {
    backgroundColor: colors.darkBlue, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  bpHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bpHeaderText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  bpFlight: { color: colors.gold, fontWeight: '800', fontSize: 16, letterSpacing: 1 },

  bpRoute: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
  bpPoint: { flex: 1 },
  bpCode: { fontSize: 28, fontWeight: '800', color: colors.darkBlue },
  bpTime: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  bpLabel: { fontSize: 11, color: colors.textLight, marginTop: 2 },
  bpMiddle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  bpLine: { flex: 1, height: 1.5, backgroundColor: colors.border },

  bpDivider: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 0, borderTopWidth: 1,
    borderTopColor: colors.border, borderStyle: 'dashed',
  },
  bpNotch: {
    position: 'absolute', left: -12,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.offWhite,
  },
  bpDash: { flex: 1, height: 1 },

  bpGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.sm },
  bpGridItem: { width: '45%' },
  bpGridLabel: { fontSize: 10, color: colors.textLight, letterSpacing: 0.5, textTransform: 'uppercase' },
  bpGridValue: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },

  bpBarcode: { alignItems: 'center', padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  barcodeLines: { flexDirection: 'row', height: 48, gap: 2, marginBottom: 8, alignItems: 'center' },
  barcodeLine: { height: 40, backgroundColor: colors.textPrimary },
  barcodeText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, letterSpacing: 3 },

  bpActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.blue, backgroundColor: colors.white,
  },
  actionBtnText: { color: colors.blue, fontWeight: '700', fontSize: 14 },
  actionBtnSecondary: {
    width: '100%', paddingVertical: 12, borderRadius: radius.md,
    backgroundColor: colors.lightBlue, alignItems: 'center',
  },
  actionBtnSecondaryText: { color: colors.blue, fontWeight: '700', fontSize: 14 },
});
