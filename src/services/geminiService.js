/**
 * aiService.js  (still exported as geminiService for backward compat)
 *
 * Uses Groq API (free tier — 14,400 req/day, no card needed).
 * Model: llama-3.1-8b-instant  — fast, intelligent, free.
 *
 * Drop-in replacement for the Gemini service — same exported function,
 * same response schema, same fallback behaviour.
 */

const API_KEY  = import.meta.env.VITE_GEMINI_API_KEY; // reusing same env var
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.1-8b-instant';

// ── System prompt ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the British Airways voice assistant — a warm, professional AI agent.

TODAY'S DATE: ${new Date().toISOString().split('T')[0]}

YOUR CAPABILITIES:
- Search & book flights (routes: LHR→JFK, LHR→DXB, LHR→NRT, LHR→SYD, LHR→SIN, LHR→BCN and reverse)
- Online check-in (needs booking reference + surname)
- Real-time flight status (e.g. BA117, BA204, BA016)
- Manage bookings: seat selection, baggage, upgrades, cancellations
- Executive Club & Avios information
- COLLECT PASSENGER DETAILS via voice — ask field by field

AIRPORT CODES:
London Heathrow=LHR, London Gatwick=LGW, New York JFK=JFK, Newark=EWR,
Los Angeles=LAX, Paris CDG=CDG, Dubai=DXB, Tokyo Narita=NRT, Sydney=SYD,
Singapore=SIN, Hong Kong=HKG, Barcelona=BCN, Madrid=MAD, Rome=FCO,
Amsterdam=AMS, Frankfurt=FRA, Cape Town=CPT, Mumbai=BOM, Istanbul=IST,
Chicago=ORD, Miami=MIA, Boston=BOS

PASSENGER COLLECTION FLOW:
When user wants to book and needs passenger details, use intent "COLLECT_PASSENGER".
Ask for each field ONE AT A TIME:
1. firstName, 2. lastName, 3. email, 4. phone, 5. dob, 6. passport, 7. nationality

For each answer use intent "PASSENGER_FIELD" and set:
passengerField.field, passengerField.value, passengerField.nextField (or null), passengerField.allCollected (true only after nationality).

When allCollected=true, add action: {"type":"PREFILL_BOOKING","passenger":{...all fields}} and set intent "BOOK_FLIGHT".

IMPORTANT: ALWAYS respond with ONLY valid JSON in this exact schema:
{
  "intent": "BOOK_FLIGHT" | "CHECK_IN" | "FLIGHT_STATUS" | "MANAGE_BOOKING" | "DESTINATIONS" | "EXECUTIVE_CLUB" | "HELP" | "COLLECT_PASSENGER" | "PASSENGER_FIELD" | "UNKNOWN",
  "text": "<natural reply to speak aloud — no bullet points>",
  "quickReplies": ["...", "..."],
  "action": null | {"type": "NAVIGATE", "path": "/book"} | {"type": "PREFILL_BOOKING", "passenger": {}},
  "entities": {"from":"LHR","to":"JFK","departureDate":"2026-08-15","adults":1,"cabin":"economy"},
  "passengerField": null | {"field":"firstName","value":"John","nextField":"lastName","allCollected":false}
}

Be warm and British. Keep "text" under 2 sentences. No markdown in text.`;

// ── Build messages array from history ─────────────────────────────
function buildMessages(history, userMessage) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  for (const turn of history) {
    messages.push({
      role:    turn.role === 'user' ? 'user' : 'assistant',
      content: turn.text,
    });
  }

  messages.push({ role: 'user', content: userMessage });
  return messages;
}

// ── Parse the response ────────────────────────────────────────────
function parseResponse(raw) {
  try {
    const text    = raw?.choices?.[0]?.message?.content || '';
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed  = JSON.parse(cleaned);
    return {
      intent:         parsed.intent        || 'UNKNOWN',
      text:           parsed.text          || "I'm sorry, I didn't catch that. Could you try again?",
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
      action: null, entities: {}, passengerField: null,
    };
  }
}

// ── Fallback when no API key ──────────────────────────────────────
function fallbackResponse(userText) {
  const lower = userText.toLowerCase();
  if (/book|flight|fly/.test(lower))
    return { intent: 'BOOK_FLIGHT', text: "I'd love to help you book a flight! Tap below to search.", quickReplies: ['Search flights'], action: { type: 'NAVIGATE', path: '/book' }, entities: {}, passengerField: null };
  if (/check.?in/.test(lower))
    return { intent: 'CHECK_IN', text: 'Check-in opens 24 hours before your flight.', quickReplies: ['Check in now'], action: { type: 'NAVIGATE', path: '/check-in' }, entities: {}, passengerField: null };
  if (/status/.test(lower))
    return { intent: 'FLIGHT_STATUS', text: "Let me check that flight's status.", quickReplies: ['Track flight'], action: { type: 'NAVIGATE', path: '/flight-status' }, entities: {}, passengerField: null };
  if (/destination|where|holiday/.test(lower))
    return { intent: 'DESTINATIONS', text: 'We fly to amazing destinations worldwide!', quickReplies: ['Explore destinations'], action: { type: 'NAVIGATE', path: '/destinations' }, entities: {}, passengerField: null };
  return { intent: 'HELP', text: 'I can help with booking, check-in, flight status and more. What would you like to do?', quickReplies: ['Book a flight', 'Check in', 'Flight status', 'Destinations'], action: null, entities: {}, passengerField: null };
}

// ── Main export ───────────────────────────────────────────────────
export async function sendToGemini(userMessage, history = []) {
  if (!API_KEY || API_KEY === 'your_groq_api_key_here') {
    console.warn('[aiService] No API key — using fallback.');
    return fallbackResponse(userMessage);
  }

  try {
    const response = await fetch(ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model:       MODEL,
        messages:    buildMessages(history, userMessage),
        temperature: 0.7,
        max_tokens:  512,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[aiService] Groq API error:', response.status, err);
      throw new Error(`Groq API error ${response.status}`);
    }

    const data = await response.json();
    return parseResponse(data);

  } catch (err) {
    console.error('[aiService] Request failed:', err);
    return {
      intent: 'UNKNOWN',
      text: "I'm having trouble connecting right now. Please try again in a moment.",
      quickReplies: ['Try again', 'Book a flight', 'Help'],
      action: null, entities: {}, passengerField: null,
    };
  }
}
