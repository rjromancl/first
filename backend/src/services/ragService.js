/**
 * ragService.js — Advanced Agentic Retrieval-Augmented Generation (RAG)
 *
 * Architecture:
 *  1. Dense Vector Search via ChromaDB (when available)
 *  2. Sparse BM25 with bigram/entity boosting
 *  3. Reciprocal Rank Fusion (RRF) reranking
 *  4. Intent classification (19 intents) + entity extraction
 *  5. Query expansion via BA synonym map
 *  6. Tool-calling schema — AI can call live app tools
 *  7. Agentic reasoning pipeline — multi-step, multi-intent
 *  8. 80+ knowledge documents across all BA domains
 */
const { getCollection, initChroma, isReady } = require('../config/chroma');
const logger = require('../config/logger');

const MAX_CONTEXT_DOCS   = 8;
const RELEVANCE_THRESHOLD = 0.85;
const MAX_CONTEXT_CHARS  = 5000;

// ── Agentic Tool Definitions ────────────────────────────────────────────────
const AGENTIC_TOOLS = [
  {
    name: 'search_flights',
    description: 'Search available flights between two airports for a given date, cabin, and passenger count',
    parameters: {
      type: 'object',
      required: ['from', 'to', 'departureDate'],
      properties: {
        from:          { type: 'string', description: 'Origin IATA code (e.g. LHR)' },
        to:            { type: 'string', description: 'Destination IATA code (e.g. JFK)' },
        departureDate: { type: 'string', description: 'Departure date YYYY-MM-DD' },
        returnDate:    { type: 'string', description: 'Return date YYYY-MM-DD (optional)' },
        cabin:         { type: 'string', enum: ['ECONOMY','PREMIUM_ECONOMY','BUSINESS','FIRST'] },
        adults:        { type: 'integer', minimum: 1, maximum: 9 },
      },
    },
  },
  {
    name: 'get_booking',
    description: 'Retrieve a booking by its 6-character reference code',
    parameters: {
      type: 'object',
      required: ['reference'],
      properties: {
        reference: { type: 'string', description: '6-character PNR / booking reference' },
      },
    },
  },
  {
    name: 'get_flight_status',
    description: 'Get live status of a British Airways flight by flight number or route',
    parameters: {
      type: 'object',
      properties: {
        flightNumber: { type: 'string', description: 'BA flight number e.g. BA117' },
        from:         { type: 'string', description: 'Origin IATA' },
        to:           { type: 'string', description: 'Destination IATA' },
        date:         { type: 'string', description: 'Flight date YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'calculate_avios',
    description: 'Calculate Avios earned for a flight route and cabin class',
    parameters: {
      type: 'object',
      required: ['from', 'to'],
      properties: {
        from:  { type: 'string', description: 'Origin IATA' },
        to:    { type: 'string', description: 'Destination IATA' },
        cabin: { type: 'string', enum: ['economy','premium_economy','business','first'] },
      },
    },
  },
  {
    name: 'get_destinations',
    description: 'List British Airways destinations, optionally filtered by category',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['city','beach','luxury','adventure','all'] },
      },
    },
  },
  {
    name: 'navigate',
    description: 'Direct the user to a specific page in the British Airways app',
    parameters: {
      type: 'object',
      required: ['path'],
      properties: {
        path:  { type: 'string', description: 'App path e.g. /manage, /check-in, /book' },
        label: { type: 'string', description: 'Button label shown to user' },
        prefill: {
          type: 'object',
          description: 'Optional params to pre-fill on the destination page',
          properties: {
            from: { type: 'string' }, to: { type: 'string' },
            departureDate: { type: 'string' }, cabin: { type: 'string' },
          },
        },
      },
    },
  },
  {
    name: 'check_in',
    description: 'Start the check-in process for a booking reference',
    parameters: {
      type: 'object',
      required: ['reference'],
      properties: {
        reference: { type: 'string', description: '6-character booking reference' },
      },
    },
  },
];

module.exports.AGENTIC_TOOLS = AGENTIC_TOOLS;

// ── BA Synonym Map ──────────────────────────────────────────────────────────
const BA_SYNONYM_MAP = {
  'business class':    ['club world','club europe','club suite','business'],
  'first class':       ['first','concorde room','first wing'],
  'economy':           ['world traveller','euro traveller','wt','et'],
  'premium economy':   ['world traveller plus','wt+','premium'],
  'points':            ['avios','tier points','tp'],
  'miles':             ['avios','reward points'],
  'rewards':           ['avios','reward flight saver','rfs','companion voucher'],
  'gold':              ['executive club gold','oneworld emerald','concorde room'],
  'silver':            ['executive club silver','oneworld sapphire','galleries lounge'],
  'bronze':            ['executive club bronze','oneworld ruby'],
  'lounge':            ['galleries club','galleries first','concorde room','first wing'],
  'luggage':           ['baggage','cabin bag','checked bag','hand luggage','suitcase'],
  'carry on':          ['cabin bag','hand luggage','personal item'],
  'delay':             ['uk261','eu261','delay compensation','duty of care','disruption'],
  'cancelled':         ['cancellation','uk261','rebooking','refund','disruption'],
  'compensation':      ['uk261','eu261','claim','duty of care'],
  'terminal 5':        ['t5','heathrow t5','lhr t5','first wing'],
  'heathrow':          ['lhr','london heathrow','t5','t3'],
  'gatwick':           ['lgw','london gatwick','lgw south'],
  'jfk':               ['new york jfk','terminal 8','chelsea lounge'],
  'dubai':             ['dxb','uae'],
  'tokyo':             ['nrt','narita','hnd','haneda'],
  'sydney':            ['syd','australia','kangaroo route'],
  'singapore':         ['sin','changi'],
  'barcelona':         ['bcn','spain'],
  'mumbai':            ['bom','bombay','india'],
  'paris':             ['cdg','orly','france'],
  'my booking':        ['manage booking','booking reference','pnr','reservation'],
  'manage':            ['manage booking','change booking','modify'],
  'change flight':     ['rebook','modify booking','same day change','sdc'],
  'cancel':            ['cancellation','refund','uk261','void'],
  'check in':          ['online check-in','checkin','boarding pass','web check-in'],
  'seat':              ['seat selection','choose seat','exit row','extra legroom'],
  'upgrade':           ['cabin upgrade','avios upgrade','bid upgrade','put me up'],
  'infant':            ['baby','lap infant','bassinet','carrycot'],
  'meal':              ['special meal','dietary','halal','kosher','vegan','gluten'],
  'wheelchair':        ['special assistance','accessibility','mobility','disabled'],
  'wi-fi':             ['wifi','internet','onboard connectivity','in-flight wifi'],
  'passport':          ['travel documents','visa','entry requirements','id'],
  'insurance':         ['travel insurance','cover','medical cover'],
};

// ── Knowledge Base ──────────────────────────────────────────────────────────
function buildKnowledgeDocs() {
  return [
    // ── DESTINATIONS ─────────────────────────────────────────────
    { id:'dest-jfk', text:'New York JFK — Daily direct from LHR T5/T3. 7h 30m. Boeing 777-300ER & A350-1000 Club Suite. Times Square, Central Park, Broadway. From £399. Currency USD.', metadata:{category:'destination',iata:'JFK',city:'New York',fromPrice:399} },
    { id:'dest-dxb', text:'Dubai DXB — 3 daily from LHR T5. 6h 45m. A380 & 787 with First & Club World. Burj Khalifa, Palm Jumeirah, Desert Safari. From £299. Best Nov-Mar. Currency AED.', metadata:{category:'destination',iata:'DXB',city:'Dubai',fromPrice:299} },
    { id:'dest-nrt', text:'Tokyo Narita NRT / Haneda HND — Daily from LHR T5. 11h 50m polar route. Club Suite & WT+. Shibuya, Fuji, Ginza. From £649. Best Mar-May, Sep-Nov. Currency JPY.', metadata:{category:'destination',iata:'NRT',city:'Tokyo',fromPrice:649} },
    { id:'dest-syd', text:'Sydney SYD — Daily BA015 via Singapore SIN. 21h 30m total. 777-300ER / 787-9. Opera House, Bondi Beach, Blue Mountains. From £799. Best Sep-Nov. Currency AUD.', metadata:{category:'destination',iata:'SYD',city:'Sydney',fromPrice:799} },
    { id:'dest-sin', text:'Singapore SIN Changi — Daily from LHR T5. 12h 55m. Gardens by the Bay, Marina Bay Sands, Sentosa. From £579. Stopover hub for Sydney. Currency SGD.', metadata:{category:'destination',iata:'SIN',city:'Singapore',fromPrice:579} },
    { id:'dest-bcn', text:'Barcelona BCN — Up to 6 daily short-haul from LHR. 2h 15m. A320neo family. Club Europe & Euro Traveller. Sagrada Familia, Park Guell, Las Ramblas. From £89.', metadata:{category:'destination',iata:'BCN',city:'Barcelona',fromPrice:89} },
    { id:'dest-cdg', text:'Paris CDG — Up to 7 daily from LHR. 1h 15m. A320/A321. Eiffel Tower, Louvre, Notre-Dame. From £79. Best Apr-Jun, Sep-Oct.', metadata:{category:'destination',iata:'CDG',city:'Paris',fromPrice:79} },
    { id:'dest-bom', text:'Mumbai BOM — Double daily from LHR T5. 9h 15m. 777 & 787 with Club Suite. Gateway of India, Marine Drive, Dharavi. From £489. Best Nov-Feb. Currency INR.', metadata:{category:'destination',iata:'BOM',city:'Mumbai',fromPrice:489} },
    { id:'dest-cpt', text:'Cape Town CPT — Direct from LHR T5 (and seasonal LGW). 11h 20m. Table Mountain, Cape of Good Hope, Boulders Beach, Winelands. From £449. Best Nov-Feb.', metadata:{category:'destination',iata:'CPT',city:'Cape Town',fromPrice:449} },
    { id:'dest-mle', text:'Maldives MLE — Direct from LHR T5. 10h 30m. Overwater villas, coral reefs, dolphin cruises. From £899. Best Nov-Apr. Currency USD/MVR.', metadata:{category:'destination',iata:'MLE',city:'Maldives',fromPrice:899} },
    { id:'dest-lhr', text:'London Heathrow LHR — BA main hub. Terminal 5 (T5A main, T5B, T5C satellites). Terminal 3 for select routes. The First Wing (Gold/First), Galleries First, Galleries Club South/North, Arrivals Lounge.', metadata:{category:'destination',iata:'LHR',city:'London',fromPrice:0} },
    { id:'dest-ams', text:'Amsterdam AMS — Multiple daily from LHR. 1h 20m. Rijksmuseum, Anne Frank House, Canal cruises. From £69. Short-haul Club Europe available.', metadata:{category:'destination',iata:'AMS',city:'Amsterdam',fromPrice:69} },
    { id:'dest-fco', text:'Rome FCO — Daily from LHR. 2h 40m. Colosseum, Vatican, Trevi Fountain. From £99. Best Apr-Jun, Sep-Oct.', metadata:{category:'destination',iata:'FCO',city:'Rome',fromPrice:99} },
    { id:'dest-ist', text:'Istanbul IST — Daily from LHR. 3h 50m. Hagia Sophia, Grand Bazaar, Bosphorus. From £149. Best Apr-May, Sep-Oct.', metadata:{category:'destination',iata:'IST',city:'Istanbul',fromPrice:149} },
    { id:'dest-del', text:'Delhi DEL — Daily from LHR T5. 8h 45m. Red Fort, Taj Mahal, India Gate. From £449. Best Oct-Mar. Currency INR.', metadata:{category:'destination',iata:'DEL',city:'Delhi',fromPrice:449} },
    { id:'dest-maa', text:'Chennai MAA — Via code-share. 10h+. Tamil Nadu cultural hub, Marina Beach, Kapaleeshwarar Temple, Mahabalipuram. From £499. Currency INR.', metadata:{category:'destination',iata:'MAA',city:'Chennai',fromPrice:499} },
  ];
}

function buildKnowledgeDocsExtended() {
  return [
    // ── EXECUTIVE CLUB & AVIOS ────────────────────────────────────
    { id:'ec-overview', text:'British Airways Executive Club: Free loyalty programme. Earn Avios on BA flights, partner airlines (Iberia, Finnair, Qatar, American, Cathay), hotels, car hire, credit cards. Avios never expire with 1 qualifying transaction every 36 months. Executive Club number format: BAXXXXXXXX.', metadata:{category:'executive-club',topic:'overview'} },
    { id:'ec-blue', text:'Executive Club Blue (entry level): 0 Tier Points required. Earn Avios at base rate. Book reward flights from 4,750 Avios. Free messaging on BA Wi-Fi. Access to member-only offers and sales.', metadata:{category:'executive-club',tier:'Blue',tierPoints:0} },
    { id:'ec-bronze', text:'Executive Club Bronze (oneworld Ruby): 300 Tier Points + 2 BA flights/year. Benefits: Priority check-in at Business counters, free standard seat selection 7 days before departure (not exit rows), 25% Avios earning bonus, Group 3 priority boarding, priority baggage tag.', metadata:{category:'executive-club',tier:'Bronze',tierPoints:300} },
    { id:'ec-silver', text:'Executive Club Silver (oneworld Sapphire): 600 Tier Points + 4 BA flights/year. Benefits: Galleries Club lounge for member + 1 guest (any cabin), free seat selection at booking (not exit rows), 50% Avios bonus, extra checked bag (2x32kg in Economy), Group 2 boarding, priority check-in.', metadata:{category:'executive-club',tier:'Silver',tierPoints:600} },
    { id:'ec-gold', text:'Executive Club Gold (oneworld Emerald): 1,500 Tier Points + 4 BA flights/year. Benefits: Galleries First & Galleries Club lounges for member + 1 guest, The First Wing at LHR T5 (dedicated check-in + fast track security), free seat selection including exit rows at booking, 100% Avios bonus, extra bag allowance, Group 1 boarding, Gold Priority reward redemptions.', metadata:{category:'executive-club',tier:'Gold',tierPoints:1500} },
    { id:'ec-concorde-card', text:'Concorde Room Card & Gold Guest List: Concorde Room Card at 5,000 Tier Points. Gold Guest List at 3,000 TP. Access: Concorde Room LHR T5 and JFK T8 — private dining booths, cabanas, Forty Winks sleep suites, vintage champagne, full waiter service. Most exclusive lounge in aviation.', metadata:{category:'executive-club',tier:'ConcordeCard',tierPoints:5000} },
    { id:'ec-avios-earn', text:'Earning Avios on Flights: Avios earned = cash fare (ex-taxes) × cabin multiplier × tier bonus. Multipliers: Economy 50%, Premium Economy 75%, Business 150%, First 300%. Tier bonus: Blue 0%, Bronze 25%, Silver 50%, Gold 100%. Partner airlines also earn at similar rates.', metadata:{category:'executive-club',topic:'earn-avios'} },
    { id:'ec-avios-spend', text:'Spending Avios: Reward Flights from 4,750 Avios + £1 (short-haul RFS). Upgrade Economy→Business from 7,500 Avios/segment. Upgrade to First from 12,500 Avios. Hotels via Avios.com from 4,000 Avios/night. Car hire from 2,000 Avios. Avios.com shopping/retail.', metadata:{category:'executive-club',topic:'spend-avios'} },
    { id:'ec-companion-voucher', text:'BA Amex Companion Voucher: Earned by spending £12,000+ on BA American Express Premium Plus card in a year. Books a second seat on any BA reward flight for zero additional Avios (only taxes/charges for second passenger). Or use as 50% Avios discount on solo travel. Valid 2 years from issue.', metadata:{category:'executive-club',topic:'companion-voucher'} },
    { id:'ec-tier-points', text:'Tier Points (TP): Earned on BA and partner flights based on route distance, cabin, and ticket type. Short-haul Europe: Economy 10 TP, Business 30 TP. Long-haul: Economy 40 TP, Premium Economy 80 TP, Business 120 TP, First 200 TP. TP count toward tier status renewal each membership year.', metadata:{category:'executive-club',topic:'tier-points'} },
    { id:'ec-family-account', text:'Executive Club Family Account: Pool Avios between up to 7 family members (1 lead + 6 companions). Lead member earns on all spend. Family members earn and pool Avios. Minimum 25% share from lead account. TP and tier status are individual — not pooled.', metadata:{category:'executive-club',topic:'family-account'} },

    // ── LOUNGES ───────────────────────────────────────────────────
    { id:'lounge-galleries-club', text:'Galleries Club Lounge: LHR T5 South, T5 North, T5B, LHR T3, LGW South, JFK T8. Eligible: Club World/Club Europe passengers, oneworld Business Class, Executive Club Silver/Gold + 1 guest. Features: Hot buffet dining, cold plates, champagne bar, barista coffee, shower suites, high-speed Wi-Fi, quiet work zone, children area.', metadata:{category:'lounge',name:'Galleries Club'} },
    { id:'lounge-galleries-first', text:'Galleries First Lounge: LHR T5 South, LGW South. Eligible: Executive Club Gold + 1 guest (any cabin), oneworld Emerald members. Features: Waiter-service à la carte dining with seasonal menu, Laurent-Perrier champagne on arrival, premium cocktail bar, spa treatment rooms (LHR), private shower suites, Elemis spa products.', metadata:{category:'lounge',name:'Galleries First'} },
    { id:'lounge-concorde-room', text:'The Concorde Room: LHR T5, JFK T8. Eligible: First Class passengers on BA, Concorde Room Card holders, Gold Guest List + 1 guest. Features: Private dining booths, Forty Winks sleep suites with turndown service, full waiter service, vintage Krug champagne, Dom Perignon bar, terrace (LHR T5), butler service.', metadata:{category:'lounge',name:'Concorde Room'} },
    { id:'lounge-first-wing', text:'The First Wing LHR T5: Exclusive dedicated terminal entrance for Gold members and First Class passengers. Features private check-in desks (bypasses standard queue), private security lane direct to airside, direct walk to Galleries First or Concorde Room, Galleries Club via private corridor. Available 04:30-21:00 daily.', metadata:{category:'lounge',name:'First Wing'} },
    { id:'lounge-jfk', text:'New York JFK T8 Lounges: Chelsea Lounge (First Class/Concorde Room Card), Soho Lounge (Gold/Emerald + Business Class), Greenwich Lounge (Silver/Sapphire + Business Class). All co-managed by BA and American Airlines. Features: Hot food, premium bar, shower suites (Chelsea & Soho).', metadata:{category:'lounge',iata:'JFK'} },

    // ── CABIN CLASSES ─────────────────────────────────────────────
    { id:'cabin-first', text:'First Class: Private suite with sliding door. 198cm fully flat bed + White Company duvet. Temperley London amenity kit. On-demand à la carte dining, Laurent-Perrier champagne. The First Wing + Concorde Room access. 3×32kg bags. Available: LHR-JFK, LHR-DXB, LHR-NRT, LHR-SYD, LHR-SIN, LHR-BOM, LHR-ORD, LHR-HKG, LHR-LAX.', metadata:{category:'cabin',cabin:'First'} },
    { id:'cabin-club-suite', text:'Club Suite (New Business Class on A350/B777): Direct aisle access from every seat, full-length sliding privacy door, 79-inch flat bed with mattress topper, White Company bedding, 18.5-inch HD screen, on-demand dining, champagne on arrival. Available on all long-haul Boeing 777-300ER, A350-1000 aircraft. 2×32kg bags.', metadata:{category:'cabin',cabin:'Club Suite'} },
    { id:'cabin-club-world', text:'Club World (Legacy Business Long-Haul): 183cm fully flat bed, alternating forward/backward facing, White Company duvet & amenity kit, multi-course dining, champagne & cocktails, priority boarding Group 1, lounge access. 2×32kg bags. Gradually being replaced by Club Suite on refurbished aircraft.', metadata:{category:'cabin',cabin:'Club World'} },
    { id:'cabin-club-europe', text:'Club Europe (Short-Haul Business): Front cabin, middle seat always empty for privacy. Hot meal service, complimentary drinks, fast track security, Galleries Club lounge, Group 1 boarding. 2×32kg bags. Available on all BA short-haul routes from LHR, LGW, and most UK airports.', metadata:{category:'cabin',cabin:'Club Europe'} },
    { id:'cabin-wt-plus', text:'World Traveller Plus (Premium Economy): Quiet dedicated cabin. 38-inch seat pitch (vs 31 WTE), wider seat, footrest, individual side table, 12-inch screen. Sparkling wine on arrival, three-course meal on fine china, amenity kit. Free seat selection at booking. 2×23kg bags.', metadata:{category:'cabin',cabin:'World Traveller Plus'} },
    { id:'cabin-world-traveller', text:'World Traveller (Long-Haul Economy): 31-inch pitch, 10-inch HD screen, USB + power socket, complimentary meal and drinks, noise-reducing headphones. Additional leg room seats (extra fee) available in specific rows. 1×23kg bag. Hand baggage: 1 cabin bag + 1 personal item.', metadata:{category:'cabin',cabin:'World Traveller'} },
  ];
}

function buildKnowledgeDocsPolicies() {
  return [
    // ── BAGGAGE ───────────────────────────────────────────────────
    { id:'bag-hand', text:'Hand Baggage (all tickets): 1 cabin bag 56×45×25cm (overhead) + 1 personal item 40×30×15cm (under seat). Max 23kg each — passenger must lift unaided. 1 baby changing bag free for infants. Musical instruments under 56×45×25cm as personal item.', metadata:{category:'baggage',type:'hand'} },
    { id:'bag-checked', text:'Checked Baggage by Cabin: HBO/Basic Economy = 0 bags. Standard Economy = 1×23kg. Premium Economy = 2×23kg. Club Europe/Club World/Club Suite = 2×32kg. First Class = 3×32kg. Dimensions max 90×75×43cm per bag.', metadata:{category:'baggage',type:'checked'} },
    { id:'bag-tier-bonus', text:'Executive Club Baggage Bonus: Silver & Gold (oneworld Sapphire/Emerald) get 1 additional checked bag + 32kg weight allowance in Economy. Bronze gets priority baggage delivery and tagging. Gold also gets overweight waiver on 1 bag.', metadata:{category:'baggage',type:'tier-bonus'} },
    { id:'bag-excess', text:'Excess Baggage: Pre-purchase online via Manage Booking up to 4 hours before departure for up to 30% saving. Extra bag short-haul: £65-£90 online, up to £110 at airport. Extra bag long-haul: £95-£130 online. Overweight bag (23-32kg): £65 online, £85 airport. Oversized: £90 each way.', metadata:{category:'baggage',type:'excess'} },
    { id:'bag-sports', text:'Sports & Special Baggage: Golf bags, skis/snowboards, surfboards, bikes, diving equipment — all count as 1 checked bag within allowance if within 23/32kg. Bicycles must be in a bike box or bag. Musical instruments over hand baggage size need their own seat or hold booking. Firearms require advance notification.', metadata:{category:'baggage',type:'sports'} },
    { id:'bag-liquids', text:'Liquids in Hand Baggage: Containers max 100ml each in 1 transparent resealable bag (20×20cm). Baby milk, liquid medications, and duty-free liquids over 100ml (in tamper-evident bag with receipt) are permitted with declaration.', metadata:{category:'baggage',type:'liquids'} },
    { id:'bag-restricted', text:'Restricted Items: Lithium batteries over 160Wh cannot fly. E-cigarettes in hold not permitted. Power banks max 27,000 mAh / 100Wh in carry-on only. Hoverboards / e-scooters banned on BA flights. Sharp objects in hold only (no exceptions for hand baggage).', metadata:{category:'baggage',type:'restricted'} },

    // ── UK261 / PASSENGER RIGHTS ──────────────────────────────────
    { id:'uk261-delay', text:'UK261 Delay Compensation: Flight delayed 3+ hours on arrival at destination due to BA fault (non-extraordinary): £220 (<1,500km), £350 (1,500–3,500km), £520 (>3,500km delayed 4h+). Compensation halved if BA re-routes you arriving within 2h (short), 3h (medium), 4h (long) of original arrival.', metadata:{category:'uk261',topic:'delay'} },
    { id:'uk261-cancel', text:'UK261 Cancellation: Cancelled with <14 days notice = same compensation £220/£350/£520 unless extraordinary. Always entitled to: full refund within 7 days OR re-routing at earliest opportunity. If re-routed on another airline BA must cover any price difference.', metadata:{category:'uk261',topic:'cancellation'} },
    { id:'uk261-duty-of-care', text:'UK261 Duty of Care: For 2h+ delay (short-haul) or 3h+ delay (long-haul) BA must provide: free meals/refreshments, 2 free phone calls or emails, free hotel accommodation + transfers for overnight delay, access to medical assistance if needed.', metadata:{category:'uk261',topic:'duty-of-care'} },
    { id:'uk261-claim', text:'How to Claim UK261: Submit claim online at ba.com/help/delays within 6 years (England/Wales). Include: booking reference, flight number, date, reason BA gave for delay, receipts for expenses (hotel, meals). BA must respond within 14 days. CEDR / CAA arbitration if BA refuses.', metadata:{category:'uk261',topic:'how-to-claim'} },
    { id:'uk261-extraordinary', text:'Extraordinary Circumstances (exempt from compensation): Severe weather, air traffic control strikes, security threats, political instability, bird strikes, medical emergencies causing diversion. COVID-19 restrictions were ruled extraordinary by UK courts. BA must still provide Duty of Care even for extraordinary circumstances.', metadata:{category:'uk261',topic:'extraordinary'} },
    { id:'uk261-downgrade', text:'Downgraded Flight Rights: If BA puts you in a lower cabin than booked: entitled to refund of fare difference — 30% refund (<1,500km), 50% refund (1,500–3,500km), 75% refund (>3,500km). Claim immediately at airport or online.', metadata:{category:'uk261',topic:'downgrade'} },

    // ── BOOKING MANAGEMENT ────────────────────────────────────────
    { id:'booking-manage', text:'Manage My Booking: Access via the Manage page with your 6-character booking reference (PNR). No surname required. Actions available: view itinerary, change seats, add baggage, special meals, upgrade, cancel. Available until 1 hour before departure.', metadata:{category:'booking',topic:'manage'} },
    { id:'booking-change', text:'Changing Flight: Flexible/fully-flexible fares — free date/route change any time. Standard Economy — change fee applies (typically £60-£100 short-haul, £150-£200 long-haul) plus fare difference. Sale fares — date change allowed, route changes not permitted. Same Day Change (SDC): rebook on same day for flat fee (Silver/Gold members priority access).', metadata:{category:'booking',topic:'change'} },
    { id:'booking-cancel', text:'Cancellation & Refunds: Fully Flexible — full refund within 7 days. Standard — taxes/fees refunded (£50-£200), base fare non-refundable. Sale fares — taxes only. 24-hour free cancellation (US law) applies to US-origin bookings. If BA cancels — full cash refund required within 7 days regardless of fare type.', metadata:{category:'booking',topic:'cancel-refund'} },
    { id:'booking-seat', text:'Seat Selection: Economy standard seat: £10-£45 depending on route, free 24h before departure. Extra Legroom / Exit Row: £25-£80. Premium Economy: free at booking. Club World/Suite: all flat beds, free at booking, direct aisle access every seat. Bronze EC: free 7 days before. Silver/Gold: free at booking including exit rows.', metadata:{category:'booking',topic:'seats'} },
    { id:'booking-upgrade', text:'Upgrade Options: Avios upgrade — Economy to Premium Economy from 7,500 Avios/segment, to Club World from 12,500 Avios (subject to availability). Bid Upgrade — offer sent 3-7 days before departure, minimum bid varies by route. Companion Voucher — second passenger travels free on reward flights. All upgrades via Manage Booking.', metadata:{category:'booking',topic:'upgrade'} },
    { id:'booking-name', text:'Name Corrections: Minor corrections (up to 3 chars) free via Manage Booking or BA call centre. Full name change not permitted — must cancel and rebook (fees apply). Name must exactly match passport/travel document. Title changes (Mr/Mrs/Ms/Dr) free at any time.', metadata:{category:'booking',topic:'name-change'} },
    { id:'booking-group', text:'Group Bookings (10+ pax): Special group fares via groups@ba.com or BA Groups team. Flexible payment — deposit upfront, balance 12 weeks before departure. One group coordinator per booking. Passengers may be split across rows. Group Avios earning applies.', metadata:{category:'booking',topic:'groups'} },
    { id:'booking-checkin', text:'Online Check-In: Opens 24 hours before scheduled departure. Use Check-In page with booking reference. Select/confirm seats. Digital boarding pass to Apple Wallet, Google Wallet, or PDF. Bag drop: 60 min long-haul, 45 min short-haul. Gates close 20 min before departure. Airport check-in also available.', metadata:{category:'booking',topic:'checkin'} },
    { id:'booking-baggage-add', text:'Adding Baggage: Pre-purchase via Manage Booking up to 4h before departure. Online prices up to 30% cheaper than airport. Short-haul extra bag from £65, long-haul from £95. Overweight (23-32kg) from £65 online. Sporting equipment pre-bookable online. Not available for HBO fares.', metadata:{category:'booking',topic:'add-baggage'} },

    // ── AIRPORT OPERATIONS ────────────────────────────────────────
    { id:'airport-lhr-t5', text:'LHR Terminal 5: BA main hub. T5A main terminal, T5B and T5C satellites (transit train). The First Wing for Gold/First passengers — dedicated check-in, private security, direct lounge access. T5 has Galleries First, Galleries Club South/North, Concorde Room. Most LHR BA flights use T5.', metadata:{category:'airport',iata:'LHR',terminal:'5'} },
    { id:'airport-lhr-t3', text:'LHR Terminal 3: Select BA routes including Accra (ACC), Austin (AUS), Las Vegas (LAS), Phoenix (PHX), São Paulo (GRU), plus codeshare partners. Features BA Galleries Club and Galleries First lounges. Connected to T5 via underground transit.', metadata:{category:'airport',iata:'LHR',terminal:'3'} },
    { id:'airport-lgw', text:'London Gatwick LGW South Terminal: BA leisure routes — Caribbean (BGI, ANU, MBJ), Orlando (MCO), Cape Town (CPT seasonal). BA Gatwick Club and First Lounge on Mezzanine, South Terminal. 30 min from central London by Gatwick Express.', metadata:{category:'airport',iata:'LGW'} },

    // ── ROUTES ────────────────────────────────────────────────────
    { id:'route-jfk', text:'LHR→JFK: Up to 8 daily non-stop. BA117, BA175, BA177, BA179, BA183, BA185. 7h 15m westbound, 6h 45m eastbound. B777-300ER and A350-1000 Club Suite fleet.', metadata:{category:'route',from:'LHR',to:'JFK'} },
    { id:'route-dxb', text:'LHR→DXB: 3 daily. BA105, BA107, BA109. 6h 50m outbound. A380 and B787-10.', metadata:{category:'route',from:'LHR',to:'DXB'} },
    { id:'route-nrt', text:'LHR→NRT: Daily BA005. 13h 40m polar route. B787-9. Also HND via BA007.', metadata:{category:'route',from:'LHR',to:'NRT'} },
    { id:'route-syd', text:'LHR→SYD: Daily BA015 via SIN. LHR-SIN 12h 50m + 1h 50m stopover + SIN-SYD 7h 45m = 21h 30m total.', metadata:{category:'route',from:'LHR',to:'SYD'} },
    { id:'route-bcn', text:'LHR→BCN: Up to 6 daily. BA472, BA474, BA476, BA478, BA480. 2h 15m. A320neo family.', metadata:{category:'route',from:'LHR',to:'BCN'} },
    { id:'route-cdg', text:'LHR→CDG: Up to 7 daily. BA304-BA318 (even numbers). 1h 15m. A320/A321.', metadata:{category:'route',from:'LHR',to:'CDG'} },
    { id:'route-bom', text:'LHR→BOM: Double daily. BA117 and BA139. 9h 15m. B787-9 and B777.', metadata:{category:'route',from:'LHR',to:'BOM'} },

    // ── SPECIAL SERVICES ─────────────────────────────────────────
    { id:'svc-special-meals', text:'Special Meals (14 types, free): Kosher (KSML), Halal (MOML), Hindu non-veg (HNML), Vegan (VGML), Vegetarian Jain (VJML), Gluten-free (GFML), Diabetic (DBML), Low cholesterol (LCML), Low sodium (LSML), Low calorie (VLML), Fruit (FPML), Seafood (SFML), Child (CHML), Baby (BBML). Order via Manage Booking at least 24h before departure.', metadata:{category:'service',topic:'meals'} },
    { id:'svc-family', text:'Family & Infant Travel: Infants under 2 travel free on lap (1 infant per adult). Infant must be under 2 at departure AND return date. COTS/bassinet seats on long-haul — free, book via Manage Booking. Stroller to aircraft door, collected at arrival gate. Child meal (CHML) bookable for ages 2-12.', metadata:{category:'service',topic:'family'} },
    { id:'svc-unaccompanied', text:'Unaccompanied Minors (UM): Children 5-11 can travel alone on direct BA flights. Book UM service at least 24h before. Fee: £40 each way (waived for Gold EC members). Child escorted from check-in to seat and from aircraft to collecting adult at destination. Form required.', metadata:{category:'service',topic:'unaccompanied-minor'} },
    { id:'svc-assistance', text:'Special Assistance: Wheelchair at airport, assistance through security, escort to gate — all free, book 48h before. WCHR (can walk short distances), WCHC (full assistance), WCBD (own wheelchair in hold). Medical clearance (MEDIF form) required for medical conditions that may affect fitness to fly.', metadata:{category:'service',topic:'accessibility'} },
    { id:'svc-pets', text:'Pets: Pets cannot travel in cabin on BA flights (except assistance dogs). Guide/hearing/mobility assistance dogs travel free in cabin with approved documentation. Pet travel in hold on some routes via BA World Cargo — book separately through cargo.ba.com.', metadata:{category:'service',topic:'pets'} },
    { id:'svc-wifi', text:'In-flight Wi-Fi: Available on most long-haul and many short-haul aircraft. Free messaging (WhatsApp, iMessage, SMS) for all Executive Club members. Full browsing: £3.99 (1 hour), £9.99 (flight pass). Streaming available at 1080p on selected aircraft. Not available on very short flights (<30 min).', metadata:{category:'service',topic:'wifi'} },
    { id:'svc-entertainment', text:'In-flight Entertainment: 1,000+ hours movies, TV, music, games on personal screen. On-demand — pause, rewind, watch from start. Noise-reducing headphones provided in Club World and First. Bluetooth headphone pairing available on A350 and selected B777 aircraft. High Wings app available on iPad.', metadata:{category:'service',topic:'entertainment'} },

    // ── OFFERS & PROMOTIONS ───────────────────────────────────────
    { id:'offer-summer', text:'Summer Escape Sale 2026: Save up to 30% on selected Europe and North America flights. Travel through 31 August 2026. Promo code SUMMER30. Excludes some peak dates. Club Europe and Economy both included.', metadata:{category:'offer',title:'Summer Sale',promoCode:'SUMMER30'} },
    { id:'offer-bizclass', text:'Business Class Sale 2026: Club World from £1,299 return to New York. Promo code BIZCLASS. Valid to 30 September 2026. Includes lounge access and 2×32kg bags. Limited availability on peak travel dates.', metadata:{category:'offer',title:'Business Class Deal',promoCode:'BIZCLASS'} },
    { id:'offer-double-avios', text:'Double Avios Promotion: Earn 2× Avios on all direct BA flights booked before 31 July 2026. Must opt-in in Executive Club account before booking. Code DOUBLEAVIOS. Applies to all cabin classes including Economy.', metadata:{category:'offer',title:'Double Avios',promoCode:'DOUBLEAVIOS'} },

    // ── TRAVEL REQUIREMENTS ───────────────────────────────────────
    { id:'travel-visa', text:'Visa & Travel Documentation: Always carry a valid passport with 6+ months validity beyond return date. Check destination entry requirements at gov.uk/foreign-travel-advice or TIMATIC via ba.com. ESTA required for USA (apply online 72h before). ETA required for UK inbound (non-British). eTA required for Canada. Schengen visa covers most EU countries.', metadata:{category:'travel',topic:'visa'} },
    { id:'travel-insurance', text:'Travel Insurance: BA recommends purchasing comprehensive travel insurance covering medical emergencies, cancellation, and baggage. EHIC/GHIC cards cover EU/EEA medical treatment for UK residents. Annual multi-trip policies often better value for frequent travellers. BA offers insurance via AXA at ba.com/travelinsurance.', metadata:{category:'travel',topic:'insurance'} },
    { id:'travel-advance-passenger', text:'Advance Passenger Information (API): Required for USA, Canada, Australia, and most long-haul destinations. Enter passport details via Manage Booking before check-in. Name must exactly match passport. Failure to provide API may result in boarding denial at destination.', metadata:{category:'travel',topic:'api-passport'} },
  ];
}

// ── Combined knowledge base ─────────────────────────────────────────────────
function getAllKnowledgeDocs() {
  return [
    ...buildKnowledgeDocs(),
    ...buildKnowledgeDocsExtended(),
    ...buildKnowledgeDocsPolicies(),
  ];
}

// ── Intent classification (19 intents) ─────────────────────────────────────
function classifyQueryIntent(queryText) {
  const q = queryText.toLowerCase();
  const entities = { iata: [], flight: [], tier: [], cabin: [], reference: [] };

  // IATA codes & cities
  const iataRe = /\b(LHR|LGW|LCY|JFK|EWR|LAX|ORD|DXB|NRT|HND|SYD|SIN|BCN|MLE|CPT|BOM|CDG|ORY|AMS|FCO|IST|MAD|FRA|ZRH|DUB|DEL|MAA|HKG|BKK|KUL|YYZ|GRU|ACC|NBO|JNB|CMN|CAI)\b/gi;
  const im = queryText.match(iataRe);
  if (im) entities.iata = [...new Set(im.map(c => c.toUpperCase()))];
  if (/\b(paris|france)\b/i.test(q) && !entities.iata.includes('CDG')) entities.iata.push('CDG');
  if (/\b(london|heathrow)\b/i.test(q) && !entities.iata.includes('LHR')) entities.iata.push('LHR');
  if (/\b(new york|nyc|newyork)\b/i.test(q) && !entities.iata.includes('JFK')) entities.iata.push('JFK');
  if (/\b(dubai|uae)\b/i.test(q) && !entities.iata.includes('DXB')) entities.iata.push('DXB');
  if (/\b(tokyo|japan)\b/i.test(q) && !entities.iata.includes('NRT')) entities.iata.push('NRT');
  if (/\b(sydney|australia)\b/i.test(q) && !entities.iata.includes('SYD')) entities.iata.push('SYD');
  if (/\b(barcelona|spain)\b/i.test(q) && !entities.iata.includes('BCN')) entities.iata.push('BCN');
  if (/\b(mumbai|bombay)\b/i.test(q) && !entities.iata.includes('BOM')) entities.iata.push('BOM');
  if (/\b(singapore)\b/i.test(q) && !entities.iata.includes('SIN')) entities.iata.push('SIN');
  if (/\b(delhi|india)\b/i.test(q) && !entities.iata.includes('DEL')) entities.iata.push('DEL');
  if (/\b(chennai|madras)\b/i.test(q) && !entities.iata.includes('MAA')) entities.iata.push('MAA');
  if (/\b(amsterdam)\b/i.test(q) && !entities.iata.includes('AMS')) entities.iata.push('AMS');
  if (/\b(rome|italy)\b/i.test(q) && !entities.iata.includes('FCO')) entities.iata.push('FCO');
  if (/\b(istanbul|turkey)\b/i.test(q) && !entities.iata.includes('IST')) entities.iata.push('IST');

  // Flight numbers
  const fm = queryText.match(/\bBA\s?\d{1,4}\b/gi);
  if (fm) entities.flight = [...new Set(fm.map(f => f.replace(/\s+/g,'').toUpperCase()))];

  // Booking references (6 alphanum)
  const rm = queryText.match(/\b[A-Z0-9]{6}\b/g);
  if (rm) entities.reference = rm.filter(r => /[A-Z]/.test(r) && /[0-9]/.test(r));

  // Tiers
  if (/\bgold\b/i.test(q))   entities.tier.push('Gold');
  if (/\bsilver\b/i.test(q)) entities.tier.push('Silver');
  if (/\bbronze\b/i.test(q)) entities.tier.push('Bronze');
  if (/\bblue\b/i.test(q))   entities.tier.push('Blue');

  // Cabins
  if (/club world|club suite|club europe|business class|business/i.test(q)) entities.cabin.push('Club World');
  if (/first class|first/i.test(q)) entities.cabin.push('First');
  if (/world traveller plus|premium economy|premium/i.test(q)) entities.cabin.push('World Traveller Plus');
  if (/world traveller|economy/i.test(q)) entities.cabin.push('World Traveller');

  // Intent (order matters — most specific first)
  let intent = 'GENERAL';
  if      (/\b(uk261|eu261|compensation|delay rights|cancel.*rights|duty of care|downgrade.*refund|stranded.*ba|flight.*rights)\b/i.test(q))                                                             intent = 'UK261';
  else if (/\b(baggage|luggage|carry.?on|hand baggage|checked bag|excess bag|suitcase|weight limit|how many kg|allowance.*bag|bag.*allowance|bag.*weight|extra bag|add.*bag|extra.*luggage)\b/i.test(q)) intent = 'BAGGAGE';
  else if (/\b(my booking|manage booking|find booking|view booking|booking ref|pnr|rebook|modify|cancel booking|seat selection|choose seat|name correction)\b/i.test(q))                                  intent = 'BOOKING';
  else if (/\b(check.?in|checkin|boarding pass|bag drop|check in online)\b/i.test(q))                                                                                                                     intent = 'CHECKIN';
  else if (/\b(flight status|is my flight|on time|live status|track.*flight|flight tracker|has.*landed|gate.*number)\b/i.test(q))                                                                        intent = 'FLIGHT_STATUS';
  else if (/\b(lounge|galleries|concorde room|first wing|shower.*airport|airport.*dining|can i use.*lounge)\b/i.test(q))                                                                                 intent = 'LOUNGE';
  else if (/\b(avios|tier points?|executive club|reward flight|companion voucher|earn.*point|how many.*avios|redeem.*avios|spend.*avios)\b/i.test(q))                                                  intent = 'EXECUTIVE_CLUB';
  else if (/\b(pet.*fly|fly.*pet|pet.*cabin|take.*pet|dog.*flight|cat.*flight|animal.*fly|animal.*cabin)\b/i.test(q))                                                                                   intent = 'PETS';
  else if (/\b(cabin|seat.*class|flat bed|legroom|club suite|world traveller|premium economy|first class|club world|club europe|what is.*class)\b/i.test(q))                                            intent = 'CABIN';
  else if (/\b(destination|where does ba fly|where can i fly|which countries|ba fly to|holiday destination|recommend.*destination|popular destination|places to visit)\b/i.test(q))                    intent = 'DESTINATION';
  else if (/\b(pet|dog|cat|animal in cabin|assistance dog|guide dog|take.*pet|fly.*pet)\b/i.test(q))                                                                                                    intent = 'PETS';
  else if (/\b(book|reserve|ticket|fly to|want to fly|search flights|find a flight|how much.*fly)\b/i.test(q))                                                                                         intent = 'BOOK_FLIGHT';
  else if (/\b(terminal|t5|t3|heathrow|gatwick|airport.*guide|which terminal|gate number)\b/i.test(q))                                                                                                  intent = 'AIRPORT';
  else if (/\b(route|flight time|duration|direct|non.?stop|which.*flight|how long.*fly)\b/i.test(q))                                                                                                   intent = 'ROUTE';
  else if (/\b(offer|sale|discount|promo|deal|cheap.*flight|best price)\b/i.test(q))                                                                                                                    intent = 'OFFER';
  else if (/\b(special meal|halal|kosher|vegan|gluten|diabetic|hindu meal|child meal|baby meal|meal.*type|dietary)\b/i.test(q))                                                                        intent = 'SPECIAL_MEAL';
  else if (/\b(wheelchair|assistance|disabled|accessibility|blind|deaf|mobility|umnr|unaccompanied)\b/i.test(q))                                                                                       intent = 'SPECIAL_SERVICE';
  else if (/\b(infant|baby|bassinet|cot|child.*travel|family.*travel|stroller|buggy|car seat)\b/i.test(q))                                                                                             intent = 'FAMILY';
  else if (/\b(visa|passport|entry requirements?|esta|eta|api|advance passenger|travel doc)\b/i.test(q))                                                                                               intent = 'TRAVEL_DOCS';
  else if (/\b(insurance|cover|medical cover|ehic|ghic)\b/i.test(q))                                                                                                                                   intent = 'INSURANCE';
  else if (/\b(wifi|wi-fi|internet.*flight|onboard.*internet|entertainment|inflight)\b/i.test(q))                                                                                                      intent = 'INFLIGHT_SERVICES';
  else if (/\b(delayed|cancel|cancelled|cancellation|refund)\b/i.test(q))                                                                                                                              intent = 'UK261';
  else if (/\b(change.*flight|change.*date|modify.*flight|reschedule|upgrade.*booking)\b/i.test(q))                                                                                                    intent = 'BOOKING';

  return { intent, entities };
}

// ── Query expansion ─────────────────────────────────────────────────────────
function expandBAQuery(queryText) {
  let expanded = queryText.toLowerCase();
  for (const [key, synonyms] of Object.entries(BA_SYNONYM_MAP)) {
    const reg = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`, 'gi');
    if (reg.test(expanded)) expanded += ' ' + synonyms.join(' ');
  }
  return expanded;
}

// ── BM25 scoring ────────────────────────────────────────────────────────────
function calculateBM25Score(doc, queryTokens, intentData) {
  if (!queryTokens?.length) return 0;
  const textLower = doc.text.toLowerCase();
  const metaStr   = JSON.stringify(doc.metadata).toLowerCase();
  const idLower   = doc.id.toLowerCase();
  let score = 0;
  const k1 = 1.2, b = 0.75, avgdl = 50;
  const docLen = textLower.split(/\s+/).length;

  for (const token of queryTokens) {
    if (token.length < 2) continue;
    let tf = (textLower.match(new RegExp(`\\b${token}\\b`,'g'))||[]).length * 2;
    if (metaStr.includes(token)) tf += 3;
    if (idLower.includes(token))  tf += 4;
    if (tf > 0) {
      const tfNorm = (tf*(k1+1))/(tf+k1*(1-b+b*(docLen/avgdl)));
      score += 1.5 * tfNorm;
    }
  }

  const { entities, intent } = intentData;

  // IATA boost
  if (entities.iata?.length) {
    const dIata = (doc.metadata?.iata||'').toUpperCase();
    const dFrom = (doc.metadata?.from||'').toUpperCase();
    const dTo   = (doc.metadata?.to||'').toUpperCase();
    if (entities.iata.some(i => i===dIata||i===dFrom||i===dTo||textLower.includes(i.toLowerCase()))) score += 12;
  }
  // Flight number boost
  if (entities.flight?.length && entities.flight.some(f => textLower.includes(f.toLowerCase()))) score += 12;
  // Tier boost
  if (entities.tier?.length) {
    const dTier = doc.metadata?.tier||'';
    if (entities.tier.some(t => t.toLowerCase()===dTier.toLowerCase()||textLower.includes(t.toLowerCase()))) score += 7;
  }
  // Cabin boost
  if (entities.cabin?.length) {
    const dCabin = doc.metadata?.cabin||'';
    if (entities.cabin.some(c => c.toLowerCase()===dCabin.toLowerCase()||textLower.includes(c.toLowerCase()))) score += 7;
  }
  // Intent-category boost
  const cat = doc.metadata?.category||'';
  const intentCatMap = {
    UK261:'uk261', BAGGAGE:'baggage', LOUNGE:'lounge', EXECUTIVE_CLUB:'executive-club',
    CABIN:'cabin', AIRPORT:'airport', ROUTE:'route', OFFER:'offer',
    SPECIAL_MEAL:'service', SPECIAL_SERVICE:'service', FAMILY:'service',
    BOOKING:'booking', CHECKIN:'booking', BOOK_FLIGHT:'destination',
    DESTINATION:'destination', TRAVEL_DOCS:'travel', INSURANCE:'travel',
    PETS:'service', INFLIGHT_SERVICES:'service', FLIGHT_STATUS:'route',
  };
  if (intent !== 'GENERAL' && intentCatMap[intent] === cat) score += 8;

  return score;
}

// ── BM25 search ─────────────────────────────────────────────────────────────
function queryBM25Docs(expandedQuery, intentData, topK = 12) {
  const docs        = getAllKnowledgeDocs();
  const queryTokens = expandedQuery.toLowerCase().replace(/[^\w\s]/g,' ').split(/\s+/).filter(t => t.length > 1);
  const scored      = docs.map(doc => ({ doc, score: calculateBM25Score(doc, queryTokens, intentData) }));
  scored.sort((a,b) => b.score - a.score);
  return scored.slice(0, topK).map(s => ({ id:s.doc.id, text:s.doc.text, metadata:s.doc.metadata, bm25Score:s.score }));
}

// ── Reciprocal Rank Fusion ───────────────────────────────────────────────────
function reciprocalRankFusion(vectorDocs, bm25Docs, topK = MAX_CONTEXT_DOCS) {
  const kRRF = 60;
  const map  = new Map();
  vectorDocs.forEach((doc, rank) => {
    const id    = doc.id || doc.text.slice(0,30);
    const score = 1/(kRRF+rank+1);
    map.set(id, { doc, rrfScore: score, vectorRank: rank+1, bm25Rank: null });
  });
  bm25Docs.forEach((item, rank) => {
    const score = 1/(kRRF+rank+1);
    if (map.has(item.id)) { map.get(item.id).rrfScore += score; map.get(item.id).bm25Rank = rank+1; }
    else map.set(item.id, { doc:{id:item.id,text:item.text,metadata:item.metadata}, rrfScore:score, vectorRank:null, bm25Rank:rank+1 });
  });
  const ranked = [...map.values()].sort((a,b) => b.rrfScore - a.rrfScore);
  return ranked.slice(0,topK).map(r => ({ id:r.doc.id, text:r.doc.text, metadata:r.doc.metadata, rrfScore:r.rrfScore }));
}

// ── ChromaDB vector search ──────────────────────────────────────────────────
async function queryVectorDocuments(queryText, topK = 12) {
  const collection = await getCollection();
  if (!collection) return [];
  try {
    const results = await collection.query({ queryTexts:[queryText], nResults:topK });
    return (results.documents[0]||[]).map((text,i) => ({
      id:       (results.ids[0]||[])[i] || `vec-${i}`,
      text:     text||'',
      metadata: (results.metadatas[0]||[])[i]||{},
      distance: (results.distances[0]||[])[i] ?? 1.0,
    })).filter(d => d.distance < RELEVANCE_THRESHOLD);
  } catch (err) {
    logger.warn('[ragService] ChromaDB query failed', { error:err.message });
    return [];
  }
}

// ── Seed ChromaDB ───────────────────────────────────────────────────────────
async function seedKnowledgeBase() {
  const collection = await getCollection();
  if (!collection) { logger.warn('[ragService] ChromaDB unavailable — using BM25 only'); return false; }
  try {
    const count = await collection.count();
    if (count > 0) { logger.info('[ragService] ChromaDB already seeded', {count}); return true; }
  } catch {}
  const docs = getAllKnowledgeDocs();
  try {
    await collection.add({ ids:docs.map(d=>d.id), documents:docs.map(d=>d.text), metadatas:docs.map(d=>d.metadata) });
    logger.info('[ragService] ChromaDB seeded', { documents:docs.length });
    return true;
  } catch (err) {
    logger.error('[ragService] ChromaDB seed failed', { error:err.message });
    return false;
  }
}

// ── Init ────────────────────────────────────────────────────────────────────
async function initRAG() {
  const ok = await initChroma();
  if (!ok) { logger.warn('[ragService] ChromaDB not available — BM25 hybrid active'); }
  else      { await seedKnowledgeBase(); }
  return true;
}

// ── getContext — core retrieval ─────────────────────────────────────────────
async function getContext(queryText) {
  if (!queryText?.trim()) return null;
  const clean      = queryText.trim();
  const intentData = classifyQueryIntent(clean);
  const expanded   = expandBAQuery(clean);

  let vectorDocs = [];
  if (isReady()) {
    vectorDocs = await queryVectorDocuments(expanded, 12);
  }
  const bm25Docs = queryBM25Docs(expanded, intentData, 12);
  const merged   = reciprocalRankFusion(vectorDocs, bm25Docs, MAX_CONTEXT_DOCS);

  if (!merged.length) return null;

  const parts = merged.map((doc, i) => {
    const cat   = doc.metadata?.category || 'general';
    const topic = doc.metadata?.topic || doc.metadata?.title || doc.metadata?.name || doc.id || `doc-${i+1}`;
    return `[${cat.toUpperCase()} | ${topic}]\n${doc.text}`;
  });

  let context = parts.join('\n\n');
  if (context.length > MAX_CONTEXT_CHARS) context = context.slice(0, MAX_CONTEXT_CHARS) + '...';

  logger.info('[ragService] Context retrieved', {
    intent: intentData.intent, docs: merged.length, chars: context.length,
  });
  return context;
}

// ── getContext with metadata ─────────────────────────────────────────────────
async function getContextWithSources(queryText) {
  if (!queryText?.trim()) return { context: null, sources: [], intent: 'GENERAL', entities: {} };
  const clean      = queryText.trim();
  const intentData = classifyQueryIntent(clean);
  const expanded   = expandBAQuery(clean);

  let vectorDocs = [];
  if (isReady()) vectorDocs = await queryVectorDocuments(expanded, 12);
  const bm25Docs = queryBM25Docs(expanded, intentData, 12);
  const merged   = reciprocalRankFusion(vectorDocs, bm25Docs, MAX_CONTEXT_DOCS);

  if (!merged.length) return { context: null, sources: [], intent: intentData.intent, entities: intentData.entities };

  const sources = merged.map(doc => ({
    id:       doc.id,
    category: doc.metadata?.category || 'general',
    label:    doc.metadata?.topic || doc.metadata?.title || doc.metadata?.name || doc.metadata?.type || doc.id,
    score:    Math.round((doc.rrfScore || 0) * 1000) / 1000,
  }));

  const parts = merged.map((doc,i) => {
    const cat   = doc.metadata?.category || 'general';
    const topic = sources[i].label;
    return `[${cat.toUpperCase()} | ${topic}]\n${doc.text}`;
  });
  let context = parts.join('\n\n');
  if (context.length > MAX_CONTEXT_CHARS) context = context.slice(0, MAX_CONTEXT_CHARS) + '...';

  return { context, sources, intent: intentData.intent, entities: intentData.entities };
}

// ── Augmented prompt ────────────────────────────────────────────────────────
async function getAugmentedPrompt(userMessage, basePrompt) {
  const context = await getContext(userMessage);
  if (!context) return basePrompt;
  return `${basePrompt}

═══════════════════════════════════════════════════════
OFFICIAL BRITISH AIRWAYS KNOWLEDGE BASE (RAG):
═══════════════════════════════════════════════════════
${context}

═══════════════════════════════════════════════════════
AGENTIC INSTRUCTIONS:
1. You ARE embedded inside the British Airways app. NEVER say "I don't have access".
2. For bookings/check-in/flight status: use the navigate tool or direct to the app page.
3. Use knowledge above as ground truth. Quote exact numbers (weights, prices, Tier Points).
4. Respond in the user's language (Tamil, Hindi, Tanglish, English, etc.).
5. Be warm, concise, and distinctly British Airways in tone.
═══════════════════════════════════════════════════════`;
}

// ── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  initRAG,
  seedKnowledgeBase,
  classifyQueryIntent,
  expandBAQuery,
  queryBM25Docs,
  queryVectorDocuments,
  reciprocalRankFusion,
  getContext,
  getContextWithSources,
  getAugmentedPrompt,
  getAllKnowledgeDocs,
  AGENTIC_TOOLS,
  isReady,
  MAX_CONTEXT_DOCS,
  RELEVANCE_THRESHOLD,
};
