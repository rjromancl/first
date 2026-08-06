/**
 * helpService.js — Advanced Agentic RAG Help & Support AI
 *
 * Pipeline:
 *  1. Call /api/rag/ask (agentic backend) → gets context + sources + toolResult + intent
 *  2. Build rich system prompt with RAG context + tool results injected
 *  3. Call Groq llama-3.3-70b with structured JSON response schema
 *  4. Return { text, intent, action, sources, suggestedQuestions, toolResult, confidence }
 *
 * Agentic capabilities:
 *  - Auto-executes tools server-side (flight search, booking lookup, Avios calc, destinations)
 *  - Renders tool results inside the AI answer (e.g. shows actual flight list, booking details)
 *  - Multi-turn conversation memory (capped at 20 turns)
 *  - Multi-intent detection (answers compound questions)
 *  - 19 intent categories, 80+ knowledge docs, 12-language support
 *  - Never disclaims booking access — always navigates to correct page
 */

import { queryAgentic, getLocalKnowledgeFallback } from './vectorService';

const API_KEY  = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.3-70b-versatile';

const REQUEST_TIMEOUT_MS  = 18_000;
const MAX_RETRIES         = 2;
const RETRY_BASE_DELAY_MS = 400;
const MAX_HISTORY_TURNS   = 20;
const IS_DEV              = Boolean(import.meta.env?.DEV);

const log    = (...a) => IS_DEV && console.log('[helpService]', ...a);
const logErr = (...a) => IS_DEV ? console.error('[helpService]', ...a) : console.error('[helpService]', a[0]);
const sleep  = ms => new Promise(r => setTimeout(r, ms));

// ── System prompt builder ─────────────────────────────────────────────────────
function buildSystemPrompt(ragContext, toolResult, intent, entities) {
  const now = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const contextBlock = ragContext
    ? `\n\n══════════════════════════════════════════\nOFFICIAL BA KNOWLEDGE BASE (RAG):\n══════════════════════════════════════════\n${ragContext}\n══════════════════════════════════════════`
    : '';

  const toolBlock = toolResult
    ? `\n\n══════════════════════════════════════════\nLIVE DATA FROM BA SYSTEMS (use this in your answer):\n══════════════════════════════════════════\n${JSON.stringify(toolResult, null, 2)}\n══════════════════════════════════════════`
    : '';

  const entityBlock = entities && Object.values(entities).some(v => v?.length)
    ? `\nDetected entities: ${JSON.stringify(entities)}`
    : '';

  return `You are the British Airways Help & Support AI Agent — an expert, agentic, and deeply knowledgeable assistant embedded directly inside the British Airways app.

Today: ${now}${entityBlock}
${contextBlock}
${toolBlock}

╔══════════════════════════════════════════════════════╗
║  YOU ARE PART OF THE BA APP — CRITICAL RULES         ║
╚══════════════════════════════════════════════════════╝

APP PAGES (navigate to these directly):
  /manage        → Manage Booking (view, change, cancel — 6-char reference, no surname)
  /check-in      → Online Check-In (opens 24h before departure)
  /flight-status → Live Flight Status tracker
  /book          → Search & Book Flights
  /executive-club → Avios balance, tier, calculator
  /destinations   → Browse destinations & offers
  /help           → Help & Support (you are here)

ABSOLUTE RULES:
1. NEVER say "I'm a language model" or "I don't have access to your bookings" — this is WRONG. Always direct to the correct in-app page.
2. When a user asks about THEIR booking: direct to /manage with an action button.
3. When tool data is available in LIVE DATA above: USE IT in your answer. Quote actual flight numbers, prices, booking details, Avios amounts directly.
4. When tool data shows a booking was found: summarise key details (route, date, cabin, seat, status) then offer next actions.
5. Quote EXACT numbers from the knowledge base: weights (23kg, 32kg), Tier Points (300, 600, 1500), compensation amounts (£220, £350, £520), seat pitch (31in, 38in), etc.
6. Be multi-intent aware — if the user asks two questions, answer both concisely.
7. Respond in the user's language (Tamil, Hindi, Tanglish, English, Spanish, French, German, etc.).
8. Keep text SHORT and FRIENDLY — max 3 short paragraphs or a clean bullet list.

RESPONSE FORMAT — return valid JSON only:
{
  "text": "Clear, warm, specific answer using exact numbers. Reference live tool data if available.",
  "intent": "baggage|avios|checkin|cancellation|uk261|lounge|seat|special_meal|cabin|booking|flight_status|book_flight|destination|travel_docs|special_service|family|pets|inflight|offer|general",
  "action": null | { "type": "navigate", "path": "/manage", "label": "Open Manage Booking", "prefill": {} },
  "toolSummary": null | "One-line summary of what the tool returned (e.g. '3 flights found LHR→JFK on 2026-08-15')",
  "sources": [{ "label": "source title", "category": "baggage|executive-club|uk261|lounge|cabin|booking|destination|route|service|offer|travel" }],
  "suggestedQuestions": ["follow-up 1", "follow-up 2"],
  "confidence": 0.0
}

ACTION FIELD RULES:
- Booking/manage queries     → { type:"navigate", path:"/manage",         label:"Open Manage Booking" }
- Check-in queries           → { type:"navigate", path:"/check-in",        label:"Go to Check-In" }
- Flight status queries      → { type:"navigate", path:"/flight-status",   label:"Track My Flight" }
- Book/search flight queries → { type:"navigate", path:"/book",            label:"Search Flights" }
- Avios/tier queries         → { type:"navigate", path:"/executive-club",  label:"View My Avios" }
- Destination queries        → { type:"navigate", path:"/destinations",    label:"Browse Destinations" }
- All other policy Q&A       → action: null`;
}

// ── Rich local fallbacks (used when both backend + Groq are unavailable) ─────
const LOCAL_FALLBACKS = {
  baggage: {
    text: `BA baggage allowances:\n\n• **Hand baggage**: 1 cabin bag (56×45×25cm) + 1 personal item (40×30×15cm), max 23kg each\n• **Economy**: 1 checked bag × 23kg\n• **Premium Economy**: 2 bags × 23kg\n• **Club World / Business**: 2 bags × 32kg\n• **First Class**: 3 bags × 32kg\n• **Silver / Gold EC members**: 1 extra bag + 32kg allowance in Economy\n• Pre-purchase extra bags online (up to 30% cheaper than airport)`,
    intent: 'baggage', action: null,
    sources: [{ label: 'Baggage Allowances', category: 'baggage' }],
    suggestedQuestions: ['How much does an extra bag cost?', 'Can Silver members take more luggage?'],
  },
  avios: {
    text: `BA Executive Club tiers:\n\n• **Blue** (0 TP): Earn Avios, free Wi-Fi messaging\n• **Bronze** (300 TP): Priority check-in, free seats 7 days before, 25% Avios bonus\n• **Silver** (600 TP): Galleries Club lounge + 1 guest, free seats at booking, 50% Avios bonus, extra bag\n• **Gold** (1,500 TP): Galleries First + Concorde Room, First Wing LHR, free exit rows, 100% Avios bonus\n\nRedeem: reward flights from 4,750 Avios. Upgrade Economy→Business from 7,500 Avios/segment.`,
    intent: 'avios',
    action: { type: 'navigate', path: '/executive-club', label: 'View My Avios' },
    sources: [{ label: 'Executive Club Tiers', category: 'executive-club' }],
    suggestedQuestions: ['How do I earn Avios faster?', 'What is a Companion Voucher?'],
  },
  uk261: {
    text: `Your rights under UK261:\n\n• **Delay 3h+ on arrival** (BA's fault): £220 (<1,500km), £350 (1,500–3,500km), £520 (>3,500km / 4h+ delay)\n• **Cancellation <14 days**: same compensation amounts\n• **Duty of Care**: free meals, 2 phone calls, hotel + transfers for overnight delays\n• **If BA cancels**: full cash refund within 7 days OR free re-routing\n• Extraordinary circumstances (weather, ATC strikes) exempt from cash compensation — Duty of Care still applies`,
    intent: 'uk261', action: null,
    sources: [{ label: 'UK261 Passenger Rights', category: 'uk261' }],
    suggestedQuestions: ['How do I claim UK261 compensation?', 'What counts as extraordinary circumstances?'],
  },
  checkin: {
    text: `BA online check-in:\n\n• Opens **24 hours** before scheduled departure\n• Enter your **6-character booking reference** on the Check-In page — no surname needed\n• Bag drop closes **60 min** before long-haul, **45 min** before short-haul\n• Gates close **20 minutes** before departure\n• Digital boarding pass: Apple Wallet, Google Wallet, or PDF`,
    intent: 'checkin',
    action: { type: 'navigate', path: '/check-in', label: 'Go to Check-In' },
    sources: [{ label: 'Check-In Process', category: 'booking' }],
    suggestedQuestions: ['Can I change my seat after checking in?', 'What if I miss bag drop?'],
  },
  booking: {
    text: `To view or manage your booking, head to the Manage Booking page. You only need your **6-character booking reference** — no surname required.\n\nFrom there you can: view your itinerary, select or change seats, add baggage, request special meals, upgrade using Avios, or cancel your booking.`,
    intent: 'booking',
    action: { type: 'navigate', path: '/manage', label: 'Open Manage Booking' },
    sources: [{ label: 'Manage My Booking', category: 'booking' }],
    suggestedQuestions: ['How do I change my flight date?', 'Can I add extra baggage online?'],
  },
  flight_status: {
    text: `Track any BA flight in real time on the Flight Status page. Enter your flight number (e.g. BA117, BA474) or route. You'll see live departure/arrival times, gate, terminal, and progress.`,
    intent: 'flight_status',
    action: { type: 'navigate', path: '/flight-status', label: 'Track My Flight' },
    sources: [{ label: 'Flight Status', category: 'route' }],
    suggestedQuestions: ['What are my rights if my flight is delayed?', 'How do I get a refund if BA cancels?'],
  },
  destination: {
    text: `BA flies to 200+ destinations worldwide from London Heathrow and Gatwick. Popular routes:\n\n• **New York JFK**: 7h 30m from £399\n• **Dubai DXB**: 6h 45m from £299\n• **Barcelona BCN**: 2h 15m from £89\n• **Tokyo NRT**: 11h 50m from £649\n• **Sydney SYD**: 21h 30m from £799\n• **Mumbai BOM**: 9h 15m from £489`,
    intent: 'destination',
    action: { type: 'navigate', path: '/destinations', label: 'Browse Destinations' },
    sources: [{ label: 'BA Destinations', category: 'destination' }],
    suggestedQuestions: ['What is the best time to visit Dubai?', 'How long is the flight to Sydney?'],
  },
};

function localFallback(question) {
  const q = question.toLowerCase();
  if (/bag|luggage|carry|weight|23kg|32kg|suitcase|allowance/.test(q))              return LOCAL_FALLBACKS.baggage;
  if (/avios|tier|executive club|bronze|silver|gold|points|miles|companion/.test(q)) return LOCAL_FALLBACKS.avios;
  if (/uk261|eu261|delay|cancel|compensation|refund|rights|stranded/.test(q))        return LOCAL_FALLBACKS.uk261;
  if (/check.?in|checkin|boarding|bag drop|boarding pass/.test(q))                   return LOCAL_FALLBACKS.checkin;
  if (/flight status|is my flight|on time|delayed|track|track.*flight/.test(q))      return LOCAL_FALLBACKS.flight_status;
  if (/destination|where.*fly|holiday|recommend|best.*visit|popular/.test(q))        return LOCAL_FALLBACKS.destination;
  if (/my booking|manage|find booking|view booking|reference|pnr|seat selection|add bag|upgrade|cancel my|change my/.test(q)) return LOCAL_FALLBACKS.booking;

  return {
    text: "I'm having trouble connecting right now. Please try again shortly, or visit **ba.com/help** for official support.",
    intent: 'general', action: null,
    sources: [],
    suggestedQuestions: ['What is the baggage allowance?', 'What are my rights if my flight is cancelled?'],
    confidence: 0.3,
  };
}

// ── Groq call with retry ──────────────────────────────────────────────────────
async function callGroq(messages) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));

    const ctrl    = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model:           MODEL,
          messages,
          max_tokens:      900,
          temperature:     0.15,
          response_format: { type: 'json_object' },
        }),
      });
      clearTimeout(timeout);

      if (!res.ok) {
        lastErr = Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        if (res.status !== 429 && res.status < 500) break;
        continue;
      }

      const data    = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq');
      return JSON.parse(content);

    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      if (err.name === 'AbortError') { logErr('Timeout on attempt', attempt + 1); continue; }
      if (err instanceof SyntaxError) break;
      logErr('Groq error attempt', attempt + 1, err.message);
    }
  }
  throw lastErr || new Error('Groq call failed');
}

// ── Main askHelpAgent ─────────────────────────────────────────────────────────
/**
 * Full agentic Help AI pipeline.
 *
 * @param {string} question
 * @param {Array}  conversationHistory  [{role:'user'|'assistant', content:string}]
 * @returns {Promise<{text, intent, action, toolSummary, toolResult, sources, suggestedQuestions, confidence}>}
 */
export async function askHelpAgent(question, conversationHistory = []) {
  if (!question?.trim()) return localFallback('');
  const q = question.trim();
  log('Ask:', q);

  // ── Step 1: call agentic backend (/api/rag/ask) ──────────────────
  let agenticData = null;
  try {
    agenticData = await queryAgentic(q, conversationHistory.slice(-MAX_HISTORY_TURNS));
    log('Agentic response:', agenticData?.intent, 'tool:', agenticData?.toolCall?.name);
  } catch (e) {
    logErr('Agentic backend failed:', e.message);
  }

  const ragContext   = agenticData?.context   || null;
  const toolResult   = agenticData?.toolResult || null;
  const agentSources = agenticData?.sources    || [];
  const intent       = agenticData?.intent     || 'GENERAL';
  const entities     = agenticData?.entities   || {};
  const serverAction = agenticData?.actionBtn  || null;

  // ── Step 2: if no API key, use local fallback ────────────────────
  if (!API_KEY) {
    logErr('No Groq API key — using local fallback');
    const fb = localFallback(q);
    if (serverAction) fb.action = { type: 'navigate', path: serverAction.path, label: serverAction.label };
    if (toolResult)   fb.toolResult = toolResult;
    return fb;
  }

  // ── Step 3: also get local corpus as extra context if RAG is thin ─
  let localContext = '';
  if (!ragContext || ragContext.length < 200) {
    const local = getLocalKnowledgeFallback(q);
    if (local?.[0]?.text) localContext = local[0].text;
  }
  const combinedContext = [ragContext, localContext].filter(Boolean).join('\n\n---\n\n') || null;

  // ── Step 4: build Groq messages ──────────────────────────────────
  const systemPrompt = buildSystemPrompt(combinedContext, toolResult, intent, entities);
  const capped       = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);
  const messages     = [
    { role: 'system',    content: systemPrompt },
    ...capped,
    { role: 'user',      content: q },
  ];

  // ── Step 5: call Groq ────────────────────────────────────────────
  let parsed;
  try {
    parsed = await callGroq(messages);
    log('Groq response intent:', parsed?.intent);
  } catch (err) {
    logErr('Groq failed — using local fallback:', err.message);
    const fb = localFallback(q);
    if (serverAction) fb.action = { type: 'navigate', path: serverAction.path, label: serverAction.label };
    if (toolResult)   fb.toolResult = toolResult;
    return fb;
  }

  // ── Step 6: merge & validate response ───────────────────────────
  // Prefer server-side action (from tool execution) if Groq didn't set one
  let action = parsed.action || null;
  if (!action && serverAction) {
    action = { type: 'navigate', path: serverAction.path, label: serverAction.label };
  }

  // Merge sources — backend sources (with scores) + any Groq-reported sources
  const mergedSources = [
    ...agentSources.slice(0, 3).map(s => ({ label: s.label || s.id, category: s.category || 'general' })),
    ...(Array.isArray(parsed.sources) ? parsed.sources.slice(0, 2) : []),
  ].filter((s, i, arr) => arr.findIndex(x => x.label === s.label) === i).slice(0, 4);

  return {
    text:               parsed.text               || "I couldn't find a clear answer — please check ba.com/help.",
    intent:             (parsed.intent            || intent || 'general').toLowerCase(),
    action,
    toolSummary:        parsed.toolSummary         || (toolResult ? `Live data retrieved: ${agenticData?.toolCall?.name}` : null),
    toolResult:         toolResult                 || null,
    sources:            mergedSources,
    suggestedQuestions: Array.isArray(parsed.suggestedQuestions)
                          ? parsed.suggestedQuestions.slice(0, 2)
                          : ['What is the baggage allowance?', 'How do I earn Avios?'],
    confidence:         typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
  };
}

// ── Category icon map ─────────────────────────────────────────────────────────
export const CATEGORY_ICONS = {
  'baggage':        '🧳',
  'executive-club': '⭐',
  'uk261':          '⚖️',
  'lounge':         '🛋️',
  'cabin':          '💺',
  'destination':    '🌍',
  'route':          '✈️',
  'service':        '🛎️',
  'booking':        '📋',
  'travel':         '🛂',
  'offer':          '🏷️',
  'general':        '💬',
};

// ── Starter questions for empty state ────────────────────────────────────────
export const STARTER_QUESTIONS = [
  { q: 'What is the baggage allowance for Economy?',              category: 'baggage' },
  { q: 'How do I earn Avios on flights?',                         category: 'executive-club' },
  { q: 'What are my rights if my flight is delayed or cancelled?', category: 'uk261' },
  { q: 'When does online check-in open?',                         category: 'booking' },
  { q: 'How do I access the BA lounge?',                          category: 'lounge' },
  { q: 'What is Club Suite Business Class like?',                 category: 'cabin' },
  { q: 'Where is my booking?',                                    category: 'booking' },
  { q: 'How do I change my flight date?',                         category: 'booking' },
  { q: 'How do I request a special meal?',                        category: 'service' },
  { q: 'What is a Companion Voucher?',                            category: 'executive-club' },
  { q: 'How much does extra baggage cost?',                       category: 'baggage' },
  { q: 'What lounges can Silver members use?',                    category: 'lounge' },
  { q: 'What are the best destinations to visit in winter?',      category: 'destination' },
  { q: 'How do I claim UK261 compensation?',                      category: 'uk261' },
  { q: 'Do I need a visa for the USA?',                           category: 'travel' },
  { q: 'Can I travel with an infant on BA?',                      category: 'service' },
];
