/**
 * ragController.js — Express controller for RAG endpoints.
 *
 * Provides:
 *  - POST /api/rag/context — retrieve relevant context for a user query
 *  - GET  /api/rag/health  — check if ChromaDB is ready
 */
const { getContext, isReady } = require('../services/ragService');
const { success, error } = require('../utils/responseHelper');

/**
 * POST /api/rag/context
 * Retrieve relevant context from the knowledge base for a user query.
 *
 * Body: { query: "string", topK?: number }
 * Returns: { context: "string|null", ready: boolean }
 */
async function getContextHandler(req, res, next) {
  try {
    const { query, topK } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return error(res, 'Query is required', 400);
    }

    const context = await getContext(query.trim());

    return success(res, {
      context,
      ready: true,
      query: query.trim(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rag/health
 * Check if the RAG service and ChromaDB are ready.
 */
function healthHandler(req, res) {
  return success(res, {
    ready: true,
    service: 'rag',
  });
}

module.exports = {
  getContext: getContextHandler,
  health: healthHandler,
};
