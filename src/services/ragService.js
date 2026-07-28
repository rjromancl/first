/**
 * ragService.js — Retrieval-Augmented Generation (RAG) service
 *
 * Retrieves relevant context from the backend ChromaDB knowledge base
 * for a user query, then formats it as a context string that can be
 * prepended to the system prompt before sending to the LLM.
 *
 * The RAG pipeline:
 *   1. Send the user query to the backend /api/rag/context endpoint
 *   2. The backend queries ChromaDB for semantically similar documents
 *   3. Filter by relevance (distance threshold)
 *   4. Format the results as a concise context string
 *   5. Return the context (or null if no relevant docs found)
 *
 * If the backend RAG endpoint is not available, the service gracefully
 * returns null and the app continues without RAG context.
 */
import { initVectorDB, isVectorDBReady } from './vectorService';

const IS_DEV = Boolean(import.meta.env?.DEV);

// Maximum number of relevant documents to include in context
const MAX_CONTEXT_DOCS = 3;

// Distance threshold — lower is more similar (Chroma uses cosine distance)
// Only include documents with distance below this threshold
const RELEVANCE_THRESHOLD = 0.7;

// Maximum total characters of context to include (to bound prompt size)
const MAX_CONTEXT_CHARS = 2000;

function log(...args) {
  if (IS_DEV) console.log('[ragService]', ...args);
}

function logError(...args) {
  if (IS_DEV) {
    console.error('[ragService]', ...args);
  } else {
    console.error('[ragService]', args[0]);
  }
}

/**
 * Retrieve relevant context for a user query from the backend RAG API.
 *
 * @param {string} userMessage  The user's voice input
 * @returns {Promise<string|null>}  Formatted context string, or null if no
 *                                   relevant documents were found
 */
export async function getContext(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') {
    return null;
  }

  // Ensure vector DB connection / backend RAG status is initialized
  await initVectorDB();
  if (!isVectorDBReady()) {
    log('Vector DB / backend RAG not ready, skipping RAG');
    return null;
  }

  try {
    // Call the backend RAG API endpoint
    const response = await fetch('/api/rag/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userMessage, topK: MAX_CONTEXT_DOCS }),
    });

    if (!response.ok) {
      log('RAG API returned non-OK status:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data.success || !data.data.context) {
      log('No context returned from RAG API');
      return null;
    }

    log(`Retrieved RAG context (${data.data.context.length} chars)`);
    return data.data.context;
  } catch (err) {
    logError('Failed to get RAG context:', err.message);
    return null;
  }
}

/**
 * Build a system prompt augmented with RAG context.
 *
 * @param {string} basePrompt  The original system prompt
 * @param {string|null} context  The RAG context (or null)
 * @returns {string}  The augmented system prompt
 */
export function buildAugmentedPrompt(basePrompt, context) {
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
 * Get RAG context and build an augmented system prompt in one call.
 *
 * @param {string} userMessage  The user's voice input
 * @param {string} basePrompt   The original system prompt
 * @returns {Promise<string>}  The augmented (or original) system prompt
 */
export async function getAugmentedPrompt(userMessage, basePrompt) {
  const context = await getContext(userMessage);
  return buildAugmentedPrompt(basePrompt, context);
}

export default {
  getContext,
  buildAugmentedPrompt,
  getAugmentedPrompt,
};
