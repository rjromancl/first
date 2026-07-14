import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { destinationsAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import PageHeader from '../components/PageHeader';
import { colors, spacing, radius, shadow, text } from '../theme';

const FILTERS = ['all', 'city', 'beach', 'adventure', 'luxury'];

export default function DestinationsScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { setSearchParams } = useApp();

  const [filter,       setFilter]       = useState('all');
  const [destinations, setDestinations] = useState([]);
  const [offers,       setOffers]       = useState([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    Promise.all([destinationsAPI.list(), destinationsAPI.getOffers()])
      .then(([dests, offs]) => {
        setDestinations(dests || []);
        setOffers(offs || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all'
    ? destinations
    : destinations.filter((d) => d.category === filter);

  const handleBook = (code) => {
    setSearchParams({ to: code });
    navigation.navigate('Book');
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
    >
      <PageHeader
        title="Explore Destinations"
        subtitle="Discover your next adventure with British Airways"
      />

      {/* Filter chips */}
      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.blue} />
        </View>
      ) : (
        <View style={styles.grid}>
          {filtered.map((dest) => (
            <View key={dest.id || dest.code} style={[styles.destCard, shadow.md]}>
              {/* Image area — use a placeholder gradient if no image */}
              <View style={styles.destImgWrap}>
                {dest.image ? (
                  <Image
                    source={{ uri: dest.image }}
                    style={styles.destImg}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.destImg, styles.destImgPlaceholder]}>
                    <Ionicons name="airplane" size={32} color="rgba(255,255,255,0.5)" />
                  </View>
                )}
                <View style={styles.destOverlay}>
                  <Text style={styles.destCity}>{dest.city}</Text>
                  <Text style={styles.destCountry}>{dest.country}</Text>
                </View>
              </View>
              <View style={styles.destBody}>
                <Text style={styles.destDesc} numberOfLines={2}>{dest.description}</Text>
                <View style={styles.destMeta}>
                  <View style={styles.destMetaItem}>
                    <Ionicons name="airplane-outline" size={12} color={colors.textLight} />
                    <Text style={styles.destMetaText}>{dest.flightTime}</Text>
                  </View>
                  <Text style={styles.destPrice}>
                    from <Text style={styles.destPriceAmount}>£{dest.fromPrice}</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.bookBtn}
                  onPress={() => handleBook(dest.code)}
                >
                  <Text style={styles.bookBtnText}>Book Now</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Offers */}
      {offers.length > 0 && (
        <View style={styles.offersSection}>
          <Text style={styles.offersTitle}>Current Offers</Text>
          {offers.map((offer) => (
            <View key={offer.id} style={[styles.offerCard, shadow.md]}>
              {offer.image && (
                <Image source={{ uri: offer.image }} style={styles.offerImg} resizeMode="cover" />
              )}
              <View style={styles.offerBody}>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{offer.discount}</Text>
                </View>
                <Text style={styles.offerTitle}>{offer.title}</Text>
                <Text style={styles.offerDesc}>{offer.description}</Text>
                <View style={styles.offerFooter}>
                  <View style={styles.promoCode}>
                    <Text style={styles.promoCodeText}>{offer.promoCode}</Text>
                  </View>
                  <Text style={styles.offerExpiry}>Until {offer.validUntil}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },

  filtersWrap: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.xs },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: colors.lightBlue,
  },
  filterChipActive: { backgroundColor: colors.blue },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.blue },
  filterTextActive: { color: colors.white },

  loadingWrap: { padding: spacing.xxl, alignItems: 'center' },

  grid: { padding: spacing.lg, gap: spacing.md },

  destCard: { backgroundColor: colors.white, borderRadius: radius.lg, overflow: 'hidden' },
  destImgWrap: { position: 'relative' },
  destImg: { width: '100%', height: 160, backgroundColor: colors.lightBlue },
  destImgPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blue },
  destOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  destCity: { color: colors.white, fontSize: 18, fontWeight: '800' },
  destCountry: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  destBody: { padding: spacing.md },
  destDesc: { ...text.body, marginBottom: spacing.sm },
  destMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  destMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  destMetaText: { fontSize: 12, color: colors.textLight },
  destPrice: { fontSize: 13, color: colors.textSecondary },
  destPriceAmount: { fontSize: 16, fontWeight: '800', color: colors.darkBlue },
  bookBtn: {
    backgroundColor: colors.blue, borderRadius: radius.sm,
    paddingVertical: 10, paddingHorizontal: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  bookBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  // Offers
  offersSection: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  offersTitle: { ...text.h2, marginBottom: spacing.md },
  offerCard: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    overflow: 'hidden', marginBottom: spacing.md,
  },
  offerImg: { width: '100%', height: 120 },
  offerBody: { padding: spacing.md },
  discountBadge: {
    backgroundColor: colors.gold, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: spacing.xs,
  },
  discountText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  offerTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  offerDesc: { ...text.body, marginBottom: spacing.sm },
  offerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  promoCode: {
    backgroundColor: colors.lightBlue, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  promoCodeText: { fontSize: 13, fontWeight: '700', color: colors.blue, letterSpacing: 1 },
  offerExpiry: { fontSize: 12, color: colors.textLight },
});
