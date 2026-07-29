/**
 * ragService.js — Advanced Retrieval-Augmented Generation (RAG) frontend service
 *
 * Retrieves relevant, domain-curated context from the backend ChromaDB & Hybrid search RAG API
 * for a user query, then formats it as an augmented context block prepended to the system prompt
 * for the LLM.
 */
import { initVectorDB, isVectorDBReady } from './vectorService';

const IS_DEV = Boolean(import.meta.env?.DEV);

const MAX_CONTEXT_DOCS = 5;

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
 * @param {string} userMessage  The user's voice input or text prompt
 * @returns {Promise<string|null>} Formatted context string, or null if no relevant documents found
 */
export async function getContext(userMessage) {
  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    return null;
  }

  // Ensure vector DB connection / backend RAG status is initialized
  await initVectorDB();
  if (!isVectorDBReady()) {
    log('Vector DB / backend RAG not ready, skipping RAG');
    return null;
  }

  try {
    const response = await fetch('/api/rag/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: userMessage.trim(), topK: MAX_CONTEXT_DOCS }),
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

    log(`Retrieved RAG context (${data.data.context.length} chars)`, data.data.intent);
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
 * @returns {string} The augmented system prompt
 */
export function buildAugmentedPrompt(basePrompt, context) {
  if (!context) {
    return basePrompt;
  }

  return `${basePrompt}

═══════════════════════════════════════════════════════
OFFICIAL BRITISH AIRWAYS KNOWLEDGE BASE CONTEXT (RAG):
═══════════════════════════════════════════════════════
${context}

═══════════════════════════════════════════════════════
INSTRUCTIONS FOR RESPONDING:
1. Speak in plain, clear, natural everyday conversational English (or natural Tanglish if the user speaks Tanglish). Never use technical jargon, raw JSON, or robotic phrases.
2. Use the official British Airways context above as your ground truth for baggage, tier points, lounges, cabin classes, and UK261 queries.
3. Share numbers, sizes, and policy details in simple, friendly sentences.
4. Deliver answers warmly, concisely, and naturally as a helpful British Airways representative.
═══════════════════════════════════════════════════════`;
}

/**
 * Get RAG context and build an augmented system prompt in one call.
 *
 * @param {string} userMessage  The user's voice input
 * @param {string} basePrompt   The original system prompt
 * @returns {Promise<string>} The augmented (or original) system prompt
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
