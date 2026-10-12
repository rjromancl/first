import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../services/api';

const AppContext = createContext(null);

const initialState = {
  user: null,
  isAuthenticated: false,
  language: 'en-GB',
  bookings: [],
  searchParams: {
    tripType: 'return', from: '', to: '',
    departDate: null, returnDate: null,
    adults: 1, children: 0, infants: 0, cabin: 'economy',
  },
  selectedFlight: null,
  notifications: [],
  voiceAgentOpen: false,
  bookingSource: null,   // 'voice' | 'normal' | null
  bookingStartedAt: null, // ISO timestamp when booking page was entered
};

function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.payload, isAuthenticated: true };
    case 'SET_LANGUAGE':
      return { ...state, language: action.payload };
    case 'UPDATE_USER':
      return { ...state, user: { ...state.user, ...action.payload } };
    case 'LOGOUT':
      return { ...state, user: null, isAuthenticated: false, bookings: [] };
    case 'SET_BOOKING_SOURCE':
      return { ...state, bookingSource: action.payload.source, bookingStartedAt: action.payload.startedAt || new Date().toISOString() };
    case 'CLEAR_BOOKING_SOURCE':
      return { ...state, bookingSource: null, bookingStartedAt: null };
    case 'SET_SEARCH_PARAMS':
      return { ...state, searchParams: { ...state.searchParams, ...action.payload } };
    case 'SET_SELECTED_FLIGHT':
      return { ...state, selectedFlight: action.payload };
    case 'ADD_BOOKING':
      return { ...state, bookings: [...state.bookings, action.payload] };
    case 'UPDATE_BOOKING':
      return { ...state, bookings: state.bookings.map(b => b.id === action.payload.id ? { ...b, ...action.payload } : b) };
    case 'SET_BOOKINGS':
      return { ...state, bookings: action.payload };
    case 'ADD_NOTIFICATION':
      return { ...state, notifications: [{ id: Date.now(), ...action.payload }, ...state.notifications] };
    case 'DISMISS_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter(n => n.id !== action.payload) };
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

function loadInitialState() {
  try {
    // Clear any stale persisted data from previous sessions
    localStorage.removeItem('ba_user');
    localStorage.removeItem('ba_bookings');

    // Only restore language preference
    const savedLang  = localStorage.getItem('ba_lang');
    return {
      ...initialState,
      language: savedLang || 'en-GB',
    };
  } catch {
    return initialState;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, loadInitialState);

  // ── Only persist language preference ────────────────────────
  useEffect(() => {
    localStorage.setItem('ba_lang', state.language || 'en-GB');
  }, [state.language]);

  // ── Rehydrate user from API token on app load ─────────────────
  // Only runs if a token exists — won't pre-fill static user data
  useEffect(() => {
    const token = localStorage.getItem('ba_token');
    if (!token) return;
    authAPI.getMe()
      .then(user => dispatch({ type: 'LOGIN', payload: user }))
      .catch(() => {
        localStorage.removeItem('ba_token');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────
  const setLanguage = lang => dispatch({ type: 'SET_LANGUAGE', payload: lang });
  const updateUser  = data => dispatch({ type: 'UPDATE_USER',  payload: data });
  const login = (userData, token) => {
    if (token) localStorage.setItem('ba_token', token);
    // Don't persist user object — only the token
    dispatch({ type: 'LOGIN', payload: userData });
  };
  const logout = () => {
    localStorage.removeItem('ba_token');
    dispatch({ type: 'LOGOUT' });
  };
  const setSearchParams     = p  => dispatch({ type: 'SET_SEARCH_PARAMS',  payload: p });
  const setBookingSource    = (source) => dispatch({ type: 'SET_BOOKING_SOURCE', payload: { source, startedAt: new Date().toISOString() } });
  const clearBookingSource  = ()       => dispatch({ type: 'CLEAR_BOOKING_SOURCE' });
  const setSelectedFlight   = f  => dispatch({ type: 'SET_SELECTED_FLIGHT', payload: f });
  const addBooking          = b  => dispatch({ type: 'ADD_BOOKING',         payload: b });
  const updateBooking       = b  => dispatch({ type: 'UPDATE_BOOKING',      payload: b });
  const setBookings         = bs => dispatch({ type: 'SET_BOOKINGS',        payload: bs });
  const addNotification     = n  => dispatch({ type: 'ADD_NOTIFICATION',    payload: n });
  const dismissNotification = id => dispatch({ type: 'DISMISS_NOTIFICATION', payload: id });
  const toggleVoiceAgent    = () => dispatch({ type: 'TOGGLE_VOICE_AGENT' });
  const openVoiceAgent      = () => dispatch({ type: 'OPEN_VOICE_AGENT' });
  const closeVoiceAgent     = () => dispatch({ type: 'CLOSE_VOICE_AGENT' });

  return (
    <AppContext.Provider value={{
      ...state,
      setLanguage, login, logout, updateUser,
      setSearchParams, setSelectedFlight,
      setBookingSource, clearBookingSource,
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
