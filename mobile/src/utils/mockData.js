/**
 * mockData.js — Mock flight & destination data for the mobile app.
 * 6 destinations, realistic flight offers.
 */

export const DESTINATIONS = [
  {
    code: 'JFK', city: 'New York', country: 'USA', emoji: '🗽',
    imageUrl: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=400',
    description: 'Experience the energy of the city that never sleeps.',
    highlights: ['Times Square', 'Central Park', 'Brooklyn Bridge', 'Statue of Liberty'],
    avgPrice: 450, currency: 'GBP', flightTime: '7h 30m',
  },
  {
    code: 'DXB', city: 'Dubai', country: 'UAE', emoji: '🏙️',
    imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400',
    description: 'Luxury, innovation, and desert adventure await.',
    highlights: ['Burj Khalifa', 'Dubai Mall', 'Palm Jumeirah', 'Desert Safari'],
    avgPrice: 380, currency: 'GBP', flightTime: '6h 45m',
  },
  {
    code: 'NRT', city: 'Tokyo', country: 'Japan', emoji: '⛩️',
    imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400',
    description: 'Ancient tradition meets futuristic innovation.',
    highlights: ['Shibuya Crossing', 'Mount Fuji', 'Senso-ji Temple', 'Shinjuku'],
    avgPrice: 620, currency: 'GBP', flightTime: '11h 45m',
  },
  {
    code: 'SYD', city: 'Sydney', country: 'Australia', emoji: '🦘',
    imageUrl: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=400',
    description: 'Stunning harbour, beaches, and the outback beyond.',
    highlights: ['Opera House', 'Bondi Beach', 'Harbour Bridge', 'Blue Mountains'],
    avgPrice: 850, currency: 'GBP', flightTime: '21h 30m',
  },
  {
    code: 'BCN', city: 'Barcelona', country: 'Spain', emoji: '🏖️',
    imageUrl: 'https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?w=400',
    description: 'Gaudí architecture, tapas, and Mediterranean beaches.',
    highlights: ['Sagrada Família', 'Park Güell', 'Las Ramblas', 'Camp Nou'],
    avgPrice: 149, currency: 'GBP', flightTime: '2h 20m',
  },
  {
    code: 'BOM', city: 'Mumbai', country: 'India', emoji: '🌆',
    imageUrl: 'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=400',
    description: 'Bollywood, street food, and the Gateway of India.',
    highlights: ['Gateway of India', 'Marine Drive', 'Elephanta Caves', 'Dharavi'],
    avgPrice: 420, currency: 'GBP', flightTime: '9h 15m',
  },
];

export const MOCK_FLIGHTS = {
  'LHR-JFK': [
    {
      id: 'BA0117',
      airline: 'British Airways',
      flightNumber: 'BA117',
      from: 'LHR', to: 'JFK',
      departure: '09:30', arrival: '12:00',
      duration: '7h 30m', stops: 0,
      price: { economy: 449, premium_economy: 899, business: 2499, first: 4999 },
      aircraft: 'Boeing 777-300ER',
      amenities: ['WiFi', 'Entertainment', 'Meals'],
    },
    {
      id: 'BA0177',
      airline: 'British Airways',
      flightNumber: 'BA177',
      from: 'LHR', to: 'JFK',
      departure: '14:00', arrival: '16:30',
      duration: '7h 30m', stops: 0,
      price: { economy: 519, premium_economy: 999, business: 2799, first: 5499 },
      aircraft: 'Boeing 787-9',
      amenities: ['WiFi', 'Entertainment', 'Meals', 'Premium Lounge'],
    },
  ],
  'LHR-DXB': [
    {
      id: 'BA0107',
      airline: 'British Airways',
      flightNumber: 'BA107',
      from: 'LHR', to: 'DXB',
      departure: '08:15', arrival: '19:00',
      duration: '6h 45m', stops: 0,
      price: { economy: 379, premium_economy: 749, business: 1999, first: 3999 },
      aircraft: 'Airbus A380',
      amenities: ['WiFi', 'Entertainment', 'Meals'],
    },
    {
      id: 'BA0109',
      airline: 'British Airways',
      flightNumber: 'BA109',
      from: 'LHR', to: 'DXB',
      departure: '21:30', arrival: '08:15+1',
      duration: '6h 45m', stops: 0,
      price: { economy: 349, premium_economy: 699, business: 1799, first: 3699 },
      aircraft: 'Boeing 777-200ER',
      amenities: ['WiFi', 'Entertainment', 'Meals'],
    },
  ],
  'LHR-NRT': [
    {
      id: 'BA0005',
      airline: 'British Airways',
      flightNumber: 'BA5',
      from: 'LHR', to: 'NRT',
      departure: '11:30', arrival: '07:15+1',
      duration: '11h 45m', stops: 0,
      price: { economy: 619, premium_economy: 1249, business: 3499, first: 7499 },
      aircraft: 'Boeing 787-9',
      amenities: ['WiFi', 'Entertainment', 'Meals', 'Flat Bed (Business)'],
    },
  ],
  'LHR-SYD': [
    {
      id: 'BA0015',
      airline: 'British Airways',
      flightNumber: 'BA15',
      from: 'LHR', to: 'SYD',
      departure: '21:15', arrival: '05:45+2',
      duration: '21h 30m', stops: 1,
      stopCity: 'Singapore',
      price: { economy: 849, premium_economy: 1799, business: 4999, first: 9999 },
      aircraft: 'Boeing 777-300ER',
      amenities: ['WiFi', 'Entertainment', 'Meals', 'Flat Bed (Business)'],
    },
  ],
  'LHR-BCN': [
    {
      id: 'BA0474',
      airline: 'British Airways',
      flightNumber: 'BA474',
      from: 'LHR', to: 'BCN',
      departure: '07:00', arrival: '10:20',
      duration: '2h 20m', stops: 0,
      price: { economy: 149, premium_economy: 289, business: 499, first: null },
      aircraft: 'Airbus A320',
      amenities: ['Snacks', 'Entertainment'],
    },
    {
      id: 'BA0476',
      airline: 'British Airways',
      flightNumber: 'BA476',
      from: 'LHR', to: 'BCN',
      departure: '12:45', arrival: '16:05',
      duration: '2h 20m', stops: 0,
      price: { economy: 179, premium_economy: 329, business: 549, first: null },
      aircraft: 'Airbus A319',
      amenities: ['Snacks', 'Entertainment'],
    },
  ],
  'LHR-BOM': [
    {
      id: 'BA0117B',
      airline: 'British Airways',
      flightNumber: 'BA117',
      from: 'LHR', to: 'BOM',
      departure: '21:30', arrival: '11:45+1',
      duration: '9h 15m', stops: 0,
      price: { economy: 419, premium_economy: 849, business: 2299, first: 4599 },
      aircraft: 'Boeing 787-9',
      amenities: ['WiFi', 'Entertainment', 'Meals', 'Flat Bed (Business)'],
    },
  ],
};

export function getMockFlights(from = 'LHR', to, cabin = 'economy') {
  const key = `${from}-${to}`;
  const reverse = `${to}-${from}`;
  const flights = MOCK_FLIGHTS[key] || MOCK_FLIGHTS[reverse] || [];
  return flights.map(f => ({
    ...f,
    displayPrice: f.price[cabin] || f.price.economy,
    cabin,
  }));
}

export const MOCK_FLIGHT_STATUS = {
  'BA117': {
    flightNumber: 'BA117',
    from: 'LHR', to: 'JFK',
    scheduledDeparture: '09:30',
    scheduledArrival: '12:00',
    actualDeparture: '09:45',
    estimatedArrival: '12:15',
    status: 'En Route',
    gate: 'B38',
    terminal: '5',
    aircraft: 'Boeing 777-300ER',
    percentComplete: 65,
  },
};
