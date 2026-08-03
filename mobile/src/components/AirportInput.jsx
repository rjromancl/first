/**
 * AirportInput — live autocomplete airport search.
 * Calls /api/airports with 300ms debounce, shows a dropdown.
 * Falls back to mock IATA list if API is unreachable.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { airportsAPI } from '../services/api';
import Colors from '../theme/colors';
import { BorderRadius, Spacing, Shadows } from '../theme/spacing';

// Offline fallback — the 6 routes we serve
const MOCK_AIRPORTS = [
  { iataCode: 'LHR', name: 'Heathrow Airport',    cityName: 'London',    countryCode: 'GB' },
  { iataCode: 'JFK', name: 'John F. Kennedy Intl', cityName: 'New York',  countryCode: 'US' },
  { iataCode: 'DXB', name: 'Dubai International',  cityName: 'Dubai',     countryCode: 'AE' },
  { iataCode: 'NRT', name: 'Narita International', cityName: 'Tokyo',     countryCode: 'JP' },
  { iataCode: 'SYD', name: 'Kingsford Smith',      cityName: 'Sydney',    countryCode: 'AU' },
  { iataCode: 'BCN', name: 'El Prat Airport',      cityName: 'Barcelona', countryCode: 'ES' },
  { iataCode: 'BOM', name: 'Chhatrapati Shivaji',  cityName: 'Mumbai',    countryCode: 'IN' },
];

function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function AirportInput({ label, value, onSelect, placeholder = 'City or IATA code' }) {
  const [query,       setQuery]       = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);

  const fetchAirports = useCallback(async (q) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const results = await airportsAPI.search(q);
      setSuggestions(results?.slice(0, 6) || []);
      setOpen(true);
    } catch {
      // Offline fallback
      const filtered = MOCK_AIRPORTS.filter(a =>
        a.iataCode.toLowerCase().includes(q.toLowerCase()) ||
        a.cityName.toLowerCase().includes(q.toLowerCase()) ||
        a.name.toLowerCase().includes(q.toLowerCase())
      );
      setSuggestions(filtered);
      setOpen(filtered.length > 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedFetch = useDebounce(fetchAirports, 300);

  const handleChange = (text) => {
    setQuery(text);
    debouncedFetch(text);
  };

  const handleSelect = (airport) => {
    setQuery(`${airport.iataCode} — ${airport.cityName}`);
    setSuggestions([]);
    setOpen(false);
    onSelect(airport.iataCode, airport);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    onSelect('', null);
  };

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.inputRow}>
        <Ionicons name="location-outline" size={16} color={Colors.midGrey} style={styles.icon} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.midGrey}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {loading ? (
          <ActivityIndicator size="small" color={Colors.blue} style={styles.trailing} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={handleClear} style={styles.trailing}>
            <Ionicons name="close-circle" size={18} color={Colors.midGrey} />
          </TouchableOpacity>
        ) : null}
      </View>

      {open && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={item => item.iataCode}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={suggestions.length > 4}
            style={{ maxHeight: 200 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggestion} onPress={() => handleSelect(item)}>
                <Text style={styles.suggCode}>{item.iataCode}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.suggCity} numberOfLines={1}>
                    {item.cityName}{item.countryCode ? `, ${item.countryCode}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md, zIndex: 10 },
  label: {
    fontSize: 12, fontWeight: '600',
    color: Colors.darkGrey, marginBottom: 6, letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.offWhite,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5, borderColor: Colors.lightGrey,
    paddingHorizontal: Spacing.sm,
  },
  icon:     { marginRight: 6 },
  input:    { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.charcoal },
  trailing: { paddingLeft: Spacing.sm },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    marginTop: 4, zIndex: 999,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  suggestion: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 10, gap: Spacing.sm,
  },
  suggCode: { fontSize: 14, fontWeight: '800', color: Colors.blue, width: 36 },
  suggName: { fontSize: 13, fontWeight: '600', color: Colors.charcoal },
  suggCity: { fontSize: 11, color: Colors.midGrey, marginTop: 1 },
  sep:      { height: 1, backgroundColor: Colors.lightGrey, marginHorizontal: Spacing.md },
});
