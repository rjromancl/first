/**
 * pdfIngestionService.js
 *
 * Parses an uploaded PDF, splits it into semantic chunks, and injects
 * them into the RAG knowledge base (both BM25 in-memory store and
 * ChromaDB when available).
 *
 * Exported API:
 *   ingestPDF(filePath, filename)  → { chunks, pages, filename, docIds }
 *   listUploadedDocs()             → [{ filename, chunks, uploadedAt }]
 *   deleteUploadedDoc(filename)    → { deleted: true }
 *   getUploadedDocStats()          → { total, byFile }
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const pdfParseLib = require('pdf-parse');
// pdf-parse exports the function as default or as .default depending on version
const pdfParse = typeof pdfParseLib === 'function' ? pdfParseLib : (pdfParseLib.default || pdfParseLib);
const { getCollection } = require('../config/chroma');
const logger  = require('../config/logger');

// In-memory store of PDF-injected chunks (survives only for the process lifetime;
// ChromaDB persists them across restarts when available)
const pdfChunkStore = new Map();   // docId → { text, metadata }

// Registry of uploaded docs
const uploadRegistry = [];         // [{ filename, originalName, chunks, pages, uploadedAt, docIds }]

// ── Chunking ──────────────────────────────────────────────────────────────────
const CHUNK_SIZE     = 600;   // characters per chunk
const CHUNK_OVERLAP  = 80;    // overlap between consecutive chunks

/**
 * Split text into overlapping fixed-size chunks.
 * Tries to split at sentence/newline boundaries first.
 */
function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned.length <= chunkSize) return [cleaned];

  // Split on paragraph / double-newline first
  const paragraphs = cleaned.split(/\n\n+/);
  const chunks = [];
  let buffer = '';

  for (const para of paragraphs) {
    if ((buffer + '\n\n' + para).length <= chunkSize) {
      buffer = buffer ? buffer + '\n\n' + para : para;
    } else {
      // Para alone fits — flush buffer then start new
      if (buffer) chunks.push(buffer.trim());
      if (para.length <= chunkSize) {
        buffer = para;
      } else {
        // Para too long — split by sentence
        const sentences = para.match(/[^.!?\n]+[.!?\n]*/g) || [para];
        buffer = '';
        for (const sent of sentences) {
          if ((buffer + ' ' + sent).length <= chunkSize) {
            buffer = buffer ? buffer + ' ' + sent : sent;
          } else {
            if (buffer) chunks.push(buffer.trim());
            // If sentence itself is too long, hard-split
            if (sent.length > chunkSize) {
              for (let i = 0; i < sent.length; i += chunkSize - overlap) {
                chunks.push(sent.slice(i, i + chunkSize).trim());
              }
              buffer = '';
            } else {
              buffer = sent;
            }
          }
        }
      }
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());

  // Add overlap: prepend last N chars of previous chunk
  const overlapped = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      overlapped.push(chunks[i]);
    } else {
      const prev  = chunks[i - 1];
      const tail  = prev.slice(-overlap);
      overlapped.push((tail + ' ' + chunks[i]).trim());
    }
  }

  return overlapped.filter(c => c.length > 20);
}

/**
 * Infer category metadata from chunk text for BM25 boosting.
 */
function inferCategory(text) {
  const t = text.toLowerCase();
  if (/baggage|luggage|suitcase|carry.?on|kg|allowance/.test(t))             return 'baggage';
  if (/uk261|eu261|compensation|delay rights|duty of care/.test(t))          return 'uk261';
  if (/avios|executive club|tier|gold|silver|bronze|companion voucher/.test(t)) return 'executive-club';
  if (/lounge|galleries|concorde room|first wing/.test(t))                   return 'lounge';
  if (/cabin|first class|business class|club world|premium economy/.test(t)) return 'cabin';
  if (/check.?in|boarding pass|bag drop/.test(t))                            return 'booking';
  if (/manage.*booking|booking reference|pnr|cancel|refund/.test(t))        return 'booking';
  if (/destination|where.*fly|holiday|city|country|beach/.test(t))           return 'destination';
  if (/route|flight time|duration|non.?stop/.test(t))                        return 'route';
  if (/visa|passport|esta|eta|api|advance passenger/.test(t))                return 'travel';
  if (/insurance|medical cover|ehic/.test(t))                                return 'travel';
  if (/special meal|halal|kosher|vegan|gluten|diabetic/.test(t))            return 'service';
  if (/wheelchair|assistance|infant|baby|bassinet/.test(t))                 return 'service';
  if (/offer|sale|promo|deal|discount/.test(t))                             return 'offer';
  if (/airport|terminal|t5|t3|heathrow|gatwick/.test(t))                    return 'airport';
  if (/wi.?fi|internet|entertainment|bluetooth/.test(t))                    return 'service';
  return 'general';
}

// ── Main ingest function ──────────────────────────────────────────────────────
async function ingestPDF(filePath, originalName) {
  logger.info('[pdfIngestion] Starting PDF ingestion', { filePath, originalName });

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const dataBuffer = fs.readFileSync(filePath);
  const parsed     = await pdfParse(dataBuffer);

  const totalPages = parsed.numpages || 1;
  const rawText    = parsed.text || '';

  if (!rawText.trim()) {
    throw new Error('PDF contains no extractable text. It may be a scanned/image PDF.');
  }

  logger.info('[pdfIngestion] PDF parsed', { pages: totalPages, chars: rawText.length });

  // Chunk the full text
  const rawChunks = chunkText(rawText);
  const baseName  = path.basename(originalName, path.extname(originalName))
                        .replace(/[^a-zA-Z0-9_-]/g, '_')
                        .toLowerCase();

  const docIds  = [];
  const chunks  = [];

  rawChunks.forEach((text, i) => {
    const docId   = `pdf-${baseName}-${i}`;
    const category = inferCategory(text);
    const metadata = {
      category,
      source:   originalName,
      page:     Math.floor((i / rawChunks.length) * totalPages) + 1,
      chunkIdx: i,
      type:     'pdf-upload',
      uploadedAt: new Date().toISOString(),
    };

    pdfChunkStore.set(docId, { id: docId, text, metadata });
    docIds.push(docId);
    chunks.push({ id: docId, text, metadata });
  });

  // ── Try to upsert into ChromaDB ──────────────────────────────────────────
  try {
    const collection = await getCollection();
    if (collection) {
      // Remove old chunks from this file first (idempotent re-upload)
      const oldEntry = uploadRegistry.find(r => r.originalName === originalName);
      if (oldEntry?.docIds?.length) {
        try { await collection.delete({ ids: oldEntry.docIds }); } catch (_) {}
      }

      await collection.upsert({
        ids:       chunks.map(c => c.id),
        documents: chunks.map(c => c.text),
        metadatas: chunks.map(c => c.metadata),
      });
      logger.info('[pdfIngestion] ChromaDB upsert complete', { count: chunks.length });
    }
  } catch (err) {
    logger.warn('[pdfIngestion] ChromaDB upsert skipped', { error: err.message });
    // Not fatal — BM25 in-memory store still has the chunks
  }

  // ── Register the upload ──────────────────────────────────────────────────
  const existingIdx = uploadRegistry.findIndex(r => r.originalName === originalName);
  const entry = {
    filename:     path.basename(filePath),
    originalName,
    chunks:       chunks.length,
    pages:        totalPages,
    uploadedAt:   new Date().toISOString(),
    docIds,
    sizeBytes:    dataBuffer.length,
  };

  if (existingIdx >= 0) uploadRegistry[existingIdx] = entry;
  else                  uploadRegistry.push(entry);

  logger.info('[pdfIngestion] Ingestion complete', { chunks: chunks.length, pages: totalPages });

  return { chunks: chunks.length, pages: totalPages, filename: originalName, docIds };
}

/**
 * Return all PDF-sourced chunks for BM25 scoring.
 * Called by ragService.getAllKnowledgeDocs() via monkey-patch on startup.
 */
function getPDFChunks() {
  return [...pdfChunkStore.values()];
}

/** List all uploaded docs with their metadata. */
function listUploadedDocs() {
  return uploadRegistry.map(r => ({
    originalName: r.originalName,
    filename:     r.filename,
    chunks:       r.chunks,
    pages:        r.pages,
    uploadedAt:   r.uploadedAt,
    sizeKB:       Math.round((r.sizeBytes || 0) / 1024),
  }));
}

/** Delete all chunks for a specific uploaded file. */
async function deleteUploadedDoc(originalName) {
  const idx = uploadRegistry.findIndex(r => r.originalName === originalName);
  if (idx < 0) throw new Error(`No uploaded doc found: ${originalName}`);

  const entry = uploadRegistry[idx];

  // Remove from in-memory store
  entry.docIds.forEach(id => pdfChunkStore.delete(id));

  // Remove from ChromaDB
  try {
    const collection = await getCollection();
    if (collection && entry.docIds.length) {
      await collection.delete({ ids: entry.docIds });
    }
  } catch (_) {}

  // Remove the physical file
  const physicalPath = path.join(__dirname, '../../uploads', entry.filename);
  if (fs.existsSync(physicalPath)) {
    try { fs.unlinkSync(physicalPath); } catch (_) {}
  }

  uploadRegistry.splice(idx, 1);
  return { deleted: true, originalName, chunksRemoved: entry.docIds.length };
}

/** Stats for the /api/rag/stats endpoint. */
function getUploadedDocStats() {
  const total = pdfChunkStore.size;
  const byFile = uploadRegistry.map(r => ({
    name:   r.originalName,
    chunks: r.chunks,
    pages:  r.pages,
  }));
  return { total, byFile };
}

module.exports = {
  ingestPDF,
  getPDFChunks,
  listUploadedDocs,
  deleteUploadedDoc,
  getUploadedDocStats,
};
