/**
 * Global app state — React Native port of the web AppContext.
 *
 * Key difference: localStorage → AsyncStorage (async reads/writes).
 * Everything else (reducer shape, actions, API rehydration) is identical.
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

const AppContext = createContext(null);

const initialState = {
  user: null,
  isAuthenticated: false,
  bookings: [],
  searchParams: {
    tripType: 'return',
    from: '',
    to: '',
    departDate: null,
    returnDate: null,
    adults: 1,
    children: 0,
    infants: 0,
    cabin: 'economy',
  },
  selectedFlight: null,
  notifications: [],
};

function appReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload };
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
        bookings: state.bookings.map((b) =>
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
        notifications: state.notifications.filter((n) => n.id !== action.payload),
      };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // ── Hydrate state from AsyncStorage on mount ──────────────────
  useEffect(() => {
    (async () => {
      try {
        const [savedUser, savedBookings] = await Promise.all([
          AsyncStorage.getItem('ba_user'),
          AsyncStorage.getItem('ba_bookings'),
        ]);
        dispatch({
          type: 'HYDRATE',
          payload: {
            user: savedUser ? JSON.parse(savedUser) : null,
            isAuthenticated: !!savedUser,
            bookings: savedBookings ? JSON.parse(savedBookings) : [],
          },
        });
      } catch {
        // ignore parse errors
      }
    })();
  }, []);

  // ── Rehydrate user from API token ─────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('ba_token');
        if (!token || state.user) return;
        const user = await authAPI.getMe();
        dispatch({ type: 'LOGIN', payload: user });
      } catch {
        await AsyncStorage.multiRemove(['ba_token', 'ba_user']);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist user ──────────────────────────────────────────────
  useEffect(() => {
    if (state.user) {
      AsyncStorage.setItem('ba_user', JSON.stringify(state.user)).catch(() => {});
    } else {
      AsyncStorage.removeItem('ba_user').catch(() => {});
    }
  }, [state.user]);

  // ── Persist bookings ──────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.setItem('ba_bookings', JSON.stringify(state.bookings)).catch(() => {});
  }, [state.bookings]);

  // ── Actions ───────────────────────────────────────────────────
  const login = async (userData, token) => {
    if (token) await AsyncStorage.setItem('ba_token', token);
    dispatch({ type: 'LOGIN', payload: userData });
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['ba_token', 'ba_user']);
    dispatch({ type: 'LOGOUT' });
  };

  const setSearchParams     = (p)  => dispatch({ type: 'SET_SEARCH_PARAMS',  payload: p });
  const setSelectedFlight   = (f)  => dispatch({ type: 'SET_SELECTED_FLIGHT', payload: f });
  const addBooking          = (b)  => dispatch({ type: 'ADD_BOOKING',         payload: b });
  const updateBooking       = (b)  => dispatch({ type: 'UPDATE_BOOKING',      payload: b });
  const setBookings         = (bs) => dispatch({ type: 'SET_BOOKINGS',        payload: bs });
  const addNotification     = (n)  => dispatch({ type: 'ADD_NOTIFICATION',    payload: n });
  const dismissNotification = (id) => dispatch({ type: 'DISMISS_NOTIFICATION', payload: id });

  return (
    <AppContext.Provider
      value={{
        ...state,
        login,
        logout,
        setSearchParams,
        setSelectedFlight,
        addBooking,
        updateBooking,
        setBookings,
        addNotification,
        dismissNotification,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
