/**
 * useVoiceRecognition.jsx
 *
 * Key behaviour for single-shot long commands:
 *  - r.continuous = true so the browser never cuts off mid-sentence
 *  - Interim results are accumulated into a running transcript
 *  - A silence timer (900ms) fires onResult once the user stops speaking
 *  - The silence timer resets on every new interim result (word detected)
 *  - abortedRef prevents auto-restart when user explicitly stops
 */
import { useState, useEffect, useRef, useCallback } from 'react';

// How long (ms) of silence before we treat the utterance as complete
// Set high enough to survive natural mid-sentence pauses in long commands
// e.g. "Book London to Paris on Christmas economy, John Smith, 07911223344"
const SILENCE_TIMEOUT_MS = 2500;

export function useVoiceRecognition({
  onResult,
  onError,
  continuous = false,
  lang = 'en-GB',
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript,  setTranscript]  = useState('');

  const SpeechRecognitionRef = useRef(null);
  if (SpeechRecognitionRef.current === null) {
    SpeechRecognitionRef.current =
      (typeof window !== 'undefined' &&
        (window.SpeechRecognition || window.webkitSpeechRecognition)) ||
      false;
  }

  const [supported, setSupported] = useState(!!SpeechRecognitionRef.current);

  const onResultRef                = useRef(onResult);
  const onErrorRef                 = useRef(onError);
  const continuousRef              = useRef(continuous);
  const abortedRef                 = useRef(false);
  const recognizerRef              = useRef(null);
  const lastProcessedTranscriptRef = useRef('');
  const restartTimerRef            = useRef(null);
  const silenceTimerRef            = useRef(null);   // fires when user stops speaking
  const accumulatedRef             = useRef('');      // full transcript accumulated so far

  useEffect(() => { onResultRef.current   = onResult;   }, [onResult]);
  useEffect(() => { onErrorRef.current    = onError;    }, [onError]);
  useEffect(() => { continuousRef.current = continuous; }, [continuous]);

  // Fire onResult with the full accumulated transcript
  const fireFinal = useCallback((text) => {
    clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;
    const clean = text.trim();
    if (clean && clean !== lastProcessedTranscriptRef.current) {
      lastProcessedTranscriptRef.current = clean;
      if (onResultRef.current) onResultRef.current(clean);
    }
    accumulatedRef.current = '';
    setTranscript('');
  }, []);

  useEffect(() => {
    const SpeechRecognition = SpeechRecognitionRef.current;
    if (!SpeechRecognition) { setSupported(false); return; }

    if (recognizerRef.current) {
      try { recognizerRef.current.abort(); } catch (_) {}
    }

    const r = new SpeechRecognition();
    r.lang            = lang;
    r.continuous      = true;   // stay open — never cut off mid-sentence
    r.interimResults  = true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      setIsListening(true);
      accumulatedRef.current = '';
      lastProcessedTranscriptRef.current = '';
    };

    r.onend = () => {
      setIsListening(false);
      // If there's accumulated text that hasn't been fired yet, fire it now
      if (accumulatedRef.current.trim()) {
        fireFinal(accumulatedRef.current);
      }
      // In continuous/hands-free mode, auto-restart
      if (continuousRef.current && !abortedRef.current) {
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          if (!abortedRef.current && recognizerRef.current === r) {
            try { r.start(); } catch (_) {}
          }
        }, 150);
      }
    };

    r.onresult = (event) => {
      // Accumulate ALL results (not just the current index) into one string
      let interim = '';
      let finalSegments = '';

      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        const txt = res[0]?.transcript || '';
        if (res.isFinal) {
          finalSegments += txt + ' ';
        } else {
          interim += txt;
        }
      }

      const fullSoFar = (finalSegments + interim).trim();
      accumulatedRef.current = fullSoFar;
      setTranscript(fullSoFar);

      // Reset silence timer on every new word detected
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        // User stopped speaking — fire the full accumulated transcript
        if (accumulatedRef.current.trim()) {
          fireFinal(accumulatedRef.current);
          // Stop the recognizer after firing (it will auto-restart if hands-free)
          if (!abortedRef.current) {
            try { r.stop(); } catch (_) {}
          }
        }
      }, SILENCE_TIMEOUT_MS);
    };

    r.onerror = (event) => {
      setIsListening(false);
      clearTimeout(silenceTimerRef.current);
      if (event.error !== 'aborted' && event.error !== 'no-speech' && onErrorRef.current) {
        onErrorRef.current(event.error);
      }
    };

    recognizerRef.current = r;
    return () => {
      abortedRef.current = true;
      clearTimeout(restartTimerRef.current);
      clearTimeout(silenceTimerRef.current);
      restartTimerRef.current = null;
      silenceTimerRef.current = null;
      try { r.abort(); } catch (_) {}
    };
  }, [lang, fireFinal]);

  const startListening = useCallback(() => {
    if (!recognizerRef.current) return;
    abortedRef.current = false;
    accumulatedRef.current = '';
    lastProcessedTranscriptRef.current = '';
    clearTimeout(silenceTimerRef.current);
    try { recognizerRef.current.start(); } catch (e) {
      if (e.name !== 'InvalidStateError') console.warn('[useVoiceRecognition] start:', e.message);
    }
  }, []);

  const stopListening = useCallback(() => {
    abortedRef.current = true;
    clearTimeout(silenceTimerRef.current);
    // Fire whatever we have accumulated before stopping
    if (accumulatedRef.current.trim()) {
      fireFinal(accumulatedRef.current);
    }
    try { recognizerRef.current?.stop(); } catch (_) {}
  }, [fireFinal]);

  const abortListening = useCallback(() => {
    abortedRef.current = true;
    clearTimeout(silenceTimerRef.current);
    accumulatedRef.current = '';
    try {
      recognizerRef.current?.abort();
      setIsListening(false);
    } catch (_) {}
  }, []);

  return { isListening, transcript, supported, startListening, stopListening, abortListening };
}
