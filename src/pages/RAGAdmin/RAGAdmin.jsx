/**
 * RAGAdmin.jsx — Knowledge Base & PDF Upload Admin Panel
 *
 * Features:
 *  - Drag-and-drop / click-to-select PDF upload
 *  - Upload progress bar with animated fill
 *  - Success/error result banners with chunk + page counts
 *  - Download the pre-built BA Rules PDF directly
 *  - List of all uploaded PDFs with chunk counts, page counts, size
 *  - Delete uploaded PDFs (removes indexed chunks too)
 *  - Live knowledge-base stats by category
 *  - "How It Works" explainer for the RAG pipeline
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FaFilePdf, FaUpload, FaTrash, FaDownload, FaDatabase,
  FaCheckCircle, FaExclamationCircle, FaTimes, FaSync,
  FaBrain, FaSearch, FaRobot, FaMagic,
} from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import './RAGAdmin.css';

const API = (path) => `/api${path}`;

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Category colour map ────────────────────────────────────────────────────
const CAT_ICONS = {
  baggage:          '🧳',
  'executive-club': '⭐',
  lounge:           '🏛',
  cabin:            '🛋',
  booking:          '📋',
  destination:      '🗺',
  route:            '✈',
  uk261:            '⚖',
  service:          '♿',
  offer:            '🏷',
  airport:          '🏢',
  travel:           '🛂',
  general:          '📄',
};

// ── Upload zone component ──────────────────────────────────────────────────
function DropZone({ onFile, selectedFile, onClear }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') onFile(file);
  };

  return (
    <div
      className={`ragadmin__dropzone ${isDragging ? 'ragadmin__dropzone--active' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !selectedFile && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
        style={{ display: 'none' }}
      />
      <span className="ragadmin__dropzone-icon">
        {selectedFile ? '📄' : '📂'}
      </span>
      {!selectedFile ? (
        <>
          <p className="ragadmin__dropzone-text">
            {isDragging ? 'Drop your PDF here' : 'Drag & drop a PDF or click to browse'}
          </p>
          <p className="ragadmin__dropzone-sub">PDF files only · Max 10 MB</p>
        </>
      ) : (
        <div className="ragadmin__file-selected" onClick={e => e.stopPropagation()}>
          <FaFilePdf size={18} />
          <span className="ragadmin__file-name">{selectedFile.name}</span>
          <span className="ragadmin__file-size">{fmt(selectedFile.size)}</span>
          <button className="ragadmin__file-clear" onClick={onClear} title="Remove">
            <FaTimes size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function RAGAdmin() {
  const { addNotification } = useApp();

  // Upload state
  const [selectedFile, setSelectedFile]   = useState(null);
  const [uploading, setUploading]         = useState(false);
  const [progress, setProgress]           = useState(0);
  const [uploadResult, setUploadResult]   = useState(null);  // { success, message, chunks, pages }

  // Uploaded docs
  const [docs, setDocs]                   = useState([]);
  const [docsLoading, setDocsLoading]     = useState(true);
  const [deletingDoc, setDeletingDoc]     = useState(null);

  // KB stats
  const [stats, setStats]                 = useState(null);
  const [statsLoading, setStatsLoading]   = useState(true);

  // ── Fetch docs & stats on mount ──────────────────────────────────────────
  const fetchDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res  = await fetch(API('/rag/pdfs'));
      const data = await res.json();
      if (data.success) setDocs(data.data?.docs || []);
    } catch (_) {}
    setDocsLoading(false);
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res  = await fetch(API('/rag/stats'));
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (_) {}
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    fetchDocs();
    fetchStats();
  }, [fetchDocs, fetchStats]);

  // ── Upload handler ───────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setProgress(0);
    setUploadResult(null);

    // Fake progress while XHR is in flight
    const progressTimer = setInterval(() => {
      setProgress(p => p < 85 ? p + Math.random() * 12 : p);
    }, 250);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res  = await fetch(API('/rag/upload-pdf'), {
        method: 'POST',
        body:   formData,
      });
      const data = await res.json();

      clearInterval(progressTimer);
      setProgress(100);

      if (res.ok && data.success) {
        setUploadResult({
          success: true,
          message: data.data.message,
          chunks:  data.data.chunks,
          pages:   data.data.pages,
          filename: data.data.filename,
        });
        addNotification({ type: 'success', message: `✅ ${selectedFile.name} ingested — ${data.data.chunks} chunks indexed.` });
        setSelectedFile(null);
        await fetchDocs();
        await fetchStats();
      } else {
        setUploadResult({ success: false, message: data.error?.message || 'Upload failed. Please try again.' });
        addNotification({ type: 'error', message: 'PDF upload failed.' });
      }
    } catch (err) {
      clearInterval(progressTimer);
      setProgress(0);
      setUploadResult({ success: false, message: `Network error: ${err.message}` });
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1500);
    }
  };

  // ── Delete handler ───────────────────────────────────────────────────────
  const handleDelete = async (doc) => {
    if (!window.confirm(`Remove "${doc.originalName}" and all its indexed chunks?`)) return;
    setDeletingDoc(doc.originalName);
    try {
      const res  = await fetch(API(`/rag/pdfs/${encodeURIComponent(doc.originalName)}`), { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        addNotification({ type: 'success', message: `Deleted "${doc.originalName}" — ${data.data.chunksRemoved} chunks removed.` });
        await fetchDocs();
        await fetchStats();
      } else {
        addNotification({ type: 'error', message: data.error?.message || 'Delete failed.' });
      }
    } catch (err) {
      addNotification({ type: 'error', message: `Delete failed: ${err.message}` });
    }
    setDeletingDoc(null);
  };

  // ── Derived stats ────────────────────────────────────────────────────────
  const totalDocs   = stats?.totalDocs    || 0;
  const byCategory  = stats?.byCategory   || {};
  const pdfChunks   = stats?.uploadedPDFs?.total || 0;
  const maxCatCount = Math.max(...Object.values(byCategory), 1);

  return (
    <div className="ragadmin">
      {/* ── Header ── */}
      <div className="ragadmin__header">
        <div className="container">
          <div className="ragadmin__title-wrap">
            <h1>
              <FaBrain size={22} />
              RAG Knowledge Base
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span className="ragadmin__badge">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6ed08a', display: 'inline-block' }} />
                Admin Panel
              </span>
            </div>
            <p className="ragadmin__subtitle" style={{ marginTop: 6 }}>
              Upload PDFs to extend the AI Voice Assistant knowledge base
            </p>
          </div>

          <div className="ragadmin__header-stats">
            <div className="ragadmin__stat">
              <span className="ragadmin__stat-num">{totalDocs}</span>
              <span className="ragadmin__stat-label">Total Docs</span>
            </div>
            <div className="ragadmin__stat">
              <span className="ragadmin__stat-num">{docs.length}</span>
              <span className="ragadmin__stat-label">PDFs Uploaded</span>
            </div>
            <div className="ragadmin__stat">
              <span className="ragadmin__stat-num">{pdfChunks}</span>
              <span className="ragadmin__stat-label">PDF Chunks</span>
            </div>
            <div className="ragadmin__stat">
              <span className="ragadmin__stat-num">{Object.keys(byCategory).length}</span>
              <span className="ragadmin__stat-label">Categories</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="ragadmin__body">
        <div className="container">
          <div className="ragadmin__grid">

            {/* ── LEFT: Upload card ── */}
            <div className="ragadmin__card">
              <div className="ragadmin__card-head">
                <div className="ragadmin__card-icon">
                  <FaUpload size={15} />
                </div>
                <div>
                  <h2>Upload PDF to Knowledge Base</h2>
                  <p>PDF will be parsed, chunked, and indexed for the AI assistant</p>
                </div>
              </div>
              <div className="ragadmin__card-body">
                {/* Download pre-built BA Rules PDF */}
                <div className="ragadmin__generate-wrap">
                  <div className="ragadmin__generate-text" style={{ flex: 1 }}>
                    <h3>📄 BA Rules PDF Ready</h3>
                    <p>Pre-built knowledge base — 12 sections, all policies</p>
                  </div>
                  <a
                    className="ragadmin__generate-btn"
                    href="/api/rag/download-ba-rules"
                    download="BA_Rules_Knowledge_Base.pdf"
                    onClick={async (e) => {
                      // Serve the file directly
                      e.preventDefault();
                      try {
                        const res  = await fetch('/api/rag/download-ba-rules');
                        if (!res.ok) throw new Error('File not found on server');
                        const blob = await res.blob();
                        const url  = URL.createObjectURL(blob);
                        const a    = document.createElement('a');
                        a.href     = url;
                        a.download = 'BA_Rules_Knowledge_Base.pdf';
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        addNotification({ type: 'error', message: `Download failed: ${err.message}` });
                      }
                    }}
                  >
                    <FaDownload size={12} /> Download PDF
                  </a>
                </div>

                {/* Drop zone */}
                <DropZone
                  onFile={setSelectedFile}
                  selectedFile={selectedFile}
                  onClear={() => { setSelectedFile(null); setUploadResult(null); }}
                />

                {/* Progress bar */}
                {(uploading || progress > 0) && (
                  <div className="ragadmin__progress">
                    <div className="ragadmin__progress-label">
                      <span>{uploading ? 'Uploading & indexing…' : 'Complete'}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="ragadmin__progress-bar">
                      <div className="ragadmin__progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                {/* Result banner */}
                {uploadResult && (
                  <div className={`ragadmin__result ragadmin__result--${uploadResult.success ? 'success' : 'error'}`}>
                    {uploadResult.success
                      ? <FaCheckCircle size={15} />
                      : <FaExclamationCircle size={15} />
                    }
                    <div style={{ flex: 1 }}>
                      <div>{uploadResult.message}</div>
                      {uploadResult.success && (
                        <div className="ragadmin__result-detail">
                          <span className="ragadmin__result-pill">📚 {uploadResult.chunks} chunks</span>
                          <span className="ragadmin__result-pill">📄 {uploadResult.pages} pages</span>
                          <span className="ragadmin__result-pill">✅ Indexed</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Upload button */}
                <button
                  className="btn btn-primary ragadmin__upload-btn"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                >
                  {uploading
                    ? <><span className="ragadmin__spinner" /> Indexing PDF…</>
                    : <><FaUpload size={13} /> Upload & Index PDF</>
                  }
                </button>
              </div>
            </div>

            {/* ── RIGHT: Uploaded docs ── */}
            <div className="ragadmin__card">
              <div className="ragadmin__card-head">
                <div className="ragadmin__card-icon ragadmin__card-icon--gold">
                  <FaFilePdf size={15} />
                </div>
                <div>
                  <h2>Uploaded Knowledge PDFs</h2>
                  <p>All PDFs currently indexed in the RAG system</p>
                </div>
                <button
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#6b7a8d', cursor: 'pointer', padding: 4 }}
                  onClick={() => fetchDocs()}
                  title="Refresh"
                >
                  <FaSync size={13} />
                </button>
              </div>
              <div className="ragadmin__card-body">
                {docsLoading ? (
                  <div className="ragadmin__empty">
                    <span className="ragadmin__empty-icon">⏳</span>
                    Loading…
                  </div>
                ) : docs.length === 0 ? (
                  <div className="ragadmin__empty">
                    <span className="ragadmin__empty-icon">📭</span>
                    No PDFs uploaded yet.<br />
                    <span style={{ fontSize: '0.78rem', marginTop: 4, display: 'block' }}>
                      Upload the BA Rules PDF to get started.
                    </span>
                  </div>
                ) : (
                  <div className="ragadmin__docs-list">
                    {docs.map((doc) => (
                      <div key={doc.originalName} className="ragadmin__doc-row">
                        <div className="ragadmin__doc-icon">
                          <FaFilePdf size={15} />
                        </div>
                        <div className="ragadmin__doc-info">
                          <div className="ragadmin__doc-name" title={doc.originalName}>
                            {doc.originalName}
                          </div>
                          <div className="ragadmin__doc-meta">
                            Uploaded {timeAgo(doc.uploadedAt)}
                          </div>
                        </div>
                        <div className="ragadmin__doc-pills">
                          <span className="ragadmin__doc-pill ragadmin__doc-pill--chunks">
                            {doc.chunks} chunks
                          </span>
                          <span className="ragadmin__doc-pill ragadmin__doc-pill--pages">
                            {doc.pages}p
                          </span>
                          {doc.sizeKB > 0 && (
                            <span className="ragadmin__doc-pill ragadmin__doc-pill--size">
                              {doc.sizeKB} KB
                            </span>
                          )}
                        </div>
                        <button
                          className="ragadmin__doc-delete"
                          onClick={() => handleDelete(doc)}
                          disabled={deletingDoc === doc.originalName}
                          title="Delete from knowledge base"
                        >
                          {deletingDoc === doc.originalName
                            ? <span className="ragadmin__spinner" style={{ borderColor: 'rgba(192,57,43,0.3)', borderTopColor: '#c0392b', width: 13, height: 13, borderWidth: 2 }} />
                            : <FaTrash size={13} />
                          }
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Knowledge Base Stats ── */}
            <div className="ragadmin__card">
              <div className="ragadmin__card-head">
                <div className="ragadmin__card-icon ragadmin__card-icon--green">
                  <FaDatabase size={15} />
                </div>
                <div>
                  <h2>Knowledge Base Stats</h2>
                  <p>Document counts by category</p>
                </div>
                <button
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#6b7a8d', cursor: 'pointer', padding: 4 }}
                  onClick={() => fetchStats()}
                  title="Refresh"
                >
                  <FaSync size={13} />
                </button>
              </div>
              <div className="ragadmin__card-body">
                {statsLoading ? (
                  <div className="ragadmin__empty">⏳ Loading…</div>
                ) : (
                  <>
                    <div className="ragadmin__stats-grid">
                      <div className="ragadmin__stats-tile">
                        <span className="ragadmin__stats-tile-num">{totalDocs}</span>
                        <span className="ragadmin__stats-tile-label">Total Docs</span>
                      </div>
                      <div className="ragadmin__stats-tile">
                        <span className="ragadmin__stats-tile-num">{pdfChunks}</span>
                        <span className="ragadmin__stats-tile-label">PDF Chunks</span>
                      </div>
                      <div className="ragadmin__stats-tile">
                        <span className="ragadmin__stats-tile-num">{stats?.intents || 19}</span>
                        <span className="ragadmin__stats-tile-label">Intents</span>
                      </div>
                      <div className="ragadmin__stats-tile">
                        <span className="ragadmin__stats-tile-num">{stats?.tools || 7}</span>
                        <span className="ragadmin__stats-tile-label">Tools</span>
                      </div>
                      <div className="ragadmin__stats-tile">
                        <span className="ragadmin__stats-tile-num">{docs.length}</span>
                        <span className="ragadmin__stats-tile-label">PDFs</span>
                      </div>
                      <div className="ragadmin__stats-tile">
                        <span className="ragadmin__stats-tile-num">{Object.keys(byCategory).length}</span>
                        <span className="ragadmin__stats-tile-label">Categories</span>
                      </div>
                    </div>

                    <div className="ragadmin__cat-list">
                      {Object.entries(byCategory)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, count]) => (
                          <div key={cat} className="ragadmin__cat-row">
                            <span className="ragadmin__cat-name">
                              {CAT_ICONS[cat] || '📄'} {cat}
                            </span>
                            <div className="ragadmin__cat-bar-wrap">
                              <div
                                className="ragadmin__cat-bar"
                                style={{ width: `${(count / maxCatCount) * 100}%` }}
                              />
                            </div>
                            <span className="ragadmin__cat-count">{count}</span>
                          </div>
                        ))
                      }
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── API reference ── */}
            <div className="ragadmin__card">
              <div className="ragadmin__card-head">
                <div className="ragadmin__card-icon">
                  <FaSearch size={15} />
                </div>
                <div>
                  <h2>API Endpoints</h2>
                  <p>Use these to interact with the RAG system directly</p>
                </div>
              </div>
              <div className="ragadmin__card-body">
                {[
                  { method: 'POST', path: '/api/rag/upload-pdf',  desc: 'Upload a PDF (multipart/form-data, field: file)' },
                  { method: 'GET',  path: '/api/rag/pdfs',         desc: 'List all uploaded PDFs and chunk counts' },
                  { method: 'DELETE',path: '/api/rag/pdfs/:name', desc: 'Delete a PDF and remove its indexed chunks' },
                  { method: 'POST', path: '/api/rag/context',      desc: 'Retrieve knowledge context for a query' },
                  { method: 'POST', path: '/api/rag/ask',          desc: 'Full agentic Q&A with tool execution' },
                  { method: 'GET',  path: '/api/rag/stats',        desc: 'Knowledge base statistics' },
                  { method: 'GET',  path: '/api/rag/health',       desc: 'Readiness probe' },
                ].map(ep => (
                  <div key={ep.path} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '8px 0', borderBottom: '1px solid #f0f4f8',
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 7px',
                      borderRadius: 4, flexShrink: 0, marginTop: 1,
                      background: ep.method === 'POST' ? '#e8f4fd' : ep.method === 'DELETE' ? '#fef0ee' : '#e8f8ef',
                      color:      ep.method === 'POST' ? '#075aaa' : ep.method === 'DELETE' ? '#c0392b' : '#1a7a45',
                      border:     `1px solid ${ep.method === 'POST' ? '#aac4e0' : ep.method === 'DELETE' ? '#f4a49a' : '#6ed08a'}`,
                    }}>
                      {ep.method}
                    </span>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#011627', fontWeight: 700 }}>
                        {ep.path}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#6b7a8d', marginTop: 2 }}>
                        {ep.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── How It Works ── */}
            <div className="ragadmin__card ragadmin__howto">
              <div className="ragadmin__card-head">
                <div className="ragadmin__card-icon">
                  <FaRobot size={15} />
                </div>
                <div>
                  <h2>How the RAG Pipeline Works</h2>
                  <p>From PDF upload to AI voice assistant response</p>
                </div>
              </div>
              <div className="ragadmin__card-body">
                <div className="ragadmin__steps">
                  {[
                    { icon: '📄', num: 1, title: 'Upload PDF', desc: 'Drop any PDF — BA rules, policy docs, route guides, or custom knowledge.' },
                    { icon: '✂️', num: 2, title: 'Chunk & Index', desc: 'Text is extracted, split into 600-char overlapping chunks, and BM25-indexed.' },
                    { icon: '🔍', num: 3, title: 'Hybrid Search', desc: 'On each query, BM25 + ChromaDB vector search runs in parallel, fused with RRF.' },
                    { icon: '🤖', num: 4, title: 'AI Answers', desc: 'Top chunks are passed as context to Groq llama-3.3-70b. Voice agent answers from your knowledge.' },
                  ].map(step => (
                    <div key={step.num} className="ragadmin__step">
                      <div className="ragadmin__step-num">{step.num}</div>
                      <span className="ragadmin__step-icon">{step.icon}</span>
                      <h4>{step.title}</h4>
                      <p>{step.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
