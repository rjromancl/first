/**
 * HomeScreen — Landing screen for the BA mobile app.
 * Shows quick actions, destinations carousel, and the voice agent FAB.
 */
import React, { useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, Dimensions, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import BAHeader from '../components/BAHeader';
import Colors from '../theme/colors';
import { Spacing, BorderRadius, Shadows } from '../theme/spacing';
import { DESTINATIONS } from '../utils/mockData';

const { width } = Dimensions.get('window');
const CARD_W = width * 0.68;

const QUICK_ACTIONS = [
  { label: 'Book Flight',     icon: 'airplane',           screen: 'Book',     tab: true },
  { label: 'Check In',        icon: 'checkmark-circle',   screen: 'CheckIn',  tab: false, stack: 'Manage' },
  { label: 'Flight Status',   icon: 'radio',              screen: 'FlightStatus', tab: false, stack: 'More' },
  { label: 'My Bookings',     icon: 'document-text',      screen: 'Manage',   tab: true },
  { label: 'Avios',           icon: 'star',               screen: 'ExecutiveClub', tab: false, stack: 'More' },
  { label: 'Destinations',    icon: 'earth',              screen: 'Destinations',  tab: false, stack: 'More' },
];

function DestinationCard({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.destCard} onPress={() => onPress(item)} activeOpacity={0.88}>
      <Image
        source={{ uri: item.imageUrl }}
        style={styles.destImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={styles.destGradient}
      />
      <View style={styles.destInfo}>
        <Text style={styles.destEmoji}>{item.emoji}</Text>
        <Text style={styles.destCity}>{item.city}</Text>
        <Text style={styles.destCountry}>{item.country}</Text>
        <Text style={styles.destPrice}>From £{item.avgPrice}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();
  const { user, isAuthenticated } = useApp();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleQuickAction = useCallback((action) => {
    if (action.tab) {
      navigation.navigate(action.screen);
    } else {
      navigation.navigate(action.stack, { screen: action.screen });
    }
  }, [navigation]);

  const handleDestination = useCallback((dest) => {
    navigation.navigate('Book', {
      screen: 'FlightSearch',
      params: { prefillTo: dest.code, prefillCity: dest.city },
    });
  }, [navigation]);

  const openVoice = () => navigation.navigate('VoiceAgent');

  return (
    <View style={styles.root}>
      {/* Hero header */}
      <LinearGradient
        colors={[Colors.darkBlue, Colors.blue]}
        style={[styles.hero, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.heroTop}>
          <View style={styles.logoRow}>
            <Text style={styles.logoGlyph}>✈</Text>
            <Text style={styles.logoBA}>British Airways</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate(isAuthenticated ? 'Manage' : 'Login')} style={styles.heroRight}>
            <Ionicons name="person-circle-outline" size={28} color={Colors.white} />
          </TouchableOpacity>
        </View>

        <Text style={styles.heroGreeting}>
          {greeting()}{user?.firstName ? `, ${user.firstName}` : ''}
        </Text>
        <Text style={styles.heroTagline}>Where would you like to fly?</Text>

        {/* Voice agent trigger */}
        <TouchableOpacity style={styles.voiceHeroBadge} onPress={openVoice} activeOpacity={0.85}>
          <Ionicons name="mic" size={18} color={Colors.white} />
          <Text style={styles.voiceHeroText}>Tap to speak with your AI assistant</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick actions grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.gridWrap}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={styles.gridItem}
                onPress={() => handleQuickAction(action)}
                activeOpacity={0.82}
              >
                <View style={styles.gridIcon}>
                  <Ionicons name={action.icon} size={24} color={Colors.darkBlue} />
                </View>
                <Text style={styles.gridLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Destinations carousel */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Explore Destinations</Text>
            <TouchableOpacity onPress={() => navigation.navigate('More', { screen: 'Destinations' })}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={DESTINATIONS}
            keyExtractor={i => i.code}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: Spacing.screen, gap: 12 }}
            renderItem={({ item }) => (
              <DestinationCard item={item} onPress={handleDestination} />
            )}
          />
        </View>

        {/* Avios promo banner */}
        <View style={styles.section}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => navigation.navigate('More', { screen: 'ExecutiveClub' })}
          >
            <LinearGradient
              colors={['#1a237e', '#283593']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.avisosBanner}
            >
              <View style={styles.aviosBannerLeft}>
                <Text style={styles.aviosBannerTitle}>Executive Club</Text>
                <Text style={styles.aviosBannerSub}>Earn Avios on every flight</Text>
                <Text style={styles.aviosBannerCta}>Join or check balance →</Text>
              </View>
              <Text style={styles.aviosBannerStar}>⭐</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Voice FAB */}
      <TouchableOpacity style={[styles.voiceFab, { bottom: insets.bottom + 20 }]} onPress={openVoice} activeOpacity={0.9}>
        <LinearGradient colors={[Colors.baSkyBlue, Colors.blue]} style={styles.voiceFabInner}>
          <Ionicons name="mic" size={26} color={Colors.white} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },

  // Hero
  hero: { paddingHorizontal: Spacing.screen, paddingBottom: 28 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoGlyph: { color: Colors.white, fontSize: 22 },
  logoBA:    { color: Colors.white, fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  heroRight: {},
  heroGreeting: { color: Colors.white, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  heroTagline:  { color: 'rgba(255,255,255,0.8)', fontSize: 15, marginBottom: 16 },

  voiceHeroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24, paddingVertical: 10, paddingHorizontal: 16,
  },
  voiceHeroText: { flex: 1, color: Colors.white, fontSize: 13, fontWeight: '500' },

  // Scroll
  scroll: { flex: 1 },
  section: { marginTop: 22, paddingHorizontal: Spacing.screen },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.charcoal, marginBottom: 12 },
  seeAll: { fontSize: 13, fontWeight: '600', color: Colors.blue },

  // Quick actions grid
  gridWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  gridItem: {
    width: (width - Spacing.screen * 2 - 10 * 2) / 3,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
    ...Shadows.sm,
  },
  gridIcon: {
    width: 48, height: 48,
    borderRadius: 24,
    backgroundColor: Colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: { fontSize: 11, fontWeight: '600', color: Colors.darkGrey, textAlign: 'center' },

  // Destination card
  destCard: {
    width: CARD_W, height: 200,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.md,
  },
  destImage:    { ...StyleSheet.absoluteFillObject },
  destGradient: { ...StyleSheet.absoluteFillObject },
  destInfo: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  destEmoji:   { fontSize: 22, marginBottom: 2 },
  destCity:    { color: Colors.white, fontSize: 18, fontWeight: '800' },
  destCountry: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  destPrice:   { color: Colors.baGold, fontSize: 13, fontWeight: '700', marginTop: 2 },

  // Avios banner
  avisosBanner: {
    borderRadius: BorderRadius.lg, padding: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    ...Shadows.md,
  },
  aviosBannerLeft: { flex: 1 },
  aviosBannerTitle: { color: Colors.baGold, fontSize: 16, fontWeight: '800' },
  aviosBannerSub:   { color: Colors.white,  fontSize: 13, marginTop: 2 },
  aviosBannerCta:   { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 6 },
  aviosBannerStar:  { fontSize: 40 },

  // Voice FAB
  voiceFab: {
    position: 'absolute', right: 20,
    width: 60, height: 60,
    borderRadius: 30,
    ...Shadows.lg,
    zIndex: 100,
  },
  voiceFabInner: {
    flex: 1, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
});
