/**
 * helpService.js — RAG-augmented Groq AI for the Help & Support page.
 *
 * Different from geminiService.js (which is booking-focused):
 *  - System prompt is pure policy Q&A — no booking logic
 *  - Returns { text, sources, suggestedQuestions, intent, confidence }
 *  - Sources come from RAG document category labels so the UI can
 *    render citation chips next to each answer
 *  - Works entirely with the existing /api/rag/context backend endpoint
 *    and falls back to the local vectorService corpus if offline
 */

import { queryDocuments } from './vectorService';

const API_KEY = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 400;
const MAX_HISTORY_TURNS = 10;
const IS_DEV = Boolean(import.meta.env?.DEV);

const log = (...a) => IS_DEV && console.log('[helpService]', ...a);
const logErr = (...a) => IS_DEV ? console.error('[helpService]', ...a) : console.error('[helpService]', a[0]);

// ── Help system prompt ──────────────────────────────────────────────────────
function buildHelpSystemPrompt(ragContext) {
  const now = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const contextBlock = ragContext
    ? `\n\n══════════════════════════════════════════\nOFFICIAL BRITISH AIRWAYS KNOWLEDGE BASE:\n══════════════════════════════════════════\n${ragContext}\n══════════════════════════════════════════\n`
    : '';

  return `You are the British Airways Help & Support AI Agent — an expert, warm, and precise customer service assistant.

Today is ${now}.
${contextBlock}
YOUR ROLE:
- Answer questions about British Airways policies, baggage rules, Avios/Executive Club, check-in, cancellations, UK261 rights, seat selection, lounges, special meals, and travel requirements.
- Use the knowledge base context above as your primary ground truth. Quote specific numbers, weights, and amounts exactly.
- If you don't have enough information to answer confidently, say so clearly and suggest contacting BA directly.
- Never make up prices, compensation amounts, or policy rules.

RESPONSE FORMAT — always return valid JSON:
{
  "text": "Your clear, friendly answer in plain English. Use bullet points for lists. Be specific — include numbers, weights, amounts.",
  "intent": "baggage | avios | checkin | cancellation | uk261 | lounge | seat | special_meal | cabin | general",
  "sources": [
    { "label": "Short source title", "category": "baggage | executive-club | uk261 | lounge | cabin | destination | route | service" }
  ],
  "suggestedQuestions": [
    "A relevant follow-up question the user might want to ask",
    "Another useful follow-up question"
  ],
  "confidence": 0.0
}

RULES:
- text must be conversational, warm, and clear. Max 3 short paragraphs or a bullet list.
- sources: 1–3 items max, only include if you actually used that knowledge area to answer.
- suggestedQuestions: always include exactly 2 short follow-up questions relevant to what was just asked.
- confidence: 0.9+ if answer is in the knowledge base, 0.6 if inferred, 0.3 if uncertain.
- Tone: professional, helpful, distinctly British Airways.`;
}

// ── Offline / local fallback answers ───────────────────────────────────────
const LOCAL_FALLBACKS = {
  baggage: {
    text: `British Airways baggage allowances:\n\n• **Hand baggage**: 1 cabin bag (56×45×25cm, max 23kg) + 1 personal item (40×30×15cm)\n• **Economy (World Traveller)**: 1 checked bag × 23kg\n• **Premium Economy**: 2 bags × 23kg\n• **Business (Club World)**: 2 bags × 32kg\n• **First Class**: 3 bags × 32kg\n\nExecutive Club Silver/Gold members receive an extra checked bag.`,
    intent: 'baggage',
    sources: [{ label: 'Baggage Allowance Policy', category: 'baggage' }],
    suggestedQuestions: ['What are the fees for excess baggage?', 'Can I pay for extra baggage online?'],
  },
  avios: {
    text: `British Airways Avios & Executive Club tiers:\n\n• **Blue** (entry): Earn Avios on all flights\n• **Bronze** (300 Tier Points): Priority check-in, free seat selection 7 days before\n• **Silver** (600 TP): Lounge access, extra bag, 50% Avios bonus\n• **Gold** (1,500 TP): First Class lounges, Concorde Room, 100% Avios bonus\n\nAvios don't expire as long as you have 1 transaction every 36 months.`,
    intent: 'avios',
    sources: [{ label: 'Executive Club Tiers', category: 'executive-club' }],
    suggestedQuestions: ['How do I spend my Avios on a reward flight?', 'How do I earn Avios faster?'],
  },
  uk261: {
    text: `Under UK261 regulations, if your BA flight is delayed or cancelled:\n\n• **Delay 3+ hours on arrival**: You may be entitled to compensation\n• **Short haul (<1,500km)**: £220 per person\n• **Medium haul (1,500–3,500km)**: £350 per person\n• **Long haul (>3,500km)**: £520 per person\n\nCompensation can be reduced by 50% if BA offers re-routing arriving within a certain time window. Extraordinary circumstances (weather, ATC strikes) are exempt.`,
    intent: 'uk261',
    sources: [{ label: 'UK261 Passenger Rights', category: 'uk261' }],
    suggestedQuestions: ['How do I claim UK261 compensation from BA?', 'What counts as extraordinary circumstances?'],
  },
  checkin: {
    text: `British Airways online check-in:\n\n• Opens **24 hours** before scheduled departure\n• Available via ba.com or the BA app\n• Bag drop closes **60 minutes** before long-haul, **45 minutes** before short-haul\n• Gates close **20 minutes** before departure\n• Digital boarding passes accepted at all airports (Apple Wallet / Google Wallet)`,
    intent: 'checkin',
    sources: [{ label: 'Check-in Guidelines', category: 'service' }],
    suggestedQuestions: ['Can I change my seat after checking in?', 'What happens if I miss bag drop?'],
  },
};

function localFallback(question) {
  const q = question.toLowerCase();
  if (/bag|luggage|carry|weight|23kg|32kg|suitcase/.test(q)) return LOCAL_FALLBACKS.baggage;
  if (/avios|tier|executive club|bronze|silver|gold|points|miles/.test(q)) return LOCAL_FALLBACKS.avios;
  if (/uk261|eu261|delay|cancel|compensation|refund/.test(q)) return LOCAL_FALLBACKS.uk261;
  if (/check.?in|checkin|boarding|gate|bag drop/.test(q)) return LOCAL_FALLBACKS.checkin;

  return {
    text: "I'm having trouble connecting to my knowledge base right now. Please try again in a moment, or visit **ba.com/help** for official British Airways support.",
    intent: 'general',
    sources: [],
    suggestedQuestions: ['What is the baggage allowance?', 'How do I claim a flight delay refund?'],
    confidence: 0.3,
  };
}

// ── Retry helper ────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isRetryable = s => !s || s === 429 || s >= 500;

// ── Main ask function ───────────────────────────────────────────────────────
/**
 * Ask the Help AI a question.
 *
 * @param {string} question         User's question
 * @param {Array}  conversationHistory  [{role, content}] prior turns (capped internally)
 * @returns {Promise<{text, intent, sources, suggestedQuestions, confidence}>}
 */
export async function askHelpAgent(question, conversationHistory = []) {
  if (!question?.trim()) return localFallback('');

  log('Question:', question);

  // 1. Fetch RAG context from backend (or local fallback)
  let ragContext = null;
  try {
    const docs = await queryDocuments(question.trim(), 5);
    if (docs?.length > 0 && docs[0].text) {
      ragContext = docs.map(d => d.text).join('\n\n---\n\n');
      log(`RAG context: ${ragContext.length} chars`);
    }
  } catch (e) {
    logErr('RAG fetch failed:', e.message);
  }

  if (!API_KEY) {
    logErr('No API key — using local fallback');
    return localFallback(question);
  }

  const systemPrompt = buildHelpSystemPrompt(ragContext);
  const capped = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...capped,
    { role: 'user', content: question },
  ];

  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          max_tokens: 700,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      });

      clearTimeout(timeout);

      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        lastErr.status = res.status;
        if (!isRetryable(res.status)) break;
        continue;
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response');

      const parsed = JSON.parse(content);
      log('Parsed:', parsed);

      return {
        text:               parsed.text               || "I couldn't find a clear answer. Please check ba.com/help.",
        intent:             parsed.intent             || 'general',
        sources:            Array.isArray(parsed.sources) ? parsed.sources.slice(0, 3) : [],
        suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions.slice(0, 2) : [],
        confidence:         typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
      };

    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      if (err.name === 'AbortError') { logErr('Timeout on attempt', attempt + 1); continue; }
      if (err instanceof SyntaxError) break;
      logErr('Error on attempt', attempt + 1, err.message);
    }
  }

  logErr('All attempts failed:', lastErr?.message);
  return localFallback(question);
}

// ── Category icon map (used by UI) ─────────────────────────────────────────
export const CATEGORY_ICONS = {
  'baggage':       '🧳',
  'executive-club':'⭐',
  'uk261':         '⚖️',
  'lounge':        '🛋️',
  'cabin':         '💺',
  'destination':   '🌍',
  'route':         '✈️',
  'service':       '🛎️',
  'checkin':       '✅',
  'general':       '📋',
};

// ── Suggested starter questions shown on empty state ───────────────────────
export const STARTER_QUESTIONS = [
  { q: 'What is the baggage allowance for Economy?',           category: 'baggage'       },
  { q: 'How do I earn Avios on flights?',                      category: 'executive-club'},
  { q: 'What are my rights if my flight is delayed?',          category: 'uk261'         },
  { q: 'When does online check-in open?',                      category: 'checkin'       },
  { q: 'How do I access the BA lounge?',                       category: 'lounge'        },
  { q: 'What is Club World Business Class like?',              category: 'cabin'         },
  { q: 'Can I change my flight after booking?',                category: 'general'       },
  { q: 'How do I request a special meal?',                     category: 'service'       },
  { q: 'What is a Companion Voucher?',                         category: 'executive-club'},
  { q: 'How do I claim UK261 compensation?',                   category: 'uk261'         },
  { q: 'How much does extra baggage cost?',                    category: 'baggage'       },
  { q: 'What lounges can Silver members use?',                 category: 'lounge'        },
];
