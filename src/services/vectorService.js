/**
 * vectorService.js — Frontend RAG vector layer
 *
 * Calls the backend /api/rag/context and /api/rag/ask endpoints.
 * Falls back to a rich local multilingual knowledge corpus when offline.
 *
 * Exported API used by ragService.js and helpService.js:
 *   queryDocuments(query, topK)          → [{text, metadata, distance}]
 *   queryAgentic(query, history)         → full agentic response with toolResult
 *   getLocalKnowledgeFallback(query)     → [{text, metadata}]
 *   initVectorDB()                       → boolean
 */

const IS_DEV = Boolean(import.meta.env?.DEV);

const log    = (...a) => IS_DEV && console.log('[vectorService]', ...a);
const logErr = (...a) => IS_DEV ? console.error('[vectorService]', ...a) : console.error('[vectorService]', a[0]);

let isInitialized = false;
let healthCheckCache = { ready: false, timestamp: 0 };
const HEALTH_CACHE_TTL = 30_000;

// ── Health check ─────────────────────────────────────────────────────────────
async function checkBackendHealth() {
  const now = Date.now();
  if (now - healthCheckCache.timestamp < HEALTH_CACHE_TTL) return healthCheckCache.ready;
  try {
    const res  = await fetch('/api/rag/health', { method: 'GET' });
    const data = res.ok ? await res.json() : null;
    const ready = !!(data?.success && data.data?.ready);
    healthCheckCache = { ready, timestamp: now };
    return ready;
  } catch {
    healthCheckCache = { ready: false, timestamp: now };
    return false;
  }
}

export async function initVectorDB() {
  if (isInitialized) return true;
  const ready = await checkBackendHealth();
  isInitialized = ready;
  log(ready ? 'Backend RAG ready' : 'Backend RAG unavailable — using local corpus');
  return ready;
}

// ── Standard context query (for voice agent + geminiService) ─────────────────
export async function queryDocuments(queryText, topK = 6) {
  if (!isInitialized) await initVectorDB();
  try {
    const res = await fetch('/api/rag/context', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query: queryText, topK }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data?.context) {
        log(`Context received: ${data.data.context.length} chars, intent: ${data.data.intent?.intent}`);
        return [{
          text:     data.data.context,
          metadata: { category: 'rag-backend', intent: data.data.intent?.intent },
          distance: 0,
          sources:  data.data.sources || [],
        }];
      }
    }
  } catch (err) {
    logErr('Backend context query failed:', err.message);
  }
  return getLocalKnowledgeFallback(queryText);
}

// ── Agentic query (for helpService) ─────────────────────────────────────────
export async function queryAgentic(queryText, history = []) {
  if (!isInitialized) await initVectorDB();
  try {
    const res = await fetch('/api/rag/ask', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query: queryText, history, executeTool: true }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        log(`Agentic response: intent=${data.data.intent}, tool=${data.data.toolCall?.name}`);
        return data.data;   // { context, sources, intent, entities, toolCall, toolResult, navigateTo, actionBtn }
      }
    }
  } catch (err) {
    logErr('Agentic query failed:', err.message);
  }
  return null;
}

// ── Local multilingual knowledge corpus ──────────────────────────────────────
// Used when the backend is unreachable. Mirrors the backend knowledge base
// at a condensed level so offline mode still answers correctly.
const LOCAL_CORPUS = [
  {
    id: 'bag-hand',
    keywords: ['baggage','luggage','bag','carry','hand','cabin bag','weight','kg','suitcase','allowance',
               'எடை','பைய்','லக்கேஜ்','weightu','saamaan','baggaj','handbagage'],
    text: `BA Baggage Allowances:
Hand baggage (all tickets): 1 cabin bag 56×45×25cm + 1 personal item 40×30×15cm. Max 23kg each.
Checked: Economy 1×23kg | Premium Economy 2×23kg | Club World 2×32kg | First 3×32kg.
Executive Club Silver/Gold: +1 extra bag + 32kg limit in Economy.
Pre-purchase extra bags online via Manage Booking — up to 30% cheaper than airport.
Overweight bag (23-32kg): £65 online / £85 airport. Extra bag short-haul from £65, long-haul from £95.
Tamil: கைப்பை 23kg. Business-ல் 2 பைகள் (32kg). First-ல் 3 பைகள்.`,
    metadata: { category: 'baggage', topic: 'allowances' },
  },
  {
    id: 'ec-tiers',
    keywords: ['avios','tier','points','executive club','gold','silver','bronze','blue','reward','lounge access',
               'membership','companion voucher','tier points','earn avios','spend avios',
               'ஏவியோஸ்','புள்ளிகள்','poindhu','points','rewardsu'],
    text: `BA Executive Club Tiers:
Blue (0 TP): Earn Avios, member offers, free Wi-Fi messaging.
Bronze (300 TP + 2 flights): Priority check-in, free seats 7 days before, 25% Avios bonus, Group 3 boarding.
Silver (600 TP + 4 flights): Galleries Club lounge + 1 guest any cabin, free seat selection at booking, 50% Avios bonus, 2×32kg in Economy, Group 2 boarding.
Gold (1,500 TP + 4 flights): Galleries First + Concorde Room + 1 guest, The First Wing LHR, free exit rows, 100% Avios bonus, Group 1 boarding.
Avios never expire with 1 transaction per 36 months.
Earn: Economy 50% fare, Premium 75%, Business 150%, First 300% (× tier bonus).
Redeem: Reward flights from 4,750 Avios. Economy→Business upgrade from 7,500 Avios/segment. Economy→First from 12,500 Avios.
Companion Voucher: 2nd passenger travels free on reward flight (BA Amex Premium Plus, spend £12k/year).`,
    metadata: { category: 'executive-club', topic: 'tiers-avios' },
  },
  {
    id: 'booking-manage',
    keywords: ['my booking','manage booking','view booking','find booking','booking reference','pnr',
               'change flight','cancel','seat selection','add bag','upgrade','name correction','rebook',
               'என் பதிவு','booking kannu','meri booking','booking dekhna'],
    text: `BA Manage My Booking:
Access via the Manage page — enter 6-character booking reference (PNR). No surname needed.
Available actions: view itinerary, change seats, add baggage, special meals, upgrade using Avios, cancel booking.
Flight changes: Flexible fares — free. Standard Economy — change fee £60-£200 + fare difference. Sale fares — date change only.
Cancellations: Flexible fares — full refund 7 days. Standard — taxes/fees refunded (£50-£200). Sale — taxes only.
If BA cancels — full cash refund within 7 days regardless of fare type.
Name corrections (≤3 chars) free. Full name change not allowed — cancel and rebook.`,
    metadata: { category: 'booking', topic: 'manage' },
  },
  {
    id: 'checkin',
    keywords: ['check-in','checkin','check in','boarding pass','gate','terminal','bag drop','web check-in',
               'online check-in','boarding time','செக்-இன்','பாஸ்','check in pannu','board pannu','checkin karo'],
    text: `BA Online Check-In:
Opens 24 hours before scheduled departure. Use the Check-In page with your 6-character booking reference.
Digital boarding pass: Apple Wallet, Google Wallet, or PDF.
Bag drop closes: 60 min before long-haul | 45 min before short-haul.
Gates close: 20 minutes before departure — arrive at gate early.
Seat selection at check-in: standard seats free, Extra Legroom/Exit Row from £25.
Cannot check in if passport details (API) not submitted for USA/Canada/Australia.`,
    metadata: { category: 'booking', topic: 'checkin' },
  },
  {
    id: 'uk261',
    keywords: ['uk261','eu261','delay','delayed','cancel','cancelled','compensation','refund','rights',
               'claim','duty of care','hotel','stranded','disruption','downgrade','overnight',
               'தாமதம்','ரத்து','இழப்பீடு','cancel aaguthu','flight late','muavza'],
    text: `UK261 Passenger Rights:
Delay compensation (BA fault, not extraordinary): £220 (<1,500km) | £350 (1,500–3,500km) | £520 (>3,500km, 4h+ delay).
Cancellation <14 days notice: same compensation amounts.
Duty of Care (2h+ short-haul, 3h+ long-haul): free meals/drinks, 2 phone calls, hotel + transfers overnight.
Entitlements: Full refund within 7 days OR re-routing at earliest opportunity (including other airlines).
Downgrade refund: 30% (<1,500km), 50% (1,500–3,500km), 75% (>3,500km).
Extraordinary circumstances exempt from cash compensation but Duty of Care still applies.
How to claim: ba.com/help/delays — include booking ref, flight number, date, receipts. Respond within 14 days.`,
    metadata: { category: 'uk261', topic: 'rights' },
  },
  {
    id: 'lounges',
    keywords: ['lounge','galleries','concorde room','first wing','shower airport','airport dining','lounge access',
               'business lounge','first class lounge','silver lounge','gold lounge',
               'ஓய்வறை','lounge poga','lounge jaana'],
    text: `BA Airport Lounges:
Galleries Club (LHR T5 S/N/B, LHR T3, LGW South, JFK T8): Club World/Business pax + Silver/Gold EC + 1 guest. Hot buffet, champagne, showers, Wi-Fi.
Galleries First (LHR T5 South, LGW South): Gold EC + 1 guest (any cabin). À la carte dining, Champagne Bar, Elemis spa (LHR).
Concorde Room (LHR T5, JFK T8): First Class pax + Concorde Room Card holders. Private dining, Forty Winks sleep suites, vintage Krug.
The First Wing (LHR T5): Gold + First pax — dedicated check-in desks, private security lane, direct to Galleries First/Concorde Room.`,
    metadata: { category: 'lounge', topic: 'access' },
  },
  {
    id: 'cabins',
    keywords: ['cabin','first class','business class','club world','club suite','premium economy',
               'world traveller','flat bed','legroom','seat pitch','club europe','economy',
               'business travel','what is club world','தரம்','business vargam'],
    text: `BA Cabin Classes:
First Class: Private suite, 198cm flat bed, White Company duvet, à la carte on-demand dining, Laurent-Perrier champagne. Routes: LHR-JFK/DXB/NRT/SYD/SIN/BOM. 3×32kg bags. Concorde Room access.
Club Suite (New Business): Direct aisle access, full privacy door, 79-inch flat bed, 18.5-inch screen, fine dining. Available on A350 and B777-300ER. 2×32kg bags.
Club World (Legacy Business): 183cm flat bed, White Company bedding, on-demand dining. 2×32kg bags.
Club Europe (Short-Haul Business): Middle seat empty, hot meal, champagne. Lounge access. 2×32kg.
World Traveller Plus (Premium Economy): 38-inch pitch, sparkling wine, 3-course meal on fine china, amenity kit. 2×23kg.
World Traveller (Economy): 31-inch pitch, 10-inch screen, complimentary meal and drinks. 1×23kg.`,
    metadata: { category: 'cabin', topic: 'all-cabins' },
  },
  {
    id: 'destinations',
    keywords: ['destination','where fly','holiday','recommend','best place','where go','popular','routes',
               'new york','dubai','tokyo','sydney','barcelona','mumbai','paris','singapore','cape town',
               'இடங்கள்','kahan jaaye','where to travel','best destination'],
    text: `BA Top Destinations from London Heathrow (LHR):
New York JFK: 7h 30m | from £399 | up to 8 daily | Best Apr-Jun, Sep-Nov
Dubai DXB: 6h 45m | from £299 | 3 daily | Best Nov-Mar (hot desert summer Apr-Oct)
Tokyo NRT: 11h 50m | from £649 | daily | Best Mar-May, Sep-Nov (cherry blossom/autumn)
Sydney SYD: 21h 30m via SIN | from £799 | daily | Best Sep-Nov, Mar-May
Singapore SIN: 12h 55m | from £579 | daily | Best Feb-Apr
Barcelona BCN: 2h 15m | from £89 | up to 6 daily | Best Apr-Jun, Sep-Oct
Paris CDG: 1h 15m | from £79 | up to 7 daily
Mumbai BOM: 9h 15m | from £489 | double daily | Best Nov-Feb
Cape Town CPT: 11h 20m | from £449 | direct | Best Nov-Feb
Maldives MLE: 10h 30m | from £899 | Best Nov-Apr`,
    metadata: { category: 'destination', topic: 'popular-routes' },
  },
  {
    id: 'special-services',
    keywords: ['special meal','halal','kosher','vegan','gluten','diabetic','hindu meal','child meal',
               'infant','baby','bassinet','wheelchair','assistance','disabled','unaccompanied minor',
               'pets','dog','guide dog','சிறப்பு உணவு','halal khana','baby travel'],
    text: `BA Special Services:
Special Meals (14 types, free, order 24h before via Manage Booking): Halal (MOML), Kosher (KSML), Hindu non-veg (HNML), Vegan (VGML), Gluten-free (GFML), Diabetic (DBML), Child (CHML), Baby (BBML), Low sodium (LSML), Fruit (FPML), Seafood (SFML), Vegetarian Jain (VJML), Low calorie (VLML), Low cholesterol (LCML).
Infants (<2): Lap infant free. Bassinet/COTS on long-haul (free, pre-book). Stroller to aircraft door.
Unaccompanied Minors (ages 5-11): £40 fee each way, escorted throughout. Book 24h before.
Special Assistance: Wheelchair (WCHR/WCHC/WCBD), blind/deaf assistance — all free, book 48h before.
Pets: No pets in cabin (except guide/assistance dogs — free with docs). Pet hold via BA Cargo.`,
    metadata: { category: 'service', topic: 'special-services' },
  },
  {
    id: 'travel-docs',
    keywords: ['visa','passport','entry requirements','esta','eta','api','advance passenger','travel document',
               'insurance','ehic','ghic','travel insurance','viza','pasaport'],
    text: `BA Travel Requirements:
Passport: Valid 6+ months beyond return date for most destinations.
USA: ESTA required (apply online at esta.cbp.dhs.gov, 72h before, $21). Valid 2 years.
UK inbound: ETA required for most non-British visitors from 2024.
Canada: eTA required for most foreign nationals (online, CAD$7).
EU/Schengen: UK passport valid. No ESTA needed. Visa-free for most nationalities.
Advance Passenger Information (API): Submit passport details via Manage Booking before check-in for USA, Canada, Australia, UAE, and others.
Travel Insurance: EHIC/GHIC for EU medical cover (UK residents). BA offers AXA cover at ba.com/travelinsurance.`,
    metadata: { category: 'travel', topic: 'documents' },
  },
  {
    id: 'wifi-entertainment',
    keywords: ['wifi','wi-fi','internet flight','onboard internet','entertainment','movies','screens',
               'bluetooth headphones','streaming','inflight wifi',
               'wifi flight-la','inflight internet'],
    text: `BA In-flight Connectivity & Entertainment:
Wi-Fi: Available most long-haul and many short-haul aircraft.
Free messaging (WhatsApp, iMessage, SMS) for all Executive Club members.
Paid browse: £3.99/hour or £9.99 flight pass. Streaming available on A350/B777.
Entertainment: 1,000+ hours on-demand movies, TV, music, games. Pause and rewind any time.
Bluetooth headphone pairing: Available on A350 and selected B777 aircraft.
Power: USB-A + USB-C + AC power socket at every seat (long-haul). USB at short-haul seats.`,
    metadata: { category: 'service', topic: 'wifi-entertainment' },
  },
  {
    id: 'offers',
    keywords: ['offer','sale','deal','discount','promo','cheap','best price','double avios','companion',
               'summer sale','business deal','oferta','promo code'],
    text: `Current BA Offers:
Summer Escape Sale: Up to 30% off Europe + North America. Travel by 31 Aug 2026. Code: SUMMER30.
Business Class Deal: Club World from £1,299 return to New York. Valid to 30 Sep 2026. Code: BIZCLASS.
Double Avios: Earn 2× Avios on all BA flights booked by 31 Jul 2026. Opt-in in EC account. Code: DOUBLEAVIOS.
Companion Voucher: Second seat free on reward flight (BA Amex Premium Plus card, £12k spend/year).
Reward Flight Saver (RFS): Short-haul from 4,750 Avios + £1. Club World to NYC from 80,000 Avios + £350 return.`,
    metadata: { category: 'offer', topic: 'current-offers' },
  },
];

// ── Local fallback query ─────────────────────────────────────────────────────
export function getLocalKnowledgeFallback(query) {
  if (!query) return [];
  const q = query.toLowerCase().trim();

  // Score each document by keyword matches
  const scored = LOCAL_CORPUS.map(doc => {
    const hits = doc.keywords.filter(kw => q.includes(kw.toLowerCase())).length;
    // Also score by word overlap with doc text
    const words = q.split(/\s+/).filter(w => w.length > 2);
    const textHits = words.filter(w => doc.text.toLowerCase().includes(w)).length;
    return { doc, score: hits * 3 + textHits };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  if (!scored.length) return [];

  // Return top 3 matches combined
  const combined = scored.slice(0, 3).map(s => s.doc.text).join('\n\n---\n\n');
  return [{
    text:     combined,
    metadata: { category: 'local-rag', sources: scored.slice(0, 3).map(s => s.doc.metadata) },
    distance: 0,
  }];
}

// ── Utility exports ──────────────────────────────────────────────────────────
export async function addDocuments() { return true; }   // managed by backend
export function isVectorDBReady()    { return true; }
export async function seedKnowledgeBase() { return true; }
export function resetVectorDB() {
  isInitialized = false;
  healthCheckCache = { ready: false, timestamp: 0 };
}

export default {
  initVectorDB, queryDocuments, queryAgentic,
  getLocalKnowledgeFallback, addDocuments,
  isVectorDBReady, seedKnowledgeBase, resetVectorDB,
};
