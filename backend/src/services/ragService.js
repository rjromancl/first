/**
 * ragService.js — Advanced Retrieval-Augmented Generation (RAG) service for British Airways.
 *
 * Provides an enterprise-grade hybrid retrieval architecture combining:
 *  1. Dense Vector Similarity Search via ChromaDB
 *  2. Sparse BM25 / Keyword Frequency Scoring with Term Weighting & Bigram matching
 *  3. Reciprocal Rank Fusion (RRF) reranking
 *  4. Intent classification & entity extraction (IATA, Flight No., Tier, Cabin)
 *  5. Domain-specific British Airways Query Expansion (synonym resolution)
 *  6. Comprehensive, structured knowledge base covering destinations, Executive Club,
 *     lounges, cabin classes, baggage policies, UK261 compensation, airports, and family services.
 *
 * If ChromaDB is unavailable, gracefully falls back to the in-memory BM25 hybrid engine.
 */
const { getCollection, initChroma, isReady } = require('../config/chroma');
const logger = require('../config/logger');

// Configuration bounds
const MAX_CONTEXT_DOCS = 6;
const RELEVANCE_THRESHOLD = 0.85; // Cosine distance threshold for vector search
const MAX_CONTEXT_CHARS = 3500;

/**
 * British Airways Synonym & Terminology Mapping for Query Expansion
 */
const BA_SYNONYM_MAP = {
  'business class': ['club world', 'club europe', 'club suite'],
  'first class': ['first', 'concorde room'],
  'economy': ['world traveller', 'euro traveller'],
  'premium economy': ['world traveller plus'],
  'points': ['avios', 'tier points'],
  'miles': ['avios'],
  'rewards': ['avios', 'reward flight saver', 'rfs'],
  'gold card': ['gold', 'executive club gold', 'concorde room'],
  'silver card': ['silver', 'executive club silver', 'galleries lounge'],
  'bronze card': ['bronze', 'executive club bronze'],
  'lounge': ['galleries club', 'galleries first', 'concorde room', 't5 lounge'],
  'luggage': ['baggage', 'cabin bag', 'checked bag', 'hand luggage'],
  'carry on': ['cabin bag', 'hand luggage', 'personal item'],
  'delay': ['uk261', 'eu261', 'delay compensation', 'duty of care'],
  'cancelled': ['cancellation', 'uk261', 'rebooking', 'refund'],
  'compensation': ['uk261', 'eu261', 'flight delay claim'],
  'terminal 5': ['t5', 'heathrow t5', 'lhr t5'],
  'heathrow': ['lhr', 'london heathrow'],
  'gatwick': ['lgw', 'london gatwick'],
  'jfk': ['new york jfk', 'terminal 8'],
  'dubai': ['dxb'],
  'tokyo': ['nrt', 'narita'],
  'sydney': ['syd'],
  'singapore': ['sin'],
  'barcelona': ['bcn'],
  // Booking & manage synonyms
  'my booking': ['manage booking', 'booking reference', 'pnr', 'find booking'],
  'manage': ['manage booking', 'change booking', 'modify booking'],
  'change flight': ['rebook', 'modify booking', 'same day change'],
  'cancel': ['cancellation', 'refund', 'uk261'],
  'check in': ['online check-in', 'checkin', 'boarding pass', 'web check-in'],
  'seat': ['seat selection', 'choose seat', 'exit row', 'window seat', 'aisle seat'],
  'upgrade': ['cabin upgrade', 'avios upgrade', 'bid upgrade'],
};

/**
 * Build the comprehensive B Airways knowledge base.
 */
function buildKnowledgeDocs() {
  return [
    // ── Destinations ──────────────────────────────────────────────────
    {
      id: 'dest-newyork',
      text: 'New York (JFK) — Daily direct flights from London Heathrow (LHR Terminal 5 and Terminal 3). Flight time: 7h 30m. Served by Boeing 777 and Airbus A350-1000 with Club Suite. Popular attractions: Times Square, Central Park, Broadway. Currency: USD.',
      metadata: { category: 'destination', city: 'New York', country: 'United States', iata: 'JFK', fromPrice: 399, climate: 'Temperate', bestTime: 'Apr-Jun, Sep-Nov' },
    },
    {
      id: 'dest-dubai',
      text: 'Dubai (DXB) — Multiple daily direct flights from London Heathrow (LHR T5). Flight time: 6h 45m. Served by Boeing 787 Dreamliner and Airbus A380 with First and Club World. Highlights: Burj Khalifa, Palm Jumeirah, Desert Safari. Currency: AED.',
      metadata: { category: 'destination', city: 'Dubai', country: 'UAE', iata: 'DXB', fromPrice: 299, climate: 'Hot Desert', bestTime: 'Nov-Mar' },
    },
    {
      id: 'dest-tokyo',
      text: 'Tokyo Narita (NRT) & Haneda (HND) — Direct long-haul flights from London Heathrow (LHR T5). Flight time: 11h 50m. Features Club Suite and World Traveller Plus. Highlights: Shibuya Crossing, Mount Fuji, Ginza. Currency: JPY.',
      metadata: { category: 'destination', city: 'Tokyo', country: 'Japan', iata: 'NRT', fromPrice: 649, climate: 'Humid Subtropical', bestTime: 'Mar-May, Sep-Nov' },
    },
    {
      id: 'dest-sydney',
      text: 'Sydney (SYD) — B Airways flagship kangaroo route from London Heathrow (LHR T5) via Singapore (SIN). Flight time: 21h 30m total. Aircraft: Boeing 787-9 / 777-300ER with First, Club World, World Traveller Plus, World Traveller. Currency: AUD.',
      metadata: { category: 'destination', city: 'Sydney', country: 'Australia', iata: 'SYD', fromPrice: 799, climate: 'Oceanic', bestTime: 'Sep-Nov, Mar-May' },
    },
    {
      id: 'dest-cape-town',
      text: 'Cape Town (CPT) — Direct flights from London Heathrow (LHR T5) and seasonal flights from London Gatwick (LGW). Flight time: 11h 20m. Overnight flights with minimal time zone difference (+1/2h). Currency: ZAR.',
      metadata: { category: 'destination', city: 'Cape Town', country: 'South Africa', iata: 'CPT', fromPrice: 449, climate: 'Mediterranean', bestTime: 'Nov-Feb' },
    },
    {
      id: 'dest-singapore',
      text: 'Singapore Changi (SIN) — Daily direct flights from London Heathrow (LHR T5). Flight time: 12h 55m. Serves as stopover hub for Sydney (SYD). Features BA Lounge at Changi T1 with Concorde Bar. Currency: SGD.',
      metadata: { category: 'destination', city: 'Singapore', country: 'Singapore', iata: 'SIN', fromPrice: 579, climate: 'Tropical', bestTime: 'Feb-Apr' },
    },
    {
      id: 'dest-barcelona',
      text: 'Barcelona (BCN) — Gaudí\'s masterpieces, sun-drenched beaches and a food scene that rivals Paris. Highlights: Sagrada Família, Park Güell, Las Ramblas, Camp Nou. Best time to visit: April–June, September–October. Flight time from London: 2h 15m. From price: £89.',
      metadata: { category: 'destination', city: 'Barcelona', country: 'Spain', iata: 'BCN', fromPrice: 89, climate: 'Mediterranean', bestTime: 'Apr-Jun, Sep-Oct' },
    },
    {
      id: 'dest-paris',
      text: 'Paris (CDG) — The City of Light, world famous for the Eiffel Tower, Louvre Museum, Notre-Dame Cathedral, and world-class dining. Multiple daily direct flights from London Heathrow (LHR T5). Flight time: 1h 15m. From price: £79.',
      metadata: { category: 'destination', city: 'Paris', country: 'France', iata: 'CDG', fromPrice: 79, climate: 'Temperate', bestTime: 'Apr-Jun, Sep-Oct' },
    },
    {
      id: 'dest-maldives',
      text: 'Maldives Male (MLE) — Direct leisure flights from London Heathrow (LHR T5). Flight time: 10h 30m. Popular luxury holiday destination with overwater villas. Currency: MVR / USD.',
      metadata: { category: 'destination', city: 'Maldives', country: 'Maldives', iata: 'MLE', fromPrice: 899, climate: 'Tropical', bestTime: 'Nov-Apr' },
    },
    {
      id: 'dest-london',
      text: 'London Heathrow (LHR) — Principal hub of B Airways. Operating predominantly from Terminal 5 (T5 A, B, C gates) and Terminal 3. Features Concorde Room, Galleries First, Galleries Club South/North lounges, and T5 Arrivals Lounge.',
      metadata: { category: 'destination', city: 'London', country: 'United Kingdom', iata: 'LHR', fromPrice: 0, climate: 'Temperate', bestTime: 'Year-round' },
    },
    {
      id: 'dest-mumbai',
      text: 'Mumbai (BOM) — Double daily direct flights from London Heathrow (LHR T5). Flight time: 9h 15m. Served by Boeing 777 and 787 Dreamliner with Club Suite, World Traveller Plus, and World Traveller. Currency: INR.',
      metadata: { category: 'destination', city: 'Mumbai', country: 'India', iata: 'BOM', fromPrice: 489, climate: 'Tropical Monsoon', bestTime: 'Nov-Feb' },
    },

    // ── Executive Club & Avios ─────────────────────────────────────────
    {
      id: 'ec-avios-overview',
      text: 'B Airways Executive Club & Avios: Avios is the reward currency of B Airways. Members earn Avios based on cash spent on flights, cabin class, and tier bonus (Blue 0%, Bronze 25%, Silver 50%, Gold 100%). Avios can be spent on Reward Flights, upgrades to Club World/First, hotel bookings, and car rentals. Avios do not expire as long as there is 1 transaction every 36 months.',
      metadata: { category: 'executive-club', topic: 'avios-overview' },
    },
    {
      id: 'ec-tier-blue',
      text: 'Executive Club Blue Tier: Entry-level membership. Benefits include earning Avios on flights and partner purchases, saving passenger details for fast booking, member-only promotional offers, and free high-speed Wi-Fi messaging on equipped aircraft.',
      metadata: { category: 'executive-club', tier: 'Blue', tierPointsRequired: 0 },
    },
    {
      id: 'ec-tier-bronze',
      text: 'Executive Club Bronze Tier (oneworld Ruby): Achieved by earning 300 Tier Points and flying 2 BA flights in a membership year. Benefits: Priority check-in at Business Class counters, free seat selection 7 days before departure (excluding exit rows), 25% bonus Avios on flights, and priority Group 3 boarding.',
      metadata: { category: 'executive-club', tier: 'Bronze', tierPointsRequired: 300 },
    },
    {
      id: 'ec-tier-silver',
      text: 'Executive Club Silver Tier (oneworld Sapphire): Achieved by earning 600 Tier Points and flying 4 BA flights in a membership year. Benefits: Access to BA Business Class / Galleries Club lounges worldwide for member + 1 guest regardless of cabin booked, free seat selection at time of booking, priority check-in, 50% bonus Avios, extra checked bag allowance (2x32kg in Economy), and Group 2 boarding.',
      metadata: { category: 'executive-club', tier: 'Silver', tierPointsRequired: 600 },
    },
    {
      id: 'ec-tier-gold',
      text: 'Executive Club Gold Tier (oneworld Emerald): Achieved by earning 1500 Tier Points and flying 4 BA flights in a membership year. Benefits: Access to First Class / Galleries First lounges and Galleries Club lounges for member + 1 guest, access to Heathrow T5 First Wing (dedicated check-in and private security), free seat selection including exit rows at booking, 100% bonus Avios, extra baggage, Group 1 boarding, and Gold Priority Reward redemptions.',
      metadata: { category: 'executive-club', tier: 'Gold', tierPointsRequired: 1500 },
    },
    {
      id: 'ec-tier-concorde',
      text: 'Concorde Room Card & Gold Guest List: Awarded to elite Executive Club members earning 5000 Tier Points (5000 TP for Concorde Room Card, 3000 TP for Gold Guest List). Grants access to the exclusive Concorde Room lounges at London Heathrow T5 and New York JFK T8 with private dining booths, cabanas, and full waiter service.',
      metadata: { category: 'executive-club', tier: 'Gold Guest List', tierPointsRequired: 5000 },
    },
    {
      id: 'ec-reward-flight-saver',
      text: 'Reward Flight Saver (RFS): Fixed low cash fee + Avios option for BA reward flights. European short-haul RFS starts from 4,750 Avios + £1 cash each way. Long-haul RFS in Club World to New York starts from 80,000 Avios + £350 return cash. Companion Vouchers from BA American Express cards double the value by allowing 2 passengers to travel for the Avios of 1.',
      metadata: { category: 'executive-club', topic: 'rfs-companion-voucher' },
    },

    // ── Airport Lounges ───────────────────────────────────────────────
    {
      id: 'lounge-galleries-club',
      text: 'B Airways Galleries Club Lounges: Located at LHR T5 (South, North, B Gates), LGW South, JFK T8, and major global outstations. Eligible access: Passengers flying in Club World, Club Europe, or Business Class on oneworld airlines; Executive Club Silver & Gold members + 1 guest; oneworld Sapphire & Emerald members. Amenities: Hot & cold buffet dining, complimentary champagne & wines, high-speed Wi-Fi, shower suites, business zone.',
      metadata: { category: 'lounge', name: 'Galleries Club' },
    },
    {
      id: 'lounge-galleries-first',
      text: 'B Airways Galleries First Lounge: Located at London Heathrow T5 (South) and London Gatwick South. Eligible access: Executive Club Gold members and oneworld Emerald members + 1 guest, traveling in any cabin. Features elevated à la carte dining, Champagne Bar, quiet work pods, and direct access via The First Wing at LHR T5.',
      metadata: { category: 'lounge', name: 'Galleries First' },
    },
    {
      id: 'lounge-concorde-room',
      text: 'The Concorde Room: Ultra-exclusive flagship lounges at London Heathrow Terminal 5 and New York JFK Terminal 8. Eligible access: Customers flying in First Class on B Airways, Concorde Room Card holders, and Gold Guest List members + 1 guest. Features private dining rooms, Forty Winks sleep suites, vintage champagne, and luxury terrace service.',
      metadata: { category: 'lounge', name: 'Concorde Room' },
    },

    // ── Cabin Classes & Amenities ─────────────────────────────────────
    {
      id: 'cabin-world-traveller',
      text: 'World Traveller (Long-Haul Economy): Ergonomic seats with adjustable headrests, 31-inch seat pitch, personal 10-inch HD entertainment screen with noise-reducing headphones, complimentary multi-course meal with bar service, and USB power sockets at every seat.',
      metadata: { category: 'cabin', cabin: 'World Traveller' },
    },
    {
      id: 'cabin-world-traveller-plus',
      text: 'World Traveller Plus (Premium Economy): Dedicated quiet cabin with wider seats, up to 38-inch legroom, greater recline, footrest, 12-inch screen, premium dining served on fine china, glass of sparkling wine on arrival, amenity kit, and double baggage allowance (2x23kg checked bags).',
      metadata: { category: 'cabin', cabin: 'World Traveller Plus' },
    },
    {
      id: 'cabin-club-suite',
      text: 'Club World & Club Suite (Business Class): Features direct aisle access, sliding privacy door (on Club Suite), 79-inch fully flat bed, White Company luxury bedding & amenity kit, 18.5-inch HD screen, multi-course fine dining curated by top chefs, fine wines and champagne, lounge access, priority check-in & boarding, and 2x32kg checked baggage allowance.',
      metadata: { category: 'cabin', cabin: 'Club World' },
    },
    {
      id: 'cabin-first-class',
      text: 'First Class: Premier luxury travel with private suite, 198cm (6ft 6in) fully flat bed with mattress topper & Meridian pajamas, Temperley London amenity bag, multi-course à la carte dining on demand, Laurent-Perrier Grand Siècle champagne, access to The First Wing, Concorde Room lounge access, and 3x32kg baggage allowance.',
      metadata: { category: 'cabin', cabin: 'First' },
    },
    {
      id: 'cabin-club-europe',
      text: 'Club Europe (Short-Haul Business Class): Located at the front of short-haul aircraft with middle seat guaranteed empty for extra space and privacy. Includes hot meal service with champagne/drinks, priority check-in, Fast Track security, Galleries Club lounge access, priority Group 1 boarding, and 2x32kg checked baggage.',
      metadata: { category: 'cabin', cabin: 'Club Europe' },
    },

    // ── Baggage Policies ──────────────────────────────────────────────
    {
      id: 'baggage-hand-luggage',
      text: 'B Airways Cabin / Hand Baggage Policy: ALL tickets include 2 cabin items: 1 Handbag/Laptop bag (up to 40x30x15cm, must fit under seat ahead) + 1 Cabin Bag (up to 56x45x25cm, placed in overhead locker). Maximum weight per item is 23kg (50lbs), provided passenger can lift it unaided into overhead bin.',
      metadata: { category: 'baggage', type: 'hand-luggage' },
    },
    {
      id: 'baggage-checked-allowance',
      text: 'Checked Baggage Allowance by Cabin: Basic Economy (Hand Baggage Only / HBO) = 0 checked bags. Standard Economy (World Traveller) = 1 bag up to 23kg (90x75x43cm). World Traveller Plus = 2 bags up to 23kg each. Club Europe / Club World = 2 bags up to 32kg each. First Class = 3 bags up to 32kg each.',
      metadata: { category: 'baggage', type: 'checked-allowance' },
    },
    {
      id: 'baggage-tier-allowance',
      text: 'Executive Club Member Baggage Bonuses: Executive Club Silver and Gold members (and oneworld Sapphire/Emerald) get 1 additional free checked bag on all tickets except Basic/HBO fares, and an increased weight limit of 32kg per bag in Economy. Bronze members get priority baggage tag dropping.',
      metadata: { category: 'baggage', type: 'tier-bonus' },
    },
    {
      id: 'baggage-excess-and-sports',
      text: 'Excess Baggage & Sporting Equipment: Additional bags can be purchased online at ba.com up to 24h before departure at up to 30% discount vs airport fees. Overweight bags (23kg-32kg) incur a £65/$100 heavy bag fee at airport (waived for Club/First & Silver/Gold members). Golf bags, skis, and bikes travel as part of checked baggage allowance if within weight & dimensions.',
      metadata: { category: 'baggage', type: 'excess-sports' },
    },

    // ── UK261 / EU261 Delay & Cancellation Rights ─────────────────────
    {
      id: 'uk261-compensation-delay',
      text: 'UK261 / EU261 Flight Delay Rights: If your B Airways flight is delayed by 2+ hours (short-haul) or 3+ hours (long-haul), BA must provide Duty of Care: complimentary food/drink vouchers, 2 phone calls/emails. If delayed 3+ hours on arrival due to BA fault (non-extraordinary circumstance), cash compensation applies: £220 for flights <1500km; £350 for flights 1500-3500km; £520 for flights >3500km delayed over 4 hours.',
      metadata: { category: 'uk261', topic: 'delay-rights' },
    },
    {
      id: 'uk261-compensation-cancellation',
      text: 'UK261 Cancellation Rights & Refunds: If your flight is cancelled by B Airways, you are entitled to a full refund within 7 days OR rebooking on the next available flight (including partner airlines) at no extra charge. If cancelled with less than 14 days notice, UK261 compensation of £220-£520 applies unless caused by extraordinary weather or air traffic control strikes.',
      metadata: { category: 'uk261', topic: 'cancellation-rights' },
    },
    {
      id: 'uk261-duty-of-care',
      text: 'UK261 Overnight Duty of Care & Hotel Accommodation: If a flight delay or cancellation requires an overnight stay, B Airways provides complimentary hotel accommodation, transport between airport and hotel, and evening dinner & breakfast. If passengers arrange their own hotel due to high disruption, BA reimburses reasonable costs upon claim submission.',
      metadata: { category: 'uk261', topic: 'hotel-duty-of-care' },
    },

    // ── Airport Operations & Hubs ─────────────────────────────────────
    {
      id: 'airport-lhr-t5',
      text: 'London Heathrow Terminal 5 (LHR T5): B Airways main hub terminal. Divided into T5A (Main Terminal), T5B (Satellite), and T5C (Satellite reached via underground transit train). Features The First Wing (Zones E/F) for Gold/First passengers with direct security line to Galleries First lounge. Express baggage drop in Zone C/D.',
      metadata: { category: 'airport', iata: 'LHR', terminal: '5' },
    },
    {
      id: 'airport-lhr-terminals',
      text: 'London Heathrow Terminal 3 (LHR T3): Select BA flights operate from T3 (including flights to Accra, Austin, Las Vegas, Phoenix, São Paulo). Features BA T3 Galleries Club & First Lounges as well as access to Cathay Pacific and Qantas lounges for Sapphire/Emerald members.',
      metadata: { category: 'airport', iata: 'LHR', terminal: '3' },
    },
    {
      id: 'airport-lgw-south',
      text: 'London Gatwick South Terminal (LGW): Hub for BA leisure short-haul and long-haul routes (Caribbean, Orlando, Cape Town seasonal). Features dedicated BA Gatwick Club and First Lounge on Mezzanine level.',
      metadata: { category: 'airport', iata: 'LGW', terminal: 'South' },
    },
    {
      id: 'airport-jfk-t8',
      text: 'New York JFK Terminal 8: B Airways operates jointly with American Airlines from JFK T8. Features co-branded premium lounges: Chelsea Lounge (First Class / Concorde Room Card), Soho Lounge (Gold / Emerald), and Greenwich Lounge (Silver / Business Class).',
      metadata: { category: 'airport', iata: 'JFK', terminal: '8' },
    },

    // ── Flight Routes ─────────────────────────────────────────────────
    {
      id: 'route-lhr-jfk',
      text: 'London Heathrow (LHR) to New York JFK — B Airways operates up to 8 daily non-stop flights. Flight numbers include BA117, BA175, BA177, BA179, BA183, BA185. Duration: 7h 15m westbound, 6h 45m eastbound. Aircraft: Boeing 777-300ER and Airbus A350-1000 with Club Suite.',
      metadata: { category: 'route', from: 'LHR', to: 'JFK', airline: 'BA' },
    },
    {
      id: 'route-lhr-dxb',
      text: 'London Heathrow (LHR) to Dubai (DXB) — B Airways operates 3 daily non-stop flights (BA105, BA107, BA109). Duration: 6h 50m outbound, 7h 30m return. Aircraft: Boeing 787-10 Dreamliner and Airbus A380 with First Class & Club Suite.',
      metadata: { category: 'route', from: 'LHR', to: 'DXB', airline: 'BA' },
    },
    {
      id: 'route-lhr-nrt',
      text: 'London Heathrow (LHR) to Tokyo Narita / Haneda (NRT/HND) — Daily direct flights (BA005 / BA007). Flight duration: 13h 40m via polar route. Features Club Suite and World Traveller Plus.',
      metadata: { category: 'route', from: 'LHR', to: 'NRT', airline: 'BA' },
    },
    {
      id: 'route-lhr-syd',
      text: 'London Heathrow (LHR) to Sydney (SYD) — Daily flight BA015 operating via Singapore Changi (SIN). Flight duration: LHR-SIN 12h 50m, 1h 50m stopover, SIN-SYD 7h 45m. Total 21h 30m.',
      metadata: { category: 'route', from: 'LHR', to: 'SYD', airline: 'BA' },
    },
    {
      id: 'route-lhr-cdg',
      text: 'London Heathrow (LHR) to Paris Charles de Gaulle (CDG) — B Airways operates up to 7 daily short-haul flights (BA304, BA306, BA308, BA314, BA316, BA318). Duration: 1h 15m. Served by Airbus A320 and A321 with Club Europe and Euro Traveller.',
      metadata: { category: 'route', from: 'LHR', to: 'CDG', airline: 'BA' },
    },
    {
      id: 'route-lhr-bcn',
      text: 'London Heathrow (LHR) to Barcelona (BCN) — Up to 6 daily short-haul flights (BA472, BA474, BA478, BA480). Duration: 2h 15m. Served by Airbus A320neo family with Club Europe and Euro Traveller.',
      metadata: { category: 'route', from: 'LHR', to: 'BCN', airline: 'BA' },
    },

    // ── Special Customer Services ─────────────────────────────────────
    {
      id: 'service-family-travel',
      text: 'Family Travel & Bassinet Seats: Families with infants under 2 travel with free seat selection at booking. Free carry-on stroller (buggy) up to 117x38x38cm can be taken to airplane door and retrieved at arrival gate. Complimentary bassinet / carrycot seats available on long-haul flights (must reserve in advance via Manage My Booking). Infant milk and baby food can be carried through airport security.',
      metadata: { category: 'service', topic: 'family-infant' },
    },
    {
      id: 'service-special-meals',
      text: 'Special Dietary Meals: B Airways offers 14 special meal types free of charge on flights with meal service: Kosher (KSML), Halal (MOML), Hindu Non-Vegetarian (HNML), Vegan (VGML), Gluten Friendly (GFML), Diabetic (DBML), Low Sodium (LSML), Child Meal (CHML). Must be ordered at least 24 hours before departure via Manage My Booking.',
      metadata: { category: 'service', topic: 'special-meals' },
    },
    {
      id: 'service-special-assistance',
      text: 'Special Assistance & Accessibility: Wheelchair assistance, airport escort, blind/deaf assistance, and medical clearance services available free of charge. Assistance must be requested at least 48 hours before departure. Guide and assistance dogs travel free in cabin on certified routes.',
      metadata: { category: 'service', topic: 'accessibility' },
    },

    // ── Offers & Promotions ───────────────────────────────────────────
    {
      id: 'offer-summer-sale',
      text: 'Summer Escape Sale — Save up to 30% on selected flights to Europe and North America. Valid for travel through 31 August 2026. Use promo code: SUMMER30 at checkout on ba.com.',
      metadata: { category: 'offer', title: 'Summer Escape Sale', discount: '30% off', validUntil: '2026-08-31', promoCode: 'SUMMER30' },
    },
    {
      id: 'offer-business-deal',
      text: 'Business Class Sale — Upgrade to Club World for less on long-haul routes. Flights to New York JFK from £1,299 return. Promo code: BIZCLASS. Valid until 30 September 2026.',
      metadata: { category: 'offer', title: 'Business Class Deal', discount: 'From £1299', validUntil: '2026-09-30', promoCode: 'BIZCLASS' },
    },
    {
      id: 'offer-double-avios',
      text: 'Double Avios Promotion — Earn 2x Avios on all direct B Airways flights booked before 31 August 2026. Opt-in required in Executive Club account prior to booking. Code: DOUBLEAVIOS.',
      metadata: { category: 'offer', title: 'Double Avios', discount: '2x Avios', validUntil: '2026-08-31', promoCode: 'DOUBLEAVIOS' },
    },
    {
      id: 'offer-companion-voucher',
      text: 'BA American Express Companion Voucher: Earned by spending threshold on BA Amex cards. Entitles primary cardholder to book a second companion seat on any BA reward flight for zero additional Avios (taxes & fees payable), or 50% discount on Avios for solo traveler.',
      metadata: { category: 'offer', title: 'Companion Voucher' },
    },

    // ── Booking Management ────────────────────────────────────────────
    {
      id: 'booking-manage-my-booking',
      text: 'Manage My Booking — British Airways App: To view, change, or manage your booking, go to the Manage Booking page and enter your 6-character booking reference (PNR). From there you can: view flight details, select or change seats, add checked baggage, request special meals, add Extra Legroom seats, request upgrades, and cancel your booking. No surname required — only your booking reference.',
      metadata: { category: 'booking', topic: 'manage-booking' },
    },
    {
      id: 'booking-change-flight',
      text: 'Changing Your Flight: You can change your flight date, time, or route online up to 1 hour before departure (subject to fare rules and availability). Go to Manage Booking and enter your reference. Flexible fares allow changes for free. Standard Economy changes may incur a fee plus any fare difference. Same Day Change (SDC) allows rebooking on another flight on the same day for a flat fee, available to Executive Club members.',
      metadata: { category: 'booking', topic: 'change-flight' },
    },
    {
      id: 'booking-cancel-refund',
      text: 'Cancelling Your Booking & Refunds: You can cancel your booking online via Manage Booking up to 2 hours before departure. Fully Flexible fares receive a full refund within 7 days. Standard and Sale fares are non-refundable but the taxes and airport charges portion (typically £50-£200) is always refundable. If BA cancels your flight, you are entitled to a full cash refund under UK261 regardless of fare type.',
      metadata: { category: 'booking', topic: 'cancel-refund' },
    },
    {
      id: 'booking-seat-selection',
      text: 'Seat Selection Policy: Economy (World Traveller) — seat selection available from £10-£45 depending on route and seat type, or free 24h before departure (standard seats only). Extra Legroom / Exit Row seats from £25. Premium Economy — free seat selection at booking. Club World / Club Suite — free seat selection at booking, all seats are aisle-access flat beds. First Class — complimentary. Executive Club Bronze — free selection 7 days before. Silver/Gold — free at time of booking including exit rows.',
      metadata: { category: 'booking', topic: 'seat-selection' },
    },
    {
      id: 'booking-add-baggage',
      text: 'Adding Baggage Online: Pre-purchase extra baggage online via Manage Booking for up to 30% less than airport prices. Available up to 4 hours before departure. Standard additional bag costs from £60 for short-haul to £120 for long-haul. Overweight bags (23-32kg) cost £65 per bag at the airport (pre-purchase online to save). Sporting equipment (skis, bikes, golf bags) can be pre-booked online.',
      metadata: { category: 'booking', topic: 'add-baggage' },
    },
    {
      id: 'booking-checkin-process',
      text: 'Online Check-In Process: Check-in opens 24 hours before your scheduled departure. Open the Check-In page in the BA app and enter your 6-character booking reference. Select your seats if not already chosen. Download or add your boarding pass to Apple Wallet or Google Wallet. Bag drop closes 60 minutes before long-haul and 45 minutes before short-haul departures. Gates close 20 minutes before departure — arrive early.',
      metadata: { category: 'booking', topic: 'checkin-process' },
    },
    {
      id: 'booking-upgrade',
      text: 'Upgrading Your Booking: Avios Upgrade — use Avios to upgrade from Economy to Premium Economy from 7,500 Avios each way, or to Club World from 12,500-25,000 Avios each way (subject to availability). Bid Upgrade — eligible passengers receive a bid upgrade offer 3-7 days before departure. Club World upgrades via bid typically start from £150-£500 per person depending on route. Check Manage Booking for your upgrade options.',
      metadata: { category: 'booking', topic: 'upgrade' },
    },
    {
      id: 'booking-name-correction',
      text: 'Name Corrections on Bookings: Minor name corrections (up to 3 characters) can be made free of charge by contacting BA Customer Service or via Manage My Booking for simple typos. Full name changes are not permitted — the booking must be cancelled (if refundable) and rebooked. Ensure your name exactly matches your passport/travel document to avoid issues at the airport.',
      metadata: { category: 'booking', topic: 'name-correction' },
    },
    {
      id: 'booking-group-bookings',
      text: 'Group Bookings (10+ passengers): Groups of 10 or more passengers can receive special fares and flexible payment terms by contacting BA Groups (groups@ba.com). Deposit required upfront with balance due 12 weeks before departure. Group passengers may be split across different seat rows. A group coordinator is assigned to manage the booking.',
      metadata: { category: 'booking', topic: 'group-bookings' },
    },
  ];
}

/**
 * Classify user query intent & extract entity tokens.
 * @param {string} queryText
 * @returns {{ intent: string, entities: { iata: string[], flight: string[], tier: string[], cabin: string[] } }}
 */
function classifyQueryIntent(queryText) {
  const q = queryText.toLowerCase();
  const entities = {
    iata: [],
    flight: [],
    tier: [],
    cabin: [],
  };

  // Extract IATA codes & city names
  const iataMatches = queryText.match(/\b(LHR|JFK|DXB|NRT|HND|SYD|SIN|BCN|MLE|CPT|BOM|LGW|LCY|CDG|ORY|AMS|FCO|IST)\b/gi);
  if (iataMatches) {
    entities.iata = Array.from(new Set(iataMatches.map(code => code.toUpperCase())));
  }
  if (/\bparis\b/i.test(q) && !entities.iata.includes('CDG')) entities.iata.push('CDG');
  if (/\blondon\b/i.test(q) && !entities.iata.includes('LHR')) entities.iata.push('LHR');
  if (/\bnew york\b/i.test(q) && !entities.iata.includes('JFK')) entities.iata.push('JFK');
  if (/\bdubai\b/i.test(q) && !entities.iata.includes('DXB')) entities.iata.push('DXB');

  // Extract Flight Numbers
  const flightMatches = queryText.match(/\bBA\s?\d{1,4}\b/gi);
  if (flightMatches) {
    entities.flight = Array.from(new Set(flightMatches.map(f => f.replace(/\s+/g, '').toUpperCase())));
  }

  // Extract Tier
  if (/\bgold\b/i.test(q)) entities.tier.push('Gold');
  if (/\bsilver\b/i.test(q)) entities.tier.push('Silver');
  if (/\bbronze\b/i.test(q)) entities.tier.push('Bronze');
  if (/\bblue\b/i.test(q)) entities.tier.push('Blue');

  // Extract Cabin
  if (/\b(club world|club europe|club suite|business class|business)\b/i.test(q)) entities.cabin.push('Club World');
  if (/\b(first class|first)\b/i.test(q)) entities.cabin.push('First');
  if (/\b(world traveller plus|premium economy)\b/i.test(q)) entities.cabin.push('World Traveller Plus');
  if (/\b(world traveller|economy)\b/i.test(q)) entities.cabin.push('World Traveller');

  // Classify intent
  let intent = 'GENERAL';
  if (/\b(my booking|manage booking|find booking|view booking|booking reference|pnr|change flight|cancel booking|add bag|seat selection|choose seat|upgrade|name correction|rebook)\b/i.test(q)) {
    intent = 'BOOKING';
  } else if (/\b(check.?in|checkin|boarding pass|bag drop|check in online|check-in opens)\b/i.test(q)) {
    intent = 'CHECKIN';
  } else if (/\b(flight status|is my flight|on time|delayed|live status|tracking|track my flight|flight tracker)\b/i.test(q)) {
    intent = 'FLIGHT_STATUS';
  } else if (/\b(book|booking|reserve|ticket|fly to|want to book|search flights)\b/i.test(q)) {
    intent = 'BOOKING';
  } else if (/\b(uk261|eu261|compensation|delay|delayed|cancel|cancelled|refund|claim|rights)\b/i.test(q)) {
    intent = 'UK261';
  } else if (/\b(baggage|luggage|bag|carry-on|handbag|suitcase|allowance|weight|excess)\b/i.test(q)) {
    intent = 'BAGGAGE';
  } else if (/\b(lounge|galleries|concorde room|the first wing|shower|dining|food in lounge)\b/i.test(q)) {
    intent = 'LOUNGE';
  } else if (/\b(avios|tier|tier points|executive club|membership|gold|silver|bronze|blue|reward flight)\b/i.test(q)) {
    intent = 'EXECUTIVE_CLUB';
  } else if (/\b(cabin|seat|flat bed|club suite|legroom|world traveller|first class)\b/i.test(q)) {
    intent = 'CABIN';
  } else if (/\b(terminal|t5|t3|heathrow|gatwick|jfk|gate|airport)\b/i.test(q)) {
    intent = 'AIRPORT';
  } else if (/\b(flight|route|duration|flight time|direct flight)\b/i.test(q)) {
    intent = 'ROUTE';
  } else if (/\b(sale|discount|promo|code|offer|deal)\b/i.test(q)) {
    intent = 'OFFER';
  } else if (/\b(baby|infant|child|bassinet|stroller|buggy|special meal|kosher|halal|vegan|wheelchair|assistance)\b/i.test(q)) {
    intent = 'SERVICE';
  }

  return { intent, entities };
}

/**
 * Expand user query with British Airways domain terms.
 * @param {string} queryText
 * @returns {string} Expanded query string
 */
function expandBAQuery(queryText) {
  let expanded = queryText.toLowerCase();

  for (const [key, synonyms] of Object.entries(BA_SYNONYM_MAP)) {
    const reg = new RegExp(`\\b${key}\\b`, 'gi');
    if (reg.test(expanded)) {
      expanded += ' ' + synonyms.join(' ');
    }
  }

  return expanded;
}

/**
 * Calculate BM25 / Sparse term-match score for a document.
 * @param {object} doc
 * @param {string[]} queryTokens
 * @param {object} intentData
 * @returns {number}BM25 score
 */
function calculateBM25Score(doc, queryTokens, intentData) {
  if (!queryTokens || queryTokens.length === 0) return 0;

  const textLower = doc.text.toLowerCase();
  const metaStr = JSON.stringify(doc.metadata).toLowerCase();
  const idLower = doc.id.toLowerCase();

  let score = 0;
  const k1 = 1.2;
  const b = 0.75;
  const avgdl = 40;
  const docLen = textLower.split(/\s+/).length;

  for (const token of queryTokens) {
    if (token.length < 2) continue;

    let tf = 0;
    // Count exact occurrences in text
    const textMatches = (textLower.match(new RegExp(`\\b${token}\\b`, 'g')) || []).length;
    tf += textMatches * 2;

    // Count in metadata
    if (metaStr.includes(token)) tf += 3;
    if (idLower.includes(token)) tf += 4;

    if (tf > 0) {
      const idf = 1.5; // Fixed IDF scaling factor for domain corpus
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgdl)));
      score += idf * tfNorm;
    }
  }

  // Entity Boosts
  const { entities, intent } = intentData;

  // IATA & Route Origin/Destination Match
  if (entities.iata && entities.iata.length > 0) {
    const docIata = (doc.metadata?.iata || '').toUpperCase();
    const docFrom = (doc.metadata?.from || '').toUpperCase();
    const docTo   = (doc.metadata?.to || '').toUpperCase();
    if (
      entities.iata.includes(docIata) ||
      entities.iata.includes(docFrom) ||
      entities.iata.includes(docTo) ||
      entities.iata.some(i => textLower.includes(i.toLowerCase()))
    ) {
      score += 10.0;
    }
  }

  // Flight Match
  if (entities.flight && entities.flight.length > 0) {
    if (entities.flight.some(f => textLower.includes(f.toLowerCase()) || idLower.includes(f.toLowerCase()))) {
      score += 10.0;
    }
  }

  // Tier Match
  if (entities.tier && entities.tier.length > 0) {
    const docTier = doc.metadata?.tier || '';
    if (entities.tier.some(t => t.toLowerCase() === docTier.toLowerCase() || textLower.includes(t.toLowerCase()))) {
      score += 6.0;
    }
  }

  // Cabin Match
  if (entities.cabin && entities.cabin.length > 0) {
    const docCabin = doc.metadata?.cabin || '';
    if (entities.cabin.some(c => c.toLowerCase() === docCabin.toLowerCase() || textLower.includes(c.toLowerCase()))) {
      score += 6.0;
    }
  }

  // Intent Category Match
  const cat = doc.metadata?.category || '';
  if (intent !== 'GENERAL') {
    if (
      (intent === 'UK261' && cat === 'uk261') ||
      (intent === 'BAGGAGE' && cat === 'baggage') ||
      (intent === 'LOUNGE' && cat === 'lounge') ||
      (intent === 'EXECUTIVE_CLUB' && cat === 'executive-club') ||
      (intent === 'CABIN' && cat === 'cabin') ||
      (intent === 'AIRPORT' && cat === 'airport') ||
      (intent === 'ROUTE' && cat === 'route') ||
      (intent === 'OFFER' && cat === 'offer') ||
      (intent === 'SERVICE' && cat === 'service') ||
      (intent === 'BOOKING' && cat === 'booking') ||
      (intent === 'CHECKIN' && (cat === 'booking' || cat === 'service')) ||
      (intent === 'FLIGHT_STATUS' && cat === 'route')
    ) {
      score += 5.0;
    }
  }

  return score;
}

/**
 * Execute Sparse BM25 / Keyword search over built-in knowledge base.
 * @param {string} expandedQuery
 * @param {object} intentData
 * @param {number} topK
 * @returns {Array<{id: string, text: string, metadata: object, bm25Score: number}>}
 */
function queryBM25Docs(expandedQuery, intentData, topK = 10) {
  const docs = buildKnowledgeDocs();
  const queryTokens = expandedQuery
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

  if (queryTokens.length === 0) return [];

  const scored = docs.map(doc => {
    const score = calculateBM25Score(doc, queryTokens, intentData);
    return { doc, score };
  }).filter(item => item.score > 0);

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map(item => ({
    id: item.doc.id,
    text: item.doc.text,
    metadata: item.doc.metadata,
    bm25Score: item.score,
  }));
}

/**
 * Reciprocal Rank Fusion (RRF) Reranker.
 * Combines rankings from Dense Vector Search and Sparse BM25 Search.
 *
 * @param {Array<{id: string, text: string, metadata: object, distance: number}>} vectorDocs
 * @param {Array<{id: string, text: string, metadata: object, bm25Score: number}>} bm25Docs
 * @param {number} topK
 * @returns {Array<{id: string, text: string, metadata: object, rrfScore: number}>}
 */
function reciprocalRankFusion(vectorDocs, bm25Docs, topK = MAX_CONTEXT_DOCS) {
  const kRRF = 60; // RRF constant
  const scoreMap = new Map();

  // Process Vector Ranks
  vectorDocs.forEach((doc, rank) => {
    const id = doc.id || doc.metadata?.id || doc.text.substring(0, 30);
    const score = 1.0 / (kRRF + (rank + 1));

    scoreMap.set(id, {
      doc,
      rrfScore: score,
      vectorRank: rank + 1,
      bm25Rank: null,
    });
  });

  // Process BM25 Ranks
  bm25Docs.forEach((item, rank) => {
    const id = item.id;
    const score = 1.0 / (kRRF + (rank + 1));

    if (scoreMap.has(id)) {
      const existing = scoreMap.get(id);
      existing.rrfScore += score;
      existing.bm25Rank = rank + 1;
    } else {
      scoreMap.set(id, {
        doc: {
          id: item.id,
          text: item.text,
          metadata: item.metadata,
          distance: 0.2,
        },
        rrfScore: score,
        vectorRank: null,
        bm25Rank: rank + 1,
      });
    }
  });

  const ranked = Array.from(scoreMap.values());
  ranked.sort((a, b) => b.rrfScore - a.rrfScore);

  return ranked.slice(0, topK).map(item => ({
    id: item.doc.id || item.doc.metadata?.id || 'doc',
    text: item.doc.text,
    metadata: item.doc.metadata,
    rrfScore: item.rrfScore,
  }));
}

/**
 * Seed ChromaDB with initial knowledge base if connected.
 */
async function seedKnowledgeBase() {
  const collection = await getCollection();
  if (!collection) {
    logger.warn('Cannot seed knowledge base — ChromaDB not available');
    return false;
  }

  try {
    const count = await collection.count();
    if (count > 0) {
      logger.info('ChromaDB knowledge base already seeded', { count });
      return true;
    }
  } catch (err) {
    logger.warn('Failed to check ChromaDB collection count', { error: err.message });
  }

  const docs = buildKnowledgeDocs();
  const ids = docs.map((d) => d.id);
  const texts = docs.map((d) => d.text);
  const metadatas = docs.map((d) => d.metadata);

  try {
    await collection.add({ ids, documents: texts, metadatas });
    logger.info('ChromaDB knowledge base seeded', { documents: docs.length });
    return true;
  } catch (err) {
    logger.error('Failed to seed ChromaDB knowledge base', { error: err.message });
    return false;
  }
}

/**
 * Query ChromaDB vector collection.
 */
async function queryVectorDocuments(queryText, topK = 10) {
  const collection = await getCollection();
  if (!collection) return [];

  try {
    const results = await collection.query({
      queryTexts: [queryText],
      nResults: topK,
    });

    const ids = results.ids[0] || [];
    const docs = results.documents[0] || [];
    const metadatas = results.metadatas[0] || [];
    const distances = results.distances[0] || [];

    return docs.map((text, i) => ({
      id: ids[i] || `vec-${i}`,
      text: text || '',
      metadata: metadatas[i] || {},
      distance: distances[i] !== undefined ? distances[i] : 1.0,
    }));
  } catch (err) {
    logger.error('Failed to query ChromaDB documents', { error: err.message });
    return [];
  }
}

/**
 * Main RAG context retriever function.
 * Performs Hybrid Search (Vector + BM25) with Intent Classification and Reciprocal Rank Fusion.
 *
 * @param {string} userMessage  The user's voice input or chat prompt
 * @returns {Promise<string|null>} Formatted context string for LLM, or null if no relevant context
 */
async function getContext(userMessage) {
  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    return null;
  }

  const queryClean = userMessage.trim();

  try {
    // Step 1: Intent & Entity Extraction
    const intentData = classifyQueryIntent(queryClean);

    // Step 2: Query Expansion (BA Terminology mapping)
    const expandedQuery = expandBAQuery(queryClean);

    // Step 3: Vector Search (if ChromaDB ready)
    let vectorResults = [];
    if (isReady()) {
      vectorResults = await queryVectorDocuments(expandedQuery, 8);
      // Filter distance threshold
      vectorResults = vectorResults.filter(d => d.distance < RELEVANCE_THRESHOLD);
    }

    // Step 4: Sparse BM25 Search
    const bm25Results = queryBM25Docs(expandedQuery, intentData, 8);

    // Step 5: Reciprocal Rank Fusion (RRF) Reranking
    const rrfResults = reciprocalRankFusion(vectorResults, bm25Results, MAX_CONTEXT_DOCS);

    if (!rrfResults || rrfResults.length === 0) {
      logger.debug('No relevant RAG documents found for query', { query: queryClean });
      return null;
    }

    // Step 6: Format Context Snippets for LLM
    const contextParts = rrfResults.map((doc, idx) => {
      const category = doc.metadata?.category || 'general';
      const topic = doc.metadata?.topic || doc.metadata?.title || doc.id || `doc-${idx + 1}`;
      return `[${category.toUpperCase()} | ${topic}]\n${doc.text}`;
    });

    let context = contextParts.join('\n\n');

    // Truncate length to fit context budget
    if (context.length > MAX_CONTEXT_CHARS) {
      context = context.substring(0, MAX_CONTEXT_CHARS) + '...';
    }

    logger.info('Retrieved advanced RAG context', {
      intent: intentData.intent,
      entities: intentData.entities,
      docsCount: rrfResults.length,
      chars: context.length,
      query: queryClean.substring(0, 50),
    });

    return context;
  } catch (err) {
    logger.error('Failed to retrieve RAG context', { error: err.message });
    return null;
  }
}

/**
 * Build augmented prompt with ground-truth instructions.
 * @param {string} userMessage
 * @param {string} basePrompt
 * @returns {Promise<string>} Augmented prompt
 */
async function getAugmentedPrompt(userMessage, basePrompt) {
  const context = await getContext(userMessage);
  if (!context) {
    return basePrompt;
  }

  return `${basePrompt}

═══════════════════════════════════════════════════════
OFFICIAL BRITISH AIRWAYS KNOWLEDGE BASE CONTEXT (RAG):
═══════════════════════════════════════════════════════
${context}

═══════════════════════════════════════════════════════
CRITICAL INSTRUCTIONS FOR RESPONDING:
1. You are embedded inside the British Airways app. Users can navigate directly to /manage (Manage Booking), /check-in (Check-In), /flight-status (Flight Status), /book (Search Flights), /executive-club (Avios). NEVER say "I don't have access to your booking" — always direct to the right page.
2. Speak in plain, clear, natural everyday conversational English. Never use technical jargon, raw JSON, or robotic phrases.
3. Use the official British Airways context above as your primary ground truth for answering questions about flights, baggage, Executive Club, lounges, and UK261 compensation.
4. Share numbers, limits, and policy details clearly in simple, friendly terms.
5. Keep your tone professional, warm, natural, and helpful as a premier British Airways representative.
═══════════════════════════════════════════════════════`;
}

/**
 * Initialise RAG service on server startup.
 */
async function initRAG() {
  const ok = await initChroma();
  if (!ok) {
    logger.warn('ChromaDB not available — hybrid BM25 search will handle RAG requests');
  } else {
    await seedKnowledgeBase();
  }
  return true;
}

module.exports = {
  initRAG,
  seedKnowledgeBase,
  queryVectorDocuments,
  queryBM25Docs,
  classifyQueryIntent,
  expandBAQuery,
  reciprocalRankFusion,
  getContext,
  getAugmentedPrompt,
  isReady,
  MAX_CONTEXT_DOCS,
  RELEVANCE_THRESHOLD,
  MAX_CONTEXT_CHARS,
};
