/**
 * aiService.js — Groq llama-3.3-70b-versatile
 *
 * Optimised for SPEED: tries to extract everything in one shot first.
 * Falls back to targeted follow-up questions only for genuinely missing fields.
 */

const API_KEY  = import.meta.env.VITE_GEMINI_API_KEY;
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.3-70b-versatile';

function buildSystemPrompt() {
  const now       = new Date();
  const year      = now.getFullYear();
  const month     = now.getMonth() + 1; // 1-12
  const day       = now.getDate();
  const dayOfWeek = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const fullDate  = now.toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const timeStr   = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });

  // ── Compute exact dates dynamically ────────────────────────────
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r.toISOString().split('T')[0]; };
  const nextWeekday = (wd) => { // 0=Sun,6=Sat
    const d = new Date(now);
    const diff = ((wd - d.getDay()) + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  };
  const firstOfNextMonth = () => {
    const d = new Date(year, month, 1); // month is already +1 so this is next month
    return d.toISOString().split('T')[0];
  };
  const inWeeks = (n) => addDays(now, n * 7);
  const inMonths = (n) => {
    const d = new Date(now); d.setMonth(d.getMonth() + n);
    return d.toISOString().split('T')[0];
  };

  // ── UK School Holidays (approximate) ───────────────────────────
  const ukSchoolHols = [
    { name: 'February Half Term',   start: `${year}-02-17`, end: `${year}-02-21` },
    { name: 'Easter Holidays',      start: `${year}-04-14`, end: `${year}-04-25` },
    { name: 'May Half Term',        start: `${year}-05-26`, end: `${year}-05-30` },
    { name: 'Summer Holidays',      start: `${year}-07-22`, end: `${year}-09-03` },
    { name: 'October Half Term',    start: `${year}-10-27`, end: `${year}-10-31` },
    { name: 'Christmas Holidays',   start: `${year}-12-22`, end: `${year+1}-01-07` },
  ].map(h => `${h.name}: ${h.start} to ${h.end}`).join('\n');

  // ── UK & Indian Festivals with computed upcoming dates ─────────
  const allFestivals = [
    // UK public holidays
    ["New Year's Day",       `${year}-01-01`, `${year+1}-01-01`],
    ["Valentine's Day",      `${year}-02-14`, `${year+1}-02-14`],
    ["Mother's Day UK",      `${year}-03-30`, `${year+1}-03-22`],
    ["St Patrick's Day",     `${year}-03-17`, `${year+1}-03-17`],
    ["Good Friday",          `${year}-04-18`, `${year+1}-04-03`],
    ["Easter Sunday",        `${year}-04-20`, `${year+1}-04-05`],
    ["Easter Monday",        `${year}-04-21`, `${year+1}-04-06`],
    ["Early May Bank Hol",   `${year}-05-05`, `${year+1}-05-04`],
    ["Spring Bank Holiday",  `${year}-05-26`, `${year+1}-05-25`],
    ["Father's Day UK",      `${year}-06-15`, `${year+1}-06-21`],
    ["Summer Bank Holiday",  `${year}-08-25`, `${year+1}-08-31`],
    ["Halloween",            `${year}-10-31`, `${year+1}-10-31`],
    ["Bonfire Night",        `${year}-11-05`, `${year+1}-11-05`],
    ["Remembrance Sunday",   `${year}-11-09`, `${year+1}-11-08`],
    ["Christmas Eve",        `${year}-12-24`, `${year+1}-12-24`],
    ["Christmas Day",        `${year}-12-25`, `${year+1}-12-25`],
    ["Boxing Day",           `${year}-12-26`, `${year+1}-12-26`],
    ["New Year's Eve",       `${year}-12-31`, `${year+1}-12-31`],
    // Indian festivals
    ["Makar Sankranti/Lohri", `${year}-01-14`, `${year+1}-01-14`],
    ["Republic Day India",   `${year}-01-26`, `${year+1}-01-26`],
    ["Vasant Panchami",      `${year}-02-02`, `${year+1}-01-22`],
    ["Maha Shivratri",       `${year}-02-26`, `${year+1}-02-15`],
    ["Holi",                 `${year}-03-14`, `${year+1}-03-03`],
    ["Ram Navami",           `${year}-04-06`, `${year+1}-03-27`],
    ["Baisakhi",             `${year}-04-14`, `${year+1}-04-14`],
    ["Eid ul-Fitr",         `${year}-03-31`, `${year+1}-03-20`],
    ["Eid ul-Adha",         `${year}-06-07`, `${year+1}-05-27`],
    ["Muharram",             `${year}-07-07`, `${year+1}-06-26`],
    ["Raksha Bandhan",       `${year}-08-09`, `${year+1}-07-29`],
    ["Independence Day India",`${year}-08-15`, `${year+1}-08-15`],
    ["Janmashtami",          `${year}-08-16`, `${year+1}-08-05`],
    ["Ganesh Chaturthi",     `${year}-08-27`, `${year+1}-08-16`],
    ["Navratri begins",      `${year}-10-02`, `${year+1}-09-22`],
    ["Dussehra/Vijayadashami",`${year}-10-02`, `${year+1}-10-02`],
    ["Karva Chauth",         `${year}-10-20`, `${year+1}-10-09`],
    ["Dhanteras",            `${year}-10-18`, `${year+1}-11-06`],
    ["Diwali/Deepavali",     `${year}-10-20`, `${year+1}-11-08`],
    ["Bhai Dooj",            `${year}-10-22`, `${year+1}-11-10`],
    ["Chhath Puja",          `${year}-10-28`, `${year+1}-10-17`],
    ["Guru Nanak Jayanti",   `${year}-11-05`, `${year+1}-11-25`],
    ["Milad-un-Nabi",        `${year}-09-05`, `${year+1}-08-25`],
  ].map(([name, d1, d2]) => {
    const use = new Date(d1) >= now ? d1 : (new Date(d2) >= now ? d2 : d1);
    // Days until
    const msUntil = new Date(use) - now;
    const daysUntil = Math.ceil(msUntil / (1000 * 60 * 60 * 24));
    const dayOfWeekFest = new Date(use).toLocaleDateString('en-GB', { weekday: 'short' });
    return `${name}: ${use} (${dayOfWeekFest}${daysUntil > 0 ? ', in '+daysUntil+' days' : ' — today/past'})`;
  }).join('\n');

  return `You are the British Airways intelligent voice assistant — like Siri or Google Assistant but for flights. You are warm, smart, fast, and know everything about dates, festivals, and travel.

CURRENT DATE AND TIME:
- Today: ${fullDate}
- Time: ${timeStr} (UK)
- Date: ${now.toISOString().split('T')[0]}
- Day: ${dayOfWeek}
- Year: ${year}, Month: ${month}, Day of month: ${day}

RELATIVE DATE CALCULATIONS (compute these exactly):
- "today" = ${now.toISOString().split('T')[0]}
- "tomorrow" = ${addDays(now, 1)}
- "day after tomorrow" = ${addDays(now, 2)}
- "this Friday" = ${nextWeekday(5)}
- "this Saturday" = ${nextWeekday(6)}
- "this Sunday" = ${nextWeekday(0)}
- "next Monday" = ${nextWeekday(1)}
- "next weekend" = ${nextWeekday(6)}
- "next week" = ${nextWeekday(1)} (Monday)
- "in 2 weeks" = ${inWeeks(2)}
- "in 3 weeks" = ${inWeeks(3)}
- "next month" = ${firstOfNextMonth()}
- "in 2 months" = ${inMonths(2)}
- "in 3 months" = ${inMonths(3)}
- "in 6 months" = ${inMonths(6)}
- "next summer" = ${year+1}-07-20 (if before July, use ${year}-07-20)
- "next Christmas" = ${month >= 11 ? year+1 : year}-12-25

UK FESTIVALS & HOLIDAYS:
${allFestivals.split('\n').filter(l => l.includes('Day') || l.includes('Christmas') || l.includes('Easter') || l.includes('Halloween') || l.includes('New Year') || l.includes('Bank')).join('\n')}

INDIAN FESTIVALS:
${allFestivals.split('\n').filter(l => !l.includes('Day UK') && !l.includes('Bank') && !l.includes('Christmas') && !l.includes('Halloween') && !l.includes('Bonfire') && !l.includes("Valentine") && !l.includes("Mother") && !l.includes("Father")).join('\n')}

UK SCHOOL HOLIDAYS ${year}:
${ukSchoolHols}

FESTIVAL TRAVEL DATES (auto-resolve when mentioned):
- Christmas -> depart ${year}-12-20, return ${year}-12-28 (8 nights)
- New Year -> depart ${year}-12-29, return ${year+1}-01-03
- Diwali -> depart 2 days before Diwali, return 7 days after
- Holi -> depart 2 days before Holi, return 5 days after
- Eid ul-Fitr -> depart 1 day before, return 7 days after
- Eid ul-Adha -> depart 1 day before, return 7 days after
- Easter holidays -> depart ${year}-04-12, return ${year}-04-27
- Half term Oct -> depart ${year}-10-25, return ${year}-11-01
- Summer holidays -> depart ${year}-07-22, return ${year}-08-10

DESTINATION SUGGESTIONS BY FESTIVAL/SEASON:
- Christmas/New Year -> New York (JFK), Dubai (DXB), Sydney (SYD)
- Diwali/Holi/Indian festivals -> Mumbai (BOM)
- Eid -> Dubai (DXB), Istanbul (IST), Mumbai (BOM)
- Easter/Half term -> Barcelona (BCN), Rome (FCO), Amsterdam (AMS)
- Summer -> Barcelona (BCN), Dubai (DXB), Singapore (SIN), Tokyo (NRT)
- Winter sun -> Dubai (DXB), Singapore (SIN)

AIRPORTS: LHR=London Heathrow, LGW=London Gatwick, JFK=New York, EWR=Newark, LAX=Los Angeles, DXB=Dubai, NRT=Tokyo, HND=Tokyo Haneda, SYD=Sydney, SIN=Singapore, BCN=Barcelona, BOM=Mumbai, CDG=Paris, AMS=Amsterdam, FCO=Rome, IST=Istanbul, CPT=Cape Town, MAD=Madrid, FRA=Frankfurt, ZRH=Zurich, DUB=Dublin

ROUTES: LHR-JFK, LHR-DXB, LHR-NRT, LHR-SYD, LHR-SIN, LHR-BCN, LHR-BOM (and all reverses)

NATIONALITY CODES (use ISO 2-letter):
British=GB, English/Scottish/Welsh/Irish=GB, Indian=IN, Pakistani=PK, American=US, Australian=AU, Canadian=CA, South African=ZA, Bangladeshi=BD, Sri Lankan=LK, Nigerian=NG, Kenyan=KE, French=FR, German=DE, Italian=IT, Spanish=ES, Portuguese=PT, Dutch=NL, Polish=PL, Romanian=RO, Bulgarian=BG, Filipino=PH, Chinese=CN, Japanese=JP, Korean=KR, Emirati=AE, Saudi=SA, Egyptian=EG, Ghanaian=GH, Jamaican=JM, Turkish=TR, Iranian=IR, Afghan=AF, Nepali=NP

BOOKING DEFAULTS: from=LHR, adults=1, tripType=return, cabin=economy

═══════════════════════════════════════════════════════
HYBRID BOOKING LOGIC — READ CAREFULLY
═══════════════════════════════════════════════════════

REQUIRED FIELDS for a complete booking:
  FLIGHT:    from, to, departureDate, returnDate (if return), cabin
  PASSENGER: firstName, lastName, phone, nationality

STEP 1 — SCAN THE MESSAGE FOR ALL REQUIRED FIELDS.
Extract everything the user has provided, in ANY order, from ANY message.

STEP 2 — DECIDE WHICH PATH:

  PATH A: SINGLE-SHOT (all fields present)
  If from + to + departureDate + cabin + firstName + lastName + phone + nationality
  are ALL present (from this message OR conversation history) -> return FULL_BOOKING immediately.
  Do NOT ask any questions. Navigate straight to booking.
  IMPORTANT: Put passenger data inside action.passenger, NOT in passengerField.
  action = {"type":"FULL_BOOKING","passenger":{"firstName":"John","lastName":"Smith","phone":"07912345678","nationality":"GB"}}

  PATH B: PARTIAL INFO (some fields present, destination+date known)
  If from + to + departureDate are known but passenger details missing -> return PREFILL_BOOKING.
  Put whatever passenger data you have inside action.passenger.
  This lets the booking page pre-fill the flight form and collect passenger details on the page.
  action = {"type":"PREFILL_BOOKING","passenger":{"firstName":"","lastName":"","phone":"","nationality":""}}

  PATH C: STEP-BY-STEP (destination or date unknown)
  Collect missing fields ONE AT A TIME in this strict order:
    1. to (destination)   -> ask: "Where would you like to fly?"
    2. departureDate      -> ask: "When would you like to travel?"
    3. returnDate         -> ask: "When would you like to return?" (skip if one-way)
    4. cabin              -> ask: "Which cabin — Economy, Business, or First?"
    5. firstName          -> ask: "What is your first name?"
    6. lastName           -> ask: "What is your last name?"
    7. phone              -> ask: "What is your phone number?"
    8. nationality        -> ask: "What is your nationality?"
  After EACH answer, re-evaluate: if all fields now complete -> FULL_BOOKING.
  If flight fields complete but passenger incomplete -> PREFILL_BOOKING.

CRITICAL RULES:
1. NEVER ask for info already provided in this message OR conversation history.
2. User can provide fields in ANY order. Store everything extracted, only ask for missing fields.
3. Always convert city names to IATA codes immediately.
4. Always resolve festival/relative dates to YYYY-MM-DD immediately.
5. Keep responses SHORT - max 2 sentences.
6. FULL_BOOKING: passenger goes inside action.passenger object. Set passengerField to null.
7. PREFILL_BOOKING: flight known (to+departureDate), passenger incomplete. Put partial pax in action.passenger.
8. Use FULL_BOOKING when ALL 6 fields known: to + departureDate + firstName + lastName + phone + nationality.
9. When step-by-step conversation has collected all passenger fields AND flight is known -> FULL_BOOKING, never PREFILL_BOOKING.
10. Full booking JSON: {intent:'BOOK_FLIGHT',action:{type:'FULL_BOOKING',passenger:{firstName:'X',lastName:'Y',phone:'Z',nationality:'GB'}},entities:{from:'LHR',to:'JFK',...},passengerField:null}

EXAMPLES:

Input: "Book business class from London to New York on 20 December returning 28 December for John Smith, phone 07912345678, British"
-> All fields present. Return FULL_BOOKING immediately.

Input: "I want to book a flight"
-> Nothing known. Ask: "Where would you like to fly?"

Input: "London to Dubai tomorrow"
-> to=DXB, departureDate=tomorrow. Flight known, passenger unknown. 
-> Return PREFILL_BOOKING (navigate to /book with entities pre-filled, collect passenger on page).

Input: "My name is Alex Brown"
-> firstName=Alex, lastName=Brown stored. Ask next missing field (destination, if not already known).

Input: "Book me a flight to Barcelona for Easter"
-> to=BCN, departureDate=Easter dates resolved. Flight known, passenger unknown.
-> Return PREFILL_BOOKING.

═══════════════════════════════════════════════════════
ACTION RULES — MANDATORY
═══════════════════════════════════════════════════════
- ALL flight + ALL passenger fields present -> action={"type":"FULL_BOOKING","passenger":{firstName,lastName,phone,nationality}}
- Flight fields complete, passenger incomplete -> action={"type":"PREFILL_BOOKING","passenger":{...whatever collected}}
- Collecting passenger fields step by step -> intent=PASSENGER_FIELD, action=null
- check-in mentioned -> action={"type":"NAVIGATE","path":"/check-in"}
- flight status/track -> action={"type":"NAVIGATE","path":"/flight-status"}
- Executive Club/Avios -> action={"type":"NAVIGATE","path":"/executive-club"}
- destinations/where to go -> action={"type":"NAVIGATE","path":"/destinations"}
- manage/change booking -> action={"type":"NAVIGATE","path":"/manage"}
- NEVER return action=null when destination + date are known

DESTINATION MAPPING — always convert to IATA:
New York/NYC->JFK, Dubai/UAE->DXB, Tokyo/Japan->NRT, Sydney/Australia->SYD, Singapore->SIN, Barcelona/Spain->BCN, Mumbai/Bombay/India->BOM, Paris/France->CDG, Amsterdam/Netherlands->AMS, Rome/Italy->FCO, Istanbul/Turkey->IST, Cape Town/South Africa->CPT, Madrid->MAD, London->LHR

GENERAL KNOWLEDGE (answer like a smart assistant):
- "What day is it?" -> tell them today is ${dayOfWeek} ${day} ${now.toLocaleDateString('en-GB', {month:'long'})} ${year}
- "What time is it?" -> tell them it's approximately ${timeStr} UK time
- "How many days until Christmas?" -> calculate from today
- "When is [festival]?" -> look up from the festival list above and tell them the date AND day of week
- "Is [festival] on a weekend this year?" -> check the day of week and answer
- "What's the best time to fly to Dubai?" -> October to April (avoids extreme summer heat)
- "Should I book now?" -> Yes, prices are typically lower when booked 6-8 weeks in advance
- "Is it peak season?" -> check if today is near Christmas, summer, or half term

PASSENGER FIELDS (4 only — keep it fast):
Collect in this strict order when doing step-by-step:
  1. firstName  -> "What is your first name?"
  2. lastName   -> "What is your last name?"
  3. phone      -> "What is your phone number?"
  4. nationality -> "What is your nationality?"

When returning a PASSENGER_FIELD response, always set passengerField.nextQuestion
so the UI knows what to speak aloud next.
When all 4 fields collected AND flight details known -> immediately return FULL_BOOKING.
When all 4 fields collected but flight details NOT known -> set allCollected=true and ask for missing flight field.

RESPONSE SCHEMA — raw JSON only, no markdown:
{
  "intent": "BOOK_FLIGHT"|"CHECK_IN"|"FLIGHT_STATUS"|"MANAGE_BOOKING"|"DESTINATIONS"|"EXECUTIVE_CLUB"|"HELP"|"TWO_OPTIONS"|"COLLECT_PASSENGER"|"PASSENGER_FIELD"|"UNKNOWN",
  "text": "short conversational reply max 2 sentences",
  "quickReplies": [],
  "action": null|{"type":"NAVIGATE","path":"/book"}|{"type":"FULL_BOOKING","passenger":{"firstName":"","lastName":"","phone":"","nationality":""}}|{"type":"PREFILL_BOOKING","passenger":{"firstName":"","lastName":"","phone":"","nationality":""}},
  "entities": {"from":"LHR","to":"","departureDate":"","returnDate":"","adults":1,"cabin":"economy","tripType":"return","festival":""},
  "passengerField": null|{"collected":{"firstName":"","lastName":"","phone":"","nationality":""},"nextField":"firstName","nextQuestion":"What is your first name?","allCollected":false}
}

FINAL RULES:
1. Raw JSON only — zero text outside the JSON object.
2. Text max 2 sentences, warm, British, conversational.
3. When festival mentioned -> resolve to exact dates -> set in entities immediately.
4. FULL_BOOKING = all 8 required fields known (from history + current message).
5. PREFILL_BOOKING = flight known (to + departureDate), passenger incomplete.
6. PASSENGER_FIELD = collecting passenger step-by-step, always include nextQuestion.
7. Never ask for information already known from conversation history.
8. TWO_OPTIONS = exactly 2 quickReplies.
9. Answer general date/festival questions in the text field, then offer to book.
10. When returning FULL_BOOKING or PREFILL_BOOKING, always mention route and dates in text.
}
}

const SYSTEM_PROMPT = buildSystemPrompt();

function buildMessages(history, userMessage) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  for (const turn of history) {
    messages.push({ role: turn.role === 'user' ? 'user' : 'assistant', content: turn.text });
  }
  messages.push({ role: 'user', content: userMessage });
  return messages;
}

function normalisePax(raw) {
  if (!raw) return null;
  const name = raw.name || '';
  const parts = name.split(' ');
  return {
    firstName:   raw.firstName   || raw.first_name || parts[0]                        || '',
    lastName:    raw.lastName    || raw.last_name  || parts.slice(1).join(' ')         || '',
    phone:       raw.phone       || raw.phone_number || raw.telephone                  || '',
    nationality: raw.nationality || raw.country    || raw.nationalityCode              || '',
  };
}

function parseResponse(raw) {
  try {
    const text    = raw?.choices?.[0]?.message?.content || '';
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed  = JSON.parse(cleaned);

    // Normalise entities
    const e = parsed.entities || {};
    const entities = {
      from:          e.from          || e.departure  || e.origin       || '',
      to:            e.to            || e.destination || e.arrival      || '',
      departureDate: e.departureDate || e.departure_date || e.depart_date || '',
      returnDate:    e.returnDate    || e.return_date || e.return        || '',
      adults:        Number(e.adults || e.num_adults  || e.passengers   || 1),
      cabin:         e.cabin         || e.class       || e.cabinClass   || 'economy',
      tripType:      e.tripType      || e.trip_type   || 'return',
      festival:      e.festival      || '',
    };

    // Normalise action
    let action = parsed.action || null;
    if (typeof action === 'string') {
      if (action.toUpperCase() === 'FULL_BOOKING') {
        const pax = parsed.passenger || (parsed.passengerField?.collected) || null;
        action = pax ? { type: 'FULL_BOOKING', passenger: normalisePax(pax) }
                     : { type: 'NAVIGATE', path: '/book' };
      } else {
        action = null;
      }
    } else if (action?.type === 'FULL_BOOKING' && !action.passenger) {
      const pax = parsed.passenger || null;
      if (pax) action.passenger = normalisePax(pax);
    }

    // Normalise passengerField
    let passengerField = parsed.passengerField || null;
    if (!passengerField && parsed.passenger && action?.type !== 'FULL_BOOKING') {
      passengerField = {
        collected: normalisePax(parsed.passenger),
        nextField: null, nextQuestion: null, allCollected: true,
      };
    }

    return {
      intent:         parsed.intent       || 'UNKNOWN',
      text:           parsed.text         || "I didn't catch that — could you try again?",
      quickReplies:   Array.isArray(parsed.quickReplies) ? parsed.quickReplies.slice(0, 5) : [],
      action, entities, passengerField,
    };
  } catch {
    return {
      intent: 'UNKNOWN',
      text: "Could you rephrase that?",
      quickReplies: ['Book a flight', 'Check in', 'Flight status'],
      action: null, entities: {}, passengerField: null,
    };
  }
}

function fallbackResponse(t) {
  const l = t.toLowerCase();
  if (/book|flight|fly/.test(l))   return { intent:'BOOK_FLIGHT',    text:"Sure! Where would you like to fly?",            quickReplies:['London to New York','London to Dubai','London to Barcelona'], action:{type:'NAVIGATE',path:'/book'}, entities:{}, passengerField:null };
  if (/check.?in/.test(l))         return { intent:'CHECK_IN',       text:"Check-in opens 24 hours before departure.",     quickReplies:['Check in now'], action:{type:'NAVIGATE',path:'/check-in'}, entities:{}, passengerField:null };
  if (/status|track/.test(l))      return { intent:'FLIGHT_STATUS',  text:"Which flight would you like to track?",         quickReplies:['BA117','BA204'], action:{type:'NAVIGATE',path:'/flight-status'}, entities:{}, passengerField:null };
  if (/avios|club|exec/.test(l))   return { intent:'EXECUTIVE_CLUB', text:"Your Avios balance is on the Executive Club page.", quickReplies:['View Avios'], action:{type:'NAVIGATE',path:'/executive-club'}, entities:{}, passengerField:null };
  return { intent:'HELP', text:"I can book flights, check you in, and track flights. What would you like?", quickReplies:['Book a flight','Check in','Flight status','Avios'], action:null, entities:{}, passengerField:null };
}

export async function sendToGemini(userMessage, history = []) {
  if (!API_KEY || API_KEY === 'your_groq_api_key_here') {
    return fallbackResponse(userMessage);
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL, messages: buildMessages(history, userMessage),
        temperature: 0.2, max_tokens: 600,
      }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error('[aiService] Groq error:', res.status, errBody);
      if (res.status === 429) {
        return { intent:'UNKNOWN', text:"I'm a little busy right now — please try again in a moment.", quickReplies:['Try again'], action:null, entities:{}, passengerField:null };
      }
      throw new Error(`Groq ${res.status}`);
    }
    const data = await res.json();
    return parseResponse(data);
  } catch (err) {
    console.error('[aiService] Request failed:', err.message);
    // Graceful fallback — still useful to the user
    return fallbackResponse(userMessage);
  }
}

// expose model name for the header display
export const AI_MODEL = 'llama-3.3-70b';
