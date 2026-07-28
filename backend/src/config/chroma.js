/**
 * chroma.js — ChromaDB client configuration for the backend.
 *
 * Provides a singleton ChromaClient that connects to a ChromaDB server
 * (HTTP mode). The server URL is configurable via the CHROMA_URL env var
 * and defaults to http://localhost:8000.
 *
 * In production (Railway), set CHROMA_URL to your ChromaDB server URL.
 * If no server is reachable, all RAG operations gracefully degrade.
 */
const { ChromaClient } = require('chromadb');
const logger = require('./logger');

const COLLECTION_NAME = 'ba-knowledge';
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';

let client = null;
let collection = null;
let isInitialized = false;

/**
 * Lazily initialise the ChromaDB client and collection.
 * Returns true if the collection is ready, false otherwise.
 */
async function initChroma() {
  if (isInitialized && collection) return true;

  try {
    logger.info('Connecting to ChromaDB', { url: CHROMA_URL });

    const parsedUrl = new URL(CHROMA_URL);
    client = new ChromaClient({
      host: parsedUrl.hostname,
      port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : (parsedUrl.protocol === 'https:' ? 443 : 80),
      ssl: parsedUrl.protocol === 'https:',
    });

    // Try to get or create collection using getOrCreateCollection or getCollection
    if (typeof client.getOrCreateCollection === 'function') {
      collection = await client.getOrCreateCollection({ name: COLLECTION_NAME });
    } else {
      try {
        collection = await client.getCollection({ name: COLLECTION_NAME });
      } catch {
        collection = await client.createCollection({ name: COLLECTION_NAME });
      }
    }

    logger.info('ChromaDB collection ready', { collection: COLLECTION_NAME });
    isInitialized = true;
    return true;
  } catch (err) {
    logger.error('Failed to initialise ChromaDB', { error: err.message });
    isInitialized = false;
    return false;
  }
}

/**
 * Get the current collection (initialises if needed).
 */
async function getCollection() {
  if (!collection) {
    const ok = await initChroma();
    if (!ok) return null;
  }
  return collection;
}

/**
 * Check if ChromaDB is ready.
 */
function isReady() {
  return isInitialized && collection !== null;
}

/**
 * Reset the connection state (useful for testing or reconnection).
 */
function reset() {
  client = null;
  collection = null;
  embeddingFunction = null;
  isInitialized = false;
}

module.exports = {
  initChroma,
  getCollection,
  isReady,
  reset,
  COLLECTION_NAME,
  CHROMA_URL,
};
