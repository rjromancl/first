/**
 * vectorService.js — ChromaDB RAG integration for the voice agent
 *
 * This service acts as a thin client wrapper around the backend ChromaDB
 * RAG API. The backend manages the ChromaDB connection, seeds the
 * knowledge base, and provides query endpoints.
 *
 * The service is designed to be resilient: if the backend RAG API is not
 * available, all operations gracefully degrade (return empty/false) so
 * the app continues to work without RAG.
 *
 * API surface (kept for backward compatibility):
 *  - initVectorDB()       — check if backend RAG is ready
 *  - addDocuments(docs)   — no-op (seeding is handled by backend)
 *  - queryDocuments(q, k) — query the backend RAG API
 *  - isVectorDBReady()    — check if backend RAG is ready
 *  - seedKnowledgeBase()  — no-op (seeding is handled by backend)
 */
const IS_DEV = Boolean(import.meta.env?.DEV);

let isInitialized = false;

/**
 * Log helper — only in dev to avoid noisy production logs.
 */
function log(...args) {
  if (IS_DEV) console.log('[vectorService]', ...args);
}

function logError(...args) {
  if (IS_DEV) {
    console.error('[vectorService]', ...args);
  } else {
    console.error('[vectorService]', args[0]);
  }
}

/**
 * Check if the backend RAG API is available by calling the health endpoint.
 * Caches the result for a short period to avoid repeated health checks.
 */
let healthCheckCache = { ready: false, timestamp: 0 };
const HEALTH_CACHE_TTL = 30000; // 30 seconds

async function checkBackendHealth() {
  const now = Date.now();
  if (now - healthCheckCache.timestamp < HEALTH_CACHE_TTL) {
    return healthCheckCache.ready;
  }

  try {
    const response = await fetch('/api/rag/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      healthCheckCache = { ready: false, timestamp: now };
      return false;
    }

    const data = await response.json();
    const ready = data.success && data.data.ready === true;
    healthCheckCache = { ready, timestamp: now };
    return ready;
  } catch (err) {
    logError('Backend RAG health check failed:', err.message);
    healthCheckCache = { ready: false, timestamp: now };
    return false;
  }
}

/**
 * Lazily initialise the vector DB connection by checking the backend.
 * Returns true if the backend RAG API is ready, false otherwise.
 */
export async function initVectorDB() {
  if (isInitialized) return true;

  try {
    const ready = await checkBackendHealth();
    if (ready) {
      log('Backend RAG API is ready');
      isInitialized = true;
      return true;
    }
    log('Backend RAG API not ready');
    return false;
  } catch (err) {
    logError('Failed to initialise vector DB:', err.message);
    isInitialized = false;
    return false;
  }
}

/**
 * Add documents to the collection.
 * This is a no-op — the backend seeds the knowledge base on startup.
 * Kept for backward compatibility with the existing API surface.
 */
export async function addDocuments(docs) {
  // Seeding is handled by the backend on startup
  log('addDocuments called — seeding is handled by backend');
  return true;
}

/**
 * Query the backend RAG API for documents semantically similar to the query.
 * @param {string} queryText  The user's message
 * @param {number} topK       Number of results to return (default 5)
 * @returns {Promise<Array<{text: string, metadata: object, distance: number}>>}
 */
export async function queryDocuments(queryText, topK = 5) {
  if (!isInitialized) {
    const ok = await initVectorDB();
    if (!ok) return [];
  }

  try {
    const response = await fetch('/api/rag/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryText, topK }),
    });

    if (!response.ok) {
      log('RAG query API returned non-OK status:', response.status);
      return [];
    }

    const data = await response.json();

    if (!data.success || !data.data.context) {
      return getLocalKnowledgeFallback(queryText);
    }

    return [{
      text: data.data.context,
      metadata: { category: 'rag' },
      distance: 0,
    }];
  } catch (err) {
    logError('Failed to query documents:', err.message);
    return getLocalKnowledgeFallback(queryText);
  }
}

/**
 * Fallback local knowledge base for offline client-side RAG
 */
function getLocalKnowledgeFallback(query) {
  if (!query) return [];
  const q = query.toLowerCase();

  const LOCAL_KNOWLEDGE = [
    {
      keywords: ['baggage', 'luggage', 'bag', 'weight', 'allowance', 'carry-on'],
      text: 'British Airways Baggage Policy: All tickets include 1 cabin bag (up to 56x45x25cm) plus 1 personal item (up to 40x30x15cm, max 23kg each). Checked baggage allowance: Economy 1x23kg, Premium Economy 2x23kg, Business 2x32kg, First 3x32kg.'
    },
    {
      keywords: ['avios', 'executive club', 'tier', 'points', 'miles', 'gold', 'silver', 'bronze', 'blue'],
      text: 'British Airways Executive Club & Avios: Earn Avios on every flight based on cabin class and distance flown. Tiers: Blue (entry), Bronze (300 Tier Points - priority check-in), Silver (600 Tier Points - lounge access & extra bag), Gold (1500 Tier Points - First lounge & Concorde Room).'
    },
    {
      keywords: ['check-in', 'checkin', 'boarding pass', 'pnr', 'reference', 'gate', 'terminal'],
      text: 'British Airways Check-In Information: Online check-in opens 24 hours prior to departure. Download mobile boarding passes to Apple Wallet / Google Pay. Airport bag-drop closes 60 minutes before long-haul flights (45 minutes for short-haul).'
    },
    {
      keywords: ['lounge', 'food', 'wifi', 'dining', 'cabin', 'seat', 'business', 'first'],
      text: 'In-Flight Experience & Lounges: British Airways offers high-speed Wi-Fi across long-haul fleets, complimentary multi-course meals, and in-flight entertainment. Galleries Lounges available for Silver/Gold members and Club World passengers.'
    },
    {
      keywords: ['destinations', 'flight', 'new york', 'dubai', 'tokyo', 'sydney', 'mumbai', 'barcelona'],
      text: 'British Airways Destinations: Flies to over 200 global destinations from London Heathrow (LHR) and London Gatwick (LGW). Major direct routes: New York (JFK), Dubai (DXB), Tokyo (NRT), Sydney (SYD), Mumbai (BOM), Barcelona (BCN).'
    }
  ];

  const matches = LOCAL_KNOWLEDGE.filter(k => k.keywords.some(kw => q.includes(kw)));
  if (matches.length > 0) {
    const combined = matches.map(m => m.text).join('\n---\n');
    return [{ text: combined, metadata: { category: 'local-rag' }, distance: 0 }];
  }
  return [];
}

/**
 * Check if the vector DB is ready.
 */
export function isVectorDBReady() {
  return isInitialized;
}

/**
 * Seed the collection with initial British Airways knowledge.
 * This is a no-op — the backend seeds the knowledge base on startup.
 * Kept for backward compatibility with the existing API surface.
 */
export async function seedKnowledgeBase() {
  // Seeding is handled by the backend on startup
  log('seedKnowledgeBase called — seeding is handled by backend');
  return true;
}

/**
 * Reset state for testing.
 */
export function resetVectorDB() {
  isInitialized = false;
  healthCheckCache = { ready: false, timestamp: 0 };
}

export default {
  initVectorDB,
  addDocuments,
  queryDocuments,
  isVectorDBReady,
  seedKnowledgeBase,
  resetVectorDB,
};
