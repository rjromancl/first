/**
 * Booking service — MOCK implementation.
 * Amadeus flight-order creation is skipped entirely.
 * All bookings are persisted to the in-memory store only.
 */

const logger = require('../config/logger');
const { BookingStore, generateRef } = require('../models/inMemoryStore');
const { UserStore } = require('../models/inMemoryStore');

/**
 * Create a confirmed booking — no Amadeus call.
 */
async function createBooking({ flightOffer, travelers, contacts, userEmail }) {
  logger.info('[MOCK] Creating booking', { userEmail, offerId: flightOffer?.id });

  const reference = generateRef();
  const traveler  = travelers[0] || {};

  // Extract segment info from either a raw Amadeus offer shape or our mock shape
  const itinerary = flightOffer?.itineraries?.[0] || flightOffer?.rawOffer?.itineraries?.[0];
  const segment   = itinerary?.segments?.[0] || {};
  const lastSeg   = itinerary?.segments?.slice(-1)[0] || {};

  const cabinMap  = {
    ECONOMY: 'Economy', PREMIUM_ECONOMY: 'Premium Economy',
    BUSINESS: 'Business Class', FIRST: 'First Class',
  };
  const rawCabin  =
    flightOffer?.rawOffer?.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin ||
    flightOffer?.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin;
  const cabin     = cabinMap[rawCabin] || 'Economy';

  const price = parseFloat(
    flightOffer?.price?.grandTotal ||
    flightOffer?.prices?.economy   ||
    flightOffer?.rawOffer?.price?.grandTotal ||
    0
  );

  const booking = BookingStore.create({
    reference,
    amadeusOrderId: null,        // no Amadeus order in mock mode
    status: 'confirmed',
    userEmail,
    passenger: {
      firstName: traveler.name?.firstName || traveler.firstName || '',
      lastName:  traveler.name?.lastName  || traveler.lastName  || '',
      email:     contacts?.[0]?.emailAddress || traveler.contact?.emailAddress || userEmail || '',
      phone:     contacts?.[0]?.phones?.[0]?.number || traveler.contact?.phones?.[0]?.number || '',
      dob:       traveler.dateOfBirth || '',
      passport:  traveler.documents?.[0]?.number || '',
    },
    outbound: {
      flightNumber: flightOffer?.flightNumber || (segment.carrierCode + segment.number) || 'BA000',
      from:         flightOffer?.from || segment.departure?.iataCode || 'LHR',
      to:           flightOffer?.to   || lastSeg.arrival?.iataCode  || 'JFK',
      departure:    segment.departure?.at || new Date().toISOString(),
      arrival:      lastSeg.arrival?.at   || new Date().toISOString(),
      cabin,
      seat: null,
      gate: null,
    },
    inbound:    null,
    passengers: travelers.length,
    totalPaid:  Math.round(price * travelers.length * 1.12 * 100) / 100,
    currency:   flightOffer?.price?.currency || 'GBP',
    bags:       { checked: 0, cabin: 1 },
    checkedIn:  false,
    boardingPass: null,
    aviosEarned:  Math.round(price * 1.5),
    flightOfferId: flightOffer?.id,
  });

  // Credit Avios to user account — only when a valid email is present
  if (userEmail && typeof userEmail === 'string' && userEmail.includes('@')) {
    try {
      UserStore.updateAvios(userEmail, booking.aviosEarned);
    } catch (aviosErr) {
      logger.warn('[bookingService] Could not credit Avios', { userEmail, error: aviosErr.message });
    }
  }

  logger.info('[MOCK] Booking created', { reference });
  return booking;
}

/** Retrieve a booking by reference + surname validation. */
function getBooking(reference, surname) {
  const booking = BookingStore.findByRef(reference);
  if (!booking) return null;
  const stored = booking.passenger?.lastName || '';
  if (stored.toLowerCase() !== surname.toLowerCase()) return null;
  return booking;
}

/** Get all bookings for an authenticated user. */
function getUserBookings(email) {
  return BookingStore.findByUser(email);
}

/** Update a booking (seats, bags, status). */
function updateBooking(reference, updates) {
  return BookingStore.update(reference, updates);
}

/** Cancel a booking — local only, no Amadeus call. */
async function cancelBooking(reference, userEmail) {
  const booking = BookingStore.findByRef(reference);
  if (!booking) return null;
  if (booking.userEmail !== userEmail) throw new Error('Unauthorized');
  return BookingStore.update(reference, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  });
}

module.exports = { createBooking, getBooking, getUserBookings, updateBooking, cancelBooking };
