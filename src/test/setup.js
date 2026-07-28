/**
 * Test setup — runs before every test file.
 *
 * Provides:
 *  - @testing-library/jest-dom custom matchers (toBeInTheDocument, etc.)
 *  - A mock window.speechSynthesis so TTS helpers don't crash in jsdom
 *  - A mock window.SpeechRecognition so useVoiceRecognition doesn't crash
 *  - Global fetch mock (vi.fn) so tests can assert on API calls
 */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ── Mock chromadb (ChromaDB client) ──────────────────────────────────
// ChromaDB requires a running server and native dependencies. In tests we
// mock it so the vectorService and ragService can be tested without a
// real ChromaDB instance. Individual test files can override these mocks.
vi.mock('chromadb', () => {
  const mockCollection = {
    add: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({
      documents: [[]],
      metadatas: [[]],
      distances: [[]],
    }),
    count: vi.fn().mockResolvedValue(0),
    get: vi.fn().mockResolvedValue({ ids: [], documents: [], metadatas: [] }),
    modify: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    upsert: vi.fn().mockResolvedValue(undefined),
  };

  const mockClient = {
    getCollection: vi.fn().mockRejectedValue(new Error('Collection not found')),
    createCollection: vi.fn().mockResolvedValue(mockCollection),
    deleteCollection: vi.fn().mockResolvedValue(undefined),
    listCollections: vi.fn().mockResolvedValue([]),
    reset: vi.fn().mockResolvedValue(undefined),
    heartbeat: vi.fn().mockResolvedValue({ status: 'ok' }),
  };

  return {
    ChromaClient: vi.fn(() => mockClient),
    DefaultEmbeddingFunction: vi.fn(() => ({
      embedText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      embedTexts: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    })),
    OpenAIEmbeddingFunction: vi.fn(),
    HuggingFaceEmbeddingFunction: vi.fn(),
    // Export mockCollection for test access
    __mockCollection: mockCollection,
    __mockClient: mockClient,
  };
});

// ── Mock window.speechSynthesis ──────────────────────────────────────
// jsdom doesn't implement the Web Speech API. We provide a minimal stub
// so speak(), stopSpeaking(), getAvailableVoices() can be exercised.
const mockVoices = [
  { name: 'Samantha', lang: 'en-GB', default: true },
  { name: 'Google UK English Male', lang: 'en-GB' },
  { name: 'Alex', lang: 'en-US' },
];

const mockSpeechSynthesis = {
  _speaking: false,
  _pending: false,
  getVoices: vi.fn(() => mockVoices),
  speak: vi.fn((utterance) => {
    mockSpeechSynthesis._speaking = true;
    // Simulate async completion
    setTimeout(() => {
      mockSpeechSynthesis._speaking = false;
      utterance?.onend?.();
    }, 50);
  }),
  cancel: vi.fn(() => {
    mockSpeechSynthesis._speaking = false;
    mockSpeechSynthesis._pending = false;
  }),
  pause: vi.fn(),
  resume: vi.fn(),
  get speaking() { return mockSpeechSynthesis._speaking; },
  get pending() { return mockSpeechSynthesis._pending; },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// SpeechSynthesisUtterance constructor
class MockSpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.lang = 'en-GB';
    this.voice = null;
    this.onend = null;
    this.onerror = null;
  }
}

global.window.speechSynthesis = mockSpeechSynthesis;
global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

// ── Mock SpeechRecognition ──────────────────────────────────────────
class MockSpeechRecognition {
  constructor() {
    this.lang = 'en-GB';
    this.continuous = false;
    this.interimResults = false;
    this.maxAlternatives = 1;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.onstart = null;
  }
  start() { this.onstart?.(); }
  stop() { this.onend?.(); }
  abort() { this.onend?.(); }
}

global.window.SpeechRecognition = MockSpeechRecognition;
global.window.webkitSpeechRecognition = MockSpeechRecognition;

// ── Mock fetch ──────────────────────────────────────────────────────
// Individual tests override this with vi.fn() as needed.
global.fetch = vi.fn();

// ── Mock ResizeObserver (used by some UI libs) ──────────────────────
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ── Mock matchMedia ─────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
