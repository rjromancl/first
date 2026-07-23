const { BookingStore } = require('../models/inMemoryStore');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Perform online check-in for a booking.
 *
 * Rules (matching BA actual policy):
 *  - Available 24h – 1h before scheduled departure
 *  - Cannot check in if already checked in
 *  - Returns a boarding pass object with barcode
 */
async function checkIn({ reference, surname }) {
  if (!reference || !surname) {
    throw Object.assign(new Error('Booking reference and surname are required'), {
      statusCode: 400,
    });
  }

  const booking = BookingStore.findByRef(reference);
  if (!booking) {
    throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  }

  const storedLastName = booking.passenger?.lastName || '';
  if (storedLastName.toLowerCase() !== surname.toLowerCase()) {
    throw Object.assign(new Error('Surname does not match booking'), { statusCode: 400 });
  }

  if (booking.status === 'cancelled') {
    throw Object.assign(new Error('Cannot check in — booking is cancelled'), { statusCode: 400 });
  }

  if (booking.checkedIn) {
    // Return existing boarding pass
    return {
      alreadyCheckedIn: true,
      boardingPass: buildBoardingPass(booking),
    };
  }

  // Time window validation (disabled in test/dev so demo always works)
  if (process.env.NODE_ENV === 'production') {
    const departureTime = new Date(booking.outbound.departure).getTime();

    if (Number.isNaN(departureTime)) {
      throw Object.assign(new Error('Booking has no valid departure time'), { statusCode: 500 });
    }

    const now = Date.now();
    const window24h = 24 * 60 * 60 * 1000;
    const window1h = 1 * 60 * 60 * 1000;

    if (now < departureTime - window24h) {
      throw Object.assign(
        new Error('Check-in not yet open (opens 24 hours before departure)'),
        { statusCode: 400 }
      );
    }
    if (now > departureTime - window1h) {
      throw Object.assign(new Error('Check-in is closed (closes 1 hour before departure)'), {
        statusCode: 400,
      });
    }
  }

  // Mark checked in
  const boardingPassRef = `BP-${reference}-${uuidv4().substring(0, 6).toUpperCase()}`;
  const updated = BookingStore.update(reference, {
    checkedIn: true,
    checkedInAt: new Date().toISOString(),
    boardingPass: boardingPassRef,
  });

  logger.info('Check-in completed', { reference, boardingPass: boardingPassRef });

  return {
    alreadyCheckedIn: false,
    boardingPass: buildBoardingPass(updated),
  };
}

function buildBoardingPass(booking) {
  const dep = new Date(booking.outbound.departure);
  const arr = new Date(booking.outbound.arrival);

  if (Number.isNaN(dep.getTime())) {
    throw Object.assign(new Error('Booking has no valid departure time'), { statusCode: 500 });
  }

  // Boarding typically 30–45 min before departure
  const boarding = new Date(dep.getTime() - 40 * 60 * 1000);

  return {
    reference: booking.reference,
    boardingPassRef: booking.boardingPass,
    passenger: {
      name: `${booking.passenger.firstName} ${booking.passenger.lastName}`.trim(),
      firstName: booking.passenger.firstName,
      lastName: booking.passenger.lastName,
    },
    flight: {
      number: booking.outbound.flightNumber,
      from: booking.outbound.from,
      to: booking.outbound.to,
      date: dep.toISOString().split('T')[0],
      departure: dep.toISOString().substring(11, 16),
      arrival: Number.isNaN(arr.getTime()) ? null : arr.toISOString().substring(11, 16),
      boarding: boarding.toISOString().substring(11, 16),
      cabin: booking.outbound.cabin,
      seat: booking.outbound.seat || 'To be assigned',
      gate: booking.outbound.gate || 'TBD',
      terminal: '5',
    },
    barcodeData: Buffer.from(
      `${booking.reference}|${booking.passenger.lastName}|${booking.outbound.flightNumber}`
    ).toString('base64'),
    issuedAt: new Date().toISOString(),
    checkedIn: true,
  };
}

module.exports = { checkIn, buildBoardingPass };