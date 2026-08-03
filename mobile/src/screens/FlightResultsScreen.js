/**
 * FlightResultsScreen — shows available flights from mock data.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import BAHeader from '../components/BAHeader';
import BACard from '../components/BACard';
import BAButton from '../components/BAButton';
import Colors from '../theme/colors';
import { Spacing, BorderRadius, Shadows } from '../theme/spacing';
import { getMockFlights } from '../utils/mockData';

const CABIN_LABELS = {
  economy:         'Economy',
  premium_economy: 'Premium Economy',
  business:        'Business (Club World)',
  first:           'First Class',
};

function FlightCard({ flight, cabin, onSelect }) {
  const price = flight.price[cabin] || flight.price.economy;
  return (
    <BACard style={styles.flightCard} variant="flat">
      <View style={styles.flightTop}>
        <View style={styles.flightRoute}>
          <Text style={styles.flightCode}>{flight.from}</Text>
          <View style={styles.flightLine}>
            <View style={styles.flightDot} />
            <View style={styles.flightLineSeg} />
            <Ionicons name="airplane" size={16} color={Colors.darkBlue} />
            <View style={styles.flightLineSeg} />
            <View style={styles.flightDot} />
          </View>
          <Text style={styles.flightCode}>{flight.to}</Text>
        </View>
        <View style={styles.flightPriceBox}>
          {price ? (
            <>
              <Text style={styles.flightPriceLabel}>from</Text>
              <Text style={styles.flightPrice}>£{price}</Text>
            </>
          ) : (
            <Text style={styles.flightPriceN}>N/A</Text>
          )}
        </View>
      </View>

      <View style={styles.flightMid}>
        <View style={styles.flightTimeBlock}>
          <Text style={styles.flightTime}>{flight.departure}</Text>
          <Text style={styles.flightCity}>{flight.from}</Text>
        </View>
        <View style={styles.flightDuration}>
          <Text style={styles.flightDurationText}>{flight.duration}</Text>
          <Text style={styles.flightStops}>
            {flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}${flight.stopCity ? ' via ' + flight.stopCity : ''}`}
          </Text>
        </View>
        <View style={styles.flightTimeBlock}>
          <Text style={styles.flightTime}>{flight.arrival}</Text>
          <Text style={styles.flightCity}>{flight.to}</Text>
        </View>
      </View>

      <View style={styles.flightBottom}>
        <View style={styles.flightMeta}>
          <Text style={styles.flightMetaText}>{flight.flightNumber}</Text>
          <Text style={styles.flightMetaText}>{flight.aircraft}</Text>
          <Text style={styles.flightMetaText}>{CABIN_LABELS[cabin]}</Text>
        </View>
        <BAButton
          label={price ? 'Select' : 'N/A'}
          onPress={() => onSelect(flight)}
          disabled={!price}
          size="sm"
          variant="primary"
          iconRight="chevron-forward"
        />
      </View>
    </BACard>
  );
}

export default function FlightResultsScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const insets     = useSafeAreaInsets();
  const { setSelectedFlight } = useApp();

  const { searchParams } = route.params || {};
  const { from = 'LHR', to = 'JFK', cabin = 'economy', adults = 1, departDate } = searchParams || {};

  const [flights,  setFlights]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    // Simulate API delay then return mock data
    const t = setTimeout(() => {
      setFlights(getMockFlights(from, to, cabin));
      setLoading(false);
    }, 800);
    return () => clearTimeout(t);
  }, [from, to, cabin]);

  const handleSelect = (flight) => {
    setSelectedFlight({ ...flight, searchParams });
    navigation.navigate('BookingFlow', { flight, searchParams });
  };

  return (
    <View style={styles.root}>
      <BAHeader
        title={`${from} → ${to}`}
        subtitle={`${departDate || 'Select date'} · ${adults} adult${adults > 1 ? 's' : ''} · ${CABIN_LABELS[cabin] || cabin}`}
        showBack
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.darkBlue} />
          <Text style={styles.loadingText}>Finding the best flights...</Text>
        </View>
      ) : flights.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>✈️</Text>
          <Text style={styles.emptyTitle}>No flights found</Text>
          <Text style={styles.emptySub}>Try adjusting your dates or cabin class.</Text>
          <BAButton label="Modify Search" onPress={() => navigation.goBack()} variant="outline" style={{ marginTop: 16 }} />
        </View>
      ) : (
        <FlatList
          data={flights}
          keyExtractor={f => f.id}
          contentContainerStyle={{ padding: Spacing.screen, paddingBottom: insets.bottom + 24, gap: 14 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <FlightCard flight={item} cabin={cabin} onSelect={handleSelect} />
          )}
          ListHeaderComponent={
            <Text style={styles.resultsCount}>{flights.length} flight{flights.length !== 1 ? 's' : ''} found</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: Colors.darkGrey },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyIcon:  { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.charcoal },
  emptySub:   { fontSize: 14, color: Colors.darkGrey, textAlign: 'center' },
  resultsCount: { fontSize: 13, color: Colors.darkGrey, marginBottom: 4 },

  flightCard: { padding: Spacing.md },
  flightTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  flightRoute: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flightCode: { fontSize: 20, fontWeight: '800', color: Colors.darkBlue },
  flightLine: { flexDirection: 'row', alignItems: 'center' },
  flightDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.midGrey },
  flightLineSeg: { width: 18, height: 1.5, backgroundColor: Colors.lightGrey },
  flightPriceBox: { alignItems: 'flex-end' },
  flightPriceLabel: { fontSize: 11, color: Colors.midGrey },
  flightPrice: { fontSize: 22, fontWeight: '800', color: Colors.darkBlue },
  flightPriceN: { fontSize: 14, color: Colors.midGrey },

  flightMid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  flightTimeBlock: { alignItems: 'center' },
  flightTime: { fontSize: 20, fontWeight: '700', color: Colors.charcoal },
  flightCity: { fontSize: 11, color: Colors.midGrey, marginTop: 2 },
  flightDuration: { alignItems: 'center' },
  flightDurationText: { fontSize: 13, fontWeight: '600', color: Colors.darkGrey },
  flightStops: { fontSize: 11, color: Colors.midGrey, marginTop: 2 },

  flightBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.lightGrey, paddingTop: 10 },
  flightMeta: { gap: 2 },
  flightMetaText: { fontSize: 11, color: Colors.midGrey },
});
