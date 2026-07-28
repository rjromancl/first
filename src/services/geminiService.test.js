/**
 * geminiService.test.js
 *
 * Comprehensive test suite for the Groq LLM service layer.
 *
 * Covers:
 *  - Fallback behaviour when no API key is configured
 *  - Empty / whitespace-only input handling
 *  - Successful API responses with every intent type
 *  - HTTP error paths (429, 5xx, non-retryable 4xx)
 *  - Network failures and timeouts
 *  - Invalid / malformed JSON from the model
 *  - Retry with exponential backoff
 *  - Stale-response guard (superseded in-flight calls)
 *  - Response normalisation (entities, action, passengerField)
 *
 * The module reads import.meta.env at load time, so we use vi.hoisted
 * to set VITE_GROQ_API_KEY before the first import.
 */
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// ── Set API key BEFORE module import (hoisted) ──────────────────────
vi.hoisted(() => {
  vi.stubEnv('VITE_GROQ_API_KEY', 'test-groq-key');
});

import { sendToGemini, AI_MODEL } from '../services/geminiService';
import { initVectorDB, resetVectorDB } from '../services/vectorService';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Build a fake Groq chat-completion response body.
 * @param {string} jsonText  Raw text the model returned (usually JSON)
 */
function mockGroqResponse(jsonText) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: Date.now(),
      model: 'llama-3.3-70b-versatile',
      choices: [{
        index: 0,
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content: jsonText,
        },
      }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }),
  };
}

/**
 * Build a mock Response for an error status.
 */
function mockErrorResponse(status, body = {}) {
  return {
    ok: false,
    status,
    json: async () => body,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('geminiService — module exports', () => {
  it('exports AI_MODEL constant', () => {
    expect(AI_MODEL).toBe('llama-3.3-70b');
  });

  it('exports sendToGemini as a function', () => {
    expect(typeof sendToGemini).toBe('function');
  });
});

describe('geminiService — no API key (fallback path)', () => {
  let sendToGeminiNoKey;

  beforeAll(async () => {
    vi.resetModules();
    vi.stubEnv('VITE_GROQ_API_KEY', '');
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    const mod = await import('../services/geminiService');
    sendToGeminiNoKey = mod.sendToGemini;
  });

  afterAll(() => {
    vi.resetModules();
    vi.stubEnv('VITE_GROQ_API_KEY', 'test-groq-key');
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
  });

  it('returns fallback response when API key is empty', async () => {
    const result = await sendToGeminiNoKey('Book a flight');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.action).toEqual({ type: 'NAVIGATE', path: '/book' });
    expect(result.text).toContain('Where would you like to fly');
  });

  it('returns fallback for check-in queries', async () => {
    const result = await sendToGeminiNoKey('Check me in');
    expect(result.intent).toBe('CHECK_IN');
    expect(result.action).toEqual({ type: 'NAVIGATE', path: '/check-in' });
  });

  it('returns fallback for flight status queries', async () => {
    const result = await sendToGeminiNoKey('Track my flight');
    expect(result.intent).toBe('FLIGHT_STATUS');
    expect(result.action).toEqual({ type: 'NAVIGATE', path: '/flight-status' });
  });

  it('returns fallback for Avios queries', async () => {
    const result = await sendToGeminiNoKey('Show Avios');
    expect(result.intent).toBe('EXECUTIVE_CLUB');
    expect(result.action).toEqual({ type: 'NAVIGATE', path: '/executive-club' });
  });

  it('returns HELP fallback for unknown text', async () => {
    const result = await sendToGeminiNoKey('Random text');
    expect(result.intent).toBe('HELP');
    expect(result.action).toBeNull();
  });

  it('returns HELP for empty message', async () => {
    const result = await sendToGeminiNoKey('');
    expect(result.intent).toBe('HELP');
    expect(result.text).toContain('book flights');
  });
});

describe('geminiService — empty / whitespace input', () => {
  it('returns HELP for empty string', async () => {
    const result = await sendToGemini('');
    expect(result.intent).toBe('HELP');
    expect(result.action).toBeNull();
    expect(result.entities).toEqual({});
  });

  it('returns HELP for whitespace-only string', async () => {
    const result = await sendToGemini('   ');
    expect(result.intent).toBe('HELP');
  });

  it('returns HELP for tab-only string', async () => {
    const result = await sendToGemini('\t\t');
    expect(result.intent).toBe('HELP');
  });

  it('returns HELP for newline-only string', async () => {
    const result = await sendToGemini('\n\n');
    expect(result.intent).toBe('HELP');
  });
});

describe('geminiService — successful API responses', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('parses BOOK_FLIGHT intent with entities', async () => {
    const aiJson = JSON.stringify({
      intent: 'BOOK_FLIGHT',
      text: 'Sure! Flying from London to New York on 20 December.',
      quickReplies: ['Book return', 'One way'],
      action: { type: 'NAVIGATE', path: '/book' },
      entities: {
        from: 'LHR', to: 'JFK', departureDate: '2025-12-20',
        returnDate: '2025-12-28', adults: 1, cabin: 'economy',
        tripType: 'return', festival: '',
      },
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('Book London to New York Christmas');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.from).toBe('LHR');
    expect(result.entities.to).toBe('JFK');
    expect(result.entities.departureDate).toBe('2025-12-20');
    expect(result.entities.returnDate).toBe('2025-12-28');
    expect(result.action).toEqual({ type: 'NAVIGATE', path: '/book' });
  });

  it('parses CHECK_IN intent', async () => {
    const aiJson = JSON.stringify({
      intent: 'CHECK_IN',
      text: 'Check-in opens 24 hours before departure.',
      quickReplies: ['Check in now'],
      action: { type: 'NAVIGATE', path: '/check-in' },
      entities: {},
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('Check me in');
    expect(result.intent).toBe('CHECK_IN');
    expect(result.action).toEqual({ type: 'NAVIGATE', path: '/check-in' });
  });

  it('parses FLIGHT_STATUS intent', async () => {
    const aiJson = JSON.stringify({
      intent: 'FLIGHT_STATUS',
      text: 'Which flight would you like to track?',
      quickReplies: ['BA117', 'BA204'],
      action: { type: 'NAVIGATE', path: '/flight-status' },
      entities: {},
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('Track my flight');
    expect(result.intent).toBe('FLIGHT_STATUS');
    expect(result.action).toEqual({ type: 'NAVIGATE', path: '/flight-status' });
  });

  it('parses EXECUTIVE_CLUB intent', async () => {
    const aiJson = JSON.stringify({
      intent: 'EXECUTIVE_CLUB',
      text: 'Your Avios balance is on the Executive Club page.',
      quickReplies: ['View Avios'],
      action: { type: 'NAVIGATE', path: '/executive-club' },
      entities: {},
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('Show Avios');
    expect(result.intent).toBe('EXECUTIVE_CLUB');
    expect(result.action).toEqual({ type: 'NAVIGATE', path: '/executive-club' });
  });

  it('parses HELP intent', async () => {
    const aiJson = JSON.stringify({
      intent: 'HELP',
      text: 'I can book flights, check you in, and track flights.',
      quickReplies: ['Book a flight', 'Check in'],
      action: null,
      entities: {},
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('What day is today');
    expect(result.intent).toBe('HELP');
    expect(result.action).toBeNull();
  });

  it('parses UNKNOWN intent', async () => {
    const aiJson = JSON.stringify({
      intent: 'UNKNOWN',
      text: 'I didn\'t understand that.',
      quickReplies: [],
      action: null,
      entities: {},
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('Random text');
    expect(result.intent).toBe('UNKNOWN');
  });

  it('parses FULL_BOOKING action with passenger data', async () => {
    const aiJson = JSON.stringify({
      intent: 'BOOK_FLIGHT',
      text: 'Great! Booking your flight to New York.',
      quickReplies: [],
      action: {
        type: 'FULL_BOOKING',
        passenger: { firstName: 'John', lastName: 'Smith', phone: '07912345678', nationality: 'GB' },
      },
      entities: { from: 'LHR', to: 'JFK', departureDate: '2025-12-20', returnDate: '2025-12-28', adults: 1, cabin: 'economy', tripType: 'return', festival: '' },
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('Book business class from London to New York on 20 December returning 28 December for John Smith, phone 07912345678, British');
    expect(result.action.type).toBe('FULL_BOOKING');
    expect(result.action.passenger.firstName).toBe('John');
    expect(result.action.passenger.lastName).toBe('Smith');
    expect(result.action.passenger.nationality).toBe('GB');
  });

  it('parses PREFILL_BOOKING action', async () => {
    const aiJson = JSON.stringify({
      intent: 'BOOK_FLIGHT',
      text: 'Got it! Flying to Dubai tomorrow.',
      quickReplies: [],
      action: {
        type: 'PREFILL_BOOKING',
        passenger: { firstName: '', lastName: '', phone: '', nationality: '' },
      },
      entities: { from: 'LHR', to: 'DXB', departureDate: '2025-07-28', returnDate: '', adults: 1, cabin: 'economy', tripType: 'return', festival: '' },
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('London to Dubai tomorrow');
    expect(result.action.type).toBe('PREFILL_BOOKING');
    expect(result.entities.to).toBe('DXB');
  });

  it('parses PASSENGER_FIELD intent with nextQuestion', async () => {
    const aiJson = JSON.stringify({
      intent: 'PASSENGER_FIELD',
      text: 'What is your first name?',
      quickReplies: [],
      action: null,
      entities: {},
      passengerField: {
        collected: { firstName: '', lastName: '', phone: '', nationality: '' },
        nextField: 'firstName',
        nextQuestion: 'What is your first name?',
        allCollected: false,
      },
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('John');
    expect(result.intent).toBe('PASSENGER_FIELD');
    expect(result.passengerField.nextField).toBe('firstName');
    expect(result.passengerField.nextQuestion).toBe('What is your first name?');
    expect(result.passengerField.allCollected).toBe(false);
  });

  it('parses TWO_OPTIONS intent', async () => {
    const aiJson = JSON.stringify({
      intent: 'TWO_OPTIONS',
      text: 'Would you like to book or check in?',
      quickReplies: ['Book a flight', 'Check in'],
      action: null,
      entities: {},
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('I need help');
    expect(result.intent).toBe('TWO_OPTIONS');
    expect(result.quickReplies).toHaveLength(2);
  });

  it('parses NAVIGATE action', async () => {
    const aiJson = JSON.stringify({
      intent: 'DESTINATIONS',
      text: 'Here are our top destinations.',
      quickReplies: [],
      action: { type: 'NAVIGATE', path: '/destinations' },
      entities: {},
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('Where can I go');
    expect(result.action.type).toBe('NAVIGATE');
    expect(result.action.path).toBe('/destinations');
  });
});

describe('geminiService — response normalisation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('normalises entity field aliases (departure → from, destination → to)', async () => {
    const aiJson = JSON.stringify({
      intent: 'BOOK_FLIGHT',
      text: 'OK',
      quickReplies: [],
      action: null,
      entities: { departure: 'LHR', destination: 'JFK', departure_date: '2025-12-20' },
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('test');
    expect(result.entities.from).toBe('LHR');
    expect(result.entities.to).toBe('JFK');
    expect(result.entities.departureDate).toBe('2025-12-20');
  });

  it('defaults adults to 1 when not provided', async () => {
    const aiJson = JSON.stringify({
      intent: 'BOOK_FLIGHT',
      text: 'OK',
      quickReplies: [],
      action: null,
      entities: { from: 'LHR', to: 'JFK' },
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('test');
    expect(result.entities.adults).toBe(1);
    expect(result.entities.cabin).toBe('economy');
    expect(result.entities.tripType).toBe('return');
  });

  it('normalises passenger data from name field', async () => {
    const aiJson = JSON.stringify({
      intent: 'BOOK_FLIGHT',
      text: 'OK',
      quickReplies: [],
      action: {
        type: 'FULL_BOOKING',
        passenger: { name: 'John Smith', phone: '07912345678', country: 'GB' },
      },
      entities: { from: 'LHR', to: 'JFK', departureDate: '2025-12-20', returnDate: '2025-12-28', adults: 1, cabin: 'economy', tripType: 'return', festival: '' },
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('test');
    expect(result.action.passenger.firstName).toBe('John');
    expect(result.action.passenger.lastName).toBe('Smith');
    expect(result.action.passenger.nationality).toBe('GB');
  });

  it('handles string action "FULL_BOOKING" by converting to object', async () => {
    const aiJson = JSON.stringify({
      intent: 'BOOK_FLIGHT',
      text: 'OK',
      quickReplies: [],
      action: 'FULL_BOOKING',
      passenger: { firstName: 'Jane', lastName: 'Doe', phone: '07123456789', nationality: 'GB' },
      entities: { from: 'LHR', to: 'DXB', departureDate: '2025-12-20', returnDate: '2025-12-28', adults: 1, cabin: 'economy', tripType: 'return', festival: '' },
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('test');
    expect(result.action.type).toBe('FULL_BOOKING');
    expect(result.action.passenger.firstName).toBe('Jane');
  });

  it('filters quickReplies to max 5 and only strings', async () => {
    const aiJson = JSON.stringify({
      intent: 'HELP',
      text: 'OK',
      quickReplies: ['A', 'B', 'C', 'D', 'E', 'F', 123, null],
      action: null,
      entities: {},
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('test');
    expect(result.quickReplies).toHaveLength(5);
    expect(result.quickReplies.every(q => typeof q === 'string')).toBe(true);
  });
});

describe('geminiService — invalid / malformed JSON', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('returns UNKNOWN intent when model returns non-JSON text', async () => {
    global.fetch.mockResolvedValue(mockGroqResponse('Sorry, I don\'t understand.'));

    const result = await sendToGemini('test');
    expect(result.intent).toBe('UNKNOWN');
    expect(result.text).toBe('Could you rephrase that?');
  });

  it('returns UNKNOWN intent when JSON is malformed', async () => {
    global.fetch.mockResolvedValue(mockGroqResponse('{intent: "BOOK_FLIGHT", text: "broken"}'));

    const result = await sendToGemini('test');
    expect(result.intent).toBe('UNKNOWN');
  });

  it('extracts JSON from conversational prose wrapper', async () => {
    const prose = `Sure! Here's the JSON you asked for:
    {"intent":"BOOK_FLIGHT","text":"OK","quickReplies":[],"action":null,"entities":{"from":"LHR","to":"DXB"},"passengerField":null}
    Hope that helps!`;

    global.fetch.mockResolvedValue(mockGroqResponse(prose));

    const result = await sendToGemini('test');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.from).toBe('LHR');
    expect(result.entities.to).toBe('DXB');
  });

  it('strips markdown code fences from JSON', async () => {
    const fenced = '```json\n{"intent":"HELP","text":"OK","quickReplies":[],"action":null,"entities":{},"passengerField":null}\n```';

    global.fetch.mockResolvedValue(mockGroqResponse(fenced));

    const result = await sendToGemini('test');
    expect(result.intent).toBe('HELP');
  });

  it('uses default text when text field is empty', async () => {
    const aiJson = JSON.stringify({
      intent: 'BOOK_FLIGHT',
      text: '',
      quickReplies: [],
      action: null,
      entities: {},
      passengerField: null,
    });

    global.fetch.mockResolvedValue(mockGroqResponse(aiJson));

    const result = await sendToGemini('test');
    expect(result.text).toBe('I didn\'t catch that — could you try again?');
  });
});

describe('geminiService — HTTP error paths', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('returns fallback response on 429 rate limit', async () => {
    global.fetch.mockResolvedValue(mockErrorResponse(429, { error: { message: 'Rate limit exceeded' } }));

    const result = await sendToGemini('Book a flight');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  it('returns fallback on 500 error', async () => {
    global.fetch.mockResolvedValue(mockErrorResponse(500, { error: { message: 'Internal server error' } }));

    const result = await sendToGemini('Book a flight');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.action).toEqual({ type: 'NAVIGATE', path: '/book' });
  });

  it('returns fallback on 502 Bad Gateway', async () => {
    global.fetch.mockResolvedValue(mockErrorResponse(502, {}));

    const result = await sendToGemini('Check me in');
    expect(result.intent).toBe('CHECK_IN');
  });

  it('returns fallback on 503 Service Unavailable', async () => {
    global.fetch.mockResolvedValue(mockErrorResponse(503, {}));

    const result = await sendToGemini('Track my flight');
    expect(result.intent).toBe('FLIGHT_STATUS');
  });

  it('does NOT retry on 400 Bad Request', async () => {
    global.fetch.mockResolvedValue(mockErrorResponse(400, { error: { message: 'Bad request' } }));

    const result = await sendToGemini('test');
    // Should fall back immediately, not retry
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.intent).toBe('HELP');
  });

  it('does NOT retry on 401 Unauthorized', async () => {
    global.fetch.mockResolvedValue(mockErrorResponse(401, { error: { message: 'Unauthorized' } }));

    const result = await sendToGemini('test');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.intent).toBe('HELP');
  });

  it('does NOT retry on 403 Forbidden', async () => {
    global.fetch.mockResolvedValue(mockErrorResponse(403, { error: { message: 'Forbidden' } }));

    const result = await sendToGemini('test');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('geminiService — network failures', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('returns fallback on network error (fetch throws)', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await sendToGemini('Book a flight');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.action).toEqual({ type: 'NAVIGATE', path: '/book' });
  });

  it('returns fallback on AbortError (timeout)', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    global.fetch.mockRejectedValue(abortError);

    const result = await sendToGemini('Check me in');
    expect(result.intent).toBe('CHECK_IN');
  });

  it('returns fallback on generic Error', async () => {
    global.fetch.mockRejectedValue(new Error('Something went wrong'));

    const result = await sendToGemini('Track my flight');
    expect(result.intent).toBe('FLIGHT_STATUS');
  });
});

describe('geminiService — retry with exponential backoff', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    global.fetch
      .mockResolvedValueOnce(mockErrorResponse(429, { error: { message: 'Rate limit' } }))
      .mockResolvedValueOnce(mockGroqResponse(JSON.stringify({
        intent: 'BOOK_FLIGHT', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
      })));

    const result = await sendToGemini('Book a flight');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  it('retries on 500 and succeeds on third attempt', async () => {
    global.fetch
      .mockResolvedValueOnce(mockErrorResponse(500, {}))
      .mockResolvedValueOnce(mockErrorResponse(500, {}))
      .mockResolvedValueOnce(mockGroqResponse(JSON.stringify({
        intent: 'CHECK_IN', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
      })));

    const result = await sendToGemini('Check me in');
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result.intent).toBe('CHECK_IN');
  });

  it('gives up after MAX_RETRIES and returns fallback', async () => {
    global.fetch.mockResolvedValue(mockErrorResponse(500, {}));

    const result = await sendToGemini('Book a flight');
    // Initial attempt + 2 retries = 3 total
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.action).toEqual({ type: 'NAVIGATE', path: '/book' });
  });

  it('retries on network error and succeeds', async () => {
    global.fetch
      .mockRejectedValueOnce(new TypeError('Network error'))
      .mockResolvedValueOnce(mockGroqResponse(JSON.stringify({
        intent: 'FLIGHT_STATUS', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
      })));

    const result = await sendToGemini('Track my flight');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.intent).toBe('FLIGHT_STATUS');
  });
});

describe('geminiService — stale response guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetVectorDB();
    global.fetch = vi.fn();
  });

  it('ignores superseded responses (returns null)', async () => {
    let resolveFirst;
    const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });
    let llmCallCount = 0;

    global.fetch = vi.fn().mockImplementation(async (input) => {
      const urlStr = typeof input === 'string' ? input : (input?.url || String(input));
      if (urlStr.includes('/api/rag')) {
        return { ok: true, status: 200, json: async () => ({ success: true, data: { ready: true, context: '' } }) };
      }
      llmCallCount++;
      if (llmCallCount === 1) {
        return firstPromise;
      }
      return mockGroqResponse(JSON.stringify({
        intent: 'BOOK_FLIGHT', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
      }));
    });

    // Ensure RAG initialization is resolved first so request ordering is deterministic
    await initVectorDB();

    // Start first call (will be superseded)
    const firstCall = sendToGemini('First message');

    // Wait a tick so firstCall reaches its Groq fetch call before secondCall starts
    await new Promise((r) => setTimeout(r, 10));

    // Start second call (this becomes the "current" request)
    const secondCall = sendToGemini('Second message');

    // Resolve the first call's fetch
    resolveFirst(mockGroqResponse(JSON.stringify({
      intent: 'CHECK_IN', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
    })));

    const firstResult = await firstCall;
    const secondResult = await secondCall;

    // First result should be null (superseded)
    expect(firstResult).toBeNull();
    // Second result should be the actual response
    expect(secondResult.intent).toBe('BOOK_FLIGHT');
  });
});

function getGroqCall(fetchMock) {
  return fetchMock.mock.calls.find(c => {
    const url = typeof c[0] === 'string' ? c[0] : (c[0]?.url || String(c[0]));
    return url.includes('groq');
  }) || fetchMock.mock.calls[0];
}

describe('geminiService — history handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetVectorDB();
    global.fetch = vi.fn();
  });

  it('passes conversation history to the API', async () => {
    global.fetch.mockResolvedValue(mockGroqResponse(JSON.stringify({
      intent: 'BOOK_FLIGHT', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
    })));

    const history = [
      { role: 'user', text: 'Book a flight' },
      { role: 'model', text: 'Where would you like to fly?' },
    ];

    await sendToGemini('London to Dubai', history);

    const callArgs = getGroqCall(global.fetch);
    const payload = JSON.parse(callArgs[1].body);
    expect(payload.messages).toHaveLength(4); // system + 2 history + user
    expect(payload.messages[0].role).toBe('system');
    expect(payload.messages[1].role).toBe('user');
    expect(payload.messages[1].content).toBe('Book a flight');
    expect(payload.messages[2].role).toBe('assistant');
    expect(payload.messages[2].content).toBe('Where would you like to fly?');
    expect(payload.messages[3].role).toBe('user');
    expect(payload.messages[3].content).toBe('London to Dubai');
  });

  it('caps history to MAX_HISTORY_TURNS (20)', async () => {
    global.fetch.mockResolvedValue(mockGroqResponse(JSON.stringify({
      intent: 'BOOK_FLIGHT', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
    })));

    // Create 25 turns of history
    const history = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'model',
      text: `Message ${i}`,
    }));

    await sendToGemini('Latest message', history);

    const callArgs = getGroqCall(global.fetch);
    const payload = JSON.parse(callArgs[1].body);
    // system + 20 history + 1 user = 22
    expect(payload.messages).toHaveLength(22);
  });

  it('skips malformed history entries', async () => {
    global.fetch.mockResolvedValue(mockGroqResponse(JSON.stringify({
      intent: 'BOOK_FLIGHT', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
    })));

    const history = [
      { role: 'user', text: 'Valid message' },
      { role: 'model' }, // missing text
      null, // null entry
      { role: 'user', text: 'Another valid' },
    ];

    await sendToGemini('Latest', history);

    const callArgs = getGroqCall(global.fetch);
    const payload = JSON.parse(callArgs[1].body);
    // system + 2 valid history + 1 user = 4
    expect(payload.messages).toHaveLength(4);
  });

  it('sends correct model and parameters', async () => {
    global.fetch.mockResolvedValue(mockGroqResponse(JSON.stringify({
      intent: 'BOOK_FLIGHT', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
    })));

    await sendToGemini('test');

    const callArgs = getGroqCall(global.fetch);
    const payload = JSON.parse(callArgs[1].body);
    expect(payload.model).toBe('llama-3.3-70b-versatile');
    expect(payload.temperature).toBe(0.2);
    expect(payload.max_tokens).toBe(600);
    expect(payload.response_format).toEqual({ type: 'json_object' });
  });
});

describe('geminiService — edge cases', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('handles very long input text', async () => {
    const longText = 'Book a flight ' + 'very '.repeat(200) + 'far away';
    global.fetch.mockResolvedValue(mockGroqResponse(JSON.stringify({
      intent: 'BOOK_FLIGHT', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
    })));

    const result = await sendToGemini(longText);
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  it('handles special characters in input', async () => {
    global.fetch.mockResolvedValue(mockGroqResponse(JSON.stringify({
      intent: 'BOOK_FLIGHT', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
    })));

    const result = await sendToGemini('Book to Tokyo! @#$%^&*()');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  it('handles Unicode characters in input', async () => {
    global.fetch.mockResolvedValue(mockGroqResponse(JSON.stringify({
      intent: 'BOOK_FLIGHT', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
    })));

    const result = await sendToGemini('Book to Tokyo 東京');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  it('handles input with only numbers', async () => {
    global.fetch.mockResolvedValue(mockGroqResponse(JSON.stringify({
      intent: 'UNKNOWN', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
    })));

    const result = await sendToGemini('1234567890');
    expect(result.intent).toBe('UNKNOWN');
  });

  it('handles input with only punctuation', async () => {
    global.fetch.mockResolvedValue(mockGroqResponse(JSON.stringify({
      intent: 'UNKNOWN', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
    })));

    const result = await sendToGemini('!@#$%^&*()');
    expect(result.intent).toBe('UNKNOWN');
  });

  it('handles null input gracefully', async () => {
    const result = await sendToGemini(null);
    expect(result.intent).toBe('HELP');
  });

  it('handles undefined input gracefully', async () => {
    const result = await sendToGemini(undefined);
    expect(result.intent).toBe('HELP');
  });

  it('handles numeric input by converting to string', async () => {
    global.fetch.mockResolvedValue(mockGroqResponse(JSON.stringify({
      intent: 'UNKNOWN', text: 'OK', quickReplies: [], action: null, entities: {}, passengerField: null,
    })));

    const result = await sendToGemini(12345);
    expect(result.intent).toBe('UNKNOWN');
  });
});
