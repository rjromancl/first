/**
 * smartNLPPreprocessor.js — Smart NLP Preprocessing Layer
 *
 * Lightweight, high-performance preprocessor for voice transcripts before LLM processing:
 * 1. Filler word removal (English & Tamil/Tanglish)
 * 2. STT mishearing & spelling normalization (airport & city names)
 * 3. Tanglish & Tamil phrase mapping
 * 4. Relative & Tamil date pre-resolution
 * 5. Wake word detection & stripping ("Hey BA", "Hello BA", "British Airways", "BA", "Assistant")
 * 6. Exit intent detection ("stop", "bye", "goodbye", "exit", "cancel")
 * 7. Speech interruption detection ("stop", "wait", "hold on", "cancel", "hello", "excuse me", "pause")
 * 8. Passenger count & trip category extraction
 */

// ── Filler Words ──────────────────────────────────────────────────
const FILLERS = [
  // English fillers
  'uh', 'um', 'mmm', 'err', 'ah', 'actually', 'basically', 'you know', 'kind of', 'sort of', 'like', 'so', 'okay', 'please',
  // Tanglish / Tamil fillers
  'enna', 'seri', 'aprom', 'dei', 'bro', 'boss', 'anna', 'thambi', 'machi', 'paa'
];

const FILLER_REGEX = new RegExp(`\\b(${FILLERS.join('|')})\\b`, 'gi');

// ── City & STT Mishearing Corrections ──────────────────────────────
const PHONETIC_MAP = [
  // STT mishearings & typos
  [/\b(heat\s*throw|heatrow|heath\s*row)\b/gi, 'Heathrow'],
  [/\b(do\s*bye|doo\s*bye|du\s*buy|dubia|dubi|dubba)\b/gi, 'Dubai'],
  [/\b(lonodn|londn|landan)\b/gi, 'London'],
  [/\b(channai|chenai|madras)\b/gi, 'Chennai'],
  [/\b(bom\s*bay|mumbai|mum\s*bai|bombay)\b/gi, 'Mumbai'],
  [/\b(hydrabad|hyderabad|hyd)\b/gi, 'Hyderabad'],
  [/\b(banglore|bengaluru|blr)\b/gi, 'Bangalore'],
  [/\b(singapoor|singapor)\b/gi, 'Singapore'],
  [/\b(gat\s*wick|gate\s*wick)\b/gi, 'Gatwick'],
  [/\b(new\s*york|nyc|ny)\b/gi, 'New York'],
  [/\b(tokyo|narita|haneda)\b/gi, 'Tokyo'],
  [/\b(barcelona|bcn)\b/gi, 'Barcelona'],
  [/\b(united\s*kingdom|uk)\b/gi, 'London'],
];

// ── Spoken Numbers to Digits ──────────────────────────────────────
const NUMBER_WORDS = {
  one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  rendu: '2', moonu: '3', naalu: '4', anju: '5',
  aaru: '6', ezhu: '7', ettu: '8', ombodhu: '9', patthu: '10'
};

// ── Tanglish Phrases ──────────────────────────────────────────────
const TANGLISH_MAP = [
  [/\b(ticket\s+venum|venum\s+ticket|poganum|polaam|poren|enakku\s+.*ticket\s+venum)\b/gi, 'ticket required'],
  [/\b(book\s+pannu|book\s+panren|book\s+pannunga|ticket\s+book\s+pannu)\b/gi, 'book flight'],
  [/\b(flight\s+status\s+enna|status\s+enna|status\s+check\s+pannu)\b/gi, 'check flight status'],
  [/\b(check\s+in\s+pannu|check\s+in\s+panren)\b/gi, 'online check-in'],
  [/\b(inniku|iniki)\b/gi, 'today'],
  [/\b(naalaiku|nalaiku|naalai)\b/gi, 'tomorrow'],
  [/\b(adutha\s+vaaram|varra\s+vaaram)\b/gi, 'next week'],
  [/\b(adutha\s+maasam)\b/gi, 'next month'],
  [/\b(varra\s+friday|indha\s+friday)\b/gi, 'this Friday'],
  [/\b(indha\s+sunday|varra\s+sunday)\b/gi, 'this Sunday'],
  [/\b(deepavali\s*ku|diwali\s*ku)\b/gi, 'Diwali'],
  [/\b(pongal\s*ukku|pongal\s*ku)\b/gi, 'Pongal'],
  [/\b(christmas\s*ku)\b/gi, 'Christmas'],
  [/\b(leave\s*la|holiday\s*la|vacation\s*ku)\b/gi, 'vacation'],
];

// ── Wake Word Detection ───────────────────────────────────────────
const WAKE_WORDS = [
  'hey ba', 'hello ba', 'hi ba', 'british airways', 'ba', 'hey assistant', 'hello assistant', 'hey siri', 'alexa'
];

// ── Exit Commands ─────────────────────────────────────────────────
const EXIT_WORDS = [
  'stop', 'goodbye', 'bye', 'exit', 'cancel', 'thank you bye', 'end conversation', 'quit', 'close'
];

// ── Interrupt Commands ───────────────────────────────────────────
const INTERRUPT_WORDS = [
  'stop', 'wait', 'hold on', 'cancel', 'hello', 'excuse me', 'pause'
];

/**
 * Detect wake word in transcript.
 * @param {string} text 
 * @returns {{hasWakeWord: boolean, cleanText: string}}
 */
export function detectWakeWord(text = '') {
  const lower = text.toLowerCase().trim();
  for (const wake of WAKE_WORDS) {
    if (lower.startsWith(wake) || lower.includes(wake)) {
      const regex = new RegExp(`\\b${wake.replace(/\s+/g, '\\s+')}\\b`, 'gi');
      const clean = text.replace(regex, '').trim();
      return { hasWakeWord: true, cleanText: clean || text };
    }
  }
  return { hasWakeWord: false, cleanText: text };
}

/**
 * Detect exit intent from user transcript.
 * @param {string} text 
 * @returns {boolean}
 */
export function detectExitIntent(text = '') {
  const lower = text.toLowerCase().trim();
  return EXIT_WORDS.some(w => lower === w || lower.startsWith(w));
}

/**
 * Detect interruption intent while assistant is speaking.
 * @param {string} text 
 * @returns {boolean}
 */
export function detectInterruptIntent(text = '') {
  const lower = text.toLowerCase().trim();
  return INTERRUPT_WORDS.some(w => lower === w || lower.startsWith(w));
}

/**
 * Extract passenger count and travel profile from text.
 * @param {string} text 
 * @returns {{adults: number, children: number, cabin: string|null, profile: string|null}}
 */
export function extractPassengerInfo(text = '') {
  const l = text.toLowerCase();
  let adults = 1;
  let children = 0;
  let cabin = null;
  let profile = null;

  if (/\b(family|with family|family oda)\b/i.test(l)) {
    adults = 2; children = 2; profile = 'family';
  } else if (/\b(couple|husband and wife|wife|husband)\b/i.test(l)) {
    adults = 2; profile = 'couple';
  } else if (/\b(business trip|office trip|work trip)\b/i.test(l)) {
    adults = 1; cabin = 'business'; profile = 'business';
  } else if (/\b(solo|solo trip|just me|alone)\b/i.test(l)) {
    adults = 1; profile = 'solo';
  } else if (/\b(honeymoon)\b/i.test(l)) {
    adults = 2; cabin = 'business'; profile = 'honeymoon';
  } else if (/\b(friends|with friends)\b/i.test(l)) {
    adults = 2; profile = 'friends';
  } else if (/\b(parents|with parents)\b/i.test(l)) {
    adults = 2; profile = 'parents';
  }

  // Explicit adult counts
  const adultMatch = l.match(/(\d+|one|two|three|four|five|rendu|moonu|naalu|anju)\s*(adult|adults|passengers|pax|people)/i);
  if (adultMatch) {
    const num = NUMBER_WORDS[adultMatch[1].toLowerCase()] || adultMatch[1];
    const parsed = parseInt(num, 10);
    if (!isNaN(parsed) && parsed > 0) adults = parsed;
  }

  // Explicit child counts
  const childMatch = l.match(/(\d+|one|two|three|four|five|rendu|moonu|naalu|anju)\s*(child|children|kids)/i);
  if (childMatch) {
    const num = NUMBER_WORDS[childMatch[1].toLowerCase()] || childMatch[1];
    const parsed = parseInt(num, 10);
    if (!isNaN(parsed) && parsed >= 0) children = parsed;
  }

  if (/\b(business|club world|first class)\b/i.test(l)) cabin = 'business';
  if (/\b(economy|world traveller)\b/i.test(l)) cabin = 'economy';

  return { adults, children, cabin, profile };
}

/**
 * Resolve relative dates (today, tomorrow, next week, festivals) to YYYY-MM-DD string.
 * @param {string} dateStr 
 * @returns {string|null}
 */
export function resolveRelativeDate(dateStr = '') {
  if (!dateStr) return null;
  const lower = dateStr.toLowerCase().trim();
  const now = new Date();

  if (lower === 'today' || lower === 'inniku') {
    return now.toISOString().split('T')[0];
  }

  if (lower === 'tomorrow' || lower === 'naalaiku' || lower === 'naalai') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }

  if (lower === 'day after tomorrow') {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  }

  if (lower === 'next week' || lower === 'adutha vaaram' || lower === 'varra vaaram') {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }

  if (lower === 'next month' || lower === 'adutha maasam') {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Calculate intent confidence score (0 to 1).
 * Thresholds:
 * - >0.95: Direct Execution
 * - 0.70 - 0.95: Clarification Confirmation ("Did you mean Dubai?")
 * - <0.70: Rephrase Request ("Sorry, could you repeat that?")
 * @param {string} text 
 * @param {string} intent 
 * @returns {number}
 */
export function calculateConfidence(text = '', intent = 'HELP') {
  if (!text || !text.trim()) return 0.0;
  const l = text.toLowerCase();
  
  if (intent === 'BOOK_FLIGHT' || intent === 'FULL_BOOKING' || intent === 'PREFILL_BOOKING') {
    let score = 0.65;
    if (/london|heathrow|jfk|dubai|chennai|mumbai|paris|tokyo|sydney|barcelona|singapore|new york/i.test(l)) score += 0.2;
    if (/tomorrow|today|next week|december|diwali|christmas|pongal|2026/i.test(l)) score += 0.1;
    if (/\d+/.test(l) || /adult|business|economy|family|couple/i.test(l)) score += 0.05;
    return Math.min(1.0, Number(score.toFixed(2)));
  }

  if (intent === 'CHECK_IN' || intent === 'FLIGHT_STATUS' || intent === 'EXECUTIVE_CLUB') {
    return 0.96;
  }

  if (intent === 'CHAT' || intent === 'THANK_YOU') {
    return 0.95;
  }

  if (l.length < 3) return 0.5;

  return 0.85;
}

/**
 * Preprocess raw voice transcript.
 * @param {string} rawText 
 * @returns {{cleanText: string, hasWakeWord: boolean, isExit: boolean, isInterrupt: boolean, confidence: number, passengerDetails: object}}
 */
export function preprocessVoiceTranscript(rawText = '') {
  if (!rawText || typeof rawText !== 'string') {
    return { cleanText: '', hasWakeWord: false, isExit: false, isInterrupt: false, confidence: 0, passengerDetails: { adults: 1, children: 0, cabin: null, profile: null } };
  }

  let text = rawText.trim();

  // 1. Exit check
  const isExit = detectExitIntent(text);

  // 2. Interrupt check
  const isInterrupt = detectInterruptIntent(text);

  // 3. Wake word check
  const { hasWakeWord, cleanText: textAfterWake } = detectWakeWord(text);
  text = textAfterWake;

  // 4. Remove filler words
  text = text.replace(FILLER_REGEX, ' ').replace(/\s+/g, ' ').trim();

  // 5. Phonetic & STT mishearing corrections
  for (const [regex, replacement] of PHONETIC_MAP) {
    text = text.replace(regex, replacement);
  }

  // 6. Spoken numbers to digits
  text = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|rendu|moonu|naalu|anju|aaru|ezhu|ettu|ombodhu|patthu)\b/gi, (match) => {
    return NUMBER_WORDS[match.toLowerCase()] || match;
  });

  // 7. Tanglish phrase mapping
  for (const [regex, replacement] of TANGLISH_MAP) {
    text = text.replace(regex, replacement);
  }

  // 8. Clean up extra punctuation/whitespace
  text = text.replace(/[\,\.\!\?]+/g, ' ').replace(/\s+/g, ' ').trim();

  // 9. Extract passenger details
  const passengerDetails = extractPassengerInfo(rawText);

  const confidence = calculateConfidence(text);

  return {
    cleanText: text,
    hasWakeWord,
    isExit,
    isInterrupt,
    confidence,
    passengerDetails,
  };
}

export default {
  preprocessVoiceTranscript,
  detectWakeWord,
  detectExitIntent,
  detectInterruptIntent,
  extractPassengerInfo,
  resolveRelativeDate,
  calculateConfidence,
};

