/**
 * smartNLPPreprocessor.test.js
 *
 * Unit tests for smartNLPPreprocessor.js covering:
 *  - Filler word removal (English, Tamil, Tanglish)
 *  - Phonetic & spelling normalization (city names, STT mishearings)
 *  - Spoken numbers conversion (English & Tanglish)
 *  - Relative date pre-resolution (English & Tamil)
 *  - Passenger & profile extraction
 *  - Wake word detection
 *  - Exit intent detection
 *  - Speech interruption detection
 *  - Confidence calculation
 */

import { describe, it, expect } from 'vitest';
import {
  preprocessVoiceTranscript,
  detectWakeWord,
  detectExitIntent,
  detectInterruptIntent,
  extractPassengerInfo,
  resolveRelativeDate,
  calculateConfidence,
} from './smartNLPPreprocessor';

describe('smartNLPPreprocessor — Filler word removal', () => {
  it('strips English filler words', () => {
    const input = 'um actually basically I want to book a flight to Dubai please';
    const { cleanText } = preprocessVoiceTranscript(input);
    expect(cleanText.toLowerCase()).not.toContain('um');
    expect(cleanText.toLowerCase()).not.toContain('actually');
    expect(cleanText.toLowerCase()).not.toContain('basically');
    expect(cleanText.toLowerCase()).toContain('dubai');
  });

  it('strips Tanglish and Tamil filler words', () => {
    const input = 'enna seri dei bro London ku ticket venum paa';
    const { cleanText } = preprocessVoiceTranscript(input);
    expect(cleanText.toLowerCase()).not.toContain('enna');
    expect(cleanText.toLowerCase()).not.toContain('seri');
    expect(cleanText.toLowerCase()).not.toContain('dei');
    expect(cleanText.toLowerCase()).not.toContain('bro');
    expect(cleanText).toContain('London');
  });
});

describe('smartNLPPreprocessor — STT mishearings & spelling normalization', () => {
  it('corrects city typos like Dubia, Lonodn, Hydrabad, Banglore, Channai, Singapoor', () => {
    expect(preprocessVoiceTranscript('Book Dubia flight').cleanText).toContain('Dubai');
    expect(preprocessVoiceTranscript('Fly to Lonodn tomorrow').cleanText).toContain('London');
    expect(preprocessVoiceTranscript('Ticket for Hydrabad').cleanText).toContain('Hyderabad');
    expect(preprocessVoiceTranscript('Banglore flight').cleanText).toContain('Bangalore');
    expect(preprocessVoiceTranscript('Channai to Singapoor').cleanText).toContain('Chennai');
    expect(preprocessVoiceTranscript('Channai to Singapoor').cleanText).toContain('Singapore');
  });

  it('normalizes nicknames and airport variants like NYC, Heatrow, Bombay, Madras', () => {
    expect(preprocessVoiceTranscript('Flight to NYC').cleanText).toContain('New York');
    expect(preprocessVoiceTranscript('Flight from Heatrow').cleanText).toContain('Heathrow');
    expect(preprocessVoiceTranscript('Ticket to Bombay').cleanText).toContain('Mumbai');
    expect(preprocessVoiceTranscript('Fly to Madras').cleanText).toContain('Chennai');
  });
});

describe('smartNLPPreprocessor — Spoken numbers conversion', () => {
  it('converts English spoken numbers to digits', () => {
    expect(preprocessVoiceTranscript('Book two tickets for three adults').cleanText).toContain('2 tickets for 3 adults');
  });

  it('converts Tanglish spoken numbers to digits', () => {
    expect(preprocessVoiceTranscript('rendu tickets moonu adults').cleanText).toContain('2 tickets 3 adults');
  });
});

describe('smartNLPPreprocessor — Relative and Tamil date pre-resolution', () => {
  it('resolves today, tomorrow, day after tomorrow', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    expect(resolveRelativeDate('today')).toBe(todayStr);
    expect(resolveRelativeDate('inniku')).toBe(todayStr);
    expect(resolveRelativeDate('tomorrow')).toBe(tomorrowStr);
    expect(resolveRelativeDate('naalaiku')).toBe(tomorrowStr);
  });
});

describe('smartNLPPreprocessor — Passenger & Profile extraction', () => {
  it('extracts family profile details', () => {
    const info = extractPassengerInfo('Book flight for my family');
    expect(info.adults).toBe(2);
    expect(info.children).toBe(2);
    expect(info.profile).toBe('family');
  });

  it('extracts couple profile details', () => {
    const info = extractPassengerInfo('Honeymoon trip for couple');
    expect(info.adults).toBe(2);
    expect(info.profile).toBe('honeymoon');
  });

  it('extracts explicit passenger counts', () => {
    const info = extractPassengerInfo('Book 3 adults and 2 children');
    expect(info.adults).toBe(3);
    expect(info.children).toBe(2);
  });
});

describe('smartNLPPreprocessor — Wake Word & Exit Intent', () => {
  it('detects and strips wake words', () => {
    const { hasWakeWord, cleanText } = detectWakeWord('Hey BA book flight to Dubai');
    expect(hasWakeWord).toBe(true);
    expect(cleanText.toLowerCase()).toBe('book flight to dubai');
  });

  it('detects exit intent commands', () => {
    expect(detectExitIntent('stop')).toBe(true);
    expect(detectExitIntent('goodbye')).toBe(true);
    expect(detectExitIntent('thank you bye')).toBe(true);
    expect(detectExitIntent('end conversation')).toBe(true);
    expect(detectExitIntent('book Dubai')).toBe(false);
  });

  it('detects speech interruption keywords', () => {
    expect(detectInterruptIntent('stop')).toBe(true);
    expect(detectInterruptIntent('wait')).toBe(true);
    expect(detectInterruptIntent('hold on')).toBe(true);
    expect(detectInterruptIntent('excuse me')).toBe(true);
    expect(detectInterruptIntent('book flight')).toBe(false);
  });
});

describe('smartNLPPreprocessor — Confidence Calculation', () => {
  it('assigns high confidence for explicit booking intent', () => {
    const conf = calculateConfidence('Book flight from London to Dubai tomorrow for 2 adults', 'BOOK_FLIGHT');
    expect(conf).toBeGreaterThanOrEqual(0.95);
  });

  it('assigns high confidence for check-in and status', () => {
    expect(calculateConfidence('Check in online', 'CHECK_IN')).toBeGreaterThanOrEqual(0.95);
    expect(calculateConfidence('Track flight status', 'FLIGHT_STATUS')).toBeGreaterThanOrEqual(0.95);
  });
});
