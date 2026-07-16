/**
 * aiService.js  (exported as geminiService for backward compat)
 *
 * Uses Groq API — llama-3.1-70b-versatile for maximum intelligence.
 * Knows UK + Indian festivals, resolves festival names to exact dates,
 * recommends destinations, and pre-fills booking with smart date logic.
 */

const API_KEY  = import.meta.env.VITE_GEMINI_API_KEY;
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
// Use the larger model for better date/festival reasoning
const MODEL    = 'llama-3.1-70b-versatile';

// ── Build current date context dynamically ────────────────────────
function buildSystemPrompt() {
  const now     = new Date();
  const today   = now.toISOString().split('T')[0];
  const year    = now.getFullYear();
  const month   = now.getMonth() + 1; // 1-12

  // Pre-compute festival dates for current & next year
  // UK festivals (fixed dates)
  const UK_FESTIVALS = [
    { name: "New Year's Day",          date: `${year}-01-01`, alt: `${year+1}-01-01` },
    { name: "Valentine's Day",         date: `${year}-02-14`, alt: `${year+1}-02-14` },
    { name: "St Patrick's Day",        date: `${year}-03-17`, alt: `${year+1}-03-17` },
    { name: "Easter",                  date: `${year}-04-20`, alt: `${year+1}-04-13` },
    { name: "May Bank Holiday",        date: `${year}-05-05`, alt: `${year+1}-05-04` },
    { name: "Summer Bank Holiday",     date: `${year}-08-25`, alt: `${year+1}-08-31` },
    { name: "Halloween",               date: `${year}-10-31`, alt: `${year+1}-10-31` },
    { name: "Guy Fawkes / Bonfire Night", date: `${year}-11-05`, alt: `${year+1}-11-05` },
    { name: "Christmas Day",           date: `${year}-12-25`, alt: `${year+1}-12-25` },
    { name: "Boxing Day",              date: `${year}-12-26`, alt: `${year+1}-12-26` },
    { name: "New Year's Eve",          date: `${year}-12-31`, alt: `${year+1}-12-31` },
  ];

  // Indian festivals (approximate fixed dates; some are lunar so vary slightly)
  const INDIAN_FESTIVALS = [
    { name: "Makar Sankranti / Lohri", date: `${year}-01-14`, alt: `${year+1}-01-14` },
    { name: "Republic Day India",      date: `${year}-01-26`, alt: `${year+1}-01-26` },
    { name: "Holi",                    date: `${year}-03-14`, alt: `${year+1}-03-04` },
    { name: "Ram Navami",              date: `${year}-04-06`, alt: `${year+1}-03-27` },
    { name: "Eid ul-Fitr",            date: `${year}-03-31`, alt: `${year+1}-03-20` },
    { name: "Eid ul-Adha",            date: `${year}-06-07`, alt: `${year+1}-05-27` },
    { name: "Raksha Bandhan",          date: `${year}-08-09`, alt: `${year+1}-07-29` },
    { name: "Independence Day India",  date: `${year}-08-15`, alt: `${year+1}-08-15` },
    { name: "Janmashtami",             date: `${year}-08-16`, alt: `${year+1}-08-05` },
    { name: "Ganesh Chaturthi",        date: `${year}-08-27`, alt: `${year+1}-08-16` },
    { name: "Navratri begins",         date: `${year}-10-02`, alt: `${year+1}-09-22` },
    { name: "Dussehra / Vijayadashami", date: `${year}-10-02`, alt: `${year+1}-10-02` },
    { name: "Karva Chauth",            date: `${year}-10-20`, alt: `${year+1}-10-09` },
    { name: "Diwali / Deepavali",      date: `${year}-10-20`, alt: `${year+1}-11-08` },
    { name: "Bhai Dooj",               date: `${year}-10-22`, alt: `${year+1}-11-10` },
    { name: "Guru Nanak Jayanti",      date: `${year}-11-05`, alt: `${year+1}-11-25` },
    { name: "Chhath Puja",             date: `${year}-10-28`, alt: `${year+1}-10-17` },
    { name: "Christmas (India)",       date: `${year}-12-25`, alt: `${year+1}-12-25` },
  ];

  const allFestivals = [...UK_FESTIVALS, ...INDIAN_FESTIVALS]
    .map(f => {
      // Pick the soonest upcoming date (today or future)
      const d1 = new Date(f.date);
      const d2 = new Date(f.alt);
      const use = d1 >= now ? f.date : (d2 >= now ? f.alt : f.date);
      return `  - ${f.name}: ${use}`;
    })
    .join('\n');

  return `You are the British Airways voice assistant — intelligent, warm, and deeply knowledgeable about travel, dates, and cultural festivals.

TODAY'S DATE AND TIME: ${now.toISOString()} (${now.toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' })})
CURRENT YEAR: ${year}
CURRENT MONTH: ${month}

═══════════════════════════════════════════
DATE & FESTIVAL INTELLIGENCE RULES:
═══════════════════════════════════════════
When a user mentions a festival, holiday, or relative date, you MUST resolve it to an exact YYYY-MM-DD date.

UPCOMING UK & INDIAN FESTIVALS (use these exact dates):
${allFestivals}

DATE RESOLUTION EXAMPLES:
- "Christmas" → departureDate: "${year}-12-20" (travel before, return "${year}-12-28")
- "Diwali" → look up Diwali date above, depart 2 days before
- "Holi" → look up Holi date above
- "New Year" → departureDate: "${year}-12-29", returnDate: "${year+1}-01-03"
- "summer holidays" → departureDate: "${year}-07-20", returnDate: "${year}-08-10"
- "Easter break" → depart 2 days before Easter, return 1 week later
- "next month" → first day of next month
- "next week" → next Monday's date
- "this weekend" → next Saturday

SMART DESTINATION SUGGESTIONS BY FESTIVAL:
- Christmas → suggest: New York (JFK), Dubai (DXB), Sydney (SYD) — festive and warm
- Diwali → suggest: Mumbai (BOM), Delhi (DEL), London (LHR for NRI)
- Holi → suggest: Mumbai (BOM), Delhi (DEL)  
- Eid → suggest: Dubai (DXB), Istanbul (IST), Mumbai (BOM)
- Summer → suggest: Barcelona (BCN), Dubai (DXB), Singapore (SIN)
- New Year → suggest: New York (JFK), Dubai (DXB), Sydney (SYD)
- Easter → suggest: Barcelona (BCN), Rome (FCO), Amsterdam (AMS)

═══════════════════════════════════════════
FLIGHT ROUTES AVAILABLE:
═══════════════════════════════════════════
LHR→JFK, LHR→DXB, LHR→NRT, LHR→SYD, LHR→SIN, LHR→BCN (and all reverses)
Extra Indian routes: LHR→BOM, LHR→DEL (map Delhi to BOM as closest available)

AIRPORT CODES:
London Heathrow=LHR, New York=JFK, Dubai=DXB, Tokyo=NRT, Sydney=SYD,
Singapore=SIN, Barcelona=BCN, Paris=CDG, Amsterdam=AMS, Rome=FCO,
Mumbai=BOM, Istanbul=IST, Cape Town=CPT, Madrid=MAD, Frankfurt=FRA

═══════════════════════════════════════════
PASSENGER COLLECTION FLOW:
═══════════════════════════════════════════
When collecting passenger details, ask ONE field at a time:
1. firstName, 2. lastName, 3. email, 4. phone, 5. dob, 6. passport, 7. nationality

Use intent "COLLECT_PASSENGER" to start.
For each answer use intent "PASSENGER_FIELD" with passengerField object.
When allCollected=true → action: {"type":"PREFILL_BOOKING","passenger":{...}}

═══════════════════════════════════════════
CAPABILITIES:
═══════════════════════════════════════════
- Book flights (resolve festival dates automatically)
- Online check-in (needs booking reference + surname)
- Flight status (e.g. BA117, BA204)
- Manage bookings: seats, bags, upgrades, cancellations
- Executive Club & Avios
- Suggest best destinations for festivals/seasons
- Answer: "When is Diwali?", "Book me a flight for Christmas", "I want to go home for Eid"

═══════════════════════════════════════════
RESPONSE FORMAT — ALWAYS valid JSON only:
═══════════════════════════════════════════
{
  "intent": "BOOK_FLIGHT" | "CHECK_IN" | "FLIGHT_STATUS" | "MANAGE_BOOKING" | "DESTINATIONS" | "EXECUTIVE_CLUB" | "HELP" | "COLLECT_PASSENGER" | "PASSENGER_FIELD" | "UNKNOWN",
  "text": "<warm natural reply — mention the resolved date if booking for a festival>",
  "quickReplies": ["...", "..."],
  "action": null | {"type":"NAVIGATE","path":"/book"} | {"type":"PREFILL_BOOKING","passenger":{}},
  "entities": {
    "from": "LHR",
    "to": "JFK",
    "departureDate": "YYYY-MM-DD",
    "returnDate": "YYYY-MM-DD",
    "adults": 1,
    "cabin": "economy",
    "festival": "Christmas"
  },
  "passengerField": null | {"field":"firstName","value":"John","nextField":"lastName","allCollected":false}
}

CRITICAL RULES:
1. ALWAYS output ONLY valid JSON — no markdown, no prose outside JSON.
2. When user mentions a festival → resolve to exact dates in entities.departureDate.
3. text must be warm, British, conversational — mention the festival and the dates you resolved.
4. quickReplies max 5 items, max 4 words each.
5. Never invent flight prices or booking references.
6. If asked about a festival date, tell the user the date AND offer to book.`;
}

// System prompt is built once per session (captures today's date correctly)
const SYSTEM_PROMPT = buildSystemPrompt();

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
        temperature: 0.4,   // lower = more consistent date resolution
        max_tokens:  600,
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
