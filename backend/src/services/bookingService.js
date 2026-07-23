/**
 * Booking service — MOCK implementation.
 * Amadeus flight-order creation is skipped entirely.
 * All bookings are persisted to the in-memory store only.
 */

const logger = require('../config/logger');
const { BookingStore, generateRef } = require('../models/inMemoryStore');
const { UserStore } = require('../models/inMemoryStore');

const CABIN_MAP = {
  ECONOMY: 'Economy',
  PREMIUM_ECONOMY: 'Premium Economy',
  BUSINESS: 'Business Class',
  FIRST: 'First Class',
};

/**
 * Pull itinerary/segment info out of either a raw Amadeus offer shape
 * or our internal mock offer shape. Throws instead of silently
 * defaulting to fake values when required fields are missing.
 */
function extractOfferDetails(flightOffer) {
  if (!flightOffer || typeof flightOffer !== 'object') {
    throw new Error('createBooking: flightOffer is required');
  }

  const itinerary =
    flightOffer.itineraries?.[0] || flightOffer.rawOffer?.itineraries?.[0] || null;
  const segments = itinerary?.segments || [];
  const segment = segments[0] || null;
  const lastSeg = segments.slice(-1)[0] || null;

  // Flight number: prefer explicit field, else derive from segment
  let flightNumber = flightOffer.flightNumber;
  if (!flightNumber && segment?.carrierCode && segment?.number) {
    flightNumber = `${segment.carrierCode}${segment.number}`;
  }
  if (!flightNumber) {
    throw new Error('createBooking: unable to determine flight number from offer');
  }

  const from = flightOffer.from || segment?.departure?.iataCode;
  const to = flightOffer.to || lastSeg?.arrival?.iataCode;
  if (!from || !to) {
    throw new Error('createBooking: unable to determine origin/destination from offer');
  }

  const departure = segment?.departure?.at || null;
  const arrival = lastSeg?.arrival?.at || null;
  if (!departure || !arrival) {
    logger.warn('[bookingService] Missing departure/arrival timestamps on offer', {
      offerId: flightOffer.id,
    });
  }

  const rawCabin =
    flightOffer.rawOffer?.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin ||
    flightOffer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin;
  const cabin = CABIN_MAP[rawCabin] || 'Economy';

  const rawPrice =
    flightOffer.price?.grandTotal ??
    flightOffer.prices?.economy ??
    flightOffer.rawOffer?.price?.grandTotal;
  const price = parseFloat(rawPrice);
  if (Number.isNaN(price) || price <= 0) {
    throw new Error('createBooking: unable to determine a valid price from offer');
  }

  const currency = flightOffer.price?.currency || 'GBP';

  return { flightNumber, from, to, departure, arrival, cabin, price, currency };
}

/**
 * Create a confirmed booking — no Amadeus call.
 */
async function createBooking({ flightOffer, travelers, contacts, userEmail }) {
  logger.info('[MOCK] Creating booking', { userEmail, offerId: flightOffer?.id });

  if (!Array.isArray(travelers) || travelers.length === 0) {
    throw new Error('createBooking: at least one traveler is required');
  }

  const details = extractOfferDetails(flightOffer);
  const traveler = travelers[0] || {};
  const reference = generateRef();

  const booking = BookingStore.create({
    reference,
    amadeusOrderId: null, // no Amadeus order in mock mode
    status: 'confirmed',
    userEmail,
    passenger: {
      firstName: traveler.name?.firstName || traveler.firstName || '',
      lastName: traveler.name?.lastName || traveler.lastName || '',
      email: contacts?.[0]?.emailAddress || traveler.contact?.emailAddress || userEmail || '',
      phone: contacts?.[0]?.phones?.[0]?.number || traveler.contact?.phones?.[0]?.number || '',
      dob: traveler.dateOfBirth || '',
      passport: traveler.documents?.[0]?.number || '',
    },
    outbound: {
      flightNumber: details.flightNumber,
      from: details.from,
      to: details.to,
      departure: details.departure || new Date().toISOString(),
      arrival: details.arrival || new Date().toISOString(),
      cabin: details.cabin,
      seat: null,
      gate: null,
    },
    inbound: null,
    passengers: travelers.length,
    totalPaid: Math.round(details.price * travelers.length * 1.12 * 100) / 100,
    currency: details.currency,
    bags: { checked: 0, cabin: 1 },
    checkedIn: false,
    boardingPass: null,
    aviosEarned: Math.round(details.price * 1.5),
    flightOfferId: flightOffer?.id,
  });

  // Credit Avios to user account — only when a valid email is present
  if (userEmail && typeof userEmail === 'string' && userEmail.includes('@')) {
    try {
      UserStore.updateAvios(userEmail, booking.aviosEarned);
    } catch (aviosErr) {
      logger.warn('[bookingService] Could not credit Avios', {
        userEmail,
        error: aviosErr.message,
      });
    }
  }

  logger.info('[MOCK] Booking created', { reference });
  return booking;
}

/** Retrieve a booking by reference + surname validation. */
function getBooking(reference, surname) {
  if (!reference || !surname) {
    throw new Error('getBooking: reference and surname are required');
  }
  const booking = BookingStore.findByRef(reference);
  if (!booking) return null;
  const stored = booking.passenger?.lastName || '';
  if (stored.toLowerCase() !== surname.toLowerCase()) return null;
  return booking;
}

/** Get all bookings for an authenticated user. */
function getUserBookings(email) {
  if (!email) {
    throw new Error('getUserBookings: email is required');
  }
  return BookingStore.findByUser(email);
}

/** Update a booking (seats, bags, status). */
function updateBooking(reference, updates) {
  if (!reference) {
    throw new Error('updateBooking: reference is required');
  }
  const booking = BookingStore.findByRef(reference);
  if (!booking) {
    throw new Error(`updateBooking: no booking found for reference ${reference}`);
  }
  return BookingStore.update(reference, updates);
}

/** Cancel a booking — local only, no Amadeus call. */
async function cancelBooking(reference, userEmail) {
  if (!reference || !userEmail) {
    throw new Error('cancelBooking: reference and userEmail are required');
  }
  const booking = BookingStore.findByRef(reference);
  if (!booking) return null;
  if (booking.userEmail !== userEmail) throw new Error('Unauthorized');
  return BookingStore.update(reference, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  });
}

module.exports = { createBooking, getBooking, getUserBookings, updateBooking, cancelBooking };