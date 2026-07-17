/**
 * aiService.js (exported as geminiService for backward compat)
 *
 * Groq API - llama-3.3-70b-versatile
 * Features:
 *  - Single-shot full booking extraction from one utterance
 *  - TWO_OPTIONS intent for binary voice/tap choices
 *  - PASSENGER_FIELD: extract ALL fields at once OR field-by-field
 *  - Festival/date resolution for UK + Indian holidays
 */

const API_KEY  = import.meta.env.VITE_GEMINI_API_KEY;
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.3-70b-versatile';

function buildSystemPrompt() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const UK_FESTIVALS = [
    { name: "New Year's Day",      date: `${year}-01-01`, alt: `${year+1}-01-01` },
    { name: "Valentine's Day",     date: `${year}-02-14`, alt: `${year+1}-02-14` },
    { name: "St Patrick's Day",    date: `${year}-03-17`, alt: `${year+1}-03-17` },
    { name: "Easter",              date: `${year}-04-20`, alt: `${year+1}-04-13` },
    { name: "May Bank Holiday",    date: `${year}-05-05`, alt: `${year+1}-05-04` },
    { name: "Summer Bank Holiday", date: `${year}-08-25`, alt: `${year+1}-08-31` },
    { name: "Halloween",           date: `${year}-10-31`, alt: `${year+1}-10-31` },
    { name: "Bonfire Night",       date: `${year}-11-05`, alt: `${year+1}-11-05` },
    { name: "Christmas",           date: `${year}-12-25`, alt: `${year+1}-12-25` },
    { name: "Boxing Day",          date: `${year}-12-26`, alt: `${year+1}-12-26` },
    { name: "New Year's Eve",      date: `${year}-12-31`, alt: `${year+1}-12-31` },
  ];

  const INDIAN_FESTIVALS = [
    { name: "Makar Sankranti",        date: `${year}-01-14`, alt: `${year+1}-01-14` },
    { name: "Republic Day India",     date: `${year}-01-26`, alt: `${year+1}-01-26` },
    { name: "Holi",                   date: `${year}-03-14`, alt: `${year+1}-03-04` },
    { name: "Ram Navami",             date: `${year}-04-06`, alt: `${year+1}-03-27` },
    { name: "Eid ul-Fitr",           date: `${year}-03-31`, alt: `${year+1}-03-20` },
    { name: "Eid ul-Adha",           date: `${year}-06-07`, alt: `${year+1}-05-27` },
    { name: "Raksha Bandhan",         date: `${year}-08-09`, alt: `${year+1}-07-29` },
    { name: "Independence Day India", date: `${year}-08-15`, alt: `${year+1}-08-15` },
    { name: "Janmashtami",            date: `${year}-08-16`, alt: `${year+1}-08-05` },
    { name: "Ganesh Chaturthi",       date: `${year}-08-27`, alt: `${year+1}-08-16` },
    { name: "Navratri",               date: `${year}-10-02`, alt: `${year+1}-09-22` },
    { name: "Dussehra",               date: `${year}-10-02`, alt: `${year+1}-10-02` },
    { name: "Karva Chauth",           date: `${year}-10-20`, alt: `${year+1}-10-09` },
    { name: "Diwali",                 date: `${year}-10-20`, alt: `${year+1}-11-08` },
    { name: "Bhai Dooj",              date: `${year}-10-22`, alt: `${year+1}-11-10` },
    { name: "Guru Nanak Jayanti",     date: `${year}-11-05`, alt: `${year+1}-11-25` },
    { name: "Chhath Puja",            date: `${year}-10-28`, alt: `${year+1}-10-17` },
  ];

  const festivalList = [...UK_FESTIVALS, ...INDIAN_FESTIVALS].map(f => {
    const d1 = new Date(f.date);
    const d2 = new Date(f.alt);
    const use = d1 >= now ? f.date : (d2 >= now ? f.alt : f.date);
    return `  - ${f.name}: ${use}`;
  }).join('\n');

  return `You are the British Airways intelligent voice assistant. You understand natural speech perfectly including full sentences, festivals, and multiple facts spoken in one breath.

TODAY: ${now.toISOString()} (${now.toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' })})
YEAR: ${year} | MONTH: ${month}

FESTIVALS AND DATES (resolve automatically):
${festivalList}

DATE RULES:
- "Christmas" -> depart ${year}-12-20, return ${year}-12-28
- "Diwali" -> depart 2 days before Diwali, return 7 days after
- "Holi" -> depart 2 days before, return 5 days after
- "Eid" -> depart 1 day before, return 7 days after
- "New Year" -> depart ${year}-12-29, return ${year+1}-01-03
- "summer holidays" -> depart ${year}-07-20, return ${year}-08-10
- "Easter" -> depart 2 days before Easter, return 1 week after
- "next weekend" -> next Saturday
- "next week" -> next Monday
- "next month" -> 1st of next month

DESTINATION SUGGESTIONS:
- Christmas/New Year -> JFK, DXB, SYD
- Diwali/Holi -> BOM (Mumbai)
- Eid -> DXB, IST, BOM
- Summer -> BCN, DXB, SIN
- Easter -> BCN, FCO, AMS

ROUTES AND AIRPORTS:
Routes: LHR-JFK, LHR-DXB, LHR-NRT, LHR-SYD, LHR-SIN, LHR-BCN, LHR-BOM
Codes: LHR=London, JFK=New York, DXB=Dubai, NRT=Tokyo, SYD=Sydney, SIN=Singapore, BCN=Barcelona, BOM=Mumbai, CDG=Paris, AMS=Amsterdam, FCO=Rome, IST=Istanbul, CPT=Cape Town, MAD=Madrid

SINGLE-SHOT BOOKING INTELLIGENCE (FULL - flight + passenger in ONE sentence):
When user picks "one shot" or "book in one go", respond with:
intent: "BOOK_FLIGHT"
text: "Brilliant! Say everything in one sentence. For example: London to New York, 20th December return 28th December, business class, 2 adults. My name is John Smith, email johnsmith@example.com, phone 07912345678, born 15 March 1990, passport AB123456, British."
quickReplies: ["Ready, listening"]
action: null

When user then speaks a sentence containing BOTH flight info AND personal details, extract ALL at once:
FLIGHT: from, to, departureDate, returnDate, adults, cabin, tripType
PASSENGER: firstName, lastName, email, phone, dob, passport, nationality

PASSENGER EXTRACTION RULES:
- "John Smith" -> firstName=John, lastName=Smith
- "email johnsmith@example.com" -> email=johnsmith@example.com
- "phone 07912345678" -> phone=07912345678
- "born 15 March 1990" or "DOB 15 March 1990" -> dob=1990-03-15
- "passport AB123456" -> passport=AB123456
- "British" or "nationality British" -> nationality=GB
- "Indian" -> nationality=IN, "Pakistani" -> nationality=PK

CRITICAL RULE: If the utterance contains BOTH flight details (origin/destination/date) AND passenger details (name + at least email or passport), use action type FULL_BOOKING:
-> intent: "BOOK_FLIGHT"
-> action: {"type": "FULL_BOOKING", "passenger": {"firstName":"John","lastName":"Smith","email":"john@test.com","phone":"07912345678","dob":"1990-03-15","passport":"AB123456","nationality":"GB"}}
-> entities: {from, to, departureDate, returnDate, adults, cabin, tripType}

EXAMPLES:
"London to New York 20 December return 28 December business 2 adults. Name John Smith email johnsmith@example.com phone 07912345678 born 15 March 1990 passport AB123456 British"
-> action type FULL_BOOKING with all passenger fields in action.passenger

"Dubai for Diwali economy 1 adult. Sara Ahmed sara@gmail.com 07800123456 10 June 1985 passport PK987654 Pakistani"
-> action type FULL_BOOKING

If only flight details present (no passenger name/email) -> action: NAVIGATE /book, fill entities only.

TWO-OPTION NAVIGATION:
When you need a binary choice from the user, use intent: TWO_OPTIONS with EXACTLY 2 quickReplies.
The user will speak or tap one option. Use for:
- One-way vs return
- Economy vs business
- This year vs next year for a festival
- Yes vs No confirmations

IMPORTANT: After user picks one option (e.g. "Return trip"), DO NOT navigate immediately if you still
need destination/dates. Instead continue collecting missing info conversationally:
- If you now know tripType but not destination -> ask "Great! Where would you like to fly to?"
- If you know destination but not date -> ask "And when would you like to travel?"
- Only use NAVIGATE action when you have: from + to + departureDate (minimum required)

Example flow:
1. User: "Book a flight" -> TWO_OPTIONS: ["One way", "Return trip"]
2. User: "Return trip" -> BOOK_FLIGHT intent, text: "Lovely! Where would you like to fly from and to?", action: null (keep collecting)
3. User: "London to New York" -> BOOK_FLIGHT intent, text: "And when would you like to depart?", action: null
4. User: "20th December" -> BOOK_FLIGHT intent, action: NAVIGATE /book with all entities filled

PASSENGER COLLECTION - TWO MODES:

MODE A - COLLECT ALL AT ONCE (preferred when user gives full details):
User: "My name is John Smith, email john@test.com, phone 07912345678, born 15th March 1990, passport AB123456, British nationality"
-> Extract ALL 7 fields immediately, set allCollected: true

MODE B - FIELD BY FIELD (when user gives partial info):
Ask one field at a time in this exact order:
1. firstName -> "What is your first name?"
2. lastName -> "And your last name?"
3. email -> "What is your email address?"
4. phone -> "What is your phone number including country code?"
5. dob -> "What is your date of birth? Please say the day, month and year."
6. passport -> "What is your passport number?"
7. nationality -> "And your nationality?"

After EACH answer, immediately ask the NEXT question in nextQuestion.
The nextQuestion will be spoken aloud to the user automatically.

passengerField schema:
{
  "collected": {
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@test.com",
    "phone": "07912345678",
    "dob": "1990-03-15",
    "passport": "AB123456",
    "nationality": "GB"
  },
  "nextField": "email",
  "nextQuestion": "What is your email address?",
  "allCollected": false
}

NORMALISATION:
- DOB: "15 March 1990" or "15/3/90" -> "1990-03-15"
- Phone: "zero seven nine one two..." -> "07912..."
- Nationality -> ISO code: British=GB, Indian=IN, American=US, Pakistani=PK, Irish=IE

When allCollected=true: action = {"type":"PREFILL_BOOKING","passenger":{...all 7 fields}}

RESPONSE SCHEMA - ALWAYS OUTPUT ONLY VALID JSON:
{
  "intent": "BOOK_FLIGHT" | "CHECK_IN" | "FLIGHT_STATUS" | "MANAGE_BOOKING" | "DESTINATIONS" | "EXECUTIVE_CLUB" | "HELP" | "TWO_OPTIONS" | "COLLECT_PASSENGER" | "PASSENGER_FIELD" | "UNKNOWN",
  "text": "<warm natural spoken reply - mention festival name and resolved dates when booking>",
  "quickReplies": ["short option 1", "short option 2"],
  "action": null | {"type":"NAVIGATE","path":"/book"} | {"type":"PREFILL_BOOKING","passenger":{...}} | {"type":"FULL_BOOKING","passenger":{...all 7 fields}},
  "entities": {
    "from": "LHR",
    "to": "JFK",
    "departureDate": "YYYY-MM-DD",
    "returnDate": "YYYY-MM-DD",
    "adults": 1,
    "cabin": "economy",
    "tripType": "return",
    "festival": "Christmas"
  },
  "passengerField": null | {
    "collected": {},
    "nextField": "firstName",
    "nextQuestion": "What is your first name?",
    "allCollected": false
  }
}

CRITICAL RULES:
1. Output ONLY valid JSON. Zero text outside the JSON object.
2. Extract maximum entities from every single utterance.
3. When booking intent with enough info -> NAVIGATE to /book immediately.
4. TWO_OPTIONS must have EXACTLY 2 quickReplies.
5. text is warm, British, conversational - spoken aloud - no bullet points, no markdown.
6. Never invent prices or booking references.
7. If user says anything like "take my details" or "collect passenger info" -> COLLECT_PASSENGER.
8. In PASSENGER_FIELD responses, always include nextQuestion so the UI knows what to speak next.`;
}

const SYSTEM_PROMPT = buildSystemPrompt();

// ── Build messages ────────────────────────────────────────────────
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

// ── Parse response ────────────────────────────────────────────────
function parseResponse(raw) {
  try {
    const text    = raw?.choices?.[0]?.message?.content || '';
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed  = JSON.parse(cleaned);

    // ── Normalise entities — AI sometimes uses different key names ─
    const ents = parsed.entities || {};
    const entities = {
      from:          ents.from          || ents.departure     || ents.origin       || '',
      to:            ents.to            || ents.destination   || ents.arrival      || '',
      departureDate: ents.departureDate || ents.departure_date || ents.depart_date || '',
      returnDate:    ents.returnDate    || ents.return_date   || ents.return       || '',
      adults:        ents.adults        || ents.num_adults    || ents.passengers   || 1,
      cabin:         ents.cabin         || ents.class         || ents.cabinClass   || 'economy',
      tripType:      ents.tripType      || ents.trip_type     || 'return',
      festival:      ents.festival      || '',
    };

    // ── Normalise action — AI sometimes returns string or wrong shape
    let action = parsed.action || null;
    if (typeof action === 'string') {
      // AI returned action as a bare string e.g. "FULL_BOOKING"
      if (action === 'FULL_BOOKING' || action === 'full_booking') {
        // Look for passenger at top level or in passengerField
        const pax = parsed.passenger || (parsed.passengerField && parsed.passengerField.collected) || null;
        action = pax ? { type: 'FULL_BOOKING', passenger: normalisePax(pax) } : { type: 'NAVIGATE', path: '/book' };
      } else {
        action = null;
      }
    } else if (action && action.type === 'FULL_BOOKING' && !action.passenger) {
      // Action object exists but passenger is at top level
      const pax = parsed.passenger || null;
      if (pax) action.passenger = normalisePax(pax);
    }

    // ── Normalise passengerField ───────────────────────────────────
    let passengerField = parsed.passengerField || null;
    if (!passengerField && parsed.passenger && (!action || action.type !== 'FULL_BOOKING')) {
      // Passenger data at top level but no FULL_BOOKING — treat as collected fields
      passengerField = {
        collected: normalisePax(parsed.passenger),
        nextField: null,
        nextQuestion: null,
        allCollected: true,
      };
    }

    return {
      intent:         parsed.intent        || 'UNKNOWN',
      text:           parsed.text          || "I'm sorry, I didn't catch that. Could you try again?",
      quickReplies:   Array.isArray(parsed.quickReplies) ? parsed.quickReplies.slice(0, 5) : [],
      action,
      entities,
      passengerField,
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

// ── Normalise passenger object from various AI key formats ────────
function normalisePax(raw) {
  if (!raw) return null;
  return {
    firstName:   raw.firstName   || raw.first_name  || (raw.name && raw.name.split(' ')[0])  || '',
    lastName:    raw.lastName    || raw.last_name   || (raw.name && raw.name.split(' ').slice(1).join(' ')) || '',
    email:       raw.email       || raw.email_address || '',
    phone:       raw.phone       || raw.phone_number  || raw.telephone || '',
    dob:         raw.dob         || raw.date_of_birth || raw.dateOfBirth || raw.born || '',
    passport:    raw.passport    || raw.passport_number || raw.passportNumber || '',
    nationality: raw.nationality || raw.country || raw.nationalityCode || '',
  };
}

// ── Fallback when no API key ──────────────────────────────────────
function fallbackResponse(userText) {
  const lower = userText.toLowerCase();
  if (/book|flight|fly/.test(lower))
    return { intent: 'BOOK_FLIGHT', text: "I'd love to help you book a flight!", quickReplies: ['One way', 'Return trip'], action: { type: 'NAVIGATE', path: '/book' }, entities: {}, passengerField: null };
  if (/check.?in/.test(lower))
    return { intent: 'CHECK_IN', text: 'Check-in opens 24 hours before your flight.', quickReplies: ['Check in now'], action: { type: 'NAVIGATE', path: '/check-in' }, entities: {}, passengerField: null };
  if (/status/.test(lower))
    return { intent: 'FLIGHT_STATUS', text: "Let me check that flight's status.", quickReplies: ['Track flight'], action: { type: 'NAVIGATE', path: '/flight-status' }, entities: {}, passengerField: null };
  return { intent: 'HELP', text: 'I can help with booking flights, check-in, and more. What would you like to do?', quickReplies: ['Book a flight', 'Check in', 'Flight status', 'Destinations'], action: null, entities: {}, passengerField: null };
}

// ── Main export ───────────────────────────────────────────────────
export async function sendToGemini(userMessage, history = []) {
  if (!API_KEY || API_KEY === 'your_groq_api_key_here') {
    console.warn('[aiService] No API key - using fallback.');
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
        temperature: 0.3,
        max_tokens:  700,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error('[aiService] Groq error:', response.status, err);
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
