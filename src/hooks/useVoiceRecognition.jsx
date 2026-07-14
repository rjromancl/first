/**
 * useVoiceRecognition.jsx
 *
 * Fixes applied:
 *  1. getSpeechRecognition() moved into a ref initialised once at mount
 *     instead of being called in the component body on every render.
 *  2. recognizerRef is re-created only when lang / continuous change,
 *     not on every onResult / onError reference change — callbacks are
 *     always read from a ref so the effect dep array stays stable.
 *  3. Proper cleanup: abort() called on both unmount and effect re-run.
 *  4. 'already started' guard extended to catch InvalidStateError name.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export function useVoiceRecognition({
  onResult,
  onError,
  continuous = false,
  lang = 'en-GB',
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript,  setTranscript]  = useState('');

  // Resolve the constructor once — avoids calling into window on every render
  const SpeechRecognitionRef = useRef(null);
  if (SpeechRecognitionRef.current === null) {
    SpeechRecognitionRef.current =
      (typeof window !== 'undefined' &&
        (window.SpeechRecognition || window.webkitSpeechRecognition)) ||
      false; // false = not supported
  }

  const [supported, setSupported] = useState(!!SpeechRecognitionRef.current);

  // Keep callback refs up-to-date so the recognizer effect never needs to
  // re-run just because onResult / onError identity changed.
  const onResultRef = useRef(onResult);
  const onErrorRef  = useRef(onError);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onErrorRef.current  = onError;  }, [onError]);

  const recognizerRef = useRef(null);

  // Re-create the recognizer only when lang or continuous changes
  useEffect(() => {
    const SpeechRecognition = SpeechRecognitionRef.current;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    // Abort any in-flight session before replacing the instance
    if (recognizerRef.current) {
      try { recognizerRef.current.abort(); } catch (_) {}
    }

    const recognizer = new SpeechRecognition();
    recognizer.lang             = lang;
    recognizer.continuous       = continuous;
    recognizer.interimResults   = true;
    recognizer.maxAlternatives  = 1;

    recognizer.onstart = () => setIsListening(true);
    recognizer.onend   = () => setIsListening(false);

    recognizer.onresult = (event) => {
      const current = event.resultIndex;
      const result  = event.results[current];
      const text    = result[0].transcript;
      const isFinal = result.isFinal;

      setTranscript(text);
      if (isFinal) {
        if (onResultRef.current) onResultRef.current(text);
        setTranscript('');
      }
    };

    recognizer.onerror = (event) => {
      setIsListening(false);
      if (onErrorRef.current) onErrorRef.current(event.error);
    };

    recognizerRef.current = recognizer;

    return () => {
      try { recognizer.abort(); } catch (_) {}
    };
  }, [lang, continuous]); // intentionally excludes onResult/onError — handled via refs

  const startListening = useCallback(() => {
    if (!recognizerRef.current) return;
    try {
      recognizerRef.current.start();
    } catch (e) {
      // InvalidStateError = already started; safe to ignore
      if (e.name !== 'InvalidStateError') console.warn('[useVoiceRecognition] start error:', e);
    }
  }, []); // stable — never needs to change

  const stopListening = useCallback(() => {
    if (!recognizerRef.current) return;
    try { recognizerRef.current.stop(); } catch (_) {}
  }, []);

  const abortListening = useCallback(() => {
    if (!recognizerRef.current) return;
    try {
      recognizerRef.current.abort();
      setIsListening(false);
    } catch (_) {}
  }, []);

  return {
    isListening,
    transcript,
    supported,
    startListening,
    stopListening,
    abortListening,
  };
}
