const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const ctrl = require('../controllers/ragController');

// POST /api/rag/context — raw context for voice agent / geminiService
router.post('/context',
  [body('query').notEmpty().withMessage('query is required')],
  validate,
  ctrl.getContext
);

// POST /api/rag/ask — full agentic Q&A with tool execution
router.post('/ask',
  [body('query').notEmpty().withMessage('query is required')],
  validate,
  ctrl.agenticAsk
);

// GET /api/rag/health
router.get('/health', ctrl.health);

// GET /api/rag/stats — knowledge base stats
router.get('/stats', ctrl.stats);

module.exports = router;
