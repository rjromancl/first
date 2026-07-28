/**
 * vectorService.test.js
 *
 * Tests for the vector service API wrapper.
 * The service forwards queries to the backend RAG API endpoints.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  initVectorDB,
  addDocuments,
  queryDocuments,
  isVectorDBReady,
  seedKnowledgeBase,
  resetVectorDB,
} from './vectorService';

describe('vectorService — RAG API wrapper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetVectorDB();
  });

  it('checks backend health on initVectorDB', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { ready: true } }),
    });

    const result = await initVectorDB();
    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('/api/rag/health', expect.any(Object));
  });

  it('handles backend health check failure', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await initVectorDB();
    expect(result).toBe(false);
  });

  it('addDocuments is a no-op returning true', async () => {
    const result = await addDocuments([{ text: 'test' }]);
    expect(result).toBe(true);
  });

  it('seedKnowledgeBase is a no-op returning true', async () => {
    const result = await seedKnowledgeBase();
    expect(result).toBe(true);
  });

  it('queryDocuments calls /api/rag/context and formats response', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { ready: true } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { context: 'B Airways offers flights to London Heathrow (LHR).' },
        }),
      });

    const results = await queryDocuments('flights to London', 5);
    expect(results).toHaveLength(1);
    expect(results[0].text).toContain('B Airways');
  });

  it('queryDocuments returns empty array on error', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    const results = await queryDocuments('test');
    expect(results).toEqual([]);
  });

  it('isVectorDBReady returns boolean state', () => {
    expect(typeof isVectorDBReady()).toBe('boolean');
  });
});
