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
      return [];
    }

    // The backend returns a formatted context string.
    // We wrap it in the same shape as the original vectorService
    // so callers that expect {text, metadata, distance} still work.
    return [{
      text: data.data.context,
      metadata: { category: 'rag' },
      distance: 0,
    }];
  } catch (err) {
    logError('Failed to query documents:', err.message);
    return [];
  }
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
