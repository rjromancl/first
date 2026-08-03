/**
 * AppContext — global state for the British Airways mobile app.
 *
 * Replaces localStorage with:
 *  - AsyncStorage  : non-sensitive data (user profile, bookings, language)
 *  - SecureStore   : JWT token
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../services/api';

const AppContext = createContext(null);

// ── Keys ────────────────────────────────────────────────────────
const KEYS = {
  USER:     'ba_user',
  BOOKINGS: 'ba_bookings',
  LANG:     'ba_lang',
  TOKEN:    'ba_token',
};

// ── Initial State ───────────────────────────────────────────────
const initialState = {
  user:            null,
  isAuthenticated: false,
  language:        'en-GB',
  bookings:        [],
  searchParams: {
    tripType:    'return',
    from:        '',
    to:          '',
    departDate:  null,
    returnDate:  null,
    adults:      1,
    children:    0,
    infants:     0,
    cabin:       'economy',
  },
  selectedFlight:  null,
  notifications:   [],
  voiceAgentOpen:  false,
  loading:         true,   // true until AsyncStorage rehydration finishes
};

// ── Reducer ─────────────────────────────────────────────────────
function appReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload, loading: false };
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };
    case 'LOGIN':
      return { ...state, user: action.payload, isAuthenticated: true };
    case 'LOGOUT':
      return { ...state, user: null, isAuthenticated: false, bookings: [] };
    case 'SET_SEARCH_PARAMS':
      return { ...state, searchParams: { ...state.searchParams, ...action.payload } };
    case 'SET_SELECTED_FLIGHT':
      return { ...state, selectedFlight: action.payload };
    case 'ADD_BOOKING':
      return { ...state, bookings: [...state.bookings, action.payload] };
    case 'UPDATE_BOOKING':
      return {
        ...state,
        bookings: state.bookings.map(b =>
          b.id === action.payload.id ? { ...b, ...action.payload } : b
        ),
      };
    case 'SET_BOOKINGS':
      return { ...state, bookings: action.payload };
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [{ id: Date.now(), ...action.payload }, ...state.notifications],
      };
    case 'DISMISS_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };
    case 'TOGGLE_VOICE_AGENT':
      return { ...state, voiceAgentOpen: !state.voiceAgentOpen };
    case 'OPEN_VOICE_AGENT':
      return { ...state, voiceAgentOpen: true };
    case 'CLOSE_VOICE_AGENT':
      return { ...state, voiceAgentOpen: false };
    default:
      return state;
  }
}

// ── Provider ────────────────────────────────────────────────────
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Rehydrate from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const [userRaw, bookingsRaw, lang, token] = await Promise.all([
          AsyncStorage.getItem(KEYS.USER),
          AsyncStorage.getItem(KEYS.BOOKINGS),
          AsyncStorage.getItem(KEYS.LANG),
          SecureStore.getItemAsync(KEYS.TOKEN),
        ]);

        const user     = userRaw     ? JSON.parse(userRaw)     : null;
        const bookings = bookingsRaw ? JSON.parse(bookingsRaw) : [];

        dispatch({
          type: 'HYDRATE',
          payload: {
            user,
            isAuthenticated: !!user,
            bookings,
            language: lang || 'en-GB',
          },
        });

        // If we have a token but no user profile yet, fetch from API
        if (token && !user) {
          try {
            const fetchedUser = await authAPI.getMe();
            dispatch({ type: 'LOGIN', payload: fetchedUser });
          } catch {
            await SecureStore.deleteItemAsync(KEYS.TOKEN);
          }
        }
      } catch {
        dispatch({ type: 'HYDRATE', payload: {} });
      }
    })();
  }, []);

  // Persist user
  useEffect(() => {
    if (state.loading) return;
    if (state.user) {
      AsyncStorage.setItem(KEYS.USER, JSON.stringify(state.user));
    } else {
      AsyncStorage.removeItem(KEYS.USER);
    }
  }, [state.user, state.loading]);

  // Persist bookings
  useEffect(() => {
    if (state.loading) return;
    AsyncStorage.setItem(KEYS.BOOKINGS, JSON.stringify(state.bookings));
  }, [state.bookings, state.loading]);

  // Persist language
  useEffect(() => {
    if (state.loading) return;
    AsyncStorage.setItem(KEYS.LANG, state.language);
  }, [state.language, state.loading]);

  // ── Actions ───────────────────────────────────────────────────
  const setLanguage    = useCallback(lang => dispatch({ type: 'SET_LANGUAGE', payload: lang }), []);

  const login = useCallback(async (userData, token) => {
    if (token) await SecureStore.setItemAsync(KEYS.TOKEN, token);
    dispatch({ type: 'LOGIN', payload: userData });
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(KEYS.TOKEN);
    await AsyncStorage.multiRemove([KEYS.USER, KEYS.BOOKINGS]);
    dispatch({ type: 'LOGOUT' });
  }, []);

  const setSearchParams     = useCallback(p  => dispatch({ type: 'SET_SEARCH_PARAMS',  payload: p  }), []);
  const setSelectedFlight   = useCallback(f  => dispatch({ type: 'SET_SELECTED_FLIGHT', payload: f  }), []);
  const addBooking          = useCallback(b  => dispatch({ type: 'ADD_BOOKING',         payload: b  }), []);
  const updateBooking       = useCallback(b  => dispatch({ type: 'UPDATE_BOOKING',      payload: b  }), []);
  const setBookings         = useCallback(bs => dispatch({ type: 'SET_BOOKINGS',        payload: bs }), []);
  const addNotification     = useCallback(n  => dispatch({ type: 'ADD_NOTIFICATION',    payload: n  }), []);
  const dismissNotification = useCallback(id => dispatch({ type: 'DISMISS_NOTIFICATION', payload: id }), []);
  const toggleVoiceAgent    = useCallback(() => dispatch({ type: 'TOGGLE_VOICE_AGENT' }), []);
  const openVoiceAgent      = useCallback(() => dispatch({ type: 'OPEN_VOICE_AGENT'  }), []);
  const closeVoiceAgent     = useCallback(() => dispatch({ type: 'CLOSE_VOICE_AGENT' }), []);

  return (
    <AppContext.Provider value={{
      ...state,
      setLanguage, login, logout,
      setSearchParams, setSelectedFlight,
      addBooking, updateBooking, setBookings,
      addNotification, dismissNotification,
      toggleVoiceAgent, openVoiceAgent, closeVoiceAgent,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
