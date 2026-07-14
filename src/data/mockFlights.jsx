import { format } from 'date-fns';

const today = new Date();

export const generateFlights = (from, to, date) => {
  const airlines = [
    { code: 'BA', name: 'British Airways' },
    { code: 'BA', name: 'British Airways' },
    { code: 'BA', name: 'British Airways' },
  ];

  const departureTimes = ['06:30', '09:15', '12:45', '15:20', '18:00', '21:30'];
  const durations = { short: '1h 20m', medium: '2h 30m', long: '7h 45m', veryLong: '11h 20m' };

  const getDuration = () => {
    if (!from || !to) return durations.medium;
    const longHaul = ['JFK','LAX','SIN','HKG','NRT','SYD','GRU','MEX','BOM','DEL'];
    if (longHaul.includes(from) || longHaul.includes(to)) return durations.veryLong;
    return durations.medium;
  };

  return departureTimes.slice(0, 4).map((dep, i) => {
    const [h, m] = dep.split(':').map(Number);
    const durationParts = getDuration().split('h ');
    const dh = parseInt(durationParts[0]);
    const dm = parseInt(durationParts[1]);
    const arrHour = (h + dh + Math.floor((m + dm) / 60)) % 24;
    const arrMin = (m + dm) % 60;

    const prices = {
      economy: 149 + i * 50 + Math.floor(Math.random() * 100),
      premiumEconomy: 399 + i * 80,
      businessClass: 999 + i * 150,
      firstClass: 2499 + i * 200,
    };

    return {
      id: `BA${100 + i * 13}`,
      flightNumber: `BA${100 + i * 13}`,
      airline: 'British Airways',
      from: from || 'LHR',
      to: to || 'JFK',
      departure: dep,
      arrival: `${String(arrHour).padStart(2,'0')}:${String(arrMin).padStart(2,'0')}`,
      duration: getDuration(),
      stops: i === 2 ? 1 : 0,
      stopAirport: i === 2 ? 'MAD' : null,
      aircraft: ['Boeing 777', 'Airbus A380', 'Boeing 787', 'Airbus A350'][i % 4],
      prices,
      seatsLeft: { economy: 12 + i * 3, premiumEconomy: 4, businessClass: 2, firstClass: 1 },
      amenities: ['Wi-Fi', 'Meals', 'Entertainment', 'USB Charging'],
      date: date ? format(date, 'yyyy-MM-dd') : format(today, 'yyyy-MM-dd'),
    };
  });
};

export const mockBookings = [
  {
    id: 'BK001',
    reference: 'XYMBA1',
    status: 'confirmed',
    passenger: { firstName: 'James', lastName: 'Wilson', email: 'james.wilson@example.com' },
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
  },
  {
    id: 'BK002',
    reference: 'PLCNR7',
    status: 'confirmed',
    passenger: { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@example.com' },
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
  },
];

export const mockFlightStatuses = [
  {
    flightNumber: 'BA117',
    route: 'LHR → JFK',
    scheduledDep: '10:30',
    actualDep: '10:45',
    scheduledArr: '13:15',
    actualArr: '13:25',
    status: 'on-time',
    statusLabel: 'On Time',
    gate: 'B22',
    terminal: '5',
    aircraft: 'Boeing 777-300ER',
    progress: 65,
  },
  {
    flightNumber: 'BA204',
    route: 'LHR → CDG',
    scheduledDep: '08:00',
    actualDep: '08:35',
    scheduledArr: '10:15',
    actualArr: '10:50',
    status: 'delayed',
    statusLabel: 'Delayed 35 min',
    gate: 'A14',
    terminal: '5',
    aircraft: 'Airbus A320',
    progress: 100,
  },
  {
    flightNumber: 'BA016',
    route: 'LHR → SIN',
    scheduledDep: '21:00',
    actualDep: '21:00',
    scheduledArr: '17:20',
    actualArr: '17:20',
    status: 'scheduled',
    statusLabel: 'Scheduled',
    gate: 'C45',
    terminal: '5',
    aircraft: 'Boeing 787-9',
    progress: 0,
  },
];
