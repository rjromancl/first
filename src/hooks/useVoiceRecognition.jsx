/**
 * useVoiceRecognition.jsx
 *
 * Supports:
 *  - continuous=true: mic stays open, auto-restarts after each result
 *  - continuous=false: single-shot, stops after first final result
 *  - abortedRef prevents auto-restart when user explicitly stops
 *  - onResult/onError via refs so the recognizer is never recreated
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

  const SpeechRecognitionRef = useRef(null);
  if (SpeechRecognitionRef.current === null) {
    SpeechRecognitionRef.current =
      (typeof window !== 'undefined' &&
        (window.SpeechRecognition || window.webkitSpeechRecognition)) ||
      false;
  }

  const [supported, setSupported] = useState(!!SpeechRecognitionRef.current);

  const onResultRef    = useRef(onResult);
  const onErrorRef     = useRef(onError);
  const continuousRef  = useRef(continuous);
  const abortedRef     = useRef(false);
  const recognizerRef  = useRef(null);

  useEffect(() => { onResultRef.current   = onResult;   }, [onResult]);
  useEffect(() => { onErrorRef.current    = onError;    }, [onError]);
  useEffect(() => { continuousRef.current = continuous; }, [continuous]);

  useEffect(() => {
    const SpeechRecognition = SpeechRecognitionRef.current;
    if (!SpeechRecognition) { setSupported(false); return; }

    if (recognizerRef.current) {
      try { recognizerRef.current.abort(); } catch (_) {}
    }

    const r = new SpeechRecognition();
    r.lang            = lang;
    r.continuous      = false; // always false — we handle restart manually
    r.interimResults  = true;
    r.maxAlternatives = 1;

    r.onstart = () => setIsListening(true);

    r.onend = () => {
      setIsListening(false);
      // In continuous mode, auto-restart unless user explicitly stopped
      if (continuousRef.current && !abortedRef.current) {
        setTimeout(() => {
          if (!abortedRef.current && recognizerRef.current === r) {
            try { r.start(); } catch (_) {}
          }
        }, 100); // faster restart — 100ms not 300ms
      }
    };

    r.onresult = (event) => {
      const result  = event.results[event.resultIndex];
      const text    = result[0].transcript;
      const isFinal = result.isFinal;
      setTranscript(text);
      if (isFinal) {
        if (onResultRef.current) onResultRef.current(text);
        setTranscript('');
      }
    };

    r.onerror = (event) => {
      setIsListening(false);
      if (event.error !== 'aborted' && onErrorRef.current) {
        onErrorRef.current(event.error);
      }
    };

    recognizerRef.current = r;
    return () => {
      abortedRef.current = true;
      try { r.abort(); } catch (_) {}
    };
  }, [lang]); // only recreate when lang changes

  const startListening = useCallback(() => {
    if (!recognizerRef.current) return;
    abortedRef.current = false;
    try { recognizerRef.current.start(); } catch (e) {
      if (e.name !== 'InvalidStateError') console.warn('[useVoiceRecognition] start:', e.message);
    }
  }, []);

  const stopListening = useCallback(() => {
    abortedRef.current = true;
    try { recognizerRef.current?.stop(); } catch (_) {}
  }, []);

  const abortListening = useCallback(() => {
    abortedRef.current = true;
    try {
      recognizerRef.current?.abort();
      setIsListening(false);
    } catch (_) {}
  }, []);

  return { isListening, transcript, supported, startListening, stopListening, abortListening };
}
