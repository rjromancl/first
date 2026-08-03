import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import BAHeader from '../components/BAHeader';
import Colors from '../theme/colors';
import { Spacing, BorderRadius, Shadows } from '../theme/spacing';
import { DESTINATIONS } from '../utils/mockData';

const { width } = Dimensions.get('window');

export default function DestinationsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handleBook = (dest) => {
    navigation.navigate('Book', {
      screen: 'FlightSearch',
      params: { prefillTo: dest.code, prefillCity: dest.city },
    });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleBook(item)} activeOpacity={0.9}>
      <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />

      <View style={styles.cardContent}>
        <Text style={styles.cardEmoji}>{item.emoji}</Text>
        <Text style={styles.cardCity}>{item.city}</Text>
        <Text style={styles.cardCountry}>{item.country} · {item.flightTime}</Text>

        <View style={styles.cardHighlights}>
          {item.highlights.slice(0, 2).map(h => (
            <View key={h} style={styles.highlight}>
              <Text style={styles.highlightText}>{h}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.cardPrice}>From £{item.avgPrice}</Text>
          <View style={styles.bookBadge}>
            <Text style={styles.bookBadgeText}>Book Now</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <BAHeader title="Destinations" />
      <FlatList
        data={DESTINATIONS}
        keyExtractor={i => i.code}
        renderItem={renderItem}
        contentContainerStyle={{ padding: Spacing.screen, paddingBottom: insets.bottom + 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.intro}>
            British Airways flies to over 200 destinations worldwide. Explore our most popular routes.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  intro: { fontSize: 14, color: Colors.darkGrey, marginBottom: 16, lineHeight: 20 },

  card: {
    height: 220, borderRadius: BorderRadius.xl,
    overflow: 'hidden', ...Shadows.md, backgroundColor: Colors.midGrey,
  },
  cardImage: { ...StyleSheet.absoluteFillObject },
  cardContent: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16,
  },
  cardEmoji:   { fontSize: 24, marginBottom: 4 },
  cardCity:    { color: Colors.white, fontSize: 24, fontWeight: '800' },
  cardCountry: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 8 },

  cardHighlights: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  highlight: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  highlightText: { color: Colors.white, fontSize: 11, fontWeight: '500' },

  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice:  { color: Colors.baGold, fontSize: 18, fontWeight: '800' },
  bookBadge: {
    backgroundColor: Colors.white, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  bookBadgeText: { color: Colors.darkBlue, fontSize: 13, fontWeight: '700' },
});
