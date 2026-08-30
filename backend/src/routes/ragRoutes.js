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

// GET /api/rag/stats — knowledge base stats (includes PDF upload stats)
router.get('/stats', ctrl.stats);

// GET /api/rag/download-ba-rules — serve the pre-built BA Rules PDF
router.get('/download-ba-rules', (req, res) => {
  const filePath = require('path').join(__dirname, '../../uploads/BA_Rules_Knowledge_Base.pdf');
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: { message: 'PDF not found. Run: node backend/scripts/generateBARulesPDF.js' } });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="BA_Rules_Knowledge_Base.pdf"');
  fs.createReadStream(filePath).pipe(res);
});

// POST /api/rag/upload-pdf — upload a PDF to extend the RAG knowledge base
// Content-Type: multipart/form-data, field: file (PDF, max 10 MB)
router.post('/upload-pdf', ctrl.uploadPDF);

// GET /api/rag/pdfs — list all uploaded PDFs and their chunk counts
router.get('/pdfs', ctrl.listPDFs);

// DELETE /api/rag/pdfs/:filename — remove a PDF and its indexed chunks
router.delete('/pdfs/:filename', ctrl.deletePDF);

module.exports = router;
