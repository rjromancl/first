/**
 * In-memory data store for users and bookings.
 *
 * In a production app swap these Maps for a real database
 * (PostgreSQL, MongoDB, etc.). The interface is deliberately
 * kept identical so the switch is a one-file change.
 */
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// ── Users ─────────────────────────────────────────────────────────
const users = new Map();

// Seed demo users so the frontend demo works out of the box
(async () => {
  const hash = await bcrypt.hash('demo1234', 10);
  const id = uuidv4();
  users.set('demo@ba.com', {
    id,
    email: 'demo@ba.com',
    passwordHash: hash,
    firstName: 'James',
    lastName: 'Wilson',
    tier: 'Gold',
    avios: 12450,
    execNumber: 'BA' + id.replace(/-/g, '').substring(0, 8).toUpperCase(),
    phone: '+44 7700 900000',
    dateOfBirth: '1985-03-12',
    nationality: 'GB',
    passportNumber: '123456789',
    passportExpiry: '2030-01-01',
    knownTravelerNumber: '',
    preferredSeat: 'window',
    preferredCabin: 'business',
    homeCityIATA: 'LHR',
    dietaryPreference: 'none',
    createdAt: new Date().toISOString(),
  });

  const rajaHash = await bcrypt.hash('raja1234', 10);
  const rajaId = uuidv4();
  users.set('raja@ba.com', {
    id: rajaId,
    email: 'raja@ba.com',
    passwordHash: rajaHash,
    firstName: 'Raja',
    lastName: 'Abilash',
    tier: 'Silver',
    avios: 8500,
    execNumber: 'BA' + rajaId.replace(/-/g, '').substring(0, 8).toUpperCase(),
    phone: '+44 7911 123456',
    dateOfBirth: '1992-07-24',
    nationality: 'IN',
    passportNumber: 'P9876543',
    passportExpiry: '2028-06-30',
    knownTravelerNumber: '',
    preferredSeat: 'aisle',
    preferredCabin: 'economy',
    homeCityIATA: 'LHR',
    dietaryPreference: 'none',
    createdAt: new Date().toISOString(),
  });
})();

const UserStore = {
  findByEmail: (email) => users.get(email.toLowerCase()) || null,
  findById: (id) => [...users.values()].find((u) => u.id === id) || null,

  create: async ({ email, password, firstName, lastName }) => {
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const user = {
      id,
      email: email.toLowerCase(),
      passwordHash: hash,
      firstName,
      lastName,
      tier: 'Blue',
      avios: 500,
      execNumber: 'BA' + id.replace(/-/g, '').substring(0, 8).toUpperCase(),
      // ── Travel profile fields ─────────────────────────────────
      phone:              '',
      dateOfBirth:        '',
      nationality:        'GB',
      passportNumber:     '',
      passportExpiry:     '',
      knownTravelerNumber:'',
      preferredSeat:      'window',   // window | aisle | middle
      preferredCabin:     'economy',  // economy | premium_economy | business | first
      homeCityIATA:       'LHR',
      dietaryPreference:  'none',     // none | vegetarian | vegan | halal | kosher | gluten-free
      // ─────────────────────────────────────────────────────────
      createdAt: new Date().toISOString(),
    };
    users.set(email.toLowerCase(), user);
    return user;
  },

  /** Update mutable profile fields for an existing user. */
  updateProfile: (email, fields) => {
    const user = users.get(email.toLowerCase());
    if (!user) return null;
    const ALLOWED = [
      'firstName','lastName','phone','dateOfBirth','nationality',
      'passportNumber','passportExpiry','knownTravelerNumber',
      'preferredSeat','preferredCabin','homeCityIATA','dietaryPreference',
    ];
    ALLOWED.forEach(k => { if (fields[k] !== undefined) user[k] = fields[k]; });
    user.updatedAt = new Date().toISOString();
    users.set(email.toLowerCase(), user);
    return user;
  },

  updateAvios: (email, amount) => {
    const user = users.get(email.toLowerCase());
    if (user) {
      user.avios += amount;
      users.set(email.toLowerCase(), user);
    }
    return user;
  },

  safeUser: (user) => {
    const { passwordHash, ...safe } = user;
    return safe;
  },
};

// ── Bookings ──────────────────────────────────────────────────────
const bookings = new Map();

// Seed demo bookings matching the frontend demo refs
bookings.set('XYMBA1', {
  id: uuidv4(),
  reference: 'XYMBA1',
  status: 'confirmed',
  userEmail: 'demo@ba.com',
  passenger: { firstName: 'James', lastName: 'Wilson', email: 'demo@ba.com', phone: '+44 7700 900000' },
  outbound: {
    flightNumber: 'BA117',
    from: 'LHR', to: 'JFK',
    departure: '2026-08-15T10:30:00',
    arrival: '2026-08-15T13:15:00',
    cabin: 'Business Class',
    seat: '4A',
  },
  inbound: {
    flightNumber: 'BA178',
    from: 'JFK', to: 'LHR',
    departure: '2026-08-22T19:00:00',
    arrival: '2026-08-23T07:00:00',
    cabin: 'Business Class',
    seat: '4A',
  },
  passengers: 1,
  totalPaid: 2499,
  currency: 'GBP',
  bags: { checked: 1, cabin: 1 },
  checkedIn: false,
  boardingPass: null,
  aviosEarned: 8750,
  tier: 'Gold',
  createdAt: new Date().toISOString(),
});

bookings.set('PLCNR7', {
  id: uuidv4(),
  reference: 'PLCNR7',
  status: 'confirmed',
  userEmail: 'sarah.j@example.com',
  passenger: { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@example.com', phone: '+44 7700 900001' },
  outbound: {
    flightNumber: 'BA204',
    from: 'LHR', to: 'CDG',
    departure: '2026-07-20T08:00:00',
    arrival: '2026-07-20T10:15:00',
    cabin: 'Economy',
    seat: '22B',
  },
  inbound: null,
  passengers: 2,
  totalPaid: 348,
  currency: 'GBP',
  bags: { checked: 0, cabin: 1 },
  checkedIn: true,
  boardingPass: 'BP-PLCNR7',
  aviosEarned: 500,
  tier: 'Blue',
  createdAt: new Date().toISOString(),
});

const BookingStore = {
  findByRef: (ref) => bookings.get(ref.toUpperCase()) || null,

  findByUser: (email) =>
    [...bookings.values()].filter(
      (b) => b.userEmail?.toLowerCase() === email.toLowerCase()
    ),

  create: (bookingData) => {
    const ref = bookingData.reference || generateRef();
    const booking = {
      id: uuidv4(),
      ...bookingData,
      reference: ref,
      createdAt: new Date().toISOString(),
    };
    bookings.set(ref.toUpperCase(), booking);
    return booking;
  },

  update: (ref, updates) => {
    const booking = bookings.get(ref.toUpperCase());
    if (!booking) return null;
    const updated = { ...booking, ...updates, updatedAt: new Date().toISOString() };
    bookings.set(ref.toUpperCase(), updated);
    return updated;
  },

  delete: (ref) => bookings.delete(ref.toUpperCase()),
};

function generateRef() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = '';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

module.exports = { UserStore, BookingStore, generateRef };
