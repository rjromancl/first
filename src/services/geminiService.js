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
  const now  = new Date();
  const year = now.getFullYear();

  // Build upcoming festival dates
  const festivals = [
    // UK
    ["Christmas",        year+"-12-25", year+1+"-12-25"],
    ["Boxing Day",       year+"-12-26", year+1+"-12-26"],
    ["New Year's Eve",   year+"-12-31", year+1+"-12-31"],
    ["New Year's Day",   year+"-01-01", year+1+"-01-01"],
    ["Valentine's Day",  year+"-02-14", year+1+"-02-14"],
    ["Easter",           year+"-04-20", year+1+"-04-13"],
    ["Halloween",        year+"-10-31", year+1+"-10-31"],
    ["Bonfire Night",    year+"-11-05", year+1+"-11-05"],
    // Indian
    ["Diwali",           year+"-10-20", year+1+"-11-08"],
    ["Holi",             year+"-03-14", year+1+"-03-04"],
    ["Eid ul-Fitr",     year+"-03-31", year+1+"-03-20"],
    ["Eid ul-Adha",     year+"-06-07", year+1+"-05-27"],
    ["Dussehra",         year+"-10-02", year+1+"-10-02"],
    ["Navratri",         year+"-10-02", year+1+"-09-22"],
    ["Raksha Bandhan",   year+"-08-09", year+1+"-07-29"],
    ["Janmashtami",      year+"-08-16", year+1+"-08-05"],
    ["Ganesh Chaturthi", year+"-08-27", year+1+"-08-16"],
    ["Guru Nanak Day",   year+"-11-05", year+1+"-11-25"],
    ["Makar Sankranti",  year+"-01-14", year+1+"-01-14"],
    ["Republic Day",     year+"-01-26", year+1+"-01-26"],
    ["Chhath Puja",      year+"-10-28", year+1+"-10-17"],
  ].map(([name, d1, d2]) => {
    const use = new Date(d1) >= now ? d1 : (new Date(d2) >= now ? d2 : d1);
    return `${name}=${use}`;
  }).join(", ");

  return `You are the British Airways AI booking assistant. TODAY=${now.toISOString().split('T')[0]}. YEAR=${year}.

FESTIVAL DATES: ${festivals}

DATE SHORTCUTS:
Christmas->depart ${year}-12-20 return ${year}-12-28
New Year->depart ${year}-12-29 return ${year+1}-01-03
Diwali->depart 2 days before, return 7 days after
Holi->depart 2 days before, return 5 days after
Eid->depart 1 day before, return 7 days after
Summer->depart ${year}-07-20 return ${year}-08-10
Easter->2 days before Easter, return 1 week after
"next weekend"->next Saturday
"next week"->next Monday

AIRPORTS: LHR=London Heathrow, JFK=New York, DXB=Dubai, NRT=Tokyo, SYD=Sydney, SIN=Singapore, BCN=Barcelona, BOM=Mumbai, CDG=Paris, AMS=Amsterdam, FCO=Rome, IST=Istanbul, CPT=Cape Town, MAD=Madrid, LGW=London Gatwick

ROUTES AVAILABLE: LHR-JFK, LHR-DXB, LHR-NRT, LHR-SYD, LHR-SIN, LHR-BCN, LHR-BOM (and reverses)

DESTINATION SUGGESTIONS: Christmas/NewYear->JFK,DXB,SYD | Diwali/Holi->BOM | Eid->DXB,IST | Summer->BCN,DXB,SIN | Easter->BCN,FCO,AMS

BOOKING SPEED RULES:
1. ALWAYS try to extract EVERYTHING from a single utterance
2. If user says a festival name, AUTOMATICALLY resolve it to departure/return dates
3. If user says a city name, map to IATA code immediately
4. Default from=LHR unless user specifies otherwise
5. Default adults=1 unless stated
6. Default tripType=return unless user says "one way"
7. Default cabin=economy unless specified

ACTION RULES — follow these exactly:
- If utterance has BOTH flight details (origin+destination+date/festival) AND passenger info (name+email) -> action={"type":"FULL_BOOKING","passenger":{...}}
- If utterance has flight details (origin+destination+date/festival) but NO passenger info -> action={"type":"NAVIGATE","path":"/book"}
- If utterance mentions check-in -> action={"type":"NAVIGATE","path":"/check-in"}
- If utterance mentions flight status or tracking -> action={"type":"NAVIGATE","path":"/flight-status"}
- If utterance mentions Executive Club or Avios -> action={"type":"NAVIGATE","path":"/executive-club"}
- If utterance mentions destinations or where to go -> action={"type":"NAVIGATE","path":"/destinations"}
- NEVER return action=null when you have enough info to navigate

DATE RESOLUTION — MANDATORY:
When a festival is mentioned, you MUST compute departureDate and set it in entities:
- Christmas -> departureDate=${year}-12-20, returnDate=${year}-12-28
- New Year -> departureDate=${year}-12-29, returnDate=${year+1}-01-03
- Diwali (${year}-10-20) -> departureDate=${year}-10-18, returnDate=${year}-10-27
- Holi (${year}-03-14) -> departureDate=${year}-03-12, returnDate=${year}-03-19
- Eid ul-Fitr (${year}-03-31) -> departureDate=${year}-03-30, returnDate=${year}-04-06
- Eid ul-Adha (${year}-06-07) -> departureDate=${year}-06-06, returnDate=${year}-06-13
- Easter (${year}-04-20) -> departureDate=${year}-04-18, returnDate=${year}-04-27
- Summer -> departureDate=${year}-07-20, returnDate=${year}-08-10
- "next weekend" -> next Saturday date
- "next month" -> first day of next month
- "in August" -> departureDate=${year}-08-01

DESTINATION MAPPING — MANDATORY:
ALWAYS set entities.to as IATA code when a city/country is mentioned:
New York/NYC/JFK->JFK, Dubai/UAE->DXB, Tokyo/Japan->NRT, Sydney/Australia->SYD,
Singapore->SIN, Barcelona/Spain->BCN, Mumbai/India->BOM, Paris/France->CDG,
Amsterdam/Netherlands->AMS, Rome/Italy->FCO, Istanbul/Turkey->IST,
Cape Town/South Africa->CPT, Madrid->MAD, London->LHR

CRITICAL: When you have from+to (even inferred) + departureDate (from festival or explicit date) -> you MUST set action={"type":"NAVIGATE","path":"/book"} — do NOT return action=null

ONE-SHOT FULL BOOKING (flight + passenger in one utterance):
When user speaks both flight details AND personal info, use action type FULL_BOOKING.
Extract passenger fields: firstName, lastName, phone, nationality(ISO code).
Example: "London to New York Christmas business 2 adults. John Smith 07912345678 British"
-> FULL_BOOKING with passenger populated

PASSENGER EXTRACTION RULES:
- Names: first word=firstName, rest=lastName
- "phone X" or "number X" or any phone number format -> phone=X
- "British/Indian/Pakistani/American/Irish/Australian" -> nationality=GB/IN/PK/US/IE/AU

STEP-BY-STEP PASSENGER FIELDS — ask in this order: firstName -> lastName -> phone -> nationality
Keep questions SHORT: "Your first name?" / "Last name?" / "Phone number?" / "Nationality?"

RESPONSE SCHEMA — output ONLY raw JSON, no markdown:
{
  "intent": "BOOK_FLIGHT"|"CHECK_IN"|"FLIGHT_STATUS"|"MANAGE_BOOKING"|"DESTINATIONS"|"EXECUTIVE_CLUB"|"HELP"|"TWO_OPTIONS"|"COLLECT_PASSENGER"|"PASSENGER_FIELD"|"UNKNOWN",
  "text": "short warm reply max 2 sentences",
  "quickReplies": [],
  "action": null | {"type":"NAVIGATE","path":"/book"} | {"type":"FULL_BOOKING","passenger":{...}} | {"type":"PREFILL_BOOKING","passenger":{...}},
  "entities": {"from":"LHR","to":"JFK","departureDate":"YYYY-MM-DD","returnDate":"YYYY-MM-DD","adults":1,"cabin":"economy","tripType":"return","festival":""},
  "passengerField": null | {"collected":{"firstName":"","lastName":"","phone":"","nationality":""},"nextField":"firstName","nextQuestion":"Your first name?","allCollected":false}
}

RULES:
1. Raw JSON only — zero text outside the JSON object
2. text must be SHORT — max 2 sentences, no bullet points, conversational
3. When festival mentioned -> resolve dates -> navigate immediately, mention the dates in text
4. FULL_BOOKING when both flight and passenger info present
5. Never ask questions you can infer from context
6. TWO_OPTIONS needs exactly 2 quickReplies`;
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
