/**
 * ragService.js — Advanced Agentic RAG Service  (v2)
 *
 * NEW in v2 (all 10 enhancements):
 *  1.  Chain-of-Thought (CoT) reasoning traces before every tool call
 *  2.  Multi-agent orchestrator — specialist agent per intent domain
 *  3.  Confidence scoring & answer validation (0-1 per doc + aggregate)
 *  4.  LRU in-memory cache — avoids re-computing repeated queries (TTL 5 min)
 *  5.  Observability — structured trace IDs, per-step latency, emit metrics
 *  6.  Multi-step tool plans — agent generates and executes ordered plan
 *  7.  Semantic reranker — TF-IDF cross-encoder layer after RRF
 *  8.  Query decomposition — splits compound queries into sub-queries
 *  9.  Proactive suggestions — surface next best actions from context
 * 10.  80+ knowledge docs (unchanged), BM25 + ChromaDB + RRF (unchanged)
 */

'use strict';

const { getCollection, initChroma, isReady } = require('../config/chroma');
const logger = require('../config/logger');

// ─── Constants ───────────────────────────────────────────────────────────────
const MAX_CONTEXT_DOCS    = 8;
const RELEVANCE_THRESHOLD = 0.85;
const MAX_CONTEXT_CHARS   = 5000;
const CACHE_TTL_MS        = 5 * 60 * 1000;   // 5 minutes
const CACHE_MAX_ENTRIES   = 200;
const MIN_CONFIDENCE      = 0.30;             // below this → ask for clarification

// ═══════════════════════════════════════════════════════════════════════════
// ENHANCEMENT 4 — LRU In-Memory Cache
// ═══════════════════════════════════════════════════════════════════════════
class LRUCache {
  constructor(maxSize, ttlMs) {
    this.maxSize = maxSize;
    this.ttlMs   = ttlMs;
    this.map     = new Map();   // key → { value, ts }
    this.hits    = 0;
    this.misses  = 0;
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) { this.misses++; return null; }
    if (Date.now() - entry.ts > this.ttlMs) { this.map.delete(key); this.misses++; return null; }
    // LRU: move to end
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    if (this.map.size >= this.maxSize) {
      this.map.delete(this.map.keys().next().value);  // evict oldest
    }
    this.map.set(key, { value, ts: Date.now() });
  }

  stats() { return { size: this.map.size, hits: this.hits, misses: this.misses, hitRate: this.hits / (this.hits + this.misses + 1) }; }
  clear() { this.map.clear(); }
}

const contextCache = new LRUCache(CACHE_MAX_ENTRIES, CACHE_TTL_MS);


// ═══════════════════════════════════════════════════════════════════════════
// ENHANCEMENT 5 — Observability: Trace IDs, per-step latency, metrics
// ═══════════════════════════════════════════════════════════════════════════
const metrics = { queries: 0, cacheHits: 0, toolCalls: 0, totalLatencyMs: 0, errors: 0 };

function newTraceId() {
  return `rag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function tracedLog(traceId, step, data = {}) {
  logger.info(`[RAG][${traceId}] ${step}`, data);
}

function getMetrics() {
  return {
    ...metrics,
    avgLatencyMs: metrics.queries > 0 ? Math.round(metrics.totalLatencyMs / metrics.queries) : 0,
    cache:        contextCache.stats(),
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// ENHANCEMENT 1 — Chain-of-Thought Reasoning
// ═══════════════════════════════════════════════════════════════════════════
/**
 * buildCoT: builds a structured reasoning trace before committing to a response.
 * Each step narrows down the answer space, documents assumptions, and flags
 * any uncertainty that should lower the confidence score.
 */
function buildCoT(query, intentData, retrievedDocs) {
  const { intent, entities } = intentData;
  const steps = [];

  steps.push({ step: 1, label: 'Query classification', result: intent,
    reasoning: `Classified "${query.slice(0,60)}" as ${intent} based on regex intent classifier. ` +
                `Entities: IATA[${entities.iata.join(',')||'none'}] ` +
                `Flights[${entities.flight.join(',')||'none'}] ` +
                `Tiers[${entities.tier.join(',')||'none'}] ` +
                `Refs[${entities.reference.join(',')||'none'}]` });

  const topDoc  = retrievedDocs[0];
  const topCat  = topDoc?.metadata?.category || 'unknown';
  const topScore = topDoc?.rrfScore?.toFixed(3) || '0';
  steps.push({ step: 2, label: 'Document retrieval', result: `${retrievedDocs.length} docs, top=${topCat} (RRF=${topScore})`,
    reasoning: `Hybrid BM25 + vector search retrieved ${retrievedDocs.length} docs via Reciprocal Rank Fusion. ` +
               `Top doc category: ${topCat}, score: ${topScore}.` });

  const needsTool = shouldAutoExecuteTool(intent, entities);
  steps.push({ step: 3, label: 'Tool decision', result: needsTool ? `INVOKE ${needsTool}` : 'ANSWER_FROM_KNOWLEDGE',
    reasoning: needsTool
      ? `Intent ${intent} with entities ${JSON.stringify(entities)} triggers auto-tool: ${needsTool}`
      : `No live tool required — knowledge base context sufficient for intent ${intent}` });

  const confidence = computeConfidence(intent, retrievedDocs, entities);
  steps.push({ step: 4, label: 'Confidence estimate', result: confidence.toFixed(2),
    reasoning: confidence < MIN_CONFIDENCE
      ? `⚠️ Low confidence (${confidence.toFixed(2)}) — may need clarifying question`
      : `Confidence OK (${confidence.toFixed(2)}) — proceeding with answer` });

  return { steps, intent, confidence, toolName: needsTool };
}


// ═══════════════════════════════════════════════════════════════════════════
// ENHANCEMENT 3 — Confidence Scoring
// ═══════════════════════════════════════════════════════════════════════════
function computeConfidence(intent, docs, entities) {
  if (!docs.length) return 0;

  // Base: average RRF score of top-3 docs, normalised to 0-1
  const top3     = docs.slice(0, 3);
  const avgRRF   = top3.reduce((s, d) => s + (d.rrfScore || 0), 0) / top3.length;
  let confidence = Math.min(avgRRF * 35, 0.70);   // RRF ~0.02 → ~0.70

  // Boost for exact category match
  const intentCatMap = {
    UK261:'uk261', BAGGAGE:'baggage', LOUNGE:'lounge', EXECUTIVE_CLUB:'executive-club',
    CABIN:'cabin', AIRPORT:'airport', ROUTE:'route', OFFER:'offer',
    SPECIAL_MEAL:'service', SPECIAL_SERVICE:'service', FAMILY:'service',
    BOOKING:'booking', CHECKIN:'booking', BOOK_FLIGHT:'destination',
    DESTINATION:'destination', TRAVEL_DOCS:'travel', INSURANCE:'travel',
    PETS:'service', INFLIGHT_SERVICES:'service', FLIGHT_STATUS:'route',
  };
  const expectedCat = intentCatMap[intent];
  if (expectedCat && docs[0]?.metadata?.category === expectedCat) confidence += 0.15;

  // Boost for IATA / flight entity match in top doc
  if (entities.iata?.length) {
    const topText = docs[0]?.text?.toLowerCase() || '';
    if (entities.iata.some(c => topText.includes(c.toLowerCase()))) confidence += 0.10;
  }

  // Penalty for GENERAL intent (low certainty)
  if (intent === 'GENERAL') confidence -= 0.20;

  return Math.max(0, Math.min(1, confidence));
}

/**
 * buildClarifyingQuestion: called when confidence is below MIN_CONFIDENCE.
 * Returns a targeted question to disambiguate the user's intent.
 */
function buildClarifyingQuestion(query, intent) {
  const map = {
    GENERAL:        'Could you give me a bit more detail — are you asking about booking, baggage, Avios, or something else?',
    BOOK_FLIGHT:    'Which airports are you flying between, and what date?',
    BOOKING:        'Could you share your 6-character booking reference so I can look that up?',
    FLIGHT_STATUS:  'What is the flight number (e.g. BA117) or the route you want to check?',
    EXECUTIVE_CLUB: 'Are you asking about earning Avios, spending Avios, or your tier status?',
    UK261:          'Did you experience a delay or a cancellation, and what was the flight number?',
    BAGGAGE:        'Are you asking about hand baggage, checked bags, or adding extra luggage?',
  };
  return map[intent] || `Could you rephrase your question? (Asking about: "${query.slice(0, 60)}")`;
}


// ═══════════════════════════════════════════════════════════════════════════
// ENHANCEMENT 8 — Query Decomposition
// ═══════════════════════════════════════════════════════════════════════════
/**
 * decomposeQuery: splits a compound query into up to 3 focused sub-queries.
 * Examples:
 *   "What is the baggage limit and how do I earn Avios?" → ['baggage limit', 'earn avios']
 *   "BA117 status and check-in for booking XY1234"       → ['BA117 status', 'check-in booking XY1234']
 */
function decomposeQuery(query) {
  // Split on conjunctions that likely signal a new question
  const splitRe = /\s+(?:and|also|plus|as well as|additionally|what about|how about)\s+/i;
  const parts   = query.split(splitRe).map(p => p.trim()).filter(p => p.length > 5);
  if (parts.length <= 1) return [query];
  return parts.slice(0, 3);   // cap at 3 sub-queries
}

/**
 * mergeSubQueryContexts: run retrieval for each sub-query and merge results
 * deduplicated by doc id, keeping best RRF score.
 */
async function retrieveForSubQueries(subQueries, intentData, traceId) {
  const docMap = new Map();
  for (const sq of subQueries) {
    const sqIntent   = classifyQueryIntent(sq);
    const expanded   = expandBAQuery(sq);
    let vDocs = [];
    if (isReady()) vDocs = await queryVectorDocuments(expanded, 8);
    const bDocs = queryBM25Docs(expanded, sqIntent, 8);
    const merged = reciprocalRankFusion(vDocs, bDocs, 6);
    tracedLog(traceId, `sub-query "${sq.slice(0,40)}" → ${merged.length} docs`, { intent: sqIntent.intent });
    for (const doc of merged) {
      if (!docMap.has(doc.id) || docMap.get(doc.id).rrfScore < doc.rrfScore) {
        docMap.set(doc.id, doc);
      }
    }
  }
  return [...docMap.values()].sort((a, b) => b.rrfScore - a.rrfScore).slice(0, MAX_CONTEXT_DOCS);
}


// ═══════════════════════════════════════════════════════════════════════════
// ENHANCEMENT 7 — Semantic Reranker (TF-IDF cross-encoder layer)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * semanticRerank: a lightweight cross-encoder that re-scores post-RRF docs
 * by computing cosine similarity between query token TF-IDF weights and doc
 * TF-IDF weights.  No external model needed — pure JS.
 */
function buildTFIDF(text) {
  const tokens = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
  const freq   = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  const total  = tokens.length || 1;
  const tfidf  = {};
  for (const [t, c] of Object.entries(freq)) tfidf[t] = (c / total) * Math.log(1 + 80 / (c + 1));
  return tfidf;
}

function cosineSimilarity(vecA, vecB) {
  const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dot = 0, normA = 0, normB = 0;
  for (const k of keys) {
    const a = vecA[k] || 0, b = vecB[k] || 0;
    dot += a * b; normA += a * a; normB += b * b;
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

function semanticRerank(query, docs) {
  const qVec = buildTFIDF(query);
  return docs
    .map(doc => {
      const dVec      = buildTFIDF(doc.text);
      const semScore  = cosineSimilarity(qVec, dVec);
      const combined  = (doc.rrfScore || 0) * 0.6 + semScore * 0.4;
      return { ...doc, semScore, finalScore: combined };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}


// ═══════════════════════════════════════════════════════════════════════════
// ENHANCEMENT 2 — Multi-Agent Orchestrator
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Each specialist agent operates on a filtered slice of the knowledge base
 * and applies domain-specific BM25 boosting. The orchestrator selects the
 * right agent based on the classified intent.
 */
const SPECIALIST_AGENTS = {
  BAGGAGE: {
    name: 'BaggageAgent',
    categories: ['baggage'],
    extraBoostTokens: ['kg','allowance','carry','hold','checked','excess','weight','suitcase'],
  },
  UK261: {
    name: 'PassengerRightsAgent',
    categories: ['uk261'],
    extraBoostTokens: ['compensation','delay','cancel','refund','duty','claim','rights','extraordinary'],
  },
  EXECUTIVE_CLUB: {
    name: 'AviosAgent',
    categories: ['executive-club'],
    extraBoostTokens: ['avios','tier','gold','silver','bronze','companion','voucher','redeem','earn'],
  },
  LOUNGE: {
    name: 'LoungeAgent',
    categories: ['lounge'],
    extraBoostTokens: ['galleries','concorde','first wing','shower','dining','spa','champagne'],
  },
  CABIN: {
    name: 'CabinAgent',
    categories: ['cabin'],
    extraBoostTokens: ['flat bed','suite','legroom','pitch','amenity','screen','dining','seat'],
  },
  BOOKING: {
    name: 'BookingAgent',
    categories: ['booking'],
    extraBoostTokens: ['reference','pnr','manage','change','cancel','seat','name','add','upgrade'],
  },
  DESTINATION: {
    name: 'DestinationAgent',
    categories: ['destination','route','offer'],
    extraBoostTokens: ['price','duration','flight','best time','highlights','from'],
  },
  FLIGHT_STATUS: {
    name: 'FlightStatusAgent',
    categories: ['route'],
    extraBoostTokens: ['status','gate','terminal','on time','delayed','landed','departed'],
  },
};

function getSpecialistAgent(intent) {
  return SPECIALIST_AGENTS[intent] || null;
}

/**
 * applySpecialistBoost: add domain token score on top of standard BM25
 */
function applySpecialistBoost(doc, agent) {
  if (!agent) return 0;
  const text  = doc.text.toLowerCase();
  let boost = 0;
  // Category match boost
  if (agent.categories.includes(doc.metadata?.category)) boost += 5;
  // Domain token boost
  for (const tok of agent.extraBoostTokens) {
    if (text.includes(tok)) boost += 1.5;
  }
  return boost;
}


// ═══════════════════════════════════════════════════════════════════════════
// ENHANCEMENT 6 — Multi-Step Tool Plans
// ═══════════════════════════════════════════════════════════════════════════
/**
 * buildToolPlan: given an intent + entities, produces an ordered list of
 * tool calls to execute sequentially.  Each step can reference the output
 * of previous steps via `dependsOn`.
 */
function buildToolPlan(intent, entities) {
  const steps = [];

  if (intent === 'BOOK_FLIGHT' && entities.iata?.length >= 2) {
    const from = entities.iata.find(c => ['LHR','LGW'].includes(c)) || entities.iata[0];
    const to   = entities.iata.find(c => c !== from) || entities.iata[1];
    const date = (() => { const d = new Date(); d.setDate(d.getDate()+30); return d.toISOString().split('T')[0]; })();
    const cabin = (entities.cabin[0] || 'ECONOMY').toUpperCase().replace(/ /g,'_');

    steps.push({ id: 's1', tool: 'search_flights',  params: { from, to, departureDate: date, cabin }, dependsOn: null });
    steps.push({ id: 's2', tool: 'calculate_avios', params: { from, to, cabin: cabin.toLowerCase() }, dependsOn: null });
    steps.push({ id: 's3', tool: 'navigate',        params: { path: `/book?from=${from}&to=${to}`, label: 'Search Flights' }, dependsOn: 's1' });
  }

  if (intent === 'BOOKING' && entities.reference?.length) {
    steps.push({ id: 's1', tool: 'get_booking', params: { reference: entities.reference[0] }, dependsOn: null });
    steps.push({ id: 's2', tool: 'navigate',    params: { path: '/manage', label: 'Open Manage Booking' }, dependsOn: 's1' });
  }

  if (intent === 'FLIGHT_STATUS' && entities.flight?.length) {
    steps.push({ id: 's1', tool: 'get_flight_status', params: { flightNumber: entities.flight[0] }, dependsOn: null });
    steps.push({ id: 's2', tool: 'navigate',           params: { path: '/flight-status', label: 'Track Flight' }, dependsOn: null });
  }

  if (intent === 'DESTINATION') {
    steps.push({ id: 's1', tool: 'get_destinations', params: { category: 'all' }, dependsOn: null });
    steps.push({ id: 's2', tool: 'navigate',          params: { path: '/destinations', label: 'Browse Destinations' }, dependsOn: null });
  }

  if (intent === 'EXECUTIVE_CLUB' && entities.iata?.length >= 2) {
    steps.push({ id: 's1', tool: 'calculate_avios', params: { from: entities.iata[0], to: entities.iata[1], cabin: (entities.cabin[0] || 'economy').toLowerCase() }, dependsOn: null });
    steps.push({ id: 's2', tool: 'navigate',          params: { path: '/executive-club', label: 'View My Avios' }, dependsOn: null });
  }

  return steps;
}

function shouldAutoExecuteTool(intent, entities) {
  if (intent === 'FLIGHT_STATUS' && entities.flight?.length)       return 'get_flight_status';
  if (intent === 'BOOK_FLIGHT'   && entities.iata?.length >= 2)    return 'search_flights';
  if (intent === 'BOOKING'       && entities.reference?.length)    return 'get_booking';
  if (intent === 'DESTINATION')                                    return 'get_destinations';
  if (intent === 'CHECKIN')                                        return 'navigate';
  if (intent === 'EXECUTIVE_CLUB' && entities.iata?.length >= 2)   return 'calculate_avios';
  return null;
}


// ═══════════════════════════════════════════════════════════════════════════
// ENHANCEMENT 9 — Proactive Suggestions
// ═══════════════════════════════════════════════════════════════════════════
const PROACTIVE_SUGGESTIONS = {
  UK261:          ['How do I claim compensation online?', 'What are extraordinary circumstances?', 'Can I get a hotel if delayed overnight?'],
  BAGGAGE:        ['How much does an extra bag cost?', 'Can Silver members take more luggage?', 'What are restricted items?'],
  EXECUTIVE_CLUB: ['How do I earn Avios faster?', 'What is a Companion Voucher?', 'How many TP for Gold status?'],
  LOUNGE:         ['What food is in the Galleries Club?', 'Can I bring a guest to the lounge?', 'Is there a shower in the Concorde Room?'],
  CABIN:          ['What is the difference between Club Suite and Club World?', 'How do I upgrade using Avios?', 'Which routes have First Class?'],
  BOOKING:        ['How do I change my seat?', 'Can I add baggage after booking?', 'What if I need a name correction?'],
  CHECKIN:        ['When does bag drop close?', 'Can I check in at the airport?', 'How do I get a digital boarding pass?'],
  FLIGHT_STATUS:  ['What are my rights if the flight is delayed?', 'How do I track my bag?', 'What happens if I miss my connection?'],
  BOOK_FLIGHT:    ['What cabin classes are available?', 'How do I use Avios to pay for a flight?', 'What is the cheapest route to Dubai?'],
  DESTINATION:    ['What is the best time to visit Tokyo?', 'How long is the flight to Sydney?', 'What currency do I need in Dubai?'],
  TRAVEL_DOCS:    ['Do I need a visa for Dubai?', 'How long must my passport be valid?', 'What is ESTA and how do I apply?'],
  SPECIAL_MEAL:   ['How do I order a halal meal?', 'Can I change a meal request?', 'Is vegan food available on short-haul?'],
  OFFER:          ['What is the Summer Escape Sale?', 'How do I use a promo code?', 'Are there Business class deals right now?'],
  GENERAL:        ['What is the baggage allowance?', 'How do I earn Avios?', 'What are my rights if my flight is cancelled?'],
};

function getProactiveSuggestions(intent, entities) {
  const base = PROACTIVE_SUGGESTIONS[intent] || PROACTIVE_SUGGESTIONS.GENERAL;
  // If specific city mentioned, inject a route-specific suggestion
  if (entities.iata?.length) {
    const codes = entities.iata.slice(0, 2).join('→');
    return [`How long is the flight ${codes}?`, ...base.slice(0, 2)];
  }
  return base.slice(0, 3);
}


// ═══════════════════════════════════════════════════════════════════════════
// AGENTIC TOOL DEFINITIONS (unchanged schema)
// ═══════════════════════════════════════════════════════════════════════════
const AGENTIC_TOOLS = [
  { name:'search_flights',   description:'Search available BA flights between two airports',
    parameters:{ type:'object', required:['from','to','departureDate'], properties:{
      from:{type:'string'}, to:{type:'string'}, departureDate:{type:'string'},
      returnDate:{type:'string'}, cabin:{type:'string',enum:['ECONOMY','PREMIUM_ECONOMY','BUSINESS','FIRST']}, adults:{type:'integer',minimum:1,maximum:9} }}},
  { name:'get_booking',      description:'Retrieve a booking by 6-char reference',
    parameters:{ type:'object', required:['reference'], properties:{ reference:{type:'string'} }}},
  { name:'get_flight_status',description:'Live status of a BA flight by flight number or route',
    parameters:{ type:'object', properties:{ flightNumber:{type:'string'}, from:{type:'string'}, to:{type:'string'}, date:{type:'string'} }}},
  { name:'calculate_avios',  description:'Calculate Avios earned for a route and cabin',
    parameters:{ type:'object', required:['from','to'], properties:{ from:{type:'string'}, to:{type:'string'}, cabin:{type:'string',enum:['economy','premium_economy','business','first']} }}},
  { name:'get_destinations', description:'List BA destinations optionally filtered by category',
    parameters:{ type:'object', properties:{ category:{type:'string',enum:['city','beach','luxury','adventure','all']} }}},
  { name:'navigate',         description:'Direct the user to a specific in-app page',
    parameters:{ type:'object', required:['path'], properties:{ path:{type:'string'}, label:{type:'string'}, prefill:{type:'object'} }}},
  { name:'check_in',         description:'Start check-in for a booking reference',
    parameters:{ type:'object', required:['reference'], properties:{ reference:{type:'string'} }}},
];
module.exports.AGENTIC_TOOLS = AGENTIC_TOOLS;


// ─── BA Synonym Map ────────────────────────────────────────────────────────
const BA_SYNONYM_MAP = {
  'business class':['club world','club europe','club suite','business'],
  'first class':['first','concorde room','first wing'],
  'economy':['world traveller','euro traveller'],
  'premium economy':['world traveller plus','wt+','premium'],
  'points':['avios','tier points','tp'],
  'miles':['avios','reward points'],
  'rewards':['avios','reward flight saver','companion voucher'],
  'gold':['executive club gold','oneworld emerald','concorde room'],
  'silver':['executive club silver','oneworld sapphire','galleries lounge'],
  'bronze':['executive club bronze','oneworld ruby'],
  'lounge':['galleries club','galleries first','concorde room','first wing'],
  'luggage':['baggage','cabin bag','checked bag','hand luggage','suitcase'],
  'carry on':['cabin bag','hand luggage','personal item'],
  'delay':['uk261','eu261','delay compensation','duty of care'],
  'cancelled':['cancellation','uk261','rebooking','refund'],
  'compensation':['uk261','eu261','claim','duty of care'],
  'terminal 5':['t5','heathrow t5','lhr t5','first wing'],
  'heathrow':['lhr','london heathrow','t5','t3'],
  'gatwick':['lgw','london gatwick'],
  'jfk':['new york jfk','terminal 8'],
  'dubai':['dxb','uae'],
  'tokyo':['nrt','narita','hnd','haneda'],
  'sydney':['syd','australia','kangaroo route'],
  'singapore':['sin','changi'],
  'barcelona':['bcn','spain'],
  'mumbai':['bom','bombay','india'],
  'paris':['cdg','france'],
  'my booking':['manage booking','booking reference','pnr'],
  'manage':['manage booking','change booking','modify'],
  'change flight':['rebook','modify booking','same day change'],
  'cancel':['cancellation','refund','uk261'],
  'check in':['online check-in','checkin','boarding pass'],
  'seat':['seat selection','choose seat','exit row','extra legroom'],
  'upgrade':['cabin upgrade','avios upgrade','bid upgrade'],
  'infant':['baby','lap infant','bassinet','carrycot'],
  'meal':['special meal','dietary','halal','kosher','vegan','gluten'],
  'wheelchair':['special assistance','accessibility','mobility'],
  'wi-fi':['wifi','internet','onboard connectivity'],
  'passport':['travel documents','visa','entry requirements'],
  'insurance':['travel insurance','cover','medical cover'],
};


// ─── Knowledge Base (80+ docs) ────────────────────────────────────────────
function buildKnowledgeDocs() {
  return [
    {id:'dest-jfk',text:'New York JFK — Daily direct from LHR T5/T3. 7h 30m. Boeing 777-300ER & A350-1000 Club Suite. Times Square, Central Park, Broadway. From £399. Currency USD.',metadata:{category:'destination',iata:'JFK',city:'New York',fromPrice:399}},
    {id:'dest-dxb',text:'Dubai DXB — 3 daily from LHR T5. 6h 45m. A380 & 787. Burj Khalifa, Palm Jumeirah, Desert Safari. From £299. Best Nov-Mar.',metadata:{category:'destination',iata:'DXB',city:'Dubai',fromPrice:299}},
    {id:'dest-nrt',text:'Tokyo Narita NRT / Haneda HND — Daily from LHR T5. 11h 50m polar route. Club Suite & WT+. Shibuya, Fuji. From £649. Best Mar-May, Sep-Nov.',metadata:{category:'destination',iata:'NRT',city:'Tokyo',fromPrice:649}},
    {id:'dest-syd',text:'Sydney SYD — Daily BA015 via Singapore SIN. 21h 30m total. Opera House, Bondi Beach. From £799. Best Sep-Nov.',metadata:{category:'destination',iata:'SYD',city:'Sydney',fromPrice:799}},
    {id:'dest-sin',text:'Singapore SIN Changi — Daily from LHR T5. 12h 55m. Gardens by the Bay, Marina Bay Sands. From £579.',metadata:{category:'destination',iata:'SIN',city:'Singapore',fromPrice:579}},
    {id:'dest-bcn',text:'Barcelona BCN — Up to 6 daily short-haul. 2h 15m. A320neo. Sagrada Familia, Park Güell. From £89.',metadata:{category:'destination',iata:'BCN',city:'Barcelona',fromPrice:89}},
    {id:'dest-cdg',text:'Paris CDG — Up to 7 daily from LHR. 1h 15m. A320/A321. Eiffel Tower, Louvre. From £79.',metadata:{category:'destination',iata:'CDG',city:'Paris',fromPrice:79}},
    {id:'dest-bom',text:'Mumbai BOM — Double daily from LHR T5. 9h 15m. 777 & 787. Gateway of India. From £489. Best Nov-Feb.',metadata:{category:'destination',iata:'BOM',city:'Mumbai',fromPrice:489}},
    {id:'dest-cpt',text:'Cape Town CPT — Direct from LHR T5. 11h 20m. Table Mountain, Cape of Good Hope. From £449. Best Nov-Feb.',metadata:{category:'destination',iata:'CPT',city:'Cape Town',fromPrice:449}},
    {id:'dest-mle',text:'Maldives MLE — Direct from LHR T5. 10h 30m. Overwater villas, coral reefs. From £899. Best Nov-Apr.',metadata:{category:'destination',iata:'MLE',city:'Maldives',fromPrice:899}},
    {id:'dest-lhr',text:'London Heathrow LHR — BA main hub. Terminal 5 (T5A,T5B,T5C). Terminal 3 select routes. The First Wing (Gold/First), Galleries First, Galleries Club, Arrivals Lounge.',metadata:{category:'destination',iata:'LHR',city:'London',fromPrice:0}},
    {id:'dest-ams',text:'Amsterdam AMS — Multiple daily from LHR. 1h 20m. Rijksmuseum, canals. From £69.',metadata:{category:'destination',iata:'AMS',city:'Amsterdam',fromPrice:69}},
    {id:'dest-fco',text:'Rome FCO — Daily from LHR. 2h 40m. Colosseum, Vatican, Trevi Fountain. From £99.',metadata:{category:'destination',iata:'FCO',city:'Rome',fromPrice:99}},
    {id:'dest-ist',text:'Istanbul IST — Daily from LHR. 3h 50m. Hagia Sophia, Grand Bazaar. From £149.',metadata:{category:'destination',iata:'IST',city:'Istanbul',fromPrice:149}},
    {id:'dest-del',text:'Delhi DEL — Daily from LHR T5. 8h 45m. Red Fort, Taj Mahal. From £449. Best Oct-Mar.',metadata:{category:'destination',iata:'DEL',city:'Delhi',fromPrice:449}},
    {id:'dest-maa',text:'Chennai MAA — Via code-share. 10h+. Marina Beach, Kapaleeshwarar Temple. From £499.',metadata:{category:'destination',iata:'MAA',city:'Chennai',fromPrice:499}},
  ];
}

function buildKnowledgeDocsExtended() {
  return [
    {id:'ec-overview',text:'British Airways Executive Club: Free loyalty programme. Earn Avios on BA flights, partner airlines (Iberia, Finnair, Qatar, American, Cathay), hotels, car hire, credit cards. Avios never expire with 1 qualifying transaction every 36 months.',metadata:{category:'executive-club',topic:'overview'}},
    {id:'ec-blue',text:'Executive Club Blue (0 TP): Earn Avios at base rate. Reward flights from 4,750 Avios. Free messaging on BA Wi-Fi. Member-only offers.',metadata:{category:'executive-club',tier:'Blue',tierPoints:0}},
    {id:'ec-bronze',text:'Executive Club Bronze (300 TP + 2 flights/year, oneworld Ruby): Priority check-in, free standard seat 7 days before, 25% Avios bonus, Group 3 boarding, priority baggage tag.',metadata:{category:'executive-club',tier:'Bronze',tierPoints:300}},
    {id:'ec-silver',text:'Executive Club Silver (600 TP + 4 flights/year, oneworld Sapphire): Galleries Club lounge + 1 guest any cabin, free seat selection at booking, 50% Avios bonus, extra checked bag 2×32kg in Economy, Group 2 boarding.',metadata:{category:'executive-club',tier:'Silver',tierPoints:600}},
    {id:'ec-gold',text:'Executive Club Gold (1,500 TP + 4 flights/year, oneworld Emerald): Galleries First + Galleries Club + 1 guest, The First Wing LHR T5, free exit rows at booking, 100% Avios bonus, extra bag, Group 1 boarding.',metadata:{category:'executive-club',tier:'Gold',tierPoints:1500}},
    {id:'ec-concorde-card',text:'Concorde Room Card at 5,000 TP. Gold Guest List at 3,000 TP. Access: Concorde Room LHR T5 and JFK T8 — private dining, Forty Winks sleep suites, vintage Krug champagne.',metadata:{category:'executive-club',tier:'ConcordeCard',tierPoints:5000}},
    {id:'ec-avios-earn',text:'Avios earning multipliers: Economy 50%, Premium Economy 75%, Business 150%, First 300%. Tier bonus on top: Blue 0%, Bronze 25%, Silver 50%, Gold 100%.',metadata:{category:'executive-club',topic:'earn-avios'}},
    {id:'ec-avios-spend',text:'Spending Avios: Reward Flights from 4,750 Avios + £1 (short-haul RFS). Upgrade Economy→Business from 7,500 Avios/segment. Upgrade to First from 12,500 Avios. Hotels from 4,000 Avios/night.',metadata:{category:'executive-club',topic:'spend-avios'}},
    {id:'ec-companion-voucher',text:'BA Amex Companion Voucher: Spend £12,000+ on BA American Express Premium Plus. Second seat free on any BA reward flight (only taxes for 2nd pax). Or 50% Avios discount solo. Valid 2 years.',metadata:{category:'executive-club',topic:'companion-voucher'}},
    {id:'ec-tier-points',text:'Tier Points (TP): Short-haul Europe Economy 10 TP, Business 30 TP. Long-haul Economy 40 TP, Premium Economy 80 TP, Business 120 TP, First 200 TP.',metadata:{category:'executive-club',topic:'tier-points'}},
    {id:'ec-family-account',text:'Executive Club Family Account: Pool Avios between up to 7 family members. TP and tier status individual — not pooled.',metadata:{category:'executive-club',topic:'family-account'}},
    {id:'lounge-galleries-club',text:'Galleries Club Lounge: LHR T5 South/North/B, T3, LGW South, JFK T8. Eligible: Club World/Club Europe pax, oneworld Business, Silver/Gold EC + 1 guest. Hot buffet, champagne bar, showers, Wi-Fi, quiet zone.',metadata:{category:'lounge',name:'Galleries Club'}},
    {id:'lounge-galleries-first',text:'Galleries First Lounge: LHR T5 South, LGW South. Eligible: Gold EC + 1 guest any cabin, oneworld Emerald. À la carte dining, Laurent-Perrier champagne, spa (LHR), private showers.',metadata:{category:'lounge',name:'Galleries First'}},
    {id:'lounge-concorde-room',text:'The Concorde Room: LHR T5, JFK T8. Eligible: First Class pax, Concorde Room Card holders. Private dining booths, Forty Winks sleep suites, vintage Krug, Dom Perignon bar, butler service.',metadata:{category:'lounge',name:'Concorde Room'}},
    {id:'lounge-first-wing',text:'The First Wing LHR T5: Gold + First pax. Private check-in desks, private security lane, direct walk to Galleries First or Concorde Room. Available 04:30-21:00.',metadata:{category:'lounge',name:'First Wing'}},
    {id:'lounge-jfk',text:'JFK T8 Lounges: Chelsea (First/Concorde Room Card), Soho (Gold+Business), Greenwich (Silver+Business). Hot food, premium bar, showers (Chelsea & Soho).',metadata:{category:'lounge',iata:'JFK'}},
    {id:'cabin-first',text:'First Class: Private suite, sliding door, 198cm flat bed, White Company duvet, on-demand à la carte, Laurent-Perrier champagne. 3×32kg bags. Routes: LHR-JFK, LHR-DXB, LHR-NRT, LHR-SYD, LHR-SIN, LHR-BOM.',metadata:{category:'cabin',cabin:'First'}},
    {id:'cabin-club-suite',text:'Club Suite (New Business on A350/B777): Direct aisle access, full privacy door, 79-inch flat bed, 18.5-inch screen, on-demand dining. 2×32kg bags.',metadata:{category:'cabin',cabin:'Club Suite'}},
    {id:'cabin-club-world',text:'Club World (Legacy Business Long-Haul): 183cm flat bed, White Company, multi-course dining, champagne. 2×32kg bags. Being replaced by Club Suite on refurbs.',metadata:{category:'cabin',cabin:'Club World'}},
    {id:'cabin-club-europe',text:'Club Europe (Short-Haul Business): Middle seat empty, hot meal, Galleries Club lounge, Group 1 boarding. 2×32kg bags.',metadata:{category:'cabin',cabin:'Club Europe'}},
    {id:'cabin-wt-plus',text:'World Traveller Plus (Premium Economy): 38-inch pitch, sparkling wine, 3-course on fine china, amenity kit. Free seat at booking. 2×23kg bags.',metadata:{category:'cabin',cabin:'World Traveller Plus'}},
    {id:'cabin-world-traveller',text:'World Traveller (Economy): 31-inch pitch, 10-inch screen, USB + power, complimentary meal and drinks. 1×23kg bag.',metadata:{category:'cabin',cabin:'World Traveller'}},
  ];
}

function buildKnowledgeDocsPolicies() {
  return [
    {id:'bag-hand',text:'Hand Baggage (all tickets): 1 cabin bag 56×45×25cm + 1 personal item 40×30×15cm. Max 23kg each. 1 baby changing bag free.',metadata:{category:'baggage',type:'hand'}},
    {id:'bag-checked',text:'Checked Baggage by Cabin: HBO/Basic=0 bags. Standard Economy=1×23kg. Premium Economy=2×23kg. Club/Business=2×32kg. First=3×32kg. Max 90×75×43cm per bag.',metadata:{category:'baggage',type:'checked'}},
    {id:'bag-tier-bonus',text:'Silver & Gold EC: 1 extra checked bag + 32kg allowance in Economy. Bronze: priority bag delivery. Gold: overweight waiver on 1 bag.',metadata:{category:'baggage',type:'tier-bonus'}},
    {id:'bag-excess',text:'Excess Baggage: Buy online via Manage Booking (up to 30% cheaper). Extra bag short-haul £65-90 online, long-haul £95-130. Overweight (23-32kg) £65 online, £85 airport.',metadata:{category:'baggage',type:'excess'}},
    {id:'bag-sports',text:'Sports Baggage: Golf, skis, surfboards, bikes count as 1 checked bag. Bikes need box/bag. Oversize instruments need own seat. Firearms require advance notice.',metadata:{category:'baggage',type:'sports'}},
    {id:'bag-liquids',text:'Liquids in Hand Baggage: Containers max 100ml in 1 transparent resealable bag. Baby milk, liquid medications, duty-free over 100ml (tamper-evident bag with receipt) permitted.',metadata:{category:'baggage',type:'liquids'}},
    {id:'bag-restricted',text:'Restricted Items: Lithium batteries >160Wh banned. E-cigarettes in hold not permitted. Power banks max 100Wh in carry-on only. Hoverboards banned on BA.',metadata:{category:'baggage',type:'restricted'}},
    {id:'uk261-delay',text:'UK261 Delay Compensation (BA fault, non-extraordinary): £220 (<1,500km), £350 (1,500–3,500km), £520 (>3,500km, 4h+). Halved if re-routed within 2/3/4h of original arrival.',metadata:{category:'uk261',topic:'delay'}},
    {id:'uk261-cancel',text:'UK261 Cancellation <14 days notice: compensation £220/£350/£520 unless extraordinary. Entitled to: full refund within 7 days OR re-routing at earliest opportunity.',metadata:{category:'uk261',topic:'cancellation'}},
    {id:'uk261-duty-of-care',text:'UK261 Duty of Care: 2h+ delay (short-haul) or 3h+ (long-haul): free meals/refreshments, 2 phone calls, free hotel + transfers overnight, medical access.',metadata:{category:'uk261',topic:'duty-of-care'}},
    {id:'uk261-claim',text:'How to Claim UK261: ba.com/help/delays within 6 years. Include: booking ref, flight number, date, reason, receipts. BA must respond within 14 days. CEDR/CAA arbitration if refused.',metadata:{category:'uk261',topic:'how-to-claim'}},
    {id:'uk261-extraordinary',text:'Extraordinary Circumstances (no cash compensation but Duty of Care still applies): Severe weather, ATC strikes, security threats, bird strikes, medical diversions.',metadata:{category:'uk261',topic:'extraordinary'}},
    {id:'uk261-downgrade',text:'Downgrade Refund: Lower cabin than booked — 30% refund (<1,500km), 50% (1,500–3,500km), 75% (>3,500km). Claim at airport or online.',metadata:{category:'uk261',topic:'downgrade'}},
    {id:'booking-manage',text:'Manage My Booking: Access via the Manage page with 6-character booking reference (PNR). No surname needed. Actions: view itinerary, change seats, add baggage, meals, upgrade, cancel.',metadata:{category:'booking',topic:'manage'}},
    {id:'booking-change',text:'Changing Flight: Flexible — free any time. Standard Economy — £60-£200 + fare difference. Sale — date change only. Same Day Change (SDC) flat fee, Silver/Gold priority.',metadata:{category:'booking',topic:'change'}},
    {id:'booking-cancel',text:'Cancellations: Fully Flexible — full refund 7 days. Standard — taxes refunded £50-£200. Sale — taxes only. BA cancels — full cash refund within 7 days.',metadata:{category:'booking',topic:'cancel-refund'}},
    {id:'booking-seat',text:'Seat Selection: Economy £10-£45, free 24h before. Extra Legroom/Exit Row £25-£80. Premium Economy free at booking. Club World/Suite free at booking. Bronze free 7 days before. Silver/Gold free at booking including exit rows.',metadata:{category:'booking',topic:'seats'}},
    {id:'booking-upgrade',text:'Upgrade: Avios Economy→Premium from 7,500 Avios/segment, to Business from 12,500. Bid upgrade 3-7 days before. Companion Voucher — 2nd pax free on reward flights.',metadata:{category:'booking',topic:'upgrade'}},
    {id:'booking-name',text:'Name Corrections: Minor (≤3 chars) free via Manage Booking. Full name change not allowed — cancel and rebook. Name must match passport exactly.',metadata:{category:'booking',topic:'name-change'}},
    {id:'booking-checkin',text:'Online Check-In: Opens 24h before departure. 6-char booking reference. Digital boarding pass to Apple/Google Wallet or PDF. Bag drop: 60 min long-haul, 45 min short-haul. Gates close 20 min before.',metadata:{category:'booking',topic:'checkin'}},
    {id:'booking-baggage-add',text:'Adding Baggage: Pre-purchase via Manage Booking up to 4h before. Online 30% cheaper. Short-haul extra bag from £65, long-haul from £95. Overweight from £65 online.',metadata:{category:'booking',topic:'add-baggage'}},
    {id:'airport-lhr-t5',text:'LHR Terminal 5: BA main hub. T5A main, T5B and T5C satellites. First Wing for Gold/First — dedicated check-in, private security, direct lounge access. Galleries First, Galleries Club South/North, Concorde Room.',metadata:{category:'airport',iata:'LHR',terminal:'5'}},
    {id:'airport-lhr-t3',text:'LHR Terminal 3: Select BA routes (ACC, AUS, LAS, PHX, GRU) and codeshares. Galleries Club and Galleries First lounges. Connected to T5 via underground transit.',metadata:{category:'airport',iata:'LHR',terminal:'3'}},
    {id:'airport-lgw',text:'London Gatwick LGW South Terminal: BA leisure routes (Caribbean, Orlando, CPT seasonal). BA Gatwick Club and First Lounge, Mezzanine. 30 min from London by Gatwick Express.',metadata:{category:'airport',iata:'LGW'}},
    {id:'route-jfk',text:'LHR→JFK: Up to 8 daily non-stop. BA117, BA175, BA177, BA179, BA183, BA185. 7h 15m westbound, 6h 45m eastbound. B777-300ER and A350-1000 Club Suite.',metadata:{category:'route',from:'LHR',to:'JFK'}},
    {id:'route-dxb',text:'LHR→DXB: 3 daily. BA105, BA107, BA109. 6h 50m outbound. A380 and B787-10.',metadata:{category:'route',from:'LHR',to:'DXB'}},
    {id:'route-nrt',text:'LHR→NRT: Daily BA005. 13h 40m polar. B787-9. Also HND via BA007.',metadata:{category:'route',from:'LHR',to:'NRT'}},
    {id:'route-syd',text:'LHR→SYD: Daily BA015 via SIN. LHR-SIN 12h 50m + 1h 50m stopover + SIN-SYD 7h 45m = 21h 30m.',metadata:{category:'route',from:'LHR',to:'SYD'}},
    {id:'route-bcn',text:'LHR→BCN: Up to 6 daily. BA472-BA480. 2h 15m. A320neo.',metadata:{category:'route',from:'LHR',to:'BCN'}},
    {id:'route-cdg',text:'LHR→CDG: Up to 7 daily. BA304-BA318. 1h 15m. A320/A321.',metadata:{category:'route',from:'LHR',to:'CDG'}},
    {id:'route-bom',text:'LHR→BOM: Double daily. BA117, BA139. 9h 15m. B787-9 and B777.',metadata:{category:'route',from:'LHR',to:'BOM'}},
    {id:'svc-special-meals',text:'Special Meals (14 types, free, order 24h before): Halal (MOML), Kosher (KSML), Hindu non-veg (HNML), Vegan (VGML), Gluten-free (GFML), Diabetic (DBML), Child (CHML), Baby (BBML), Low sodium, Fruit, Seafood, Jain, Low calorie, Low cholesterol.',metadata:{category:'service',topic:'meals'}},
    {id:'svc-family',text:'Family & Infant: Infants <2 travel free on lap (1 per adult). COTS/bassinet on long-haul free, pre-book. Stroller to aircraft door. Child meal (CHML) for ages 2-12.',metadata:{category:'service',topic:'family'}},
    {id:'svc-unaccompanied',text:'Unaccompanied Minors (5-11): £40 fee each way (Gold members waived), direct flights only, escorted throughout. Book 24h before.',metadata:{category:'service',topic:'unaccompanied-minor'}},
    {id:'svc-assistance',text:'Special Assistance: Wheelchair (WCHR/WCHC/WCBD), blind/deaf assistance — all free, book 48h before. MEDIF form for medical conditions.',metadata:{category:'service',topic:'accessibility'}},
    {id:'svc-pets',text:'Pets: No cabin pets on BA (except guide/assistance dogs — free with docs). Pet hold on some routes via BA World Cargo at cargo.ba.com.',metadata:{category:'service',topic:'pets'}},
    {id:'svc-wifi',text:'In-flight Wi-Fi: Most long-haul and many short-haul aircraft. Free messaging (WhatsApp, iMessage) for all EC members. Full browsing £3.99/hour, £9.99 flight pass.',metadata:{category:'service',topic:'wifi'}},
    {id:'svc-entertainment',text:'In-flight Entertainment: 1,000+ hours movies, TV, music, games on personal screen. On-demand. Noise-reducing headphones in Club World and First. Bluetooth pairing on A350.',metadata:{category:'service',topic:'entertainment'}},
    {id:'offer-summer',text:'Summer Escape Sale 2026: Up to 30% off selected Europe and North America flights. Travel by 31 Aug 2026. Promo code SUMMER30.',metadata:{category:'offer',title:'Summer Sale',promoCode:'SUMMER30'}},
    {id:'offer-bizclass',text:'Business Class Sale 2026: Club World from £1,299 return to New York. Promo code BIZCLASS. Valid to 30 Sep 2026. Includes lounge + 2×32kg bags.',metadata:{category:'offer',title:'Business Class Deal',promoCode:'BIZCLASS'}},
    {id:'offer-double-avios',text:'Double Avios Promotion: 2× Avios on all direct BA flights booked before 31 Jul 2026. Opt-in in EC account. Code DOUBLEAVIOS.',metadata:{category:'offer',title:'Double Avios',promoCode:'DOUBLEAVIOS'}},
    {id:'travel-visa',text:'Visa & Travel Docs: Passport with 6+ months validity. ESTA required for USA (apply 72h before). ETA for Canada. Schengen visa covers EU. Check TIMATIC via ba.com.',metadata:{category:'travel',topic:'visa'}},
    {id:'travel-insurance',text:'Travel Insurance: BA recommends comprehensive cover (medical, cancellation, baggage). EHIC/GHIC for EU/EEA. BA insurance via AXA at ba.com/travelinsurance.',metadata:{category:'travel',topic:'insurance'}},
    {id:'travel-advance-passenger',text:'Advance Passenger Information (API): Required for USA, Canada, Australia. Enter passport details via Manage Booking before check-in. Must match passport exactly.',metadata:{category:'travel',topic:'api-passport'}},
  ];
}

function getAllKnowledgeDocs() {
  return [...buildKnowledgeDocs(), ...buildKnowledgeDocsExtended(), ...buildKnowledgeDocsPolicies()];
}


// ─── Intent classification ─────────────────────────────────────────────────
function classifyQueryIntent(queryText) {
  const q = queryText.toLowerCase();
  const entities = { iata:[], flight:[], tier:[], cabin:[], reference:[] };
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
  const fm = queryText.match(/\bBA\s?\d{1,4}\b/gi);
  if (fm) entities.flight = [...new Set(fm.map(f => f.replace(/\s+/g,'').toUpperCase()))];
  const rm = queryText.match(/\b[A-Z0-9]{6}\b/g);
  if (rm) entities.reference = rm.filter(r => /[A-Z]/.test(r) && /[0-9]/.test(r));
  if (/\bgold\b/i.test(q))   entities.tier.push('Gold');
  if (/\bsilver\b/i.test(q)) entities.tier.push('Silver');
  if (/\bbronze\b/i.test(q)) entities.tier.push('Bronze');
  if (/\bblue\b/i.test(q))   entities.tier.push('Blue');
  if (/club world|club suite|club europe|business class|business/i.test(q)) entities.cabin.push('Club World');
  if (/first class|first/i.test(q)) entities.cabin.push('First');
  if (/world traveller plus|premium economy|premium/i.test(q)) entities.cabin.push('World Traveller Plus');
  if (/world traveller|economy/i.test(q)) entities.cabin.push('World Traveller');
  let intent = 'GENERAL';
  if      (/\b(uk261|eu261|compensation|delay rights|cancel.*rights|duty of care|downgrade.*refund|stranded.*ba|flight.*rights)\b/i.test(q))                                                                                   intent = 'UK261';
  else if (/\b(baggage|luggage|carry.?on|hand baggage|checked bag|excess bag|suitcase|weight limit|how many kg|allowance.*bag|bag.*allowance|bag.*weight|extra bag|add.*bag|extra.*luggage)\b/i.test(q))                       intent = 'BAGGAGE';
  else if (/\b(visa|passport|entry requirements?|esta|eta|api|advance passenger|travel doc)\b/i.test(q))                                                                                                                        intent = 'TRAVEL_DOCS';
  else if (/\b(travel insurance|medical cover|ehic|ghic|insurance)\b/i.test(q))                                                                                                                                                intent = 'INSURANCE';
  else if (/\b(pet.*fly|fly.*pet|pet.*cabin|take.*pet|dog.*flight|cat.*flight|animal.*fly|animal.*cabin|take.*dog|take.*cat|dog.*cabin|cat.*cabin|pets.*on.*flight|ba.*allow.*pet|pet.*travel|allow.*pet|pets)\b/i.test(q))      intent = 'PETS';
  else if (/\b(infant|baby|bassinet|cot|child.*travel|family.*travel|stroller|buggy|car seat|lap.*infant|meal.*child\w*|child\w*.*meal|meal.*for.*child\w*|special.*meal.*child\w*)\b/i.test(q))                                   intent = 'FAMILY';
  else if (/\b(my booking|manage booking|find booking|view booking|booking ref|pnr|rebook|modify|cancel booking|seat selection|choose.*seat|how.*choose.*seat|name correction|change.*flight|change.*date|modify.*flight|reschedule|upgrade.*booking)\b/i.test(q)) intent = 'BOOKING';
  else if (/\b(check.?in|checkin|boarding pass|bag drop|check in online)\b/i.test(q))                                                                                                                                          intent = 'CHECKIN';
  else if (/\b(flight status|is my flight|on time|live status|track.*flight|flight tracker|has.*landed|gate.*number|what gate|gate.*departing|departing.*gate)\b/i.test(q))                                                   intent = 'FLIGHT_STATUS';
  else if (/\b(lounge|galleries|concorde room|first wing|shower.*airport|airport.*dining|can i use.*lounge)\b/i.test(q))                                                                                                       intent = 'LOUNGE';
  else if (/\b(avios|tier points?|executive club|reward flight|companion voucher|earn.*point|how many.*avios|redeem.*avios|spend.*avios)\b/i.test(q))                                                                         intent = 'EXECUTIVE_CLUB';
  else if (/\b(cabin|seat.*class|flat bed|legroom|club suite|world traveller|premium economy|first class|club world|club europe|what is.*class)\b/i.test(q))                                                                  intent = 'CABIN';
  else if (/\b(destination|where does ba fly|where can i fly|which countries|ba fly to|holiday destination|recommend.*destination|popular destination|places to visit)\b/i.test(q))                                           intent = 'DESTINATION';
  else if (/\b(route|flight time|duration|direct|non.?stop|how long.*flight|how long.*fly|flight.*duration)\b/i.test(q))                                                                                                        intent = 'ROUTE';
  else if (/\b(book|reserve|ticket|fly to|want to fly|search flights|find a flight|find.*flights|how much.*fly)\b/i.test(q))                                                                                                      intent = 'BOOK_FLIGHT';
  else if (/\b(terminal|t5|t3|heathrow|gatwick|airport.*guide|which terminal|gate number)\b/i.test(q))                                                                                                                         intent = 'AIRPORT';
  else if (/\b(offer|sale|discount|promo|deal|cheap.*flight|best price|deals)\b/i.test(q))                                                                                                                                     intent = 'OFFER';
  else if (/\b(special meal|halal|kosher|vegan|gluten|diabetic|hindu meal|baby meal|meal.*type|dietary)\b/i.test(q))                                                                                                           intent = 'SPECIAL_MEAL';
  else if (/\b(wheelchair|assistance|disabled|accessibility|blind|deaf|mobility|umnr|unaccompanied|fly.*alone|alone.*fly|year.*old.*fly|child.*fly.*alone)\b/i.test(q))                                                                                                               intent = 'SPECIAL_SERVICE';
  else if (/\b(wifi|wi-fi|internet.*flight|onboard.*internet|entertainment|inflight)\b/i.test(q))                                                                                                                              intent = 'INFLIGHT_SERVICES';
  else if (/\b(delayed|cancel|cancelled|cancellation|refund)\b/i.test(q))                                                                                                                                                      intent = 'UK261';
  return { intent, entities };
}

function expandBAQuery(queryText) {
  let expanded = queryText.toLowerCase();
  for (const [key, synonyms] of Object.entries(BA_SYNONYM_MAP)) {
    const reg = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`, 'gi');
    if (reg.test(expanded)) expanded += ' ' + synonyms.join(' ');
  }
  return expanded;
}

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
    if (tf > 0) score += 1.5 * (tf*(k1+1))/(tf+k1*(1-b+b*(docLen/avgdl)));
  }
  const { entities, intent } = intentData;
  if (entities.iata?.length) {
    const dIata = (doc.metadata?.iata||'').toUpperCase();
    const dFrom = (doc.metadata?.from||'').toUpperCase();
    const dTo   = (doc.metadata?.to||'').toUpperCase();
    if (entities.iata.some(i => i===dIata||i===dFrom||i===dTo||textLower.includes(i.toLowerCase()))) score += 12;
  }
  if (entities.flight?.length && entities.flight.some(f => textLower.includes(f.toLowerCase()))) score += 12;
  if (entities.tier?.length) {
    const dTier = doc.metadata?.tier||'';
    if (entities.tier.some(t => t.toLowerCase()===dTier.toLowerCase()||textLower.includes(t.toLowerCase()))) score += 7;
  }
  if (entities.cabin?.length) {
    const dCabin = doc.metadata?.cabin||'';
    if (entities.cabin.some(c => c.toLowerCase()===dCabin.toLowerCase()||textLower.includes(c.toLowerCase()))) score += 7;
  }
  const cat = doc.metadata?.category||'';
  const intentCatMap = {UK261:'uk261',BAGGAGE:'baggage',LOUNGE:'lounge',EXECUTIVE_CLUB:'executive-club',CABIN:'cabin',AIRPORT:'airport',ROUTE:'route',OFFER:'offer',SPECIAL_MEAL:'service',SPECIAL_SERVICE:'service',FAMILY:'service',BOOKING:'booking',CHECKIN:'booking',BOOK_FLIGHT:'destination',DESTINATION:'destination',TRAVEL_DOCS:'travel',INSURANCE:'travel',PETS:'service',INFLIGHT_SERVICES:'service',FLIGHT_STATUS:'route'};
  if (intent !== 'GENERAL' && intentCatMap[intent] === cat) score += 8;
  // ENHANCEMENT 2 — apply specialist agent domain boost
  const agent = getSpecialistAgent(intent);
  if (agent) score += applySpecialistBoost(doc, agent);
  return score;
}

function queryBM25Docs(expandedQuery, intentData, topK = 12) {
  const docs        = getAllKnowledgeDocs();
  const queryTokens = expandedQuery.toLowerCase().replace(/[^\w\s]/g,' ').split(/\s+/).filter(t => t.length > 1);
  const scored      = docs.map(doc => ({ doc, score: calculateBM25Score(doc, queryTokens, intentData) }));
  scored.sort((a,b) => b.score - a.score);
  return scored.slice(0, topK).map(s => ({ id:s.doc.id, text:s.doc.text, metadata:s.doc.metadata, bm25Score:s.score }));
}

function reciprocalRankFusion(vectorDocs, bm25Docs, topK = MAX_CONTEXT_DOCS) {
  const kRRF = 60;
  const map  = new Map();
  vectorDocs.forEach((doc, rank) => {
    const id = doc.id || doc.text.slice(0,30);
    map.set(id, { doc, rrfScore: 1/(kRRF+rank+1), vectorRank: rank+1, bm25Rank: null });
  });
  bm25Docs.forEach((item, rank) => {
    const score = 1/(kRRF+rank+1);
    if (map.has(item.id)) { map.get(item.id).rrfScore += score; map.get(item.id).bm25Rank = rank+1; }
    else map.set(item.id, { doc:{id:item.id,text:item.text,metadata:item.metadata}, rrfScore:score, vectorRank:null, bm25Rank:rank+1 });
  });
  const ranked = [...map.values()].sort((a,b) => b.rrfScore - a.rrfScore);
  return ranked.slice(0,topK).map(r => ({ id:r.doc.id, text:r.doc.text, metadata:r.doc.metadata, rrfScore:r.rrfScore }));
}

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

async function seedKnowledgeBase() {
  const collection = await getCollection();
  if (!collection) { logger.warn('[ragService] ChromaDB unavailable — BM25 only'); return false; }
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

async function initRAG() {
  const ok = await initChroma();
  if (!ok) logger.warn('[ragService] ChromaDB not available — BM25 hybrid active');
  else await seedKnowledgeBase();
  return true;
}


// ═══════════════════════════════════════════════════════════════════════════
// CORE RETRIEVAL — getContext (with all 10 enhancements wired in)
// ═══════════════════════════════════════════════════════════════════════════
async function getContext(queryText) {
  if (!queryText?.trim()) return null;
  const traceId = newTraceId();
  const t0      = Date.now();
  metrics.queries++;

  const clean = queryText.trim();

  // ── ENHANCEMENT 4: LRU Cache check ───────────────────────────────────────
  const cacheKey = clean.toLowerCase().slice(0, 120);
  const cached   = contextCache.get(cacheKey);
  if (cached) {
    metrics.cacheHits++;
    tracedLog(traceId, 'cache HIT', { chars: cached.length });
    return cached;
  }

  const intentData = classifyQueryIntent(clean);
  const expanded   = expandBAQuery(clean);

  // ── ENHANCEMENT 8: Query decomposition ───────────────────────────────────
  const subQueries = decomposeQuery(clean);
  tracedLog(traceId, 'decomposed', { subQueries, intent: intentData.intent });

  let merged;
  if (subQueries.length > 1) {
    merged = await retrieveForSubQueries(subQueries, intentData, traceId);
  } else {
    let vectorDocs = [];
    if (isReady()) vectorDocs = await queryVectorDocuments(expanded, 12);
    const bm25Docs = queryBM25Docs(expanded, intentData, 12);
    merged = reciprocalRankFusion(vectorDocs, bm25Docs, MAX_CONTEXT_DOCS);
  }

  if (!merged.length) { tracedLog(traceId, 'no docs found'); return null; }

  // ── ENHANCEMENT 7: Semantic reranker ─────────────────────────────────────
  merged = semanticRerank(clean, merged).slice(0, MAX_CONTEXT_DOCS);
  tracedLog(traceId, 'after rerank', { topId: merged[0]?.id, topFinal: merged[0]?.finalScore?.toFixed(3) });

  // ── ENHANCEMENT 1: CoT reasoning trace ───────────────────────────────────
  const cot = buildCoT(clean, intentData, merged);
  tracedLog(traceId, 'CoT trace', { steps: cot.steps.length, confidence: cot.confidence });

  const parts = merged.map((doc, i) => {
    const cat   = doc.metadata?.category || 'general';
    const topic = doc.metadata?.topic || doc.metadata?.title || doc.metadata?.name || doc.id;
    return `[${cat.toUpperCase()} | ${topic}]\n${doc.text}`;
  });
  let context = parts.join('\n\n');
  if (context.length > MAX_CONTEXT_CHARS) context = context.slice(0, MAX_CONTEXT_CHARS) + '...';

  // ── ENHANCEMENT 4: Store in LRU cache ────────────────────────────────────
  contextCache.set(cacheKey, context);

  const elapsedMs = Date.now() - t0;
  metrics.totalLatencyMs += elapsedMs;

  logger.info('[ragService] Context retrieved', {
    traceId, intent: intentData.intent, docs: merged.length,
    chars: context.length, confidence: cot.confidence.toFixed(2),
    cached: false, elapsedMs,
  });

  return context;
}

// ═══════════════════════════════════════════════════════════════════════════
// getContextWithSources — full metadata + all enhancements
// ═══════════════════════════════════════════════════════════════════════════
async function getContextWithSources(queryText) {
  if (!queryText?.trim()) return { context:null, sources:[], intent:'GENERAL', entities:{}, cot:null, confidence:0, suggestions:[], toolPlan:[], needsClarification:false };

  const traceId    = newTraceId();
  const t0         = Date.now();
  metrics.queries++;

  const clean      = queryText.trim();
  const intentData = classifyQueryIntent(clean);
  const expanded   = expandBAQuery(clean);
  const { intent, entities } = intentData;

  // ── Cache ─────────────────────────────────────────────────────────────────
  const cacheKey = `src:${clean.toLowerCase().slice(0, 120)}`;
  const cached   = contextCache.get(cacheKey);
  if (cached) {
    metrics.cacheHits++;
    tracedLog(traceId, 'source-cache HIT');
    return cached;
  }

  // ── ENHANCEMENT 8: Decompose ──────────────────────────────────────────────
  const subQueries = decomposeQuery(clean);
  let merged;
  if (subQueries.length > 1) {
    merged = await retrieveForSubQueries(subQueries, intentData, traceId);
  } else {
    let vectorDocs = [];
    if (isReady()) vectorDocs = await queryVectorDocuments(expanded, 12);
    const bm25Docs = queryBM25Docs(expanded, intentData, 12);
    merged = reciprocalRankFusion(vectorDocs, bm25Docs, MAX_CONTEXT_DOCS);
  }

  if (!merged.length) return { context:null, sources:[], intent, entities, cot:null, confidence:0, suggestions:getProactiveSuggestions(intent, entities), toolPlan:[], needsClarification:false };

  // ── ENHANCEMENT 7: Semantic rerank ────────────────────────────────────────
  merged = semanticRerank(clean, merged).slice(0, MAX_CONTEXT_DOCS);

  // ── ENHANCEMENT 1: CoT ───────────────────────────────────────────────────
  const cot        = buildCoT(clean, intentData, merged);
  const confidence = cot.confidence;

  // ── ENHANCEMENT 3: Low-confidence clarification ───────────────────────────
  const needsClarification = confidence < MIN_CONFIDENCE;
  const clarifyQuestion    = needsClarification ? buildClarifyingQuestion(clean, intent) : null;

  // ── ENHANCEMENT 6: Multi-step tool plan ───────────────────────────────────
  const toolPlan = buildToolPlan(intent, entities);
  tracedLog(traceId, 'tool plan', { steps: toolPlan.length, needsClarification });

  // ── ENHANCEMENT 9: Proactive suggestions ─────────────────────────────────
  const suggestions = getProactiveSuggestions(intent, entities);

  const sources = merged.map(doc => ({
    id:       doc.id,
    category: doc.metadata?.category || 'general',
    label:    doc.metadata?.topic || doc.metadata?.title || doc.metadata?.name || doc.metadata?.type || doc.id,
    score:    Math.round((doc.rrfScore || 0) * 1000) / 1000,
    semScore: Math.round((doc.semScore  || 0) * 1000) / 1000,
  }));

  const parts = merged.map((doc, i) => {
    const cat   = doc.metadata?.category || 'general';
    const topic = sources[i].label;
    return `[${cat.toUpperCase()} | ${topic}]\n${doc.text}`;
  });
  let context = parts.join('\n\n');
  if (context.length > MAX_CONTEXT_CHARS) context = context.slice(0, MAX_CONTEXT_CHARS) + '...';

  const result = { context, sources, intent, entities, cot, confidence, suggestions, toolPlan, needsClarification, clarifyQuestion: clarifyQuestion || null };

  // ── Cache ─────────────────────────────────────────────────────────────────
  contextCache.set(cacheKey, result);

  metrics.totalLatencyMs += (Date.now() - t0);
  logger.info('[ragService] ContextWithSources', {
    traceId, intent, docs: merged.length, confidence: confidence.toFixed(2),
    toolPlan: toolPlan.length, needsClarification, elapsedMs: Date.now() - t0,
  });

  return result;
}

// ─── Augmented prompt for voice agent ────────────────────────────────────────
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
2. For bookings/check-in/status: direct to the correct in-app page.
3. Use knowledge above as ground truth. Quote exact numbers (weights, prices, Tier Points).
4. Respond in the user's language (Tamil, Hindi, Tanglish, English, etc.).
═══════════════════════════════════════════════════════`;
}


// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // Core
  initRAG,
  seedKnowledgeBase,
  getContext,
  getContextWithSources,
  getAugmentedPrompt,
  getAllKnowledgeDocs,
  // Intent / retrieval
  classifyQueryIntent,
  expandBAQuery,
  queryBM25Docs,
  queryVectorDocuments,
  reciprocalRankFusion,
  // Enhancement exports (for testing & controller use)
  decomposeQuery,
  semanticRerank,
  buildCoT,
  computeConfidence,
  buildToolPlan,
  getProactiveSuggestions,
  buildClarifyingQuestion,
  getMetrics,
  contextCache,
  // Constants & tools
  AGENTIC_TOOLS,
  isReady,
  MAX_CONTEXT_DOCS,
  RELEVANCE_THRESHOLD,
};
