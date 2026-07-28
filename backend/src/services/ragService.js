/**
 * ragService.js — Retrieval-Augmented Generation (RAG) service for the backend.
 *
 * This service manages the ChromaDB knowledge base for the B Airways
 * voice agent. It:
 *  1. Seeds the collection with comprehensive BA knowledge (destinations,
 *     offers, policies, festival guides, airport info, flight data)
 *  2. Queries the collection for semantically similar documents given a
 *     user query
 *  3. Formats the results as a concise context string for the LLM
 *
 * The service is designed to be resilient: if ChromaDB is not running or
 * the connection fails, all operations gracefully degrade (return empty
 * results) so the app continues to work without RAG.
 */
const { getCollection, initChroma, isReady, COLLECTION_NAME } = require('../config/chroma');
const logger = require('../config/logger');

// Maximum number of relevant documents to include in context
const MAX_CONTEXT_DOCS = 5;

// Distance threshold — lower is more similar (Chroma uses cosine distance)
// Only include documents with distance below this threshold
const RELEVANCE_THRESHOLD = 0.7;

// Maximum total characters of context to include (to bound prompt size)
const MAX_CONTEXT_CHARS = 3000;

/**
 * Build the comprehensive knowledge base documents.
 * Each document has an id, text, and metadata.
 */
function buildKnowledgeDocs() {
  return [
    // ── Destinations (from destinationService.js) ─────────────────────
    {
      id: 'dest-newyork',
      text: 'New York (JFK) — The city that never sleeps. Iconic skyline, world-class dining, art and culture. Popular attractions: Times Square, Central Park, Brooklyn Bridge, Metropolitan Museum. Best time to visit: April–June, September–November. Flight time from London: 7h 30m. From price: £399.',
      metadata: { category: 'destination', city: 'New York', country: 'United States', iata: 'JFK', fromPrice: 399, climate: 'Temperate', bestTime: 'Apr-Jun, Sep-Nov' },
    },
    {
      id: 'dest-dubai',
      text: 'Dubai (DXB) — Where luxury meets modernity. Soaring skyscrapers, desert safaris and beaches. Highlights: Burj Khalifa, Dubai Mall, Palm Jumeirah, Desert Safari. Best time to visit: November–March. Flight time from London: 6h 45m. From price: £299.',
      metadata: { category: 'destination', city: 'Dubai', country: 'UAE', iata: 'DXB', fromPrice: 299, climate: 'Hot Desert', bestTime: 'Nov-Mar' },
    },
    {
      id: 'dest-tokyo',
      text: 'Tokyo (NRT) — Ancient tradition meets futuristic innovation. Highlights: Shibuya Crossing, Senso-ji Temple, Mount Fuji, Shinjuku. Best time to visit: March–May, September–November. Flight time from London: 11h 50m. From price: £649.',
      metadata: { category: 'destination', city: 'Tokyo', country: 'Japan', iata: 'NRT', fromPrice: 649, climate: 'Humid Subtropical', bestTime: 'Mar-May, Sep-Nov' },
    },
    {
      id: 'dest-sydney',
      text: 'Sydney (SYD) — Harbourside beauty with stunning beaches, world-class cuisine and outdoor adventures. Highlights: Sydney Opera House, Bondi Beach, Harbour Bridge, Blue Mountains. Best time to visit: September–November, March–May. Flight time from London: 21h 30m. From price: £799.',
      metadata: { category: 'destination', city: 'Sydney', country: 'Australia', iata: 'SYD', fromPrice: 799, climate: 'Oceanic', bestTime: 'Sep-Nov, Mar-May' },
    },
    {
      id: 'dest-cape-town',
      text: 'Cape Town (CPT) — At the foot of Table Mountain, a city of astounding natural beauty and vibrant culture. Highlights: Table Mountain, Cape of Good Hope, Boulders Beach, Winelands. Best time to visit: November–February. Flight time from London: 11h 20m. From price: £449.',
      metadata: { category: 'destination', city: 'Cape Town', country: 'South Africa', iata: 'CPT', fromPrice: 449, climate: 'Mediterranean', bestTime: 'Nov-Feb' },
    },
    {
      id: 'dest-singapore',
      text: 'Singapore (SIN) — A sparkling city-state fusing futuristic architecture, lush gardens and incredible food. Highlights: Gardens by the Bay, Marina Bay Sands, Sentosa, Hawker Centres. Best time to visit: February–April. Flight time from London: 12h 55m. From price: £579.',
      metadata: { category: 'destination', city: 'Singapore', country: 'Singapore', iata: 'SIN', fromPrice: 579, climate: 'Tropical', bestTime: 'Feb-Apr' },
    },
    {
      id: 'dest-barcelona',
      text: 'Barcelona (BCN) — Gaudí\'s masterpieces, sun-drenched beaches and a food scene that rivals Paris. Highlights: Sagrada Família, Park Güell, Las Ramblas, Camp Nou. Best time to visit: April–June, September–October. Flight time from London: 2h 15m. From price: £89.',
      metadata: { category: 'destination', city: 'Barcelona', country: 'Spain', iata: 'BCN', fromPrice: 89, climate: 'Mediterranean', bestTime: 'Apr-Jun, Sep-Oct' },
    },
    {
      id: 'dest-maldives',
      text: 'Maldives (MLE) — Crystal-clear lagoons, overwater bungalows and pristine coral reefs. Best time to visit: November–April. Flight time from London: 10h 30m. From price: £899.',
      metadata: { category: 'destination', city: 'Maldives', country: 'Maldives', iata: 'MLE', fromPrice: 899, climate: 'Tropical', bestTime: 'Nov-Apr' },
    },
    {
      id: 'dest-london',
      text: 'London (LHR) — The home of B Airways. Heathrow is one of the world\'s busiest airports. The city offers historic landmarks like the Tower of London, Buckingham Palace, and the British Museum.',
      metadata: { category: 'destination', city: 'London', country: 'United Kingdom', iata: 'LHR', fromPrice: 0, climate: 'Temperate', bestTime: 'Year-round' },
    },
    {
      id: 'dest-mumbai',
      text: 'Mumbai (BOM) — India\'s financial capital and home to Bollywood. Visit the Gateway of India, Marine Drive, and explore the local street food. Best time to visit: November to February.',
      metadata: { category: 'destination', city: 'Mumbai', country: 'India', iata: 'BOM', fromPrice: 0, climate: 'Tropical Monsoon', bestTime: 'Nov-Feb' },
    },
    {
      id: 'dest-paris',
      text: 'Paris (CDG) — The City of Light, famous for the Eiffel Tower, Louvre Museum, and Notre-Dame Cathedral. Best time to visit: April to June or September to October.',
      metadata: { category: 'destination', city: 'Paris', country: 'France', iata: 'CDG', fromPrice: 0, climate: 'Temperate', bestTime: 'Apr-Jun, Sep-Oct' },
    },
    {
      id: 'dest-amsterdam',
      text: 'Amsterdam (AMS) — Known for its canals, museums, and cycling culture. Visit the Rijksmuseum, Van Gogh Museum, and take a boat tour through the historic canals. Best time: April-May or September-October.',
      metadata: { category: 'destination', city: 'Amsterdam', country: 'Netherlands', iata: 'AMS', fromPrice: 0, climate: 'Temperate', bestTime: 'Apr-May, Sep-Oct' },
    },
    {
      id: 'dest-rome',
      text: 'Rome (FCO) — The Eternal City, rich in ancient history. Visit the Colosseum, Vatican City, and the Roman Forum. Best time to visit: April-June or September-November.',
      metadata: { category: 'destination', city: 'Rome', country: 'Italy', iata: 'FCO', fromPrice: 0, climate: 'Mediterranean', bestTime: 'Apr-Jun, Sep-Nov' },
    },
    {
      id: 'dest-istanbul',
      text: 'Istanbul (IST) — Straddles Europe and Asia. Visit Hagia Sophia, the Grand Bazaar, and the Blue Mosque. Best time to visit: April-June or September-October.',
      metadata: { category: 'destination', city: 'Istanbul', country: 'Turkey', iata: 'IST', fromPrice: 0, climate: 'Humid Subtropical', bestTime: 'Apr-Jun, Sep-Oct' },
    },

    // ── Offers (from destinationService.js) ───────────────────────────
    {
      id: 'offer-summer-sale',
      text: 'Summer Escape Sale — Save up to 30% on selected flights to Europe this summer. Valid until 2026-08-31. Destinations: BCN, MAD, FCO, GVA. Promo code: SUMMER30.',
      metadata: { category: 'offer', title: 'Summer Escape Sale', discount: '30% off', validUntil: '2026-08-31', promoCode: 'SUMMER30' },
    },
    {
      id: 'offer-business-deal',
      text: 'Business Class Deal — Upgrade to Business for less on long-haul routes this autumn. From £999. Valid until 2026-09-30. Destinations: JFK, LAX, SIN, NRT. Promo code: BIZCLASS.',
      metadata: { category: 'offer', title: 'Business Class Deal', discount: 'From £999', validUntil: '2026-09-30', promoCode: 'BIZCLASS' },
    },
    {
      id: 'offer-double-avios',
      text: 'Earn Double Avios — Book by 31 July and earn double Avios on all flights. Valid until 2026-07-31. Promo code: DOUBLEAVIOS.',
      metadata: { category: 'offer', title: 'Earn Double Avios', discount: '2x Avios', validUntil: '2026-07-31', promoCode: 'DOUBLEAVIOS' },
    },

    // ── Check-in info ─────────────────────────────────────────────────
    {
      id: 'checkin-info',
      text: 'Online check-in opens 24 hours before departure and closes 1 hour before domestic flights or 45 minutes before international flights. You can check in via the B Airways app, website, or at the airport kiosk. Boarding typically begins 30 minutes before departure.',
      metadata: { category: 'checkin' },
    },
    {
      id: 'boarding-pass',
      text: 'Your boarding pass can be obtained during online check-in. It contains your flight number, seat number, gate information, and boarding time. You can store it on your phone or print it. At the airport, have it ready for security and boarding.',
      metadata: { category: 'boarding-pass' },
    },

    // ── Flight status ─────────────────────────────────────────────────
    {
      id: 'flight-status-info',
      text: 'You can track your flight status in real-time through the B Airways app or website. Flight status includes departure time, arrival time, gate information, and any delays or cancellations. Enter your flight number (e.g., BA117) or booking reference.',
      metadata: { category: 'flight-status' },
    },

    // ── Executive Club / Avios ────────────────────────────────────────
    {
      id: 'avios-info',
      text: 'Avios is the currency of the B Airways Executive Club. You earn Avios on every flight and can redeem them for flights, upgrades, and partner rewards. Your Avios balance never expires as long as your account is active. Log in to the Executive Club portal to check your balance.',
      metadata: { category: 'executive-club' },
    },
    {
      id: 'executive-club-tiers',
      text: 'B Airways Executive Club has three tiers: Blue (entry level), Bronze (earned 350+ tier points in a year), and Gold (earned 1500+ tier points in a year). Bronze offers priority check-in and extra baggage. Gold offers lounge access, priority boarding, and 50% bonus Avios.',
      metadata: { category: 'executive-club' },
    },

    // ── Baggage policy ────────────────────────────────────────────────
    {
      id: 'baggage-policy',
      text: 'B Airways baggage allowance varies by route and cabin class. Generally, economy passengers on long-haul flights get 1 checked bag (23kg), business class gets 2 bags (32kg each), and first class gets 3 bags (32kg each). Hand luggage allowance is 1 piece up to 23kg.',
      metadata: { category: 'baggage' },
    },

    // ── Seat selection ────────────────────────────────────────────────
    {
      id: 'seat-selection',
      text: 'You can select your seat during booking or online check-in. Seat selection is free for most cabins, but premium seats (aisle, window, extra legroom) may incur a fee. You can also select seats for your entire party at the same time.',
      metadata: { category: 'seats' },
    },

    // ── Festival travel guides ────────────────────────────────────────
    {
      id: 'christmas-travel',
      text: 'Christmas is a peak travel period. Popular destinations include New York (JFK), Dubai (DXB), and Sydney (SYD). Book early as prices are higher and seats fill up quickly. Typical Christmas travel dates are December 20-28.',
      metadata: { category: 'festival', festival: 'Christmas' },
    },
    {
      id: 'diwali-travel',
      text: 'Diwali is a major festival for Indian travelers. Popular destinations include Mumbai (BOM), Dubai (DXB), and Delhi. Book early as this is a peak period. Diwali typically falls in October or November.',
      metadata: { category: 'festival', festival: 'Diwali' },
    },
    {
      id: 'easter-travel',
      text: 'Easter holidays are popular for short-haul European flights. Top destinations include Barcelona (BCN), Rome (FCO), and Amsterdam (AMS). Easter typically falls in March or April.',
      metadata: { category: 'festival', festival: 'Easter' },
    },
    {
      id: 'summer-travel',
      text: 'Summer is peak season for European travel. Popular destinations include Barcelona (BCN), Dubai (DXB), and Greek islands. Book well in advance for the best prices. Summer holidays typically run from late July to early September.',
      metadata: { category: 'festival', festival: 'Summer' },
    },
    {
      id: 'eid-travel',
      text: 'Eid is a major travel period for Muslim travelers. Popular destinations include Dubai (DXB), Istanbul (IST), and Mumbai (BOM). Book early as this is a peak period. Eid ul-Fitr and Eid ul-Adha both fall in spring/autumn respectively.',
      metadata: { category: 'festival', festival: 'Eid' },
    },
    {
      id: 'new-year-travel',
      text: 'New Year is a popular travel period. Popular destinations include Sydney (SYD), Dubai (DXB), and New York (JFK). Book early as prices are higher and seats fill up quickly. Typical New Year travel dates are December 29 - January 3.',
      metadata: { category: 'festival', festival: 'New Year' },
    },

    // ── Flight routes (from mockData.js) ─────────────────────────────
    {
      id: 'route-lhr-jfk',
      text: 'London Heathrow (LHR) to New York JFK — B Airways operates multiple daily flights. Flight numbers include BA117, BA175, BA177, BA179, BA183, BA185. Duration: approximately 7h 15m. Aircraft: Boeing 777, 787 Dreamliner, Airbus A380.',
      metadata: { category: 'route', from: 'LHR', to: 'JFK', airline: 'BA' },
    },
    {
      id: 'route-lhr-dxb',
      text: 'London Heathrow (LHR) to Dubai (DXB) — B Airways operates multiple daily flights. Flight numbers include BA107, BA109, BA111, BA113, BA115, BA119. Duration: approximately 6h 50m. Aircraft: Boeing 777, 787 Dreamliner, Airbus A380.',
      metadata: { category: 'route', from: 'LHR', to: 'DXB', airline: 'BA' },
    },
    {
      id: 'route-lhr-nrt',
      text: 'London Heathrow (LHR) to Tokyo Narita (NRT) — B Airways operates daily flights. Flight numbers include BA005, BA007, BA009, BA011, BA013, BA015. Duration: approximately 11h 45m. Aircraft: Boeing 777, 787 Dreamliner, Airbus A380.',
      metadata: { category: 'route', from: 'LHR', to: 'NRT', airline: 'BA' },
    },
    {
      id: 'route-lhr-syd',
      text: 'London Heathrow (LHR) to Sydney (SYD) — B Airways operates daily flights via Singapore or Dubai. Duration: approximately 21h 30m. Aircraft: Boeing 787 Dreamliner, 777, Airbus A380.',
      metadata: { category: 'route', from: 'LHR', to: 'SYD', airline: 'BA' },
    },
    {
      id: 'route-lhr-sin',
      text: 'London Heathrow (LHR) to Singapore (SIN) — B Airways operates multiple daily flights. Flight numbers include BA011, BA013, BA015, BA017, BA019, BA021. Duration: approximately 12h 50m. Aircraft: Boeing 787 Dreamliner, 777, Airbus A380.',
      metadata: { category: 'route', from: 'LHR', to: 'SIN', airline: 'BA' },
    },
    {
      id: 'route-lhr-bcn',
      text: 'London Heathrow (LHR) to Barcelona (BCN) — B Airways operates multiple daily flights. Flight numbers include BA414, BA416, BA418, BA420, BA422, BA424. Duration: approximately 2h 15m. Aircraft: Airbus A320, A319, A321.',
      metadata: { category: 'route', from: 'LHR', to: 'BCN', airline: 'BA' },
    },

    // ── Airport information ───────────────────────────────────────────
    {
      id: 'airport-lhr',
      text: 'London Heathrow (LHR) — One of the world\'s busiest airports, located 14 miles west of Central London. Terminals 1-5 (Terminal 1 closed in 2018). B Airways operates from Terminal 5. Access via Heathrow Express (15 min to Paddington), Piccadilly Line, or taxi.',
      metadata: { category: 'airport', iata: 'LHR', city: 'London' },
    },
    {
      id: 'airport-jfk',
      text: 'John F. Kennedy International (JFK) — New York\'s primary international airport, located in Queens. Terminals 1-8. B Airways operates from Terminal 7. Access via AirTrain, subway (E, J, Z, A), or taxi.',
      metadata: { category: 'airport', iata: 'JFK', city: 'New York' },
    },
    {
      id: 'airport-dxb',
      text: 'Dubai International (DXB) — One of the world\'s busiest airports by international passengers. Terminals 1, 3, and 5 (concourse D). B Airways operates from Terminal 3. Access via Metro, taxi, or ride-sharing.',
      metadata: { category: 'airport', iata: 'DXB', city: 'Dubai' },
    },
    {
      id: 'airport-bcn',
      text: 'Barcelona El Prat (BCN) — Located 12km southwest of Barcelona. Terminals 1 and 2. B Airways operates from Terminal 1. Access via Rodalies (Cercanías) train, Aerobus, or taxi.',
      metadata: { category: 'airport', iata: 'BCN', city: 'Barcelona' },
    },

    // ── Booking info ──────────────────────────────────────────────────
    {
      id: 'booking-info',
      text: 'You can book flights through the B Airways website, mobile app, or by calling the contact centre. Payment methods accepted include major credit/debit cards (Visa, Mastercard, American Express) and PayPal. After booking, you\'ll receive a confirmation email with your booking reference.',
      metadata: { category: 'booking' },
    },
    {
      id: 'manage-booking',
      text: 'You can manage your booking online using your booking reference and surname. Changes include seat selection, baggage addition, meal preferences, and flight changes. Note that change fees may apply depending on your fare type. Online check-in opens 24 hours before departure.',
      metadata: { category: 'manage-booking' },
    },
  ];
}

/**
 * Seed the collection with initial B Airways knowledge.
 * This should be called once on app startup (or when the collection is empty).
 */
async function seedKnowledgeBase() {
  const collection = await getCollection();
  if (!collection) {
    logger.warn('Cannot seed knowledge base — ChromaDB not available');
    return false;
  }

  try {
    // Check if we already have data
    const count = await collection.count();
    if (count > 0) {
      logger.info('Knowledge base already seeded', { count });
      return true;
    }
  } catch (err) {
    logger.warn('Failed to check collection count', { error: err.message });
  }

  const docs = buildKnowledgeDocs();
  const ids = docs.map((d) => d.id);
  const texts = docs.map((d) => d.text);
  const metadatas = docs.map((d) => d.metadata);

  try {
    await collection.add({ ids, documents: texts, metadatas });
    logger.info('Knowledge base seeded', { documents: docs.length });
    return true;
  } catch (err) {
    logger.error('Failed to seed knowledge base', { error: err.message });
    return false;
  }
}

/**
 * Query the collection for documents semantically similar to the query.
 * @param {string} queryText  The user's message
 * @param {number} topK       Number of results to return (default 5)
 * @returns {Promise<Array<{text: string, metadata: object, distance: number}>>}
 */
async function queryDocuments(queryText, topK = MAX_CONTEXT_DOCS) {
  const collection = await getCollection();
  if (!collection) return [];

  try {
    const results = await collection.query({
      queryTexts: [queryText],
      nResults: topK,
    });

    const docs = results.documents[0] || [];
    const metadatas = results.metadatas[0] || [];
    const distances = results.distances[0] || [];

    return docs.map((text, i) => ({
      text: text || '',
      metadata: metadatas[i] || {},
      distance: distances[i] !== undefined ? distances[i] : 1,
    }));
  } catch (err) {
    logger.error('Failed to query documents', { error: err.message });
    return [];
  }
}

/**
 * Retrieve relevant context for a user query.
 * @param {string} userMessage  The user's voice input
/**
 * Fallback similarity query over buildKnowledgeDocs() when ChromaDB is not connected.
 * Calculates term-matching relevance scores so the voice agent ALWAYS receives RAG context.
 */
function queryFallbackDocs(queryText, topK = 3) {
  const docs = buildKnowledgeDocs();
  const tokens = queryText.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  if (tokens.length === 0) return [];

  const scored = docs.map(doc => {
    const textLower = doc.text.toLowerCase();
    const metaStr = JSON.stringify(doc.metadata).toLowerCase();
    let score = 0;

    tokens.forEach(token => {
      if (textLower.includes(token)) score += 2;
      if (metaStr.includes(token)) score += 3;
    });

    return { doc, score };
  }).filter(item => item.score > 0);

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map(item => ({
    id: item.doc.id,
    text: item.doc.text,
    metadata: item.doc.metadata,
    distance: 0.1,
  }));
}

/**
 * Retrieve relevant context for a user query.
 * If ChromaDB is connected, uses vector embedding search.
 * Otherwise, uses in-memory knowledge base search.
 *
 * @param {string} userMessage  The user's voice input
 * @returns {Promise<string|null>}  Formatted context string, or null if no
 *                                   relevant documents were found
 */
async function getContext(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') {
    return null;
  }

  try {
    let results = [];
    if (isReady()) {
      results = await queryDocuments(userMessage, MAX_CONTEXT_DOCS);
    } else {
      results = queryFallbackDocs(userMessage, MAX_CONTEXT_DOCS);
    }

    if (!results || results.length === 0) {
      logger.debug('No relevant documents found for query');
      return null;
    }

    // Filter by relevance threshold
    const relevantDocs = results.filter(
      (doc) => doc.distance !== undefined && doc.distance < RELEVANCE_THRESHOLD
    );

    if (relevantDocs.length === 0) {
      logger.debug('No documents above relevance threshold');
      return null;
    }

    // Format the context
    const contextParts = relevantDocs.map((doc) => {
      const category = doc.metadata?.category || 'general';
      return `[${category}] ${doc.text}`;
    });

    let context = contextParts.join('\n\n');

    // Truncate if too long
    if (context.length > MAX_CONTEXT_CHARS) {
      context = context.substring(0, MAX_CONTEXT_CHARS) + '...';
    }

    logger.info('Retrieved RAG context', {
      docs: relevantDocs.length,
      chars: context.length,
      query: userMessage.substring(0, 50),
    });

    return context;
  } catch (err) {
    logger.error('Failed to get RAG context', { error: err.message });
    return null;
  }
}

/**
 * Get RAG context and build an augmented system prompt in one call.
 * @param {string} userMessage  The user's voice input
 * @param {string} basePrompt   The original system prompt
 * @returns {Promise<string>}  The augmented (or original) system prompt
 */
async function getAugmentedPrompt(userMessage, basePrompt) {
  const context = await getContext(userMessage);
  if (!context) {
    return basePrompt;
  }

  return `${basePrompt}

═══════════════════════════════════════════════════════
RELEVANT CONTEXT FROM KNOWLEDGE BASE (RAG):
═══════════════════════════════════════════════════════
${context}

═══════════════════════════════════════════════════════
Use the above context to provide accurate, specific answers. If the context
contains relevant information, incorporate it into your response. If not,
rely on your general knowledge.
═══════════════════════════════════════════════════════`;
}

/**
 * Initialise the RAG service — connect to ChromaDB and seed the knowledge base.
 * Should be called once on server startup.
 */
async function initRAG() {
  const ok = await initChroma();
  if (!ok) {
    logger.warn('ChromaDB not available — RAG will be disabled');
    return false;
  }

  await seedKnowledgeBase();
  return true;
}

module.exports = {
  initRAG,
  seedKnowledgeBase,
  queryDocuments,
  getContext,
  getAugmentedPrompt,
  isReady,
  MAX_CONTEXT_DOCS,
  RELEVANCE_THRESHOLD,
  MAX_CONTEXT_CHARS,
};
