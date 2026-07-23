/**
 * Destinations & Offers service.
 * Returns static curated data — in production you'd source this
 * from a CMS or Amadeus Points of Interest API.
 */

const DESTINATIONS = [
  { id: 1, city: 'New York',  country: 'United States', code: 'JFK', image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80', description: 'The city that never sleeps — iconic skyline, world-class dining, art and culture.', fromPrice: 399, currency: 'GBP', flightTime: '7h 30m', highlights: ['Times Square','Central Park','Brooklyn Bridge','Metropolitan Museum'], climate: 'Temperate', bestTime: 'Apr–Jun, Sep–Nov', category: 'city',    popular: true },
  { id: 2, city: 'Dubai',     country: 'UAE',           code: 'DXB', image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80', description: 'Where luxury meets modernity — soaring skyscrapers, desert safaris and beaches.',  fromPrice: 299, currency: 'GBP', flightTime: '6h 45m', highlights: ['Burj Khalifa','Dubai Mall','Palm Jumeirah','Desert Safari'],            climate: 'Hot Desert', bestTime: 'Nov–Mar',      category: 'luxury',  popular: true },
  { id: 3, city: 'Tokyo',     country: 'Japan',         code: 'NRT', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80', description: 'Ancient tradition meets futuristic innovation in one of the world\'s great cities.',  fromPrice: 649, currency: 'GBP', flightTime: '11h 50m',highlights: ['Shibuya Crossing','Senso-ji Temple','Mount Fuji','Shinjuku'],           climate: 'Humid Subtropical', bestTime: 'Mar–May, Sep–Nov', category: 'city',    popular: true },
  { id: 4, city: 'Sydney',    country: 'Australia',     code: 'SYD', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80', description: 'Harbourside beauty with stunning beaches, world-class cuisine and outdoor adventures.', fromPrice: 799, currency: 'GBP', flightTime: '21h 30m',highlights: ['Opera House','Bondi Beach','Harbour Bridge','Blue Mountains'],        climate: 'Oceanic', bestTime: 'Sep–Nov, Mar–May',        category: 'adventure',popular: true },
  { id: 5, city: 'Cape Town', country: 'South Africa',  code: 'CPT', image: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=600&q=80', description: 'At the foot of Table Mountain, a city of astounding natural beauty and vibrant culture.',fromPrice: 449, currency: 'GBP', flightTime: '11h 20m',highlights: ['Table Mountain','Cape of Good Hope','Boulders Beach','Winelands'],    climate: 'Mediterranean', bestTime: 'Nov–Feb',        category: 'adventure',popular: true },
  { id: 6, city: 'Singapore', country: 'Singapore',     code: 'SIN', image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&q=80', description: 'A sparkling city-state fusing futuristic architecture, lush gardens and incredible food.', fromPrice: 579, currency: 'GBP', flightTime: '12h 55m',highlights: ['Gardens by the Bay','Marina Bay Sands','Sentosa','Hawker Centres'],  climate: 'Tropical', bestTime: 'Feb–Apr',              category: 'city',    popular: true },
  { id: 7, city: 'Barcelona', country: 'Spain',         code: 'BCN', image: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=600&q=80', description: 'Gaudí\'s masterpieces, sun-drenched beaches and a food scene that rivals Paris.',      fromPrice: 89,  currency: 'GBP', flightTime: '2h 15m', highlights: ['Sagrada Família','Park Güell','Las Ramblas','Camp Nou'],              climate: 'Mediterranean', bestTime: 'Apr–Jun, Sep–Oct', category: 'beach',   popular: true },
  { id: 8, city: 'Maldives',  country: 'Maldives',      code: 'MLE', image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=600&q=80', description: 'Crystal-clear lagoons, overwater bungalows and pristine coral reefs.',                fromPrice: 899, currency: 'GBP', flightTime: '10h 30m',highlights: ['Water Villas','Snorkelling','Dolphin Cruises','Spa Retreats'],       climate: 'Tropical', bestTime: 'Nov–Apr',              category: 'beach',   popular: true },
];

const OFFERS = [
  { id: 1, title: 'Summer Escape Sale',   description: 'Save up to 30% on selected flights to Europe this summer.', discount: '30% off', validUntil: '2026-08-31', destinations: ['BCN','MAD','FCO','GVA'], image: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=600&q=80', promoCode: 'SUMMER30',    category: 'sale' },
  { id: 2, title: 'Business Class Deal',  description: 'Upgrade to Business for less on long-haul routes this autumn.',   discount: 'From £999',  validUntil: '2026-09-30', destinations: ['JFK','LAX','SIN','NRT'], image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80', promoCode: 'BIZCLASS',    category: 'upgrade' },
  { id: 3, title: 'Earn Double Avios',    description: 'Book by 31 July and earn double Avios on all flights.',           discount: '2x Avios',   validUntil: '2026-07-31', destinations: ['ALL'],                  image: 'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=600&q=80', promoCode: 'DOUBLEAVIOS', category: 'avios' },
];

/**
 * List destinations, optionally filtered by category and/or popularity.
 * Accepts query-string style values for `popular` ('true'/'false') as
 * well as real booleans.
 */
function getDestinations({ category, popular } = {}) {
  let list = DESTINATIONS;

  if (category && category !== 'all') {
    list = list.filter((d) => d.category === category.toLowerCase());
  }

  if (popular !== undefined && popular !== null && popular !== '') {
    const wantPopular = popular === true || popular === 'true';
    list = list.filter((d) => d.popular === wantPopular);
  }

  return list;
}

/** Look up a single destination by its IATA code. */
function getDestinationByCode(code) {
  if (!code || typeof code !== 'string') {
    throw Object.assign(new Error('getDestinationByCode: a destination code is required'), {
      statusCode: 400,
    });
  }
  return DESTINATIONS.find((d) => d.code.toUpperCase() === code.toUpperCase()) || null;
}

/** List current offers, optionally filtered by category. */
function getOffers({ category } = {}) {
  if (category) {
    return OFFERS.filter((o) => o.category === category.toLowerCase());
  }
  return OFFERS;
}

module.exports = { getDestinations, getDestinationByCode, getOffers };