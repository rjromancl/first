const router = require('express').Router();
const { getContext, health } = require('../controllers/ragController');

// POST /api/rag/context — retrieve RAG context for a query
router.post('/context', getContext);

// GET /api/rag/health — check if ChromaDB is ready
router.get('/health', health);

module.exports = router;
