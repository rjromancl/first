import React, { useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { bookingsAPI } from '../services/api';
import BAHeader from '../components/BAHeader';
import BACard from '../components/BACard';
import BAButton from '../components/BAButton';
import Colors from '../theme/colors';
import { Spacing, BorderRadius } from '../theme/spacing';

function BookingItem({ booking, onCancel }) {
  const ref    = booking.reference || booking.pnr || booking.id;
  const flight = booking.flight || {};
  const pax    = booking.passenger || {};

  return (
    <BACard style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View>
          <Text style={styles.bookingRef}>{ref}</Text>
          <Text style={styles.bookingRoute}>{flight.from || 'LHR'} → {flight.to || '?'}</Text>
        </View>
        <View style={[styles.statusBadge, booking.status === 'CONFIRMED' ? styles.statusConfirmed : styles.statusOther]}>
          <Text style={styles.statusText}>{booking.status || 'CONFIRMED'}</Text>
        </View>
      </View>

      <View style={styles.bookingMeta}>
        <Text style={styles.bookingMetaText}>{pax.firstName} {pax.lastName}</Text>
        <Text style={styles.bookingMetaText}>{flight.flightNumber} · {booking.cabin}</Text>
        {booking.bookedAt && (
          <Text style={styles.bookingMetaText}>Booked {new Date(booking.bookedAt).toLocaleDateString('en-GB')}</Text>
        )}
      </View>

      <BAButton
        label="Cancel Booking"
        variant="danger"
        size="sm"
        onPress={() => onCancel(ref)}
        style={styles.cancelBtn}
      />
    </BACard>
  );
}

export default function ManageBookingScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const { bookings, addNotification, updateBooking } = useApp();

  const [ref,      setRef]      = useState('');
  const [surname,  setSurname]  = useState('');
  const [found,    setFound]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState('mine');  // mine | lookup

  const handleLookup = async () => {
    if (!ref.trim() || !surname.trim()) return;
    setLoading(true);
    try {
      const res = await bookingsAPI.retrieve(ref.trim().toUpperCase(), surname.trim());
      setFound(res);
    } catch (err) {
      // Fall back to local bookings
      const local = bookings.find(b =>
        (b.reference || b.id || '').toLowerCase() === ref.trim().toLowerCase()
      );
      if (local) setFound(local);
      else addNotification({ type: 'error', message: 'Booking not found. Check your reference and surname.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (bookingRef) => {
    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel booking ${bookingRef}?`,
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking', style: 'destructive',
          onPress: async () => {
            try {
              await bookingsAPI.cancel(bookingRef);
            } catch {}
            updateBooking({ id: bookingRef, reference: bookingRef, status: 'CANCELLED' });
            addNotification({ type: 'success', message: `Booking ${bookingRef} cancelled.` });
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <BAHeader
        title="Manage Booking"
        rightIcon="airplane-outline"
        onRightPress={() => navigation.navigate('CheckIn')}
        rightLabel="Check In"
      />

      {/* Tab toggle */}
      <View style={styles.tabRow}>
        {['mine', 'lookup'].map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'mine' ? 'My Bookings' : 'Look Up Booking'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'mine' ? (
        bookings.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptySub}>Your bookings will appear here after you book a flight.</Text>
            <BAButton label="Book a Flight" onPress={() => navigation.navigate('Book')} style={{ marginTop: 16 }} />
          </View>
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={b => b.id || b.reference || String(Math.random())}
            contentContainerStyle={{ padding: Spacing.screen, paddingBottom: insets.bottom + 24, gap: 12 }}
            renderItem={({ item }) => <BookingItem booking={item} onCancel={handleCancel} />}
          />
        )
      ) : (
        <View style={styles.lookupForm}>
          <Text style={styles.lookupTitle}>Enter booking details</Text>
          <TextInput
            style={styles.input}
            value={ref}
            onChangeText={setRef}
            placeholder="Booking reference (e.g. XYMBA1)"
            placeholderTextColor={Colors.midGrey}
            autoCapitalize="characters"
          />
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            value={surname}
            onChangeText={setSurname}
            placeholder="Lead passenger surname"
            placeholderTextColor={Colors.midGrey}
            autoCapitalize="words"
          />
          <BAButton
            label="Find Booking"
            onPress={handleLookup}
            loading={loading}
            icon="search"
            style={{ marginTop: 16 }}
          />

          {found && <BookingItem booking={found} onCancel={handleCancel} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.lightGrey },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2.5, borderBottomColor: Colors.darkBlue },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.midGrey },
  tabTextActive: { color: Colors.darkBlue },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.charcoal },
  emptySub: { fontSize: 14, color: Colors.darkGrey, textAlign: 'center' },

  lookupForm: { padding: Spacing.screen },
  lookupTitle: { fontSize: 16, fontWeight: '700', color: Colors.charcoal, marginBottom: 14 },
  input: {
    borderWidth: 1.5, borderColor: Colors.lightGrey,
    borderRadius: BorderRadius.md, padding: 12,
    fontSize: 15, color: Colors.charcoal, backgroundColor: Colors.white,
  },

  bookingCard: { padding: Spacing.md },
  bookingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  bookingRef:   { fontSize: 18, fontWeight: '800', color: Colors.darkBlue, letterSpacing: 2 },
  bookingRoute: { fontSize: 13, color: Colors.darkGrey, marginTop: 2 },
  statusBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  statusConfirmed: { backgroundColor: '#dcfce7' },
  statusOther: { backgroundColor: Colors.lightGrey },
  statusText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  bookingMeta: { gap: 3, marginBottom: 12 },
  bookingMetaText: { fontSize: 13, color: Colors.darkGrey },
  cancelBtn: { alignSelf: 'flex-start' },
});
