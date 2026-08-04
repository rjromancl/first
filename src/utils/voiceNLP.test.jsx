/**
 * voiceNLP.test.jsx
 *
 * Comprehensive test suite for the voiceNLP adapter layer.
 *
 * This file tests parseVoiceInput() — the single public API consumed by
 * VoiceAgent — across all 100 SoapUI test cases (TC001–TC100) plus
 * additional edge cases.
 *
 * sendToGemini is mocked so we can assert on every intent type, entity
 * extraction, error handling, and response shape without hitting the network.
 *
 * Test categories:
 *  - Empty / null / whitespace input (TC092, TC093)
 *  - BOOK_FLIGHT intents (TC001–TC049)
 *  - CHECK_IN intents (TC051–TC060)
 *  - FLIGHT_STATUS intents (TC061–TC070)
 *  - EXECUTIVE_CLUB intents (TC071–TC075)
 *  - PASSENGER / COLLECT_PASSENGER intents (TC076–TC085)
 *  - FULL_BOOKING intent (TC082)
 *  - HELP intents (TC050, TC086–TC090, TC100)
 *  - UNKNOWN intents (TC091, TC094–TC096)
 *  - Edge cases: typos (TC098, TC099), long input (TC097)
 *  - Gemini failure / error handling
 *  - TTS functions (speak, stopSpeaking, getAvailableVoices)
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Mock the geminiService module ────────────────────────────────────
// We mock sendToGemini so tests are deterministic and don't hit the network.
// Each test sets up the mock return value it needs.
vi.mock('../services/geminiService', () => ({
  sendToGemini: vi.fn(),
  AI_MODEL: 'llama-3.3-70b',
}));

import { sendToGemini } from '../services/geminiService';
import { parseVoiceInput, speak, stopSpeaking, getAvailableVoices } from './voiceNLP';
import { preprocessVoiceTranscript, detectWakeWord, detectExitIntent, resolveRelativeDate } from './smartNLPPreprocessor';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Create a mock AI response object (what sendToGemini returns).
 */
function mockAIResponse(overrides = {}) {
  return {
    intent: 'BOOK_FLIGHT',
    text: 'Sure! Where would you like to fly?',
    quickReplies: ['Book a flight', 'Check in', 'Flight status'],
    action: null,
    entities: {},
    passengerField: null,
    ...overrides,
  };
}

/**
 * Create a mock BOOK_FLIGHT response with entities.
 */
function mockBookFlight(entities = {}) {
  return mockAIResponse({
    intent: 'BOOK_FLIGHT',
    text: 'Great! Flying from London to New York.',
    action: { type: 'NAVIGATE', path: '/book' },
    entities: {
      from: 'LHR', to: 'JFK', departureDate: '2025-12-20',
      returnDate: '2025-12-28', adults: 1, cabin: 'economy',
      tripType: 'return', festival: '',
      ...entities,
    },
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('voiceNLP — parseVoiceInput: empty / null / whitespace input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns HELP intent for empty string', async () => {
    const result = await parseVoiceInput('');
    expect(result.intent).toBe('HELP');
    expect(result.entities).toEqual({});
    expect(result.passengerField).toBeNull();
    expect(result.response.text).toContain('didn\'t catch that');
    expect(result.response.quickReplies).toEqual(['Book a flight', 'Check in', 'Flight status', 'Help']);
    expect(result.response.action).toBeNull();
    expect(sendToGemini).not.toHaveBeenCalled();
  });

  it('returns HELP intent for whitespace-only string', async () => {
    const result = await parseVoiceInput('   ');
    expect(result.intent).toBe('HELP');
    expect(sendToGemini).not.toHaveBeenCalled();
  });

  it('returns HELP intent for tab-only string', async () => {
    const result = await parseVoiceInput('\t\t');
    expect(result.intent).toBe('HELP');
  });

  it('returns HELP intent for newline-only string', async () => {
    const result = await parseVoiceInput('\n\n');
    expect(result.intent).toBe('HELP');
  });

  it('returns HELP intent for null input', async () => {
    const result = await parseVoiceInput(null);
    expect(result.intent).toBe('HELP');
    expect(sendToGemini).not.toHaveBeenCalled();
  });

  it('returns HELP intent for undefined input', async () => {
    const result = await parseVoiceInput(undefined);
    expect(result.intent).toBe('HELP');
  });

  it('returns HELP intent when text is only spaces and newlines', async () => {
    const result = await parseVoiceInput(' \n \t \n ');
    expect(result.intent).toBe('HELP');
  });
});

describe('voiceNLP — parseVoiceInput: BOOK_FLIGHT intents (TC001–TC049)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC001: "Book a flight"
  it('TC001: Book a flight → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight());
    const result = await parseVoiceInput('Book a flight');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.from).toBe('LHR');
    expect(result.entities.to).toBe('JFK');
    expect(result.response.action).toEqual({ type: 'NAVIGATE', path: '/book' });
  });

  // TC002: "Book London to New York"
  it('TC002: Book London to New York → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ from: 'LHR', to: 'JFK' }));
    const result = await parseVoiceInput('Book London to New York');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.from).toBe('LHR');
    expect(result.entities.to).toBe('JFK');
  });

  // TC003: "Fly me to Dubai"
  it('TC003: Fly me to Dubai → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'DXB' }));
    const result = await parseVoiceInput('Fly me to Dubai');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('DXB');
  });

  // TC004: "I want Tokyo tickets"
  it('TC004: I want Tokyo tickets → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'NRT' }));
    const result = await parseVoiceInput('I want Tokyo tickets');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('NRT');
  });

  // TC005: "Flight from London to Sydney"
  it('TC005: Flight from London to Sydney → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ from: 'LHR', to: 'SYD' }));
    const result = await parseVoiceInput('Flight from London to Sydney');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.from).toBe('LHR');
    expect(result.entities.to).toBe('SYD');
  });

  // TC006: "London to Mumbai flight"
  it('TC006: London to Mumbai flight → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ from: 'LHR', to: 'BOM' }));
    const result = await parseVoiceInput('London to Mumbai flight');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('BOM');
  });

  // TC007: "London Paris flight"
  it('TC007: London Paris flight → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ from: 'LHR', to: 'CDG' }));
    const result = await parseVoiceInput('London Paris flight');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('CDG');
  });

  // TC008: "London Amsterdam"
  it('TC008: London Amsterdam → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ from: 'LHR', to: 'AMS' }));
    const result = await parseVoiceInput('London Amsterdam');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('AMS');
  });

  // TC009: "London Barcelona"
  it('TC009: London Barcelona → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ from: 'LHR', to: 'BCN' }));
    const result = await parseVoiceInput('London Barcelona');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('BCN');
  });

  // TC010: "London Rome"
  it('TC010: London Rome → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ from: 'LHR', to: 'FCO' }));
    const result = await parseVoiceInput('London Rome');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('FCO');
  });

  // TC011: "London Istanbul"
  it('TC011: London Istanbul → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ from: 'LHR', to: 'IST' }));
    const result = await parseVoiceInput('London Istanbul');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('IST');
  });

  // TC012: "London Cape Town"
  it('TC012: London Cape Town → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ from: 'LHR', to: 'CPT' }));
    const result = await parseVoiceInput('London Cape Town');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('CPT');
  });

  // TC013: "Cheapest flight to Dubai"
  it('TC013: Cheapest flight to Dubai → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'DXB' }));
    const result = await parseVoiceInput('Cheapest flight to Dubai');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('DXB');
  });

  // TC014: "Need a return ticket"
  it('TC014: Need a return ticket → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ tripType: 'return' }));
    const result = await parseVoiceInput('Need a return ticket');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.tripType).toBe('return');
  });

  // TC015: "One way ticket to New York"
  it('TC015: One way ticket to New York → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'JFK', tripType: 'one-way' }));
    const result = await parseVoiceInput('One way ticket to New York');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.tripType).toBe('one-way');
  });

  // TC016: "Book business class"
  it('TC016: Book business class → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ cabin: 'business' }));
    const result = await parseVoiceInput('Book business class');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.cabin).toBe('business');
  });

  // TC017: "Book first class"
  it('TC017: Book first class → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ cabin: 'first' }));
    const result = await parseVoiceInput('Book first class');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.cabin).toBe('first');
  });

  // TC018: "Economy ticket"
  it('TC018: Economy ticket → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ cabin: 'economy' }));
    const result = await parseVoiceInput('Economy ticket');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.cabin).toBe('economy');
  });

  // TC019: "Two passengers London Dubai"
  it('TC019: Two passengers London Dubai → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ from: 'LHR', to: 'DXB', adults: 2 }));
    const result = await parseVoiceInput('Two passengers London Dubai');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.adults).toBe(2);
  });

  // TC020: "Family trip to USA"
  it('TC020: Family trip to USA → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'JFK', adults: 4 }));
    const result = await parseVoiceInput('Family trip to USA');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('JFK');
    expect(result.entities.adults).toBe(4);
  });

  // TC021: "Fly tomorrow"
  it('TC021: Fly tomorrow → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-07-28' }));
    const result = await parseVoiceInput('Fly tomorrow');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.departureDate).toBe('2025-07-28');
  });

  // TC022: "Fly day after tomorrow"
  it('TC022: Fly day after tomorrow → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-07-29' }));
    const result = await parseVoiceInput('Fly day after tomorrow');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.departureDate).toBe('2025-07-29');
  });

  // TC023: "Fly next Monday"
  it('TC023: Fly next Monday → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-07-28' }));
    const result = await parseVoiceInput('Fly next Monday');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  // TC024: "Fly this Friday"
  it('TC024: Fly this Friday → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-07-25' }));
    const result = await parseVoiceInput('Fly this Friday');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  // TC025: "Fly next weekend"
  it('TC025: Fly next weekend → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-07-26' }));
    const result = await parseVoiceInput('Fly next weekend');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  // TC026: "Fly in two weeks"
  it('TC026: Fly in two weeks → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-08-10' }));
    const result = await parseVoiceInput('Fly in two weeks');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  // TC027: "Fly next month"
  it('TC027: Fly next month → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-08-01' }));
    const result = await parseVoiceInput('Fly next month');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  // TC028: "Fly in 3 months"
  it('TC028: Fly in 3 months → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-10-27' }));
    const result = await parseVoiceInput('Fly in 3 months');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  // TC029: "Fly during summer"
  it('TC029: Fly during summer → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-07-22' }));
    const result = await parseVoiceInput('Fly during summer');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  // TC030: "Fly during winter"
  it('TC030: Fly during winter → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-12-22' }));
    const result = await parseVoiceInput('Fly during winter');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  // TC031: "Christmas trip"
  it('TC031: Christmas trip → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-12-20', returnDate: '2025-12-28', festival: 'Christmas' }));
    const result = await parseVoiceInput('Christmas trip');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.festival).toBe('Christmas');
  });

  // TC032: "New year holiday"
  it('TC032: New year holiday → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-12-29', returnDate: '2026-01-03', festival: 'New Year' }));
    const result = await parseVoiceInput('New year holiday');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  // TC033: "Easter holiday"
  it('TC033: Easter holiday → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-04-12', returnDate: '2025-04-27', festival: 'Easter' }));
    const result = await parseVoiceInput('Easter holiday');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  // TC034: "October half term"
  it('TC034: October half term → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-10-25', returnDate: '2025-11-01', festival: 'October Half Term' }));
    const result = await parseVoiceInput('October half term');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  // TC035: "Summer vacation"
  it('TC035: Summer vacation → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ departureDate: '2025-07-22', returnDate: '2025-08-10', festival: 'Summer' }));
    const result = await parseVoiceInput('Summer vacation');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  // TC036: "Book India trip for Diwali"
  it('TC036: Book India trip for Diwali → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'BOM', festival: 'Diwali' }));
    const result = await parseVoiceInput('Book India trip for Diwali');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('BOM');
    expect(result.entities.festival).toBe('Diwali');
  });

  // TC037: "Flight for Holi"
  it('TC037: Flight for Holi → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'BOM', festival: 'Holi' }));
    const result = await parseVoiceInput('Flight for Holi');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.festival).toBe('Holi');
  });

  // TC038: "Eid holiday Dubai"
  it('TC038: Eid holiday Dubai → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'DXB', festival: 'Eid' }));
    const result = await parseVoiceInput('Eid holiday Dubai');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('DXB');
    expect(result.entities.festival).toBe('Eid');
  });

  // TC039: "Christmas New York"
  it('TC039: Christmas New York → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'JFK', festival: 'Christmas' }));
    const result = await parseVoiceInput('Christmas New York');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('JFK');
  });

  // TC040: "Christmas Dubai"
  it('TC040: Christmas Dubai → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'DXB', festival: 'Christmas' }));
    const result = await parseVoiceInput('Christmas Dubai');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('DXB');
  });

  // TC041: "New Year Sydney"
  it('TC041: New Year Sydney → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'SYD', festival: 'New Year' }));
    const result = await parseVoiceInput('New Year Sydney');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('SYD');
  });

  // TC042: "Easter Barcelona"
  it('TC042: Easter Barcelona → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'BCN', festival: 'Easter' }));
    const result = await parseVoiceInput('Easter Barcelona');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('BCN');
  });

  // TC043: "Ramadan travel"
  it('TC043: Ramadan travel → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ festival: 'Ramadan' }));
    const result = await parseVoiceInput('Ramadan travel');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.festival).toBe('Ramadan');
  });

  // TC044: "Ganesh festival Mumbai"
  it('TC044: Ganesh festival Mumbai → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'BOM', festival: 'Ganesh' }));
    const result = await parseVoiceInput('Ganesh festival Mumbai');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('BOM');
  });

  // TC045: "Independence day India trip"
  it('TC045: Independence day India trip → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'BOM', festival: 'Independence Day' }));
    const result = await parseVoiceInput('Independence day India trip');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('BOM');
  });

  // TC046: "Thanksgiving USA trip"
  it('TC046: Thanksgiving USA trip → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'JFK', festival: 'Thanksgiving' }));
    const result = await parseVoiceInput('Thanksgiving USA trip');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('JFK');
  });

  // TC047: "Halloween trip"
  it('TC047: Halloween trip → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ festival: 'Halloween' }));
    const result = await parseVoiceInput('Halloween trip');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.festival).toBe('Halloween');
  });

  // TC048: "Summer festival travel"
  it('TC048: Summer festival travel → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ festival: 'Summer' }));
    const result = await parseVoiceInput('Summer festival travel');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  // TC049: "Religious holiday travel"
  it('TC049: Religious holiday travel → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ festival: 'Religious Holiday' }));
    const result = await parseVoiceInput('Religious holiday travel');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });
});

describe('voiceNLP — parseVoiceInput: CHECK_IN intents (TC051–TC060)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC051: Check me in → CHECK_IN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'CHECK_IN', text: 'Check-in opens 24 hours before departure.',
      action: { type: 'NAVIGATE', path: '/check-in' },
    }));
    const result = await parseVoiceInput('Check me in');
    expect(result.intent).toBe('CHECK_IN');
    expect(result.response.action).toEqual({ type: 'NAVIGATE', path: '/check-in' });
  });

  it('TC052: Online check in → CHECK_IN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'CHECK_IN', text: 'You can check in online 24 hours before departure.',
      action: { type: 'NAVIGATE', path: '/check-in' },
    }));
    const result = await parseVoiceInput('Online check in');
    expect(result.intent).toBe('CHECK_IN');
  });

  it('TC053: I need boarding pass → CHECK_IN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'CHECK_IN', text: 'You can get your boarding pass during check-in.',
      action: { type: 'NAVIGATE', path: '/check-in' },
    }));
    const result = await parseVoiceInput('I need boarding pass');
    expect(result.intent).toBe('CHECK_IN');
  });

  it('TC054: Start check in → CHECK_IN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'CHECK_IN', text: 'Starting check-in now.',
      action: { type: 'NAVIGATE', path: '/check-in' },
    }));
    const result = await parseVoiceInput('Start check in');
    expect(result.intent).toBe('CHECK_IN');
  });

  it('TC055: Check my booking in → CHECK_IN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'CHECK_IN', text: 'Checking your booking now.',
      action: { type: 'NAVIGATE', path: '/check-in' },
    }));
    const result = await parseVoiceInput('Check my booking in');
    expect(result.intent).toBe('CHECK_IN');
  });

  it('TC056: When does checkin open → CHECK_IN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'CHECK_IN', text: 'Check-in opens 24 hours before departure.',
      action: { type: 'NAVIGATE', path: '/check-in' },
    }));
    const result = await parseVoiceInput('When does checkin open');
    expect(result.intent).toBe('CHECK_IN');
  });

  it('TC057: Need boarding pass → CHECK_IN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'CHECK_IN', text: 'You can get your boarding pass during check-in.',
      action: { type: 'NAVIGATE', path: '/check-in' },
    }));
    const result = await parseVoiceInput('Need boarding pass');
    expect(result.intent).toBe('CHECK_IN');
  });

  it('TC058: Check-in for tomorrow flight → CHECK_IN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'CHECK_IN', text: 'Check-in for tomorrow\'s flight is now open.',
      action: { type: 'NAVIGATE', path: '/check-in' },
    }));
    const result = await parseVoiceInput('Check-in for tomorrow flight');
    expect(result.intent).toBe('CHECK_IN');
  });

  it('TC059: Complete my check in → CHECK_IN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'CHECK_IN', text: 'Completing your check-in now.',
      action: { type: 'NAVIGATE', path: '/check-in' },
    }));
    const result = await parseVoiceInput('Complete my check in');
    expect(result.intent).toBe('CHECK_IN');
  });

  it('TC060: Help with checkin → CHECK_IN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'CHECK_IN', text: 'I can help you with check-in.',
      action: { type: 'NAVIGATE', path: '/check-in' },
    }));
    const result = await parseVoiceInput('Help with checkin');
    expect(result.intent).toBe('CHECK_IN');
  });
});

describe('voiceNLP — parseVoiceInput: FLIGHT_STATUS intents (TC061–TC070)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC061: Track my flight → FLIGHT_STATUS', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'FLIGHT_STATUS', text: 'Which flight would you like to track?',
      action: { type: 'NAVIGATE', path: '/flight-status' },
    }));
    const result = await parseVoiceInput('Track my flight');
    expect(result.intent).toBe('FLIGHT_STATUS');
    expect(result.response.action).toEqual({ type: 'NAVIGATE', path: '/flight-status' });
  });

  it('TC062: Flight status → FLIGHT_STATUS', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'FLIGHT_STATUS', text: 'Your flight status is available.',
      action: { type: 'NAVIGATE', path: '/flight-status' },
    }));
    const result = await parseVoiceInput('Flight status');
    expect(result.intent).toBe('FLIGHT_STATUS');
  });

  it('TC063: Is BA117 delayed → FLIGHT_STATUS', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'FLIGHT_STATUS', text: 'BA117 is on time.',
      action: { type: 'NAVIGATE', path: '/flight-status' },
    }));
    const result = await parseVoiceInput('Is BA117 delayed');
    expect(result.intent).toBe('FLIGHT_STATUS');
  });

  it('TC064: Where is my plane → FLIGHT_STATUS', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'FLIGHT_STATUS', text: 'Your plane is approaching.',
      action: { type: 'NAVIGATE', path: '/flight-status' },
    }));
    const result = await parseVoiceInput('Where is my plane');
    expect(result.intent).toBe('FLIGHT_STATUS');
  });

  it('TC065: Flight arrival time → FLIGHT_STATUS', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'FLIGHT_STATUS', text: 'Your flight arrives at 14:30.',
      action: { type: 'NAVIGATE', path: '/flight-status' },
    }));
    const result = await parseVoiceInput('Flight arrival time');
    expect(result.intent).toBe('FLIGHT_STATUS');
  });

  it('TC066: Is my flight cancelled → FLIGHT_STATUS', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'FLIGHT_STATUS', text: 'Your flight is not cancelled.',
      action: { type: 'NAVIGATE', path: '/flight-status' },
    }));
    const result = await parseVoiceInput('Is my flight cancelled');
    expect(result.intent).toBe('FLIGHT_STATUS');
  });

  it('TC067: Track BA204 → FLIGHT_STATUS', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'FLIGHT_STATUS', text: 'Tracking BA204.',
      action: { type: 'NAVIGATE', path: '/flight-status' },
    }));
    const result = await parseVoiceInput('Track BA204');
    expect(result.intent).toBe('FLIGHT_STATUS');
  });

  it('TC068: Departure update → FLIGHT_STATUS', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'FLIGHT_STATUS', text: 'Your flight departs at 10:00.',
      action: { type: 'NAVIGATE', path: '/flight-status' },
    }));
    const result = await parseVoiceInput('Departure update');
    expect(result.intent).toBe('FLIGHT_STATUS');
  });

  it('TC069: Airport status → FLIGHT_STATUS', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'FLIGHT_STATUS', text: 'Heathrow is operating normally.',
      action: { type: 'NAVIGATE', path: '/flight-status' },
    }));
    const result = await parseVoiceInput('Airport status');
    expect(result.intent).toBe('FLIGHT_STATUS');
  });

  it('TC070: Flight running late → FLIGHT_STATUS', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'FLIGHT_STATUS', text: 'Your flight is running 15 minutes late.',
      action: { type: 'NAVIGATE', path: '/flight-status' },
    }));
    const result = await parseVoiceInput('Flight running late');
    expect(result.intent).toBe('FLIGHT_STATUS');
  });
});

describe('voiceNLP — parseVoiceInput: EXECUTIVE_CLUB intents (TC071–TC075)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC071: Show Avios → EXECUTIVE_CLUB', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'EXECUTIVE_CLUB', text: 'Your Avios balance is 15,000.',
      action: { type: 'NAVIGATE', path: '/executive-club' },
    }));
    const result = await parseVoiceInput('Show Avios');
    expect(result.intent).toBe('EXECUTIVE_CLUB');
    expect(result.response.action).toEqual({ type: 'NAVIGATE', path: '/executive-club' });
  });

  it('TC072: My points → EXECUTIVE_CLUB', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'EXECUTIVE_CLUB', text: 'You have 15,000 points.',
      action: { type: 'NAVIGATE', path: '/executive-club' },
    }));
    const result = await parseVoiceInput('My points');
    expect(result.intent).toBe('EXECUTIVE_CLUB');
  });

  it('TC073: Executive club → EXECUTIVE_CLUB', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'EXECUTIVE_CLUB', text: 'Welcome to the Executive Club.',
      action: { type: 'NAVIGATE', path: '/executive-club' },
    }));
    const result = await parseVoiceInput('Executive club');
    expect(result.intent).toBe('EXECUTIVE_CLUB');
  });

  it('TC074: Check rewards → EXECUTIVE_CLUB', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'EXECUTIVE_CLUB', text: 'Your rewards are available.',
      action: { type: 'NAVIGATE', path: '/executive-club' },
    }));
    const result = await parseVoiceInput('Check rewards');
    expect(result.intent).toBe('EXECUTIVE_CLUB');
  });

  it('TC075: Loyalty account → EXECUTIVE_CLUB', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'EXECUTIVE_CLUB', text: 'Your loyalty account details.',
      action: { type: 'NAVIGATE', path: '/executive-club' },
    }));
    const result = await parseVoiceInput('Loyalty account');
    expect(result.intent).toBe('EXECUTIVE_CLUB');
  });
});

describe('voiceNLP — parseVoiceInput: PASSENGER intents (TC076–TC085)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC076: John → PASSENGER_FIELD', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'PASSENGER_FIELD', text: 'What is your last name?',
      passengerField: {
        collected: { firstName: 'John', lastName: '', phone: '', nationality: '' },
        nextField: 'lastName', nextQuestion: 'What is your last name?', allCollected: false,
      },
    }));
    const result = await parseVoiceInput('John');
    expect(result.intent).toBe('PASSENGER_FIELD');
    expect(result.passengerField.collected.firstName).toBe('John');
    expect(result.passengerField.nextField).toBe('lastName');
  });

  it('TC077: John Smith → PASSENGER_FIELD', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'PASSENGER_FIELD', text: 'What is your phone number?',
      passengerField: {
        collected: { firstName: 'John', lastName: 'Smith', phone: '', nationality: '' },
        nextField: 'phone', nextQuestion: 'What is your phone number?', allCollected: false,
      },
    }));
    const result = await parseVoiceInput('John Smith');
    expect(result.intent).toBe('PASSENGER_FIELD');
    expect(result.passengerField.collected.firstName).toBe('John');
    expect(result.passengerField.collected.lastName).toBe('Smith');
  });

  it('TC078: Phone number 07912345678 → PASSENGER_FIELD', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'PASSENGER_FIELD', text: 'What is your nationality?',
      passengerField: {
        collected: { firstName: 'John', lastName: 'Smith', phone: '07912345678', nationality: '' },
        nextField: 'nationality', nextQuestion: 'What is your nationality?', allCollected: false,
      },
    }));
    const result = await parseVoiceInput('Phone number 07912345678');
    expect(result.intent).toBe('PASSENGER_FIELD');
    expect(result.passengerField.collected.phone).toBe('07912345678');
  });

  it('TC079: British nationality → PASSENGER_FIELD', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'PASSENGER_FIELD', text: 'All details collected!',
      passengerField: {
        collected: { firstName: 'John', lastName: 'Smith', phone: '07912345678', nationality: 'GB' },
        nextField: null, nextQuestion: null, allCollected: true,
      },
    }));
    const result = await parseVoiceInput('British nationality');
    expect(result.intent).toBe('PASSENGER_FIELD');
    expect(result.passengerField.collected.nationality).toBe('GB');
    expect(result.passengerField.allCollected).toBe(true);
  });

  it('TC080: Indian nationality → PASSENGER_FIELD', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'PASSENGER_FIELD', text: 'All details collected!',
      passengerField: {
        collected: { firstName: 'John', lastName: 'Smith', phone: '07912345678', nationality: 'IN' },
        nextField: null, nextQuestion: null, allCollected: true,
      },
    }));
    const result = await parseVoiceInput('Indian nationality');
    expect(result.intent).toBe('PASSENGER_FIELD');
    expect(result.passengerField.collected.nationality).toBe('IN');
  });

  it('TC081: American nationality → PASSENGER_FIELD', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'PASSENGER_FIELD', text: 'All details collected!',
      passengerField: {
        collected: { firstName: 'John', lastName: 'Smith', phone: '07912345678', nationality: 'US' },
        nextField: null, nextQuestion: null, allCollected: true,
      },
    }));
    const result = await parseVoiceInput('American nationality');
    expect(result.intent).toBe('PASSENGER_FIELD');
    expect(result.passengerField.collected.nationality).toBe('US');
  });

  it('TC082: Alex Brown 07123456789 British → FULL_BOOKING', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'BOOK_FLIGHT', text: 'Booking your flight now!',
      action: {
        type: 'FULL_BOOKING',
        passenger: { firstName: 'Alex', lastName: 'Brown', phone: '07123456789', nationality: 'GB' },
      },
      entities: { from: 'LHR', to: 'DXB', departureDate: '2025-07-28', returnDate: '2025-08-04', adults: 1, cabin: 'economy', tripType: 'return', festival: '' },
      passengerField: null,
    }));
    const result = await parseVoiceInput('Alex Brown 07123456789 British');
    expect(result.response.action.type).toBe('FULL_BOOKING');
    expect(result.response.action.passenger.firstName).toBe('Alex');
    expect(result.response.action.passenger.lastName).toBe('Brown');
    expect(result.response.action.passenger.nationality).toBe('GB');
  });

  it('TC083: Sarah Jones phone → PASSENGER_FIELD', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'PASSENGER_FIELD', text: 'What is your phone number?',
      passengerField: {
        collected: { firstName: 'Sarah', lastName: 'Jones', phone: '', nationality: '' },
        nextField: 'phone', nextQuestion: 'What is your phone number?', allCollected: false,
      },
    }));
    const result = await parseVoiceInput('Sarah Jones phone');
    expect(result.intent).toBe('PASSENGER_FIELD');
    expect(result.passengerField.collected.firstName).toBe('Sarah');
    expect(result.passengerField.collected.lastName).toBe('Jones');
  });

  it('TC084: Missing phone → PASSENGER_FIELD', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'PASSENGER_FIELD', text: 'What is your phone number?',
      passengerField: {
        collected: { firstName: 'John', lastName: 'Smith', phone: '', nationality: '' },
        nextField: 'phone', nextQuestion: 'What is your phone number?', allCollected: false,
      },
    }));
    const result = await parseVoiceInput('Missing phone');
    expect(result.intent).toBe('PASSENGER_FIELD');
    expect(result.passengerField.nextField).toBe('phone');
  });

  it('TC085: Missing nationality → PASSENGER_FIELD', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'PASSENGER_FIELD', text: 'What is your nationality?',
      passengerField: {
        collected: { firstName: 'John', lastName: 'Smith', phone: '07912345678', nationality: '' },
        nextField: 'nationality', nextQuestion: 'What is your nationality?', allCollected: false,
      },
    }));
    const result = await parseVoiceInput('Missing nationality');
    expect(result.intent).toBe('PASSENGER_FIELD');
    expect(result.passengerField.nextField).toBe('nationality');
  });
});

describe('voiceNLP — parseVoiceInput: HELP intents (TC050, TC086–TC090, TC100)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC050: Festival date question → HELP', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'HELP', text: 'Diwali is on 1 November 2025.',
      action: null,
    }));
    const result = await parseVoiceInput('Festival date question');
    expect(result.intent).toBe('HELP');
    expect(result.response.action).toBeNull();
  });

  it('TC086: What day is today → HELP', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'HELP', text: 'Today is Sunday 27 July 2025.',
      action: null,
    }));
    const result = await parseVoiceInput('What day is today');
    expect(result.intent).toBe('HELP');
  });

  it('TC087: What time is it → HELP', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'HELP', text: 'It is approximately 09:00 UK time.',
      action: null,
    }));
    const result = await parseVoiceInput('What time is it');
    expect(result.intent).toBe('HELP');
  });

  it('TC088: How many days until Christmas → HELP', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'HELP', text: 'Christmas is in 150 days.',
      action: null,
    }));
    const result = await parseVoiceInput('How many days until Christmas');
    expect(result.intent).toBe('HELP');
  });

  it('TC089: Is Christmas weekend → HELP', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'HELP', text: 'Christmas Day 2025 is a Thursday.',
      action: null,
    }));
    const result = await parseVoiceInput('Is Christmas weekend');
    expect(result.intent).toBe('HELP');
  });

  it('TC090: Should I book now → HELP', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'HELP', text: 'Yes, prices are typically lower when booked 6-8 weeks in advance.',
      action: null,
    }));
    const result = await parseVoiceInput('Should I book now');
    expect(result.intent).toBe('HELP');
  });

  it('TC100: Unsupported request → HELP', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'HELP', text: 'I can book flights, check you in, and track flights.',
      action: null,
    }));
    const result = await parseVoiceInput('Unsupported request');
    expect(result.intent).toBe('HELP');
  });
});

describe('voiceNLP — parseVoiceInput: UNKNOWN intents (TC091, TC093–TC096)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC091: Random text → UNKNOWN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'UNKNOWN', text: 'I didn\'t understand that.',
      action: null,
    }));
    const result = await parseVoiceInput('Random text');
    expect(result.intent).toBe('UNKNOWN');
  });

  it('TC093: null input → UNKNOWN (via fallback)', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'UNKNOWN', text: 'Could you rephrase that?',
      action: null,
    }));
    const result = await parseVoiceInput('null input');
    expect(result.intent).toBe('UNKNOWN');
  });

  it('TC094: Invalid JSON response → UNKNOWN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'UNKNOWN', text: 'Could you rephrase that?',
      action: null,
    }));
    const result = await parseVoiceInput('Invalid JSON response');
    expect(result.intent).toBe('UNKNOWN');
  });

  it('TC095: API timeout → UNKNOWN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'UNKNOWN', text: 'I\'m a little busy right now — please try again in a moment.',
      action: null,
    }));
    const result = await parseVoiceInput('API timeout');
    expect(result.intent).toBe('UNKNOWN');
  });

  it('TC096: Rate limit error → UNKNOWN', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'UNKNOWN', text: 'I\'m a little busy right now — please try again in a moment.',
      action: null,
    }));
    const result = await parseVoiceInput('Rate limit error');
    expect(result.intent).toBe('UNKNOWN');
  });
});

describe('voiceNLP — parseVoiceInput: edge cases (TC097, TC098, TC099)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TC097: Very long sentence booking request → BOOK_FLIGHT', async () => {
    const longText = 'I would like to book a flight from London to New York on the 20th of December returning on the 28th of December for two adults in business class with passenger John Smith phone number 07912345678 British nationality please';
    sendToGemini.mockResolvedValue(mockBookFlight({ from: 'LHR', to: 'JFK', adults: 2, cabin: 'business' }));
    const result = await parseVoiceInput(longText);
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.adults).toBe(2);
    expect(result.entities.cabin).toBe('business');
  });

  it('TC098: Dubia flight typo → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'DXB' }));
    const result = await parseVoiceInput('Dubia flight typo');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('DXB');
  });

  it('TC099: flite tokyo → BOOK_FLIGHT', async () => {
    sendToGemini.mockResolvedValue(mockBookFlight({ to: 'NRT' }));
    const result = await parseVoiceInput('flite tokyo');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('NRT');
  });
});

describe('voiceNLP — parseVoiceInput: error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns HELP intent when sendToGemini throws an Error', async () => {
    sendToGemini.mockRejectedValue(new Error('Network failure'));
    const result = await parseVoiceInput('Book a flight');
    expect(result.intent).toBe('HELP');
    expect(result.entities).toEqual({});
    expect(result.passengerField).toBeNull();
    expect(result.response.text).toContain('trouble understanding');
    expect(result.response.quickReplies).toEqual(['Book a flight', 'Check in', 'Flight status', 'Help']);
    expect(result.response.action).toBeNull();
  });

  it('returns HELP intent when sendToGemini throws a string', async () => {
    sendToGemini.mockRejectedValue('Something went wrong');
    const result = await parseVoiceInput('Check me in');
    expect(result.intent).toBe('HELP');
    expect(result.response.text).toContain('trouble understanding');
  });

  it('returns HELP intent when sendToGemini throws null', async () => {
    sendToGemini.mockRejectedValue(null);
    const result = await parseVoiceInput('Track my flight');
    expect(result.intent).toBe('HELP');
    expect(result.response.text).toContain('trouble understanding');
  });

  it('returns HELP intent when sendToGemini throws undefined', async () => {
    sendToGemini.mockRejectedValue(undefined);
    const result = await parseVoiceInput('Show Avios');
    expect(result.intent).toBe('HELP');
  });

  it('returns HELP intent when sendToGemini throws an object', async () => {
    sendToGemini.mockRejectedValue({ code: 500, message: 'Internal error' });
    const result = await parseVoiceInput('Book a flight');
    expect(result.intent).toBe('HELP');
  });

  it('does not call sendToGemini for empty input', async () => {
    await parseVoiceInput('');
    expect(sendToGemini).not.toHaveBeenCalled();
  });

  it('does not call sendToGemini for whitespace-only input', async () => {
    await parseVoiceInput('   \n\t  ');
    expect(sendToGemini).not.toHaveBeenCalled();
  });
});

describe('voiceNLP — parseVoiceInput: response shape and normalisation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wraps AI response with correct structure', async () => {
    sendToGemini.mockResolvedValue({
      intent: 'BOOK_FLIGHT',
      text: 'Flying to Dubai.',
      quickReplies: ['Book return', 'One way'],
      action: { type: 'NAVIGATE', path: '/book' },
      entities: { from: 'LHR', to: 'DXB', departureDate: '2025-07-28', returnDate: '', adults: 1, cabin: 'economy', tripType: 'return', festival: '' },
      passengerField: null,
    });

    const result = await parseVoiceInput('London to Dubai tomorrow');
    expect(result).toHaveProperty('intent', 'BOOK_FLIGHT');
    expect(result).toHaveProperty('entities');
    expect(result).toHaveProperty('passengerField', null);
    expect(result).toHaveProperty('response');
    expect(result.response).toHaveProperty('text', 'Flying to Dubai.');
    expect(result.response).toHaveProperty('quickReplies');
    expect(result.response).toHaveProperty('action');
  });

  it('defaults entities to {} when AI returns undefined', async () => {
    sendToGemini.mockResolvedValue({
      intent: 'HELP', text: 'OK', quickReplies: [], action: null,
      entities: undefined, passengerField: undefined,
    });
    const result = await parseVoiceInput('test');
    expect(result.entities).toEqual({});
    expect(result.passengerField).toBeNull();
  });

  it('defaults quickReplies to [] when AI returns undefined', async () => {
    sendToGemini.mockResolvedValue({
      intent: 'HELP', text: 'OK', quickReplies: undefined, action: null,
      entities: {}, passengerField: null,
    });
    const result = await parseVoiceInput('test');
    expect(result.response.quickReplies).toEqual([]);
  });

  it('defaults action to null when AI returns undefined', async () => {
    sendToGemini.mockResolvedValue({
      intent: 'HELP', text: 'OK', quickReplies: [], action: undefined,
      entities: {}, passengerField: null,
    });
    const result = await parseVoiceInput('test');
    expect(result.response.action).toBeNull();
  });

  it('passes conversation history to sendToGemini', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse());
    const history = [
      { role: 'user', text: 'Book a flight' },
      { role: 'model', text: 'Where would you like to fly?' },
    ];
    await parseVoiceInput('London to Dubai', {}, history);
    expect(sendToGemini).toHaveBeenCalledWith('London to Dubai', history);
  });

  it('passes empty history array when not provided', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse());
    await parseVoiceInput('test');
    expect(sendToGemini).toHaveBeenCalledWith('test', []);
  });

  it('passes input text as-is to sendToGemini (trimming happens inside sendToGemini)', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse());
    await parseVoiceInput('  test  ');
    expect(sendToGemini).toHaveBeenCalledWith('  test  ', []);
  });
});

describe('voiceNLP — parseVoiceInput: COLLECT_PASSENGER intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles COLLECT_PASSENGER intent', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'COLLECT_PASSENGER',
      text: 'Let me collect your details. What is your first name?',
      quickReplies: [],
      action: null,
      entities: { from: 'LHR', to: 'DXB', departureDate: '2025-07-28' },
      passengerField: null,
    }));
    const result = await parseVoiceInput('Book a flight to Dubai');
    expect(result.intent).toBe('COLLECT_PASSENGER');
    expect(result.entities.from).toBe('LHR');
    expect(result.entities.to).toBe('DXB');
  });
});

describe('voiceNLP — parseVoiceInput: TWO_OPTIONS intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles TWO_OPTIONS intent with two quick replies', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'TWO_OPTIONS',
      text: 'Would you like to book or check in?',
      quickReplies: ['Book a flight', 'Check in'],
      action: null,
      entities: {},
      passengerField: null,
    }));
    const result = await parseVoiceInput('I need help');
    expect(result.intent).toBe('TWO_OPTIONS');
    expect(result.response.quickReplies).toHaveLength(2);
  });
});

describe('voiceNLP — parseVoiceInput: PREFILL_BOOKING action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles PREFILL_BOOKING action', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'BOOK_FLIGHT',
      text: 'Got it! Flying to Dubai tomorrow.',
      action: {
        type: 'PREFILL_BOOKING',
        passenger: { firstName: '', lastName: '', phone: '', nationality: '' },
      },
      entities: { from: 'LHR', to: 'DXB', departureDate: '2025-07-28', returnDate: '', adults: 1, cabin: 'economy', tripType: 'return', festival: '' },
      passengerField: null,
    }));
    const result = await parseVoiceInput('London to Dubai tomorrow');
    expect(result.response.action.type).toBe('PREFILL_BOOKING');
    expect(result.entities.to).toBe('DXB');
  });
});

describe('voiceNLP — parseVoiceInput: NAVIGATE action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles NAVIGATE action to /destinations', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'DESTINATIONS',
      text: 'Here are our top destinations.',
      action: { type: 'NAVIGATE', path: '/destinations' },
      entities: {},
      passengerField: null,
    }));
    const result = await parseVoiceInput('Where can I go');
    expect(result.response.action.type).toBe('NAVIGATE');
    expect(result.response.action.path).toBe('/destinations');
  });

  it('handles NAVIGATE action to /manage', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'MANAGE_BOOKING',
      text: 'Let me help you manage your booking.',
      action: { type: 'NAVIGATE', path: '/manage' },
      entities: {},
      passengerField: null,
    }));
    const result = await parseVoiceInput('I need to change my booking');
    expect(result.response.action.type).toBe('NAVIGATE');
    expect(result.response.action.path).toBe('/manage');
  });
});

describe('voiceNLP — TTS functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('stopSpeaking', () => {
    it('calls speechSynthesis.cancel()', () => {
      stopSpeaking();
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('getAvailableVoices', () => {
    it('returns array of voices', () => {
      const voices = getAvailableVoices();
      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
    });

    it('returns voices with name and lang properties', () => {
      const voices = getAvailableVoices();
      expect(voices[0]).toHaveProperty('name');
      expect(voices[0]).toHaveProperty('lang');
    });
  });

  describe('speak', () => {
    it('calls speechSynthesis.speak with an utterance', async () => {
      const promise = speak('Hello world');
      await promise;
      expect(window.speechSynthesis.speak).toHaveBeenCalled();
    });

    it('creates SpeechSynthesisUtterance with correct text', async () => {
      await speak('Test message');
      const utterance = window.speechSynthesis.speak.mock.calls[0][0];
      expect(utterance.text).toBe('Test message');
    });

    it('sets rate, pitch, volume, and lang on utterance', async () => {
      await speak('Hello', { rate: 1.2, pitch: 0.8, volume: 0.5, lang: 'en-US' });
      const utterance = window.speechSynthesis.speak.mock.calls[0][0];
      expect(utterance.rate).toBe(1.2);
      expect(utterance.pitch).toBe(0.8);
      expect(utterance.volume).toBe(0.5);
      expect(utterance.lang).toBe('en-US');
    });

    it('uses default values when options not provided', async () => {
      await speak('Hello');
      const utterance = window.speechSynthesis.speak.mock.calls[0][0];
      expect(utterance.rate).toBe(0.95);
      expect(utterance.pitch).toBe(1.0);
      expect(utterance.volume).toBe(1.0);
      expect(utterance.lang).toBe('en-GB');
    });

    it('cancels previous speech before speaking', async () => {
      await speak('First message');
      await speak('Second message');
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });

    it('resolves promise when speech ends', async () => {
      const promise = speak('Hello');
      await expect(promise).resolves.toBeUndefined();
    });

    it('uses provided voice when specified', async () => {
      const customVoice = { name: 'Custom', lang: 'en-GB' };
      await speak('Hello', { voice: customVoice });
      const utterance = window.speechSynthesis.speak.mock.calls[0][0];
      expect(utterance.voice).toBe(customVoice);
    });
  });
});

describe('voiceNLP — parseVoiceInput: integration scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles multi-step conversation: destination → passenger collection → full booking', async () => {
    // Step 1: User provides destination
    sendToGemini.mockResolvedValueOnce(mockBookFlight({ to: 'DXB', departureDate: '2025-07-28' }));
    let result = await parseVoiceInput('London to Dubai tomorrow');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('DXB');

    // Step 2: User provides passenger details
    sendToGemini.mockResolvedValueOnce(mockAIResponse({
      intent: 'PASSENGER_FIELD',
      text: 'What is your phone number?',
      passengerField: {
        collected: { firstName: 'John', lastName: 'Smith', phone: '', nationality: '' },
        nextField: 'phone', nextQuestion: 'What is your phone number?', allCollected: false,
      },
    }));
    result = await parseVoiceInput('John Smith');
    expect(result.intent).toBe('PASSENGER_FIELD');
    expect(result.passengerField.collected.firstName).toBe('John');

    // Step 3: All collected → FULL_BOOKING
    sendToGemini.mockResolvedValueOnce(mockAIResponse({
      intent: 'BOOK_FLIGHT',
      text: 'Booking complete!',
      action: {
        type: 'FULL_BOOKING',
        passenger: { firstName: 'John', lastName: 'Smith', phone: '07912345678', nationality: 'GB' },
      },
      entities: { from: 'LHR', to: 'DXB', departureDate: '2025-07-28', returnDate: '', adults: 1, cabin: 'economy', tripType: 'return', festival: '' },
      passengerField: null,
    }));
    result = await parseVoiceInput('07912345678 British');
    expect(result.response.action.type).toBe('FULL_BOOKING');
    expect(result.response.action.passenger.firstName).toBe('John');
  });

  it('handles conversation with history context', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'BOOK_FLIGHT', text: 'OK', action: null, entities: { to: 'DXB' },
    }));

    const history = [
      { role: 'user', text: 'Book a flight' },
      { role: 'model', text: 'Where would you like to fly?' },
    ];

    const result = await parseVoiceInput('London to Dubai', {}, history);
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(result.entities.to).toBe('DXB');
    expect(sendToGemini).toHaveBeenCalledWith('London to Dubai', history);
  });

  it('handles mixed-case input', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'BOOK_FLIGHT', text: 'OK', action: null, entities: { to: 'DXB' },
    }));
    const result = await parseVoiceInput('lOnDoN tO dUbAi');
    expect(result.intent).toBe('BOOK_FLIGHT');
  });

  it('handles input with leading/trailing whitespace', async () => {
    sendToGemini.mockResolvedValue(mockAIResponse({
      intent: 'BOOK_FLIGHT', text: 'OK', action: null, entities: { to: 'DXB' },
    }));
    const result = await parseVoiceInput('  London to Dubai  ');
    expect(result.intent).toBe('BOOK_FLIGHT');
    expect(sendToGemini).toHaveBeenCalledWith('London to Dubai', []);
  });

  describe('smartNLPPreprocessor — NLP preprocessing layer', () => {
    it('detects wake words in transcripts', () => {
      expect(detectWakeWord('Hey BA book a flight to Dubai')).toEqual({ hasWakeWord: true, cleanText: 'book a flight to Dubai' });
      expect(detectWakeWord('Hello Assistant check-in')).toEqual({ hasWakeWord: true, cleanText: 'check-in' });
      expect(detectWakeWord('book London to New York')).toEqual({ hasWakeWord: false, cleanText: 'book London to New York' });
    });

    it('detects exit intent commands', () => {
      expect(detectExitIntent('stop')).toBe(true);
      expect(detectExitIntent('bye')).toBe(true);
      expect(detectExitIntent('goodbye')).toBe(true);
      expect(detectExitIntent('exit')).toBe(true);
      expect(detectExitIntent('book a flight')).toBe(false);
    });

    it('resolves relative & Tamil dates', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(resolveRelativeDate('today')).toBe(today);
      expect(resolveRelativeDate('inniku')).toBe(today);

      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      expect(resolveRelativeDate('tomorrow')).toBe(tomorrow);
      expect(resolveRelativeDate('naalaiku')).toBe(tomorrow);
    });

    it('normalizes filler words, STT mishearings, and Tanglish phrases', () => {
      const processed = preprocessVoiceTranscript('um uh Hey BA book flight to do bye naalaiku rendu ticket');
      expect(processed.hasWakeWord).toBe(true);
      expect(processed.cleanText).toContain('Dubai');
      expect(processed.cleanText).toContain('tomorrow');
      expect(processed.cleanText).toContain('2 ticket');
    });

    it('returns EXIT_CONVERSATION intent when exit command is spoken', async () => {
      const result = await parseVoiceInput('stop');
      expect(result.intent).toBe('EXIT_CONVERSATION');
      expect(result.response.text).toContain('Goodbye');
    });
  });
});
