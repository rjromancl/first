/**
 * Airport autocomplete input.
 * Calls the backend /airports endpoint (debounced 300 ms) and shows
 * a dropdown of suggestions beneath the text field.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { airportsAPI } from '../services/api';
import { colors, spacing, radius, shadow, input as inputStyle } from '../theme';

function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback(
    (...args) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay]
  );
}

export default function AirportInput({ label, value, onSelect, placeholder = 'City or airport code' }) {
  const [query, setQuery]           = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [open, setOpen]             = useState(false);

  const fetchAirports = useCallback(async (q) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const results = await airportsAPI.search(q);
      setSuggestions(results || []);
      setOpen(true);
    } catch {
      setSuggestions([]);
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
    const display = `${airport.iataCode} — ${airport.name}`;
    setQuery(display);
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
        <Ionicons name="location-outline" size={16} color={colors.textLight} style={styles.icon} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.blue} style={styles.trailing} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={handleClear} style={styles.trailing}>
            <Ionicons name="close-circle" size={18} color={colors.textLight} />
          </TouchableOpacity>
        ) : null}
      </View>

      {open && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.iataCode}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={suggestions.length > 4}
            style={{ maxHeight: 200 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggestion} onPress={() => handleSelect(item)}>
                <Text style={styles.suggestionCode}>{item.iataCode}</Text>
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.suggestionCity} numberOfLines={1}>
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
  wrapper: {
    marginBottom: spacing.md,
    zIndex: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  icon: {
    marginRight: 6,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  trailing: {
    paddingLeft: spacing.sm,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    marginTop: 4,
    ...shadow.lg,
    zIndex: 999,
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.sm,
  },
  suggestionCode: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.blue,
    width: 36,
  },
  suggestionInfo: { flex: 1 },
  suggestionName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  suggestionCity: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 1,
  },
  sep: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
});
