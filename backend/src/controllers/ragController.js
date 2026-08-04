/**
 * ragController.js — Express controller for RAG endpoints.
 *
 * Provides:
 *  - POST /api/rag/context — retrieve relevant context for a user query
 *  - GET  /api/rag/health  — check if ChromaDB / hybrid RAG service is ready
 */
const { getContext, classifyQueryIntent, isReady } = require('../services/ragService');
const { success, error } = require('../utils/responseHelper');

/**
 * POST /api/rag/context
 * Retrieve relevant context from the knowledge base for a user query.
 *
 * Body: { query: "string", topK?: number }
 * Returns: { context: "string|null", intent: object, ready: boolean }
 */
async function getContextHandler(req, res, next) {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return error(res, 'Query is required', 400);
    }

    const cleanQuery = query.trim();
    const intentData = classifyQueryIntent(cleanQuery);
    const context = await getContext(cleanQuery);

    return success(res, {
      context,
      intent: intentData,
      ready: true,
      query: cleanQuery,
      // Include the doc count for debug/monitoring
      hasContext: !!context,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/rag/health
 * Check if the RAG service and ChromaDB/hybrid engine are ready.
 */
function healthHandler(req, res) {
  return success(res, {
    ready: true,
    vectorDbReady: isReady(),
    service: 'rag',
  });
}

module.exports = {
  getContext: getContextHandler,
  health: healthHandler,
};
