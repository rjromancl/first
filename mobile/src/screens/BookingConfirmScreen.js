/**
 * BookingConfirmScreen — shows the e-ticket / boarding pass after successful booking.
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Colors from '../theme/colors';
import { Spacing, BorderRadius, Shadows } from '../theme/spacing';
import BAButton from '../components/BAButton';

export default function BookingConfirmScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();
  const { booking } = route.params || {};

  const ref      = booking?.reference || booking?.pnr || booking?.id || 'BA123456';
  const pax      = booking?.passenger || {};
  const flight   = booking?.flight || {};
  const cabin    = booking?.cabin || 'economy';
  const price    = booking?.price || flight?.price?.[cabin] || 0;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[Colors.darkBlue, Colors.blue]}
        style={[styles.hero, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={40} color={Colors.white} />
        </View>
        <Text style={styles.heroTitle}>Booking Confirmed!</Text>
        <Text style={styles.heroSub}>Your e-ticket has been issued</Text>
        <View style={styles.pnrBox}>
          <Text style={styles.pnrLabel}>Booking Reference</Text>
          <Text style={styles.pnrCode}>{ref}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Ticket card */}
        <View style={styles.ticket}>
          {/* Ticket header */}
          <View style={styles.ticketHeader}>
            <Text style={styles.ticketBA}>✈ British Airways</Text>
            <Text style={styles.ticketCabin}>{cabin.toUpperCase()}</Text>
          </View>

          {/* Route */}
          <View style={styles.ticketRoute}>
            <View style={styles.ticketCity}>
              <Text style={styles.ticketCode}>{flight.from || 'LHR'}</Text>
              <Text style={styles.ticketTime}>{flight.departure || '--:--'}</Text>
            </View>
            <View style={styles.ticketMid}>
              <View style={styles.ticketDot} />
              <Ionicons name="airplane" size={20} color={Colors.baSkyBlue} />
              <View style={styles.ticketDot} />
            </View>
            <View style={styles.ticketCity}>
              <Text style={styles.ticketCode}>{flight.to || 'JFK'}</Text>
              <Text style={styles.ticketTime}>{flight.arrival || '--:--'}</Text>
            </View>
          </View>

          {/* Perforation */}
          <View style={styles.perforation}>
            <View style={styles.perforationCircleL} />
            {Array.from({ length: 18 }).map((_, i) => (
              <View key={i} style={styles.perforationDash} />
            ))}
            <View style={styles.perforationCircleR} />
          </View>

          {/* Passenger info */}
          <View style={styles.ticketDetail}>
            <View style={styles.ticketDetailCol}>
              <Text style={styles.detailLabel}>PASSENGER</Text>
              <Text style={styles.detailValue}>{pax.firstName || 'PASSENGER'} {pax.lastName || ''}</Text>
            </View>
            <View style={styles.ticketDetailCol}>
              <Text style={styles.detailLabel}>FLIGHT</Text>
              <Text style={styles.detailValue}>{flight.flightNumber || 'BA117'}</Text>
            </View>
            <View style={styles.ticketDetailCol}>
              <Text style={styles.detailLabel}>SEAT</Text>
              <Text style={styles.detailValue}>Online Check-in</Text>
            </View>
            <View style={styles.ticketDetailCol}>
              <Text style={styles.detailLabel}>PRICE PAID</Text>
              <Text style={styles.detailValue}>£{price}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <BAButton
            label="Check In Online"
            onPress={() => navigation.navigate('Manage', { screen: 'CheckIn' })}
            icon="checkmark-circle-outline"
            style={styles.actionBtn}
          />
          <BAButton
            label="View My Bookings"
            onPress={() => navigation.navigate('Manage', { screen: 'ManageBooking' })}
            variant="outline"
            icon="document-text-outline"
            style={styles.actionBtn}
          />
          <BAButton
            label="Back to Home"
            onPress={() => navigation.navigate('Home')}
            variant="ghost"
            icon="home-outline"
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  hero: { alignItems: 'center', paddingBottom: 32, paddingHorizontal: 20 },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle:  { color: Colors.white, fontSize: 24, fontWeight: '800' },
  heroSub:    { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 4 },
  pnrBox:     { marginTop: 16, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  pnrLabel:   { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  pnrCode:    { color: Colors.white, fontSize: 28, fontWeight: '900', letterSpacing: 4 },

  scroll: { padding: Spacing.screen },

  ticket: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    ...Shadows.lg,
    overflow: 'hidden',
  },
  ticketHeader: {
    backgroundColor: Colors.darkBlue,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  ticketBA:    { color: Colors.white, fontSize: 16, fontWeight: '800' },
  ticketCabin: { color: Colors.baGold, fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  ticketRoute: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 28, paddingVertical: 24,
  },
  ticketCity: { alignItems: 'center' },
  ticketCode: { fontSize: 36, fontWeight: '900', color: Colors.darkBlue },
  ticketTime: { fontSize: 14, color: Colors.midGrey, marginTop: 4 },
  ticketMid:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ticketDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.lightGrey },

  perforation: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: -1, paddingHorizontal: 0,
  },
  perforationCircleL: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.screenBg, marginLeft: -10 },
  perforationCircleR: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.screenBg, marginRight: -10 },
  perforationDash: { flex: 1, height: 1.5, backgroundColor: Colors.lightGrey },

  ticketDetail: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 20, gap: 14,
  },
  ticketDetailCol: { width: '45%' },
  detailLabel: { fontSize: 10, color: Colors.midGrey, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  detailValue: { fontSize: 14, fontWeight: '700', color: Colors.charcoal },

  actions: { marginTop: 20, gap: 10 },
  actionBtn: {},
});
