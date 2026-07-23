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

  let result;
  try {
    result = await sendToGemini(text, geminiHistory);
  } catch (err) {
    // Gemini call failed (network, quota, API error) — don't let this
    // bubble up and crash the voice agent, degrade gracefully instead.
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