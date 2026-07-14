/**
 * Central API service layer — React Native port.
 *
 * Mirrors the web app's api.jsx exactly, but:
 *  - Uses AsyncStorage instead of localStorage for the JWT token
 *  - Base URL comes from EXPO_PUBLIC_API_URL (set in .env)
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

// ── Axios instance ────────────────────────────────────────────────
const http = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: attach JWT if present ────────────────────
http.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('ba_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // ignore storage errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: unwrap response / normalise errors ──────
http.interceptors.response.use(
  (response) => response.data,
  (err) => {
    const message =
      err.response?.data?.error?.message ||
      err.response?.data?.message ||
      err.message ||
      'Something went wrong';

    const apiError = new Error(message);
    apiError.statusCode = err.response?.status || 0;
    apiError.details = err.response?.data?.error?.details || null;

    return Promise.reject(apiError);
  }
);

// Helper to unwrap { success, data }
const unwrap = (promise) => promise.then((res) => res.data);

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════
export const authAPI = {
  login: (email, password) =>
    unwrap(http.post('/auth/login', { email, password })),

  register: (firstName, lastName, email, password) =>
    unwrap(
      http.post('/auth/register', { firstName, lastName, email, password })
    ),

  getMe: () => unwrap(http.get('/auth/me')),
};

// ════════════════════════════════════════════════════════════════
// FLIGHTS
// ════════════════════════════════════════════════════════════════
export const flightsAPI = {
  search: ({ from, to, departureDate, returnDate, adults = 1, cabin = 'ECONOMY', nonStop = false }) =>
    unwrap(
      http.get('/flights/search', {
        params: {
          from,
          to,
          departureDate,
          ...(returnDate ? { returnDate } : {}),
          adults,
          cabin: cabin.toUpperCase(),
          nonStop,
        },
      })
    ),

  confirmPrice: (flightOffer) =>
    unwrap(http.post('/flights/confirm-price', { flightOffer })),

  getStatus: ({ flightNumber, from, to, date }) =>
    unwrap(
      http.get('/flights/status', {
        params: {
          ...(flightNumber ? { flightNumber } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(date ? { date } : {}),
        },
      })
    ),
};

// ════════════════════════════════════════════════════════════════
// AIRPORTS
// ════════════════════════════════════════════════════════════════
export const airportsAPI = {
  search: (q, type) =>
    unwrap(
      http.get('/airports', {
        params: { q, ...(type ? { type } : {}) },
      })
    ),

  getAll: () => unwrap(http.get('/airports/all')),
};

// ════════════════════════════════════════════════════════════════
// BOOKINGS
// ════════════════════════════════════════════════════════════════
export const bookingsAPI = {
  create: (flightOffer, travelers, contacts = []) =>
    unwrap(http.post('/bookings', { flightOffer, travelers, contacts })),

  retrieve: (reference, surname) =>
    unwrap(http.get(`/bookings/${reference}`, { params: { surname } })),

  listMine: () => unwrap(http.get('/bookings/mine')),

  update: (reference, updates) =>
    unwrap(http.patch(`/bookings/${reference}`, updates)),

  selectSeat: (reference, seat, segment = 'outbound') =>
    unwrap(http.patch(`/bookings/${reference}/seat`, { seat, segment })),

  updateBags: (reference, checked, cabin) =>
    unwrap(http.patch(`/bookings/${reference}/bags`, { checked, cabin })),

  cancel: (reference) => unwrap(http.delete(`/bookings/${reference}`)),
};

// ════════════════════════════════════════════════════════════════
// CHECK-IN
// ════════════════════════════════════════════════════════════════
export const checkinAPI = {
  checkIn: (reference, surname) =>
    unwrap(http.post('/checkin', { reference, surname })),
};

// ════════════════════════════════════════════════════════════════
// DESTINATIONS & OFFERS
// ════════════════════════════════════════════════════════════════
export const destinationsAPI = {
  list: (params = {}) => unwrap(http.get('/destinations', { params })),
  getOne: (code) => unwrap(http.get(`/destinations/${code}`)),
  getOffers: (params = {}) => unwrap(http.get('/offers', { params })),
};

// ════════════════════════════════════════════════════════════════
// AVIOS / EXECUTIVE CLUB
// ════════════════════════════════════════════════════════════════
export const aviosAPI = {
  calculate: (from, to, cabin = 'economy') =>
    unwrap(http.get('/avios/calculate', { params: { from, to, cabin } })),

  getBalance: () => unwrap(http.get('/avios/balance')),
};

// ════════════════════════════════════════════════════════════════
// HEALTH
// ════════════════════════════════════════════════════════════════
export const healthAPI = {
  check: () => http.get('/health'),
};

export default http;
