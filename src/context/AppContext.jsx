import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authAPI } from '../services/api';

const AppContext = createContext(null);

const initialState = {
  user: null,
  isAuthenticated: false,
  bookings: [],
  searchParams: {
    tripType: 'return', from: '', to: '',
    departDate: null, returnDate: null,
    adults: 1, children: 0, infants: 0, cabin: 'economy',
  },
  selectedFlight: null,
  notifications: [],
  voiceAgentOpen: false,
};

function appReducer(state, action) {
  switch (action.type) {
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
    const savedUser     = localStorage.getItem('ba_user');
    const savedBookings = localStorage.getItem('ba_bookings');
    return {
      ...initialState,
      user:            savedUser     ? JSON.parse(savedUser)     : null,
      isAuthenticated: !!savedUser,
      bookings:        savedBookings ? JSON.parse(savedBookings) : [],
    };
  } catch {
    return initialState;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, undefined, loadInitialState);

  // ── Persist user + bookings to localStorage ──────────────────
  useEffect(() => {
    if (state.user) localStorage.setItem('ba_user', JSON.stringify(state.user));
    else            localStorage.removeItem('ba_user');
  }, [state.user]);

  useEffect(() => {
    localStorage.setItem('ba_bookings', JSON.stringify(state.bookings));
  }, [state.bookings]);

  // ── Rehydrate user from API token on app load ─────────────────
  useEffect(() => {
    const token = localStorage.getItem('ba_token');
    if (!token || state.user) return;
    authAPI.getMe()
      .then(user => dispatch({ type: 'LOGIN', payload: user }))
      .catch(() => {
        localStorage.removeItem('ba_token');
        localStorage.removeItem('ba_user');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────
  const login = (userData, token) => {
    if (token) localStorage.setItem('ba_token', token);
    dispatch({ type: 'LOGIN', payload: userData });
  };
  const logout = () => {
    localStorage.removeItem('ba_token');
    localStorage.removeItem('ba_user');
    dispatch({ type: 'LOGOUT' });
  };
  const setSearchParams     = p  => dispatch({ type: 'SET_SEARCH_PARAMS',  payload: p });
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
      login, logout,
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
