/**
 * aiService.js — Groq llama-3.3-70b for the BA mobile app.
 *
 * Identical logic to the web geminiService.js, adapted for React Native:
 *  - Uses fetch() instead of axios (works in RN without extra deps)
 *  - API key read from EXPO_PUBLIC_GROQ_API_KEY
 *  - AbortController timeout, retry/backoff, stale-request guard
 *  - Builds full system prompt with live date, festivals, UK holidays
 */

const API_KEY  = process.env.EXPO_PUBLIC_GROQ_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.3-70b-versatile';

const REQUEST_TIMEOUT_MS  = 12_000;
const MAX_RETRIES         = 2;
const RETRY_BASE_DELAY_MS = 400;
const MAX_HISTORY_TURNS   = 20;
const IS_DEV              = __DEV__;

let currentRequestId = 0;

function log(...args)      { if (IS_DEV) console.log('[aiService]', ...args); }
function logError(...args) { if (IS_DEV) console.error('[aiService]', ...args); else console.error('[aiService]', args[0]); }

// ── System prompt ────────────────────────────────────────────────
function buildSystemPrompt() {
  const now       = new Date();
  const year      = now.getFullYear();
  const month     = now.getMonth() + 1;
  const fullDate  = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr   = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split('T')[0]; };
  const inMonths = (n) => { const d = new Date(now); d.setMonth(d.getMonth() + n); return d.toISOString().split('T')[0]; };

  const allFestivals = [
    [`New Year's Day`,       `${year}-01-01`, `${year+1}-01-01`],
    [`Valentine's Day`,      `${year}-02-14`, `${year+1}-02-14`],
    [`Good Friday`,          `${year}-04-18`, `${year+1}-04-03`],
    [`Easter Sunday`,        `${year}-04-20`, `${year+1}-04-05`],
    [`Spring Bank Holiday`,  `${year}-05-26`, `${year+1}-05-25`],
    [`Summer Bank Holiday`,  `${year}-08-25`, `${year+1}-08-31`],
    [`Halloween`,            `${year}-10-31`, `${year+1}-10-31`],
    [`Christmas Day`,        `${year}-12-25`, `${year+1}-12-25`],
    [`Boxing Day`,           `${year}-12-26`, `${year+1}-12-26`],
    [`New Year's Eve`,       `${year}-12-31`, `${year+1}-12-31`],
    [`Holi`,                 `${year}-03-14`, `${year+1}-03-03`],
    [`Baisakhi`,             `${year}-04-14`, `${year+1}-04-14`],
    [`Eid ul-Fitr`,          `${year}-03-31`, `${year+1}-03-20`],
    [`Eid ul-Adha`,          `${year}-06-07`, `${year+1}-05-27`],
    [`Raksha Bandhan`,       `${year}-08-09`, `${year+1}-07-29`],
    [`Independence Day India`,`${year}-08-15`, `${year+1}-08-15`],
    [`Ganesh Chaturthi`,     `${year}-08-27`, `${year+1}-08-16`],
    [`Navratri`,             `${year}-10-02`, `${year+1}-09-22`],
    [`Dussehra`,             `${year}-10-02`, `${year+1}-10-02`],
    [`Diwali`,               `${year}-10-20`, `${year+1}-11-08`],
    [`Guru Nanak Jayanti`,   `${year}-11-05`, `${year+1}-11-25`],
  ].map(([name, d1, d2]) => {
    const use = new Date(d1) >= now ? d1 : (new Date(d2) >= now ? d2 : d1);
    const msUntil = new Date(use) - now;
    const daysUntil = Math.ceil(msUntil / 86400000);
    return `${name}: ${use}${daysUntil > 0 ? ' (in ' + daysUntil + ' days)' : ' (today/past)'}`;
  }).join('\n');

  return `You are the British Airways AI Assistant — an expert, empathetic voice assistant for a mobile flight booking app.

TODAY: ${fullDate} at ${timeStr}

UPCOMING FESTIVALS & DATES:
${allFestivals}

ROUTES YOU SERVE (mock data, always available):
LHR→JFK (New York), LHR→DXB (Dubai), LHR→NRT (Tokyo), LHR→SYD (Sydney), LHR→BCN (Barcelona), LHR→BOM (Mumbai)

CABINS: economy, premium_economy, business (Club World), first

YOUR JOB:
1. Extract flight intent in ONE shot from natural language. Resolve festival/holiday references to real dates.
2. Collect passenger details step-by-step via voice: firstName, lastName, phone, nationality.
3. Guide the user with two-option choices when needed (one-way vs return, cabin class, etc).
4. When all info gathered, trigger the booking action.

RESPONSE FORMAT — always return valid JSON:
{
  "intent": "book_flight" | "check_in" | "flight_status" | "manage_booking" | "avios_query" | "general_chat" | "collect_passenger_field" | "confirm_booking" | "navigate" | "unknown",
  "entities": {
    "from": "IATA or null",
    "to": "IATA or null",
    "destination": "city name or null",
    "departureDate": "YYYY-MM-DD or null",
    "returnDate": "YYYY-MM-DD or null",
    "tripType": "one_way | return | null",
    "adults": number or null,
    "children": number or null,
    "cabin": "economy | premium_economy | business | first | null",
    "flightNumber": "string or null",
    "bookingRef": "string or null"
  },
  "passengerField": {
    "field": "firstName | lastName | phone | nationality | null",
    "value": "extracted value or null"
  },
  "action": {
    "type": "navigate | prefill_booking | speak | confirm | ask_choice | collect_field | none",
    "screen": "Home | BookFlight | ManageBooking | CheckIn | FlightStatus | Destinations | ExecutiveClub | null",
    "choices": ["option1", "option2"] or null
  },
  "response": "What the assistant says aloud — warm, concise, professional",
  "confidence": 0.0 to 1.0
}

RULES:
- Always resolve festival names to actual YYYY-MM-DD dates using the list above.
- "Christmas" → ${year}-12-25, "New Year" → ${year+1}-01-01, etc.
- LHR is the default departure airport unless user says otherwise.
- "Business class" = "business", "Club World" = "business", "First" = "first".
- For passenger collection, extract the field value clearly from the user's speech.
- Keep spoken responses SHORT — under 20 words when guiding, under 40 words for explanations.
- Be warm, confident, and British in tone.
- Never hallucinate prices — say "prices shown on next screen".`;
}

// ── Retry helper ─────────────────────────────────────────────────
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(status) {
  return !status || status === 429 || status >= 500;
}

// ── Local fallback NLP (no API) ──────────────────────────────────
function localFallback(text) {
  const t = text.toLowerCase();
  const CITY_MAP = {
    'new york': 'JFK', 'nyc': 'JFK', 'jfk': 'JFK',
    'dubai': 'DXB', 'tokyo': 'NRT', 'sydney': 'SYD',
    'barcelona': 'BCN', 'mumbai': 'BOM', 'london': 'LHR',
  };
  let to = null;
  for (const [city, code] of Object.entries(CITY_MAP)) {
    if (t.includes(city)) { to = code; break; }
  }

  const cabin =
    t.includes('business') || t.includes('club world') ? 'business' :
    t.includes('first') ? 'first' :
    t.includes('premium') ? 'premium_economy' : 'economy';

  const adults = t.match(/(\d+)\s*(adult|passenger|people|person)/) 
    ? parseInt(t.match(/(\d+)\s*(adult|passenger|people|person)/)[1]) : 1;

  if (to) {
    return {
      intent: 'book_flight',
      entities: { from: 'LHR', to, destination: null, departureDate: null, returnDate: null, tripType: null, adults, children: null, cabin, flightNumber: null, bookingRef: null },
      passengerField: { field: null, value: null },
      action: { type: 'prefill_booking', screen: 'BookFlight', choices: null },
      response: `Sure! Let me find flights to ${to} for you.`,
      confidence: 0.6,
    };
  }

  if (t.includes('check in') || t.includes('check-in')) {
    return {
      intent: 'check_in',
      entities: { from: null, to: null, destination: null, departureDate: null, returnDate: null, tripType: null, adults: null, children: null, cabin: null, flightNumber: null, bookingRef: null },
      passengerField: { field: null, value: null },
      action: { type: 'navigate', screen: 'CheckIn', choices: null },
      response: "I'll take you to check-in. What's your booking reference?",
      confidence: 0.85,
    };
  }

  return {
    intent: 'general_chat',
    entities: { from: null, to: null, destination: null, departureDate: null, returnDate: null, tripType: null, adults: null, children: null, cabin: null, flightNumber: null, bookingRef: null },
    passengerField: { field: null, value: null },
    action: { type: 'none', screen: null, choices: null },
    response: "I can help you book a flight, check in, or check flight status. What would you like to do?",
    confidence: 0.4,
  };
}

// ── Main processVoiceInput ────────────────────────────────────────
export async function processVoiceInput(userText, conversationHistory = []) {
  const myRequestId = ++currentRequestId;
  log('Request', myRequestId, ':', userText);

  if (!API_KEY) {
    logError('No API key — using local fallback');
    return localFallback(userText);
  }

  // Cap history
  const cappedHistory = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...cappedHistory,
    { role: 'user', content: userText },
  ];

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (myRequestId !== currentRequestId) {
      log('Stale request', myRequestId, '— aborting');
      return null;
    }

    if (attempt > 0) {
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          max_tokens: 600,
          temperature: 0.15,
          response_format: { type: 'json_object' },
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        lastError.status = res.status;
        if (!isRetryable(res.status)) break;
        continue;
      }

      const data = await res.json();

      if (myRequestId !== currentRequestId) {
        log('Stale response', myRequestId, '— discarding');
        return null;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq');

      const parsed = JSON.parse(content);
      log('Parsed response:', parsed);

      // Validate and fill defaults
      return {
        intent:  parsed.intent  || 'general_chat',
        entities: {
          from:          parsed.entities?.from          || null,
          to:            parsed.entities?.to            || null,
          destination:   parsed.entities?.destination   || null,
          departureDate: parsed.entities?.departureDate || null,
          returnDate:    parsed.entities?.returnDate    || null,
          tripType:      parsed.entities?.tripType      || null,
          adults:        parsed.entities?.adults        || 1,
          children:      parsed.entities?.children      || 0,
          cabin:         parsed.entities?.cabin         || 'economy',
          flightNumber:  parsed.entities?.flightNumber  || null,
          bookingRef:    parsed.entities?.bookingRef    || null,
        },
        passengerField: {
          field: parsed.passengerField?.field || null,
          value: parsed.passengerField?.value || null,
        },
        action: {
          type:    parsed.action?.type    || 'none',
          screen:  parsed.action?.screen  || null,
          choices: parsed.action?.choices || null,
        },
        response:   parsed.response   || 'How can I help you?',
        confidence: parsed.confidence ?? 0.8,
      };

    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (err.name === 'AbortError') {
        logError('Request timed out on attempt', attempt + 1);
        continue;
      }
      if (err instanceof SyntaxError) {
        logError('JSON parse error — using fallback');
        break;
      }
      logError('Fetch error on attempt', attempt + 1, ':', err.message);
    }
  }

  logError('All attempts failed — using local fallback. Last error:', lastError?.message);
  return localFallback(userText);
}
