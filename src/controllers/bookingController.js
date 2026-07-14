const {
  createBooking, getBooking, getUserBookings, updateBooking, cancelBooking,
} = require('../services/bookingService');
const { success, error } = require('../utils/responseHelper');

// POST /api/bookings
async function create(req, res, next) {
  try {
    const { flightOffer, travelers, contacts } = req.body;
    if (!travelers || travelers.length === 0) return error(res, 'At least one traveler is required', 400);

    const booking = await createBooking({
      flightOffer,
      travelers,
      contacts: contacts || [],
      userEmail: req.user?.email,
    });

    return success(res, booking, 201);
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings/:reference?surname=Wilson
async function retrieve(req, res, next) {
  try {
    const { reference } = req.params;
    const { surname } = req.query;

    if (!surname) return error(res, 'surname query parameter is required', 400);

    const booking = getBooking(reference, surname);
    if (!booking) return error(res, 'Booking not found. Please check your reference and surname.', 404);

    return success(res, booking);
  } catch (err) {
    next(err);
  }
}

// GET /api/bookings  — authenticated user's own bookings
async function listMine(req, res, next) {
  try {
    const bookings = getUserBookings(req.user.email);
    return success(res, bookings);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:reference
async function update(req, res, next) {
  try {
    const { reference } = req.params;
    const updates = req.body;

    // Strip fields that shouldn't be updated this way
    delete updates.reference;
    delete updates.id;
    delete updates.userEmail;

    const booking = updateBooking(reference, updates);
    if (!booking) return error(res, 'Booking not found', 404);

    return success(res, booking);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:reference/seat
async function selectSeat(req, res, next) {
  try {
    const { reference } = req.params;
    const { seat, segment = 'outbound' } = req.body;
    if (!seat) return error(res, 'seat is required', 400);

    const booking = updateBooking(reference, {
      [segment]: { ...require('../models/inMemoryStore').BookingStore.findByRef(reference)?.[segment], seat },
    });
    if (!booking) return error(res, 'Booking not found', 404);

    return success(res, { seat, segment, reference });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/bookings/:reference/bags
async function updateBags(req, res, next) {
  try {
    const { reference } = req.params;
    const { checked, cabin } = req.body;

    const booking = updateBooking(reference, { bags: { checked: checked ?? 0, cabin: cabin ?? 1 } });
    if (!booking) return error(res, 'Booking not found', 404);

    return success(res, booking.bags);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/bookings/:reference
async function cancel(req, res, next) {
  try {
    const { reference } = req.params;
    const booking = await cancelBooking(reference, req.user.email);
    if (!booking) return error(res, 'Booking not found', 404);

    return success(res, { cancelled: true, reference });
  } catch (err) {
    if (err.message === 'Unauthorized') return error(res, 'Not authorised to cancel this booking', 403);
    next(err);
  }
}

module.exports = { create, retrieve, listMine, update, selectSeat, updateBags, cancel };
