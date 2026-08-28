/**
 * chroma.js — ChromaDB client configuration.
 *
 * On Vercel serverless, ChromaDB cannot run (it needs a persistent
 * Docker process). The code gracefully degrades to BM25-only retrieval
 * when ChromaDB is unavailable — no crash, no loud error.
 *
 * In local dev / Railway: set CHROMA_URL to point to your ChromaDB server.
 * On Vercel: leave CHROMA_URL unset — BM25 + semantic reranker still runs.
 */
const logger = require('./logger');

// Only require chromadb if a URL is explicitly configured
const CHROMA_URL = process.env.CHROMA_URL || '';

let client     = null;
let collection = null;
let isInitialized = false;

const COLLECTION_NAME = 'ba-knowledge';

/**
 * Lazily initialise the ChromaDB client.
 * Returns false silently when no CHROMA_URL is set (Vercel / BM25-only mode).
 */
async function initChroma() {
  // On Vercel no ChromaDB is available — skip silently, BM25 takes over
  if (!CHROMA_URL) {
    logger.info('[chroma] No CHROMA_URL set — running in BM25-only mode');
    isInitialized = false;
    return false;
  }

  if (isInitialized && collection) return true;

  try {
    const { ChromaClient } = require('chromadb');
    logger.info('[chroma] Connecting to ChromaDB', { url: CHROMA_URL });

    const parsedUrl = new URL(CHROMA_URL);
    client = new ChromaClient({
      host: parsedUrl.hostname,
      port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : (parsedUrl.protocol === 'https:' ? 443 : 80),
      ssl:  parsedUrl.protocol === 'https:',
    });

    if (typeof client.getOrCreateCollection === 'function') {
      collection = await client.getOrCreateCollection({ name: COLLECTION_NAME });
    } else {
      try {
        collection = await client.getCollection({ name: COLLECTION_NAME });
      } catch {
        collection = await client.createCollection({ name: COLLECTION_NAME });
      }
    }

    logger.info('[chroma] Collection ready', { collection: COLLECTION_NAME });
    isInitialized = true;
    return true;
  } catch (err) {
    // Downgrade to BM25 — not an error in Vercel deployments
    logger.warn('[chroma] ChromaDB unavailable — BM25-only mode active', { reason: err.message });
    isInitialized = false;
    collection    = null;
    return false;
  }
}

async function getCollection() {
  if (!collection) {
    const ok = await initChroma();
    if (!ok) return null;
  }
  return collection;
}

function isReady() {
  return isInitialized && collection !== null;
}

function reset() {
  client        = null;
  collection    = null;
  isInitialized = false;
}

module.exports = { initChroma, getCollection, isReady, reset, COLLECTION_NAME, CHROMA_URL };
