/**
 * geminiService.js
 *
 * Google Gemini API client for the British Airways voice assistant.
 *
 * Architecture:
 *  - One persistent chat session per VoiceAgent mount (history array passed each call)
 *  - Every response is a strict JSON object so the UI can act on structured data
 *  - Falls back gracefully if the API key is missing or the call fails
 *
 * Response schema Gemini must return (enforced in the system prompt):
 * {
 *   "intent": "BOOK_FLIGHT" | "CHECK_IN" | "FLIGHT_STATUS" | "MANAGE_BOOKING" |
 *             "DESTINATIONS" | "EXECUTIVE_CLUB" | "BAGGAGE" | "UPGRADE" |
 *             "REFUND_CANCEL" | "LOUNGE" | "PASSPORT_VISA" | "MEAL" | "SEAT" |
 *             "CONTACT" | "HELP" | "COLLECT_PASSENGER" | "PASSENGER_FIELD" | "UNKNOWN",
 *   "text": "<natural language reply to speak/show>",
 *   "quickReplies": ["...", "..."],          // optional, max 5
 *   "action": {                              // optional
 *     "type": "NAVIGATE",
 *     "path": "/book?from=LHR&to=JFK&..."
 *   },
 *   "entities": {                            // optional, extracted facts
 *     "from": "LHR",
 *     "to": "JFK",
 *     "departureDate": "2026-08-15",
 *     "returnDate": "2026-08-22",
 *     "adults": 1,
 *     "cabin": "economy",
 *     "flightNumber": "BA117",
 *     "bookingRef": "XYMBA1",
 *     "surname": "Wilson"
 *   },
 *   "passengerField": {                      // present only during passenger collection
 *     "field": "firstName" | "lastName" | "email" | "phone" | "dob" | "passport" | "nationality",
 *     "value": "<extracted value>",
 *     "nextField": "<next field to ask for or null>",
 *     "allCollected": false
 *   }
 * }
 */

const API_KEY  = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL    = 'gemini-2.0-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

// ── System prompt ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the British Airways voice assistant — a warm, professional AI agent embedded in the BA mobile/web app.

TODAY'S DATE: ${new Date().toISOString().split('T')[0]}

YOUR CAPABILITIES:
- Search & book flights (routes: LHR→JFK, LHR→DXB, LHR→NRT, LHR→SYD, LHR→SIN, LHR→BCN and reverse)
- Online check-in (needs booking reference + surname)
- Real-time flight status (e.g. BA117, BA204, BA016)
- Manage bookings: seat selection, baggage, upgrades, cancellations
- Executive Club & Avios information
- Baggage allowances, meal preferences, lounge access
- Visa/passport guidance, contact details
- COLLECT PASSENGER DETAILS via voice — ask field by field, confirm, then pre-fill the booking form

AIRPORT CODES (use these in entities):
London Heathrow=LHR, London Gatwick=LGW, New York JFK=JFK, Newark=EWR,
Los Angeles=LAX, Paris CDG=CDG, Dubai=DXB, Tokyo Narita=NRT, Sydney=SYD,
Singapore Changi=SIN, Hong Kong=HKG, Barcelona=BCN, Madrid=MAD, Rome=FCO,
Amsterdam=AMS, Frankfurt=FRA, Cape Town=CPT, Mumbai=BOM, Istanbul=IST,
Chicago O'Hare=ORD, Miami=MIA, Boston=BOS

PASSENGER COLLECTION FLOW:
When a user wants to book and you need passenger details, use intent "COLLECT_PASSENGER".
Then ask for each field ONE AT A TIME in this order:
  1. firstName  — "What is your first name?"
  2. lastName   — "What is your last name?"
  3. email      — "What is your email address?"
  4. phone      — "What is your phone number including country code?"
  5. dob        — "What is your date of birth? Please say day, month, year."
  6. passport   — "What is your passport number?"
  7. nationality — "What is your nationality or passport issuing country?"

For each answer use intent "PASSENGER_FIELD" and set passengerField.field, passengerField.value,
passengerField.nextField (next field name or null if done), passengerField.allCollected (true only after nationality).

When passengerField.allCollected is true, include an action:
  { "type": "PREFILL_BOOKING", "passenger": { ...all collected fields } }
and set intent to "BOOK_FLIGHT".

DATE NORMALISATION: Convert spoken dates to YYYY-MM-DD. "next Friday" = compute from today.
DOB NORMALISATION: "15th March 1990" → "1990-03-15"
PHONE NORMALISATION: "zero seven nine one two..." → "+447912..."

IMPORTANT RULES:
1. ALWAYS respond with ONLY valid JSON matching the schema. No markdown, no prose outside JSON.
2. Keep "text" concise and natural — it will be read aloud. No bullet points in "text".
3. quickReplies must be short (max 4 words each), max 5 items.
4. Never make up flight prices or booking references.
5. For navigation actions, build the path with all available entities as query params.
6. Be warm and British in tone. Use "brilliant", "lovely", "certainly" occasionally.`;

// ── Build a Gemini request body from conversation history ──────────
function buildRequestBody(history, userMessage) {
  // Gemini takes alternating user/model turns
  const contents = [];

  // Inject system prompt as first user turn + model ack (Gemini 1.5+ supports systemInstruction)
  for (const turn of history) {
    contents.push({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.text }],
    });
  }

  // Append current user message
  contents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  return {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };
}

// ── Parse and validate the Gemini response ─────────────────────────
function parseGeminiResponse(raw) {
  try {
    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Strip any accidental markdown fences
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed  = JSON.parse(cleaned);

    // Ensure required fields exist
    return {
      intent:         parsed.intent        || 'UNKNOWN',
      text:           parsed.text          || "I'm sorry, I didn't quite catch that. Could you try again?",
      quickReplies:   Array.isArray(parsed.quickReplies) ? parsed.quickReplies.slice(0, 5) : [],
      action:         parsed.action        || null,
      entities:       parsed.entities      || {},
      passengerField: parsed.passengerField || null,
    };
  } catch {
    return {
      intent: 'UNKNOWN',
      text: "I'm having a little trouble understanding. Could you rephrase that?",
      quickReplies: ['Book a flight', 'Check in', 'Flight status', 'Help'],
      action: null,
      entities: {},
      passengerField: null,
    };
  }
}

// ── Fallback response when API key is missing ──────────────────────
function fallbackResponse(userText) {
  const lower = userText.toLowerCase();
  if (/book|flight|fly/.test(lower))
    return { intent: 'BOOK_FLIGHT', text: "I'd love to help you book a flight! Please visit the Book page to search for available flights.", quickReplies: ['Open booking', 'Search flights'], action: { type: 'NAVIGATE', path: '/book' }, entities: {}, passengerField: null };
  if (/check.?in/.test(lower))
    return { intent: 'CHECK_IN', text: 'Online check-in is available 24 hours before your flight. Tap below to get started.', quickReplies: ['Check in now'], action: { type: 'NAVIGATE', path: '/check-in' }, entities: {}, passengerField: null };
  if (/status/.test(lower))
    return { intent: 'FLIGHT_STATUS', text: 'Let me take you to the flight status page.', quickReplies: ['Track a flight'], action: { type: 'NAVIGATE', path: '/flight-status' }, entities: {}, passengerField: null };
  return { intent: 'HELP', text: 'To use the full AI assistant, please add your Gemini API key to .env.local as VITE_GEMINI_API_KEY.', quickReplies: ['Book a flight', 'Check in', 'Flight status', 'Destinations'], action: null, entities: {}, passengerField: null };
}

// ── Main export: send a message and get a structured response ──────
export async function sendToGemini(userMessage, history = []) {
  if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
    console.warn('[geminiService] No API key — using fallback responses.');
    return fallbackResponse(userMessage);
  }

  try {
    const body     = buildRequestBody(history, userMessage);
    const response = await fetch(ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[geminiService] API error:', response.status, err);
      throw new Error(`Gemini API error ${response.status}`);
    }

    const data = await response.json();
    return parseGeminiResponse(data);

  } catch (err) {
    console.error('[geminiService] Request failed:', err);
    return {
      intent: 'UNKNOWN',
      text: "I'm having trouble connecting right now. Please try again in a moment.",
      quickReplies: ['Try again', 'Book a flight', 'Help'],
      action: null,
      entities: {},
      passengerField: null,
    };
  }
}
