/**
 * Mock data — replaces all Amadeus API calls.
 * Six routes, 6 flights each, realistic prices/times/aircraft.
 */

// ─── Airports ────────────────────────────────────────────────────
const AIRPORTS = [
  { iataCode: 'LHR', name: 'London Heathrow',           cityName: 'London',      countryName: 'United Kingdom', countryCode: 'GB', subType: 'AIRPORT' },
  { iataCode: 'LGW', name: 'London Gatwick',             cityName: 'London',      countryName: 'United Kingdom', countryCode: 'GB', subType: 'AIRPORT' },
  { iataCode: 'JFK', name: 'John F. Kennedy International', cityName: 'New York', countryName: 'United States',  countryCode: 'US', subType: 'AIRPORT' },
  { iataCode: 'EWR', name: 'Newark Liberty International',  cityName: 'New York', countryName: 'United States',  countryCode: 'US', subType: 'AIRPORT' },
  { iataCode: 'DXB', name: 'Dubai International',        cityName: 'Dubai',       countryName: 'UAE',            countryCode: 'AE', subType: 'AIRPORT' },
  { iataCode: 'NRT', name: 'Narita International',       cityName: 'Tokyo',       countryName: 'Japan',          countryCode: 'JP', subType: 'AIRPORT' },
  { iataCode: 'HND', name: 'Haneda Airport',             cityName: 'Tokyo',       countryName: 'Japan',          countryCode: 'JP', subType: 'AIRPORT' },
  { iataCode: 'SYD', name: 'Sydney Kingsford Smith',     cityName: 'Sydney',      countryName: 'Australia',      countryCode: 'AU', subType: 'AIRPORT' },
  { iataCode: 'SIN', name: 'Singapore Changi',           cityName: 'Singapore',   countryName: 'Singapore',      countryCode: 'SG', subType: 'AIRPORT' },
  { iataCode: 'BCN', name: 'Barcelona El Prat',          cityName: 'Barcelona',   countryName: 'Spain',          countryCode: 'ES', subType: 'AIRPORT' },
  { iataCode: 'CDG', name: 'Charles de Gaulle',          cityName: 'Paris',       countryName: 'France',         countryCode: 'FR', subType: 'AIRPORT' },
  { iataCode: 'FRA', name: 'Frankfurt Airport',          cityName: 'Frankfurt',   countryName: 'Germany',        countryCode: 'DE', subType: 'AIRPORT' },
  { iataCode: 'AMS', name: 'Amsterdam Schiphol',         cityName: 'Amsterdam',   countryName: 'Netherlands',    countryCode: 'NL', subType: 'AIRPORT' },
  { iataCode: 'CPT', name: 'Cape Town International',    cityName: 'Cape Town',   countryName: 'South Africa',   countryCode: 'ZA', subType: 'AIRPORT' },
  { iataCode: 'MAD', name: 'Adolfo Suárez Barajas',      cityName: 'Madrid',      countryName: 'Spain',          countryCode: 'ES', subType: 'AIRPORT' },
  { iataCode: 'FCO', name: 'Fiumicino Leonardo da Vinci',cityName: 'Rome',        countryName: 'Italy',          countryCode: 'IT', subType: 'AIRPORT' },
  { iataCode: 'ORD', name: "O'Hare International",       cityName: 'Chicago',     countryName: 'United States',  countryCode: 'US', subType: 'AIRPORT' },
  { iataCode: 'MIA', name: 'Miami International',        cityName: 'Miami',       countryName: 'United States',  countryCode: 'US', subType: 'AIRPORT' },
  { iataCode: 'BOM', name: 'Chhatrapati Shivaji International', cityName: 'Mumbai', countryName: 'India',        countryCode: 'IN', subType: 'AIRPORT' },
  { iataCode: 'IST', name: 'Istanbul Airport',           cityName: 'Istanbul',    countryName: 'Turkey',         countryCode: 'TR', subType: 'AIRPORT' },
];

// ─── Flight generator helper ─────────────────────────────────────
let _flightIdCounter = 1;

function makeFlight({ from, to, dep, arr, flightNum, aircraft, price, stops = 0, stopAt = null, durationH, durationM }) {
  const id = String(_flightIdCounter++);
  const today = new Date();
  const depDate = new Date(today);
  depDate.setDate(depDate.getDate() + 3); // default 3 days out
  const dateStr = depDate.toISOString().split('T')[0];

  return {
    id,
    flightNumber: flightNum,
    airline: 'BA',
    from,
    to,
    departure: dep,
    arrival: arr,
    duration: `${durationH}h ${durationM}m`,
    stops,
    stopAirport: stopAt,
    aircraft,
    date: dateStr,
    prices: {
      economy:        price,
      premiumEconomy: Math.round(price * 1.85),
      businessClass:  Math.round(price * 3.6),
      firstClass:     Math.round(price * 6.2),
    },
    seatsLeft: { economy: 9, premiumEconomy: 4, businessClass: 6, firstClass: 2 },
    amenities: ['Wi-Fi', 'Meals', 'Entertainment', 'USB Charging'],
    price: { grandTotal: String(price), total: String(price), currency: 'GBP' },
    numberOfStops: stops,
    itineraries: [{
      duration: `PT${durationH}H${durationM}M`,
      segments: stops === 0
        ? [{ departure: { iataCode: from, at: `${dateStr}T${dep}:00` }, arrival: { iataCode: to, at: `${dateStr}T${arr}:00` }, carrierCode: 'BA', number: flightNum.replace('BA',''), aircraft: { code: aircraft }, operatingCarrierCode: 'BA' }]
        : [
            { departure: { iataCode: from, at: `${dateStr}T${dep}:00` }, arrival: { iataCode: stopAt, at: `${dateStr}T${arr}:00` }, carrierCode: 'BA', number: flightNum.replace('BA','') + '1', aircraft: { code: aircraft } },
            { departure: { iataCode: stopAt, at: `${dateStr}T${arr}:00` }, arrival: { iataCode: to, at: `${dateStr}T${arr}:00` }, carrierCode: 'BA', number: flightNum.replace('BA','') + '2', aircraft: { code: aircraft } },
          ],
    }],
    travelerPricings: [{ fareDetailsBySegment: [{ cabin: 'ECONOMY' }] }],
  };
}

// ─── Mock flights keyed by "FROM-TO" ────────────────────────────
const MOCK_FLIGHTS = {

  // London → New York  (6 flights)
  'LHR-JFK': [
    makeFlight({ from:'LHR', to:'JFK', dep:'08:30', arr:'11:45', flightNum:'BA117', aircraft:'777', price:349, durationH:7, durationM:15 }),
    makeFlight({ from:'LHR', to:'JFK', dep:'10:15', arr:'13:20', flightNum:'BA175', aircraft:'787', price:389, durationH:7, durationM:5 }),
    makeFlight({ from:'LHR', to:'JFK', dep:'12:00', arr:'15:10', flightNum:'BA177', aircraft:'777', price:319, durationH:7, durationM:10 }),
    makeFlight({ from:'LHR', to:'JFK', dep:'14:30', arr:'17:35', flightNum:'BA179', aircraft:'787', price:369, durationH:7, durationM:5 }),
    makeFlight({ from:'LHR', to:'JFK', dep:'17:00', arr:'20:10', flightNum:'BA183', aircraft:'777', price:429, durationH:7, durationM:10 }),
    makeFlight({ from:'LHR', to:'JFK', dep:'20:45', arr:'23:55', flightNum:'BA185', aircraft:'A380',price:359, durationH:7, durationM:10 }),
  ],

  // London → Dubai  (6 flights)
  'LHR-DXB': [
    makeFlight({ from:'LHR', to:'DXB', dep:'07:00', arr:'18:00', flightNum:'BA107', aircraft:'777', price:289, durationH:7, durationM:0 }),
    makeFlight({ from:'LHR', to:'DXB', dep:'09:30', arr:'20:25', flightNum:'BA109', aircraft:'787', price:309, durationH:6, durationM:55 }),
    makeFlight({ from:'LHR', to:'DXB', dep:'13:15', arr:'00:10', flightNum:'BA111', aircraft:'777', price:269, durationH:6, durationM:55 }),
    makeFlight({ from:'LHR', to:'DXB', dep:'15:45', arr:'02:35', flightNum:'BA113', aircraft:'787', price:299, durationH:6, durationM:50 }),
    makeFlight({ from:'LHR', to:'DXB', dep:'19:00', arr:'05:55', flightNum:'BA115', aircraft:'777', price:279, durationH:6, durationM:55 }),
    makeFlight({ from:'LHR', to:'DXB', dep:'22:30', arr:'09:20', flightNum:'BA119', aircraft:'A380',price:339, durationH:6, durationM:50 }),
  ],

  // London → Tokyo  (6 flights)
  'LHR-NRT': [
    makeFlight({ from:'LHR', to:'NRT', dep:'09:00', arr:'06:50', flightNum:'BA005', aircraft:'787', price:649, durationH:11, durationM:50 }),
    makeFlight({ from:'LHR', to:'NRT', dep:'11:30', arr:'09:15', flightNum:'BA007', aircraft:'777', price:699, durationH:11, durationM:45 }),
    makeFlight({ from:'LHR', to:'NRT', dep:'14:00', arr:'11:45', flightNum:'BA009', aircraft:'787', price:619, durationH:11, durationM:45 }),
    makeFlight({ from:'LHR', to:'NRT', dep:'16:30', arr:'14:10', flightNum:'BA011', aircraft:'777', price:679, durationH:11, durationM:40 }),
    makeFlight({ from:'LHR', to:'NRT', dep:'19:00', arr:'16:45', flightNum:'BA013', aircraft:'A380',price:729, durationH:11, durationM:45 }),
    makeFlight({ from:'LHR', to:'NRT', dep:'21:45', arr:'19:25', flightNum:'BA015', aircraft:'787', price:599, durationH:11, durationM:40 }),
  ],

  // London → Sydney  (6 flights)
  'LHR-SYD': [
    makeFlight({ from:'LHR', to:'SYD', dep:'10:00', arr:'07:30', flightNum:'BA015', aircraft:'787', price:799, stops:1, stopAt:'SIN', durationH:21, durationM:30 }),
    makeFlight({ from:'LHR', to:'SYD', dep:'12:30', arr:'10:00', flightNum:'BA017', aircraft:'777', price:849, stops:1, stopAt:'SIN', durationH:21, durationM:30 }),
    makeFlight({ from:'LHR', to:'SYD', dep:'08:00', arr:'05:20', flightNum:'BA019', aircraft:'A380',price:879, stops:1, stopAt:'DXB', durationH:21, durationM:20 }),
    makeFlight({ from:'LHR', to:'SYD', dep:'15:00', arr:'12:25', flightNum:'BA021', aircraft:'787', price:769, stops:1, stopAt:'SIN', durationH:21, durationM:25 }),
    makeFlight({ from:'LHR', to:'SYD', dep:'18:30', arr:'15:55', flightNum:'BA023', aircraft:'777', price:819, stops:1, stopAt:'BKK', durationH:21, durationM:25 }),
    makeFlight({ from:'LHR', to:'SYD', dep:'22:00', arr:'19:20', flightNum:'BA025', aircraft:'787', price:749, stops:1, stopAt:'SIN', durationH:21, durationM:20 }),
  ],

  // London → Singapore  (6 flights)
  'LHR-SIN': [
    makeFlight({ from:'LHR', to:'SIN', dep:'09:15', arr:'06:05', flightNum:'BA011', aircraft:'787', price:579, durationH:12, durationM:50 }),
    makeFlight({ from:'LHR', to:'SIN', dep:'11:45', arr:'08:30', flightNum:'BA013', aircraft:'777', price:619, durationH:12, durationM:45 }),
    makeFlight({ from:'LHR', to:'SIN', dep:'13:30', arr:'10:15', flightNum:'BA015', aircraft:'787', price:549, durationH:12, durationM:45 }),
    makeFlight({ from:'LHR', to:'SIN', dep:'16:00', arr:'12:45', flightNum:'BA017', aircraft:'A380',price:659, durationH:12, durationM:45 }),
    makeFlight({ from:'LHR', to:'SIN', dep:'19:30', arr:'16:15', flightNum:'BA019', aircraft:'787', price:589, durationH:12, durationM:45 }),
    makeFlight({ from:'LHR', to:'SIN', dep:'22:00', arr:'18:45', flightNum:'BA021', aircraft:'777', price:529, durationH:12, durationM:45 }),
  ],

  // London → Barcelona  (6 flights)
  'LHR-BCN': [
    makeFlight({ from:'LHR', to:'BCN', dep:'06:30', arr:'09:45', flightNum:'BA414', aircraft:'A320',price:89,  durationH:2, durationM:15 }),
    makeFlight({ from:'LHR', to:'BCN', dep:'09:00', arr:'12:10', flightNum:'BA416', aircraft:'A319',price:119, durationH:2, durationM:10 }),
    makeFlight({ from:'LHR', to:'BCN', dep:'11:30', arr:'14:40', flightNum:'BA418', aircraft:'A320',price:99,  durationH:2, durationM:10 }),
    makeFlight({ from:'LHR', to:'BCN', dep:'14:00', arr:'17:15', flightNum:'BA420', aircraft:'A321',price:139, durationH:2, durationM:15 }),
    makeFlight({ from:'LHR', to:'BCN', dep:'16:45', arr:'19:55', flightNum:'BA422', aircraft:'A320',price:109, durationH:2, durationM:10 }),
    makeFlight({ from:'LHR', to:'BCN', dep:'19:30', arr:'22:40', flightNum:'BA424', aircraft:'A319',price:79,  durationH:2, durationM:10 }),
  ],
};

// ─── Flight statuses ─────────────────────────────────────────────
const MOCK_STATUSES = [
  { flightNumber:'BA117', route:'LHR → JFK', scheduledDep:'08:30', actualDep:'08:45', scheduledArr:'11:45', actualArr:'11:55', status:'on-time',   statusLabel:'On Time',        gate:'B22', terminal:'5', aircraft:'Boeing 777-300ER',   progress:68 },
  { flightNumber:'BA175', route:'LHR → JFK', scheduledDep:'10:15', actualDep:'10:15', scheduledArr:'13:20', actualArr:'13:20', status:'scheduled',  statusLabel:'Scheduled',      gate:'C31', terminal:'5', aircraft:'Boeing 787-9',       progress:0  },
  { flightNumber:'BA204', route:'LHR → CDG', scheduledDep:'08:00', actualDep:'08:35', scheduledArr:'10:15', actualArr:'10:50', status:'delayed',    statusLabel:'Delayed 35 min', gate:'A14', terminal:'5', aircraft:'Airbus A320',        progress:100},
  { flightNumber:'BA016', route:'LHR → SIN', scheduledDep:'21:00', actualDep:'21:00', scheduledArr:'17:20', actualArr:'17:20', status:'scheduled',  statusLabel:'Scheduled',      gate:'C45', terminal:'5', aircraft:'Boeing 787-9',       progress:0  },
  { flightNumber:'BA107', route:'LHR → DXB', scheduledDep:'07:00', actualDep:'07:00', scheduledArr:'18:00', actualArr:'18:00', status:'on-time',    statusLabel:'On Time',        gate:'D11', terminal:'5', aircraft:'Boeing 777-200ER',   progress:42 },
  { flightNumber:'BA005', route:'LHR → NRT', scheduledDep:'09:00', actualDep:'09:00', scheduledArr:'06:50', actualArr:'06:50', status:'on-time',    statusLabel:'On Time',        gate:'E02', terminal:'5', aircraft:'Boeing 787-9',       progress:15 },
  { flightNumber:'BA015', route:'LHR → SYD', scheduledDep:'10:00', actualDep:'10:00', scheduledArr:'07:30', actualArr:'07:30', status:'scheduled',  statusLabel:'Scheduled',      gate:'F09', terminal:'5', aircraft:'Boeing 787-9',       progress:0  },
  { flightNumber:'BA414', route:'LHR → BCN', scheduledDep:'06:30', actualDep:'06:30', scheduledArr:'09:45', actualArr:'09:30', status:'on-time',    statusLabel:'On Time',        gate:'A05', terminal:'5', aircraft:'Airbus A320',        progress:100},
  { flightNumber:'BA011', route:'LHR → SIN', scheduledDep:'09:15', actualDep:'09:15', scheduledArr:'06:05', actualArr:'06:05', status:'boarding',   statusLabel:'Now Boarding',   gate:'G14', terminal:'5', aircraft:'Boeing 787-9',       progress:0  },
  { flightNumber:'BA019', route:'LHR → SYD', scheduledDep:'08:00', actualDep:'08:00', scheduledArr:'05:20', actualArr:'05:20', status:'landed',     statusLabel:'Landed',         gate:'H22', terminal:'5', aircraft:'Airbus A380',        progress:100},
];

// ─── Route distances (km) for Avios calculation ──────────────────
const ROUTE_DISTANCES = {
  'LHR-JFK':5540,'JFK-LHR':5540,'LHR-LAX':8755,'LAX-LHR':8755,
  'LHR-DXB':5478,'DXB-LHR':5478,'LHR-SIN':10841,'SIN-LHR':10841,
  'LHR-HKG':9640,'HKG-LHR':9640,'LHR-NRT':9547,'NRT-LHR':9547,
  'LHR-SYD':17017,'SYD-LHR':17017,'LHR-BCN':1145,'BCN-LHR':1145,
  'LHR-MAD':1246,'MAD-LHR':1246,'LHR-CDG':343,'CDG-LHR':343,
  'LHR-FRA':643,'FRA-LHR':643,'LHR-AMS':370,'AMS-LHR':370,
  'LHR-ORD':6340,'ORD-LHR':6340,'LHR-MIA':7126,'MIA-LHR':7126,
  'LHR-BOS':5265,'BOS-LHR':5265,'LHR-CPT':9673,'CPT-LHR':9673,
  'LHR-BOM':7194,'BOM-LHR':7194,'LHR-IST':2497,'IST-LHR':2497,
};

module.exports = { AIRPORTS, MOCK_FLIGHTS, MOCK_STATUSES, ROUTE_DISTANCES };
