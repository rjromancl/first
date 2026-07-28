/**
 * start-chroma.js — ChromaDB server startup helper
 *
 * This script starts a local ChromaDB server for development.
 * In production, ChromaDB should be running on a separate server
 * (e.g., Railway) and CHROMA_URL should point to it.
 *
 * Usage:
 *   npm run chroma:start   # Start ChromaDB server
 *   npm run chroma:stop    # Stop ChromaDB server
 *
 * The server runs on http://localhost:8000 by default.
 */
const { spawn } = require('child_process');
const path = require('path');

const CHROMA_PORT = process.env.CHROMA_PORT || '8000';
const CHROMA_HOST = process.env.CHROMA_HOST || '0.0.0.0';

console.log(`Starting ChromaDB server on ${CHROMA_HOST}:${CHROMA_PORT}...`);

// Start ChromaDB server using the Python CLI
// Requires: pip install chromadb
const chromaProcess = spawn('python', ['-m', 'chromadb', 'run', '--host', CHROMA_HOST, '--port', CHROMA_PORT], {
  stdio: 'inherit',
  shell: true,
});

chromaProcess.on('error', (err) => {
  console.error('Failed to start ChromaDB:', err.message);
  console.error('Make sure ChromaDB is installed: pip install chromadb');
  process.exit(1);
});

chromaProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`ChromaDB server exited with code ${code}`);
  }
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down ChromaDB server...');
  chromaProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down ChromaDB server...');
  chromaProcess.kill('SIGTERM');
  process.exit(0);
});
