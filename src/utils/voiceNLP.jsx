/**
 * voiceNLP.jsx
 *
 * Thin adapter layer between VoiceAgent and Gemini.
 *
 * parseVoiceInput() is still the single public API consumed by VoiceAgent —
 * the only change from the original contract is that it is now async and
 * the history array (Gemini multi-turn context) is passed as a third arg.
 *
 * TTS helpers (speak / stopSpeaking / getAvailableVoices) are unchanged.
 */

import { sendToGemini } from '../services/geminiService';
import { preprocessVoiceTranscript } from './smartNLPPreprocessor';

function parseVoiceInputFallback(text) {
  const l = (text || '').toLowerCase();

  const cityMap = {
    london: 'LHR', heathrow: 'LHR', gatwick: 'LGW',
    paris: 'CDG', cdg: 'CDG',
    newyork: 'JFK', 'new york': 'JFK', jfk: 'JFK',
    dubai: 'DXB', dxb: 'DXB',
    tokyo: 'NRT', nrt: 'NRT',
    sydney: 'SYD', syd: 'SYD',
    mumbai: 'BOM', bom: 'BOM',
    chennai: 'MAA', maa: 'MAA',
    delhi: 'DEL', del: 'DEL',
    barcelona: 'BCN', bcn: 'BCN',
    singapore: 'SIN', sin: 'SIN'
  };

  const routeMatch = l.match(/(london|heathrow|gatwick|paris|dubai|chennai|mumbai|delhi|new york|tokyo|sydney|barcelona|singapore)\s+(?:to|poganum|-)\s+(london|heathrow|gatwick|paris|dubai|chennai|mumbai|delhi|new york|tokyo|sydney|barcelona|singapore)/i);

  if (routeMatch || /book|flight|fly|pannu|panren|venum|ticket|poganum|paris|chennai|mumbai|delhi|dubai|london|new york/i.test(l)) {
    const fromCode = routeMatch ? (cityMap[routeMatch[1].toLowerCase().replace(/\s+/g, '')] || 'LHR') : 'LHR';
    const toCode   = routeMatch ? (cityMap[routeMatch[2].toLowerCase().replace(/\s+/g, '')] || 'CDG') : 'CDG';

    return {
      intent: 'BOOK_FLIGHT',
      entities: { from: fromCode, to: toCode, departureDate: '2026-12-28', cabin: 'economy', adults: 1 },
      passengerField: null,
      response: {
        text: `Sure! Searching flights from ${fromCode} to ${toCode}...`,
        quickReplies: ['London to Paris', 'London to New York', 'London to Dubai'],
        action: { type: 'PREFILL_BOOKING', passenger: null }
      }
    };
  }

  return {
    intent: 'HELP',
    entities: {},
    passengerField: null,
    response: {
      text: "I can help you book flights, check in online, and track flight status.",
      quickReplies: ['Book a flight', 'Check in', 'Flight status'],
      action: null
    }
  };
}

// ─── Main async parser ────────────────────────────────────────────
/**
 * @param {string}   text               Raw transcript / typed text from the user
 * @param {object}   conversationContext Legacy context object (kept for compat)
 * @param {Array}    geminiHistory       [{role:'user'|'model', text:'...'}] multi-turn history
 * @returns {Promise<{intent, entities, response, passengerField}>}
 */
export async function parseVoiceInput(text, conversationContext = {}, geminiHistory = []) {
  if (!text || !text.trim()) {
    return {
      intent: 'HELP',
      entities: {},
      passengerField: null,
      response: {
        text: "I didn't catch that — could you say it again, or tap a quick reply below?",
        quickReplies: ['Book a flight', 'Check in', 'Flight status', 'Help'],
        action: null,
      },
    };
  }

  const { cleanText, hasWakeWord, isExit, confidence } = preprocessVoiceTranscript(text);

  if (isExit) {
    return {
      intent: 'EXIT_CONVERSATION',
      entities: {},
      passengerField: null,
      response: {
        text: "Goodbye! Have a wonderful journey with British Airways.",
        quickReplies: ['Book a flight'],
        action: { type: 'EXIT_CONVERSATION' },
      },
    };
  }

  const queryText = cleanText || text.trim();

  let result;
  try {
    result = await sendToGemini(text, geminiHistory);
  } catch (err) {
    console.warn('[voiceNLP] sendToGemini failed:', err?.message || err);
    return {
      intent: 'HELP',
      entities: {},
      passengerField: null,
      response: {
        text: "Sorry, I'm having trouble understanding right now — could you try again, or tap a quick reply below?",
        quickReplies: ['Book a flight', 'Check in', 'Flight status', 'Help'],
        action: null,
      },
    };
  }

  return {
    intent:         result.intent,
    entities:       result.entities       || {},
    passengerField: result.passengerField || null,
    confidence:     result.confidence     || confidence || 0.9,
    response: {
      text:         result.text,
      quickReplies: result.quickReplies   || [],
      action:       result.action         || null,
    },
  };
}

// ─── Text-to-Speech ───────────────────────────────────────────────
/**
 * Pick the best available TTS voice for the requested language.
 * On first page load getVoices() often returns [] because the browser
 * hasn't loaded the list yet — this helper waits for voiceschanged if
 * the list is empty, with a 2 s timeout fallback.
 */
function getPreferredVoice(lang = 'en-GB') {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;

    const pick = () => {
      const voices = synth.getVoices();
      const langPrefix = lang.split('-')[0]; // e.g. 'ta' from 'ta-IN'

      const preferred =
        // Exact requested locale, preferring a female voice where identifiable
        voices.find(v => v.lang === lang && /female|samantha|karen|victoria/i.test(v.name)) ||
        voices.find(v => v.lang === lang) ||
        // Same language, any region (e.g. asked for ta-IN, accept ta-LK)
        voices.find(v => v.lang.startsWith(langPrefix) && /female|samantha|karen|victoria/i.test(v.name)) ||
        voices.find(v => v.lang.startsWith(langPrefix)) ||
        // Fall back to English if the requested language has no voice installed
        voices.find(v => v.lang.startsWith('en-GB') && /female|samantha|karen|victoria/i.test(v.name)) ||
        voices.find(v => v.lang.startsWith('en-GB')) ||
        voices.find(v => v.lang.startsWith('en-US') && /female|samantha|karen|victoria/i.test(v.name)) ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices[0] ||
        null;
      return preferred;
    };

    const immediate = pick();
    if (immediate) { resolve(immediate); return; }

    // Voices not loaded yet — wait for the event (Chrome, Edge)
    let timer;
    const onVoicesChanged = () => {
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(pick());
    };
    synth.addEventListener('voiceschanged', onVoicesChanged);

    // Safety timeout — resolve with null so TTS still runs (browser picks default)
    timer = setTimeout(() => {
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(pick());
    }, 2000);
  });
}

export function speak(text, {
  rate   = 0.95,
  pitch  = 1.0,
  volume = 1.0,
  lang   = 'en-GB',
  voice  = null,
} = {}) {
  // Get the preferred voice first, then speak — avoids async-in-Promise antipattern
  return getPreferredVoice(lang).then((selectedVoice) => {
    return new Promise((resolve, reject) => {
      if (!window.speechSynthesis) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      window.speechSynthesis.cancel();

      const utterance    = new SpeechSynthesisUtterance(text);
      utterance.rate     = rate;
      utterance.pitch    = pitch;
      utterance.volume   = volume;
      utterance.lang     = lang;

      const finalVoice = voice ?? selectedVoice;
      if (finalVoice) utterance.voice = finalVoice;

      // iOS/Chrome bug: synthesis silently stops if the tab is backgrounded.
      // Resuming every 10s keeps it alive. Self-clears once speech ends.
      const keepAlive = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.resume();
        } else {
          clearInterval(keepAlive);
        }
      }, 10000);

      const finish = () => {
        clearInterval(keepAlive);
        resolve();
      };

      utterance.onend = finish;
      utterance.onerror = (e) => {
        // 'interrupted' / 'canceled' fires when cancel() is called — treat as resolved
        if (e.error !== 'interrupted' && e.error !== 'canceled' && e.error !== 'cancelled') {
          // Log but still resolve so the app keeps working
          console.warn('[speak] TTS error:', e.error);
        }
        finish();
      };

      window.speechSynthesis.speak(utterance);
    });
  });
}

export function stopSpeaking() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

export function getAvailableVoices() {
  return window.speechSynthesis?.getVoices() || [];
}