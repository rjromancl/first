/**
 * VoiceAgent.jsx — Gemini-powered British Airways voice assistant.
 *
 * Fix log (all issues resolved without changing functionality):
 *
 * 1. HOOK ORDER: useVoiceRecognition moved ABOVE all useEffects that
 *    reference isListening / startListening / abortListening / micSupported.
 *    Previously those values were used before the hook was called (TDZ).
 *
 * 2. STALE CLOSURES: ttsEnabled, handsFree, isProcessing all exposed via
 *    live refs (ttsEnabledRef, handsFreeRef) so async functions and stable
 *    useCallbacks always read current values without re-creating.
 *
 * 3. handleVoiceError no longer depends on handsFree state — reads
 *    handsFreeRef.current instead. This breaks the dependency chain that
 *    caused useVoiceRecognition to tear down and re-create the
 *    SpeechRecognition instance on every handsFree toggle.
 *
 * 4. speakMessage and processInput converted to useCallback so they are
 *    stable references and their deps are explicit and correct.
 *
 * 5. Unmount guard (mountedRef) prevents setState calls after unmount
 *    in speakMessage and processInput.
 *
 * 6. All useEffect dependency arrays are correct and complete (no
 *    eslint-disable needed except intentional one-shot effects).
 *
 * 7. addAgentMessage / addUserMessage stabilised with useCallback so
 *    they can safely appear in dependency arrays.
 */

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaMicrophone, FaMicrophoneSlash, FaTimes, FaPlane,
  FaPaperPlane, FaVolumeUp, FaVolumeMute, FaKeyboard,
  FaRedo, FaExpand, FaCompress, FaUser, FaCheckCircle,
  FaHeadphones,
} from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import { parseVoiceInput, speak, stopSpeaking } from '../../utils/voiceNLP';
import './VoiceAgent.css';

// ─── Module-level constants (never change) ────────────────────────

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'agent',
  text: "Hello! I'm your British Airways assistant, now powered by Gemini AI. I can book flights, collect your passenger details by voice, check you in, track flights and much more. How can I help you today?",
  timestamp: new Date(),
  quickReplies: [
    'Book a flight', 'Check in online', 'Flight status',
    'My Avios balance', 'Explore destinations',
  ],
};

const PASSENGER_FIELDS = [
  { key: 'firstName',   label: 'First Name',   placeholder: 'John' },
  { key: 'lastName',    label: 'Last Name',     placeholder: 'Smith' },
  { key: 'email',       label: 'Email',         placeholder: 'john@example.com' },
  { key: 'phone',       label: 'Phone',         placeholder: '+44 7700 900000' },
  { key: 'dob',         label: 'Date of Birth', placeholder: '1990-03-15' },
  { key: 'passport',    label: 'Passport No.',  placeholder: 'AB123456' },
  { key: 'nationality', label: 'Nationality',   placeholder: 'British' },
];

let _msgId = 1;
const makeId = () => `msg-${Date.now()}-${_msgId++}`;

// ─── Passenger Progress Card (pure component, no hooks) ───────────

function PassengerCard({ passenger, currentField }) {
  const filled = PASSENGER_FIELDS.filter(f => passenger[f.key]);
  if (filled.length === 0 && !currentField) return null;

  return (
    <div className="va-passenger-card">
      <div className="va-passenger-card-header">
        <FaUser size={12} />
        <span>Collecting passenger details</span>
        <span className="va-passenger-progress">
          {filled.length}/{PASSENGER_FIELDS.length}
        </span>
      </div>
      <div className="va-passenger-fields">
        {PASSENGER_FIELDS.map(f => {
          const val      = passenger[f.key];
          const isActive = f.key === currentField;
          return (
            <div
              key={f.key}
              className={[
                'va-passenger-field',
                val      ? 'va-passenger-field--done'   : '',
                isActive ? 'va-passenger-field--active' : '',
              ].join(' ')}
            >
              <span className="va-passenger-field-label">{f.label}</span>
              {val
                ? <span className="va-passenger-field-value">
                    <FaCheckCircle size={10} />
                    {' '}{f.key === 'passport' ? '••••••••' : val}
                  </span>
                : isActive
                  ? <span className="va-passenger-field-waiting">Waiting…</span>
                  : <span className="va-passenger-field-empty">{f.placeholder}</span>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function VoiceAgent() {
  const { voiceAgentOpen, closeVoiceAgent, setSearchParams } = useApp();
  const navigate = useNavigate();

  // ── 1. All useState declarations first ───────────────────────
  const [messages,            setMessages]            = useState([WELCOME_MESSAGE]);
  const [inputText,           setInputText]           = useState('');
  const [isProcessing,        setIsProcessing]        = useState(false);
  const [isSpeaking,          setIsSpeaking]          = useState(false);
  const [ttsEnabled,          setTtsEnabled]          = useState(true);
  const [inputMode,           setInputMode]           = useState('voice');
  const [isExpanded,          setIsExpanded]          = useState(false);
  const [agentStatus,         setAgentStatus]         = useState('idle');
  const [interimText,         setInterimText]         = useState('');
  const [handsFree,           setHandsFree]           = useState(false);
  const [geminiHistory,       setGeminiHistory]       = useState([]);
  const [collectingPassenger, setCollectingPassenger] = useState(false);
  const [passenger,           setPassenger]           = useState({});
  const [currentPaxField,     setCurrentPaxField]     = useState(null);

  // ── 2. All useRef declarations ────────────────────────────────
  const messagesEndRef  = useRef(null);
  const inputRef        = useRef(null);
  const pendingNavRef   = useRef(null);
  const pendingStateRef = useRef(null);
  const mountedRef      = useRef(true); // unmount guard

  // Live refs — always hold the latest state value so async
  // callbacks and stable useCallbacks never read stale closures.
  const geminiHistoryRef       = useRef(geminiHistory);
  const passengerRef           = useRef(passenger);
  const collectingPassengerRef = useRef(collectingPassenger);
  const currentPaxFieldRef     = useRef(currentPaxField);
  const isProcessingRef        = useRef(isProcessing);
  const ttsEnabledRef          = useRef(ttsEnabled);
  const handsFreeRef           = useRef(handsFree);
  const isListeningRef         = useRef(false); // kept in sync below

  // ── 3. Sync live refs whenever state changes ──────────────────
  // These are intentionally simple one-liner effects.
  useEffect(() => { geminiHistoryRef.current       = geminiHistory;       }, [geminiHistory]);
  useEffect(() => { passengerRef.current            = passenger;           }, [passenger]);
  useEffect(() => { collectingPassengerRef.current  = collectingPassenger; }, [collectingPassenger]);
  useEffect(() => { currentPaxFieldRef.current      = currentPaxField;     }, [currentPaxField]);
  useEffect(() => { isProcessingRef.current         = isProcessing;        }, [isProcessing]);
  useEffect(() => { ttsEnabledRef.current           = ttsEnabled;          }, [ttsEnabled]);
  useEffect(() => { handsFreeRef.current            = handsFree;           }, [handsFree]);

  // Unmount cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── 4. Stable message helpers (useCallback so they can be ─────
  //       safely listed in dependency arrays)
  const addUserMessage = useCallback((text) => {
    setMessages(prev => [...prev, {
      id: makeId(), role: 'user', text, timestamp: new Date(),
    }]);
  }, []);

  const addAgentMessage = useCallback((text, quickReplies = [], action = null) => {
    setMessages(prev => [...prev, {
      id: makeId(), role: 'agent', text, timestamp: new Date(), quickReplies, action,
    }]);
  }, []);

  // ── 5. TTS helper — useCallback, reads ttsEnabledRef ─────────
  const speakMessage = useCallback(async (text) => {
    if (!ttsEnabledRef.current || !window.speechSynthesis) return;
    const clean = text.replace(/[^\x00-\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (mountedRef.current) setIsSpeaking(true);
    try {
      await speak(clean, { rate: 0.95, pitch: 1.0, lang: 'en-GB' });
    } catch (_) { /* ignore TTS errors */ }
    if (mountedRef.current) setIsSpeaking(false);
  }, []); // ttsEnabledRef is a ref — no dep needed

  // ── 6. Voice recognition callbacks — declared BEFORE the hook ─
  //    handleVoiceError reads handsFreeRef so it never needs to
  //    be recreated when handsFree changes, which prevents the
  //    SpeechRecognition instance from being torn down on toggle.
  const handleVoiceError = useCallback((error) => {
    if (!mountedRef.current) return;
    setAgentStatus('idle');
    setInterimText('');
    if (error === 'not-allowed') {
      addAgentMessage(
        'Microphone access was denied. Please allow microphone access in your browser settings, or switch to text mode.',
        ['Switch to text mode'],
      );
    } else if (error === 'no-speech') {
      if (!handsFreeRef.current) {
        addAgentMessage(
          "I didn't hear anything. Tap the microphone and try again, or switch to text mode.",
        );
      }
    }
  }, [addAgentMessage]); // stable — handsFree read via ref

  // handleVoiceResult is declared after processInput (see below)
  // but we need a stable ref for it so useVoiceRecognition doesn't
  // re-create the recognizer. We use a ref-forwarding pattern.
  const handleVoiceResultRef = useRef(null);
  const handleVoiceResult = useCallback((transcript) => {
    setInterimText('');
    // Call through ref so we always invoke the latest processInput
    if (handleVoiceResultRef.current) handleVoiceResultRef.current(transcript);
  }, []); // stable forever — delegates to ref

  // ── 7. useVoiceRecognition — called BEFORE any effect that ────
  //    references isListening / startListening / abortListening
  const {
    isListening,
    transcript: liveTranscript,
    supported: micSupported,
    startListening,
    stopListening,
    abortListening,
  } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onError:  handleVoiceError,
    lang:     'en-GB',
  });

  // Keep isListeningRef in sync (used inside processInput)
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  // Sync interim text from the hook's live transcript
  useEffect(() => {
    if (liveTranscript) setInterimText(liveTranscript);
  }, [liveTranscript]);

  // ── 8. scrollToBottom ─────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // ── 9. Sync agentStatus — now safe: isListening is declared ───
  useEffect(() => {
    setAgentStatus(
      isListening  ? 'listening' :
      isProcessing ? 'thinking'  :
      isSpeaking   ? 'speaking'  : 'idle',
    );
  }, [isListening, isProcessing, isSpeaking]);

  // ── 10. On open/close — now safe: abortListening is declared ──
  useEffect(() => {
    if (voiceAgentOpen) {
      if (ttsEnabledRef.current) {
        const t = setTimeout(() => {
          if (mountedRef.current) speakMessage(WELCOME_MESSAGE.text);
        }, 400);
        return () => clearTimeout(t);
      }
    } else {
      stopSpeaking();
      abortListening();
    }
  }, [voiceAgentOpen, abortListening, speakMessage]);

  // ── 11. Pending navigation after TTS finishes ─────────────────
  useEffect(() => {
    if (!isSpeaking && pendingNavRef.current) {
      const path  = pendingNavRef.current;
      const state = pendingStateRef.current;
      pendingNavRef.current   = null;
      pendingStateRef.current = null;
      const t = setTimeout(() => navigate(path, state ? { state } : undefined), 300);
      return () => clearTimeout(t);
    }
  }, [isSpeaking, navigate]);

  // ── 12. Hands-free auto-listen — now safe: startListening declared
  useEffect(() => {
    if (
      handsFree &&
      !isSpeaking &&
      !isProcessing &&
      !isListening &&
      voiceAgentOpen
    ) {
      const t = setTimeout(() => {
        if (mountedRef.current) startListening();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [handsFree, isSpeaking, isProcessing, isListening, voiceAgentOpen, startListening]);

  // ── 13. Core processing loop ───────────────────────────────────
  // useCallback with empty deps — reads everything via live refs.
  const processInput = useCallback(async (text) => {
    if (!text || !text.trim() || isProcessingRef.current) return;

    const trimmed = text.trim();
    if (mountedRef.current) setIsProcessing(true);
    addUserMessage(trimmed);

    const currentHistory   = geminiHistoryRef.current;
    const currentPassenger = passengerRef.current;

    const updatedHistory = [
      ...currentHistory,
      { role: 'user', text: trimmed },
    ];

    try {
      const { intent, entities, response, passengerField } =
        await parseVoiceInput(trimmed, {}, updatedHistory);

      if (!mountedRef.current) return;

      const newHistory = [
        ...updatedHistory,
        { role: 'model', text: response.text },
      ];
      setGeminiHistory(newHistory);

      // ── Passenger collection start ─────────────────────────
      if (intent === 'COLLECT_PASSENGER') {
        setCollectingPassenger(true);
        setPassenger({});
        setCurrentPaxField('firstName');
      }

      // ── Individual passenger field received ────────────────
      if (intent === 'PASSENGER_FIELD' && passengerField) {
        const { field, value, nextField, allCollected } = passengerField;
        const updatedPassenger = { ...currentPassenger, [field]: value };
        setPassenger(updatedPassenger);
        setCurrentPaxField(nextField || null);

        if (allCollected || !nextField) {
          setCollectingPassenger(false);
          setCurrentPaxField(null);
          const navState = {
            prefillPassenger: updatedPassenger,
            ...(entities.from          && { from:       entities.from }),
            ...(entities.to            && { to:         entities.to }),
            ...(entities.departureDate && { departDate: entities.departureDate }),
            ...(entities.returnDate    && { returnDate: entities.returnDate }),
            ...(entities.adults        && { adults:     entities.adults }),
            ...(entities.cabin         && { cabin:      entities.cabin }),
          };
          if (mountedRef.current) setIsProcessing(false);
          addAgentMessage(response.text, response.quickReplies, response.action);
          await speakMessage(response.text);
          if (mountedRef.current) navigate('/book', { state: navState });
          return;
        }
      }

      // ── PREFILL_BOOKING action ─────────────────────────────
      if (response.action?.type === 'PREFILL_BOOKING') {
        const navState = {
          prefillPassenger: response.action.passenger,
          ...(entities.from          && { from:       entities.from }),
          ...(entities.to            && { to:         entities.to }),
          ...(entities.departureDate && { departDate: entities.departureDate }),
          ...(entities.adults        && { adults:     entities.adults }),
          ...(entities.cabin         && { cabin:      entities.cabin }),
        };
        setCollectingPassenger(false);
        setCurrentPaxField(null);
        setPassenger({});
        if (mountedRef.current) setIsProcessing(false);
        addAgentMessage(response.text, response.quickReplies);
        await speakMessage(response.text);
        if (mountedRef.current) navigate('/book', { state: navState });
        return;
      }

      // ── Standard NAVIGATE action ───────────────────────────
      if (response.action?.type === 'NAVIGATE') {
        if (entities.from || entities.to) {
          setSearchParams({
            from:       entities.from         || '',
            to:         entities.to           || '',
            departDate: entities.departureDate || '',
            returnDate: entities.returnDate   || '',
            adults:     entities.adults        || 1,
            cabin:      entities.cabin         || 'economy',
          });
        }
        if (mountedRef.current) setIsProcessing(false);
        addAgentMessage(response.text, response.quickReplies, response.action);
        if (ttsEnabledRef.current) {
          pendingNavRef.current   = response.action.path;
          pendingStateRef.current = null;
          await speakMessage(response.text);
        } else {
          await speakMessage(response.text);
          const t = setTimeout(() => navigate(response.action.path), 800);
          // no cleanup needed — component stays mounted during navigation
          void t;
        }
        return;
      }

      // ── Plain conversational response ──────────────────────
      if (mountedRef.current) setIsProcessing(false);
      addAgentMessage(response.text, response.quickReplies, response.action);
      await speakMessage(response.text);

    } catch (err) {
      console.error('[VoiceAgent] processInput error:', err);
      if (!mountedRef.current) return;
      setIsProcessing(false);
      const errText = "I'm sorry, something went wrong. Please try again.";
      addAgentMessage(errText, ['Try again', 'Book a flight', 'Help']);
      await speakMessage(errText);
    }
  }, [addUserMessage, addAgentMessage, speakMessage, navigate, setSearchParams]);
  // All other values read via live refs — correct and complete deps.

  // ── 14. Wire processInput into the stable voice-result ref ────
  //    This is the pattern that lets handleVoiceResult (stable) always
  //    call the latest processInput without recreating the recognizer.
  useEffect(() => {
    handleVoiceResultRef.current = processInput;
  }, [processInput]);

  // ── 15. Event handlers ────────────────────────────────────────
  const handleMicToggle = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
    if (isListeningRef.current) {
      stopListening();
    } else {
      setInterimText('');
      startListening();
    }
  }, [stopListening, startListening]);

  const handleTextSubmit = useCallback((e) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessingRef.current) return;
    const text = inputText.trim();
    setInputText('');
    processInput(text);
  }, [inputText, processInput]);

  const handleQuickReply = useCallback((reply) => {
    if (isProcessingRef.current) return;
    processInput(reply);
  }, [processInput]);

  const handleClearChat = useCallback(() => {
    stopSpeaking();
    setMessages([WELCOME_MESSAGE]);
    setGeminiHistory([]);
    setInterimText('');
    setIsSpeaking(false);
    setIsProcessing(false);
    setCollectingPassenger(false);
    setPassenger({});
    setCurrentPaxField(null);
  }, []);

  const handleTtsToggle = useCallback(() => {
    if (isSpeaking) stopSpeaking();
    setTtsEnabled(t => !t);
    setIsSpeaking(false);
  }, [isSpeaking]);

  // ── Derived UI values ─────────────────────────────────────────
  const statusLabel = {
    idle:      'Ready',
    listening: 'Listening…',
    thinking:  'Thinking…',
    speaking:  'Speaking…',
  }[agentStatus] || 'Ready';

  // Early return AFTER all hooks — never before
  if (!voiceAgentOpen) return null;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      className={`va-overlay ${isExpanded ? 'va-overlay--expanded' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="British Airways Voice Assistant"
    >
      <div className="va-backdrop" onClick={closeVoiceAgent} />

      <div className={`va-panel ${isExpanded ? 'va-panel--expanded' : ''}`}>

        {/* ── Header ── */}
        <div className="va-header">
          <div className="va-header-left">
            <div className={`va-avatar ${agentStatus !== 'idle' ? `va-avatar--${agentStatus}` : ''}`}>
              <FaPlane size={16} />
            </div>
            <div className="va-header-info">
              <span className="va-header-name">BA Assistant · Gemini AI</span>
              <span className={`va-status va-status--${agentStatus}`}>
                {agentStatus === 'listening' && <span className="va-pulse" />}
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="va-header-actions">
            <button
              className={`va-icon-btn ${handsFree ? 'va-icon-btn--active' : ''}`}
              onClick={() => setHandsFree(h => !h)}
              title={handsFree ? 'Hands-free on' : 'Hands-free off'}
              aria-label="Toggle hands-free mode"
              aria-pressed={handsFree}
            >
              <FaHeadphones size={13} />
            </button>

            <button
              className={`va-icon-btn ${ttsEnabled ? 'va-icon-btn--active' : ''}`}
              onClick={handleTtsToggle}
              title={ttsEnabled ? 'Mute voice' : 'Enable voice'}
              aria-label={ttsEnabled ? 'Mute voice' : 'Enable voice'}
            >
              {ttsEnabled ? <FaVolumeUp size={14} /> : <FaVolumeMute size={14} />}
            </button>

            <button
              className="va-icon-btn"
              onClick={() => setIsExpanded(e => !e)}
              title={isExpanded ? 'Collapse' : 'Expand'}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <FaCompress size={13} /> : <FaExpand size={13} />}
            </button>

            <button
              className="va-icon-btn"
              onClick={handleClearChat}
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <FaRedo size={13} />
            </button>

            <button
              className="va-icon-btn va-icon-btn--close"
              onClick={closeVoiceAgent}
              title="Close"
              aria-label="Close assistant"
            >
              <FaTimes size={16} />
            </button>
          </div>
        </div>

        {/* ── Message Area ── */}
        <div className="va-messages" role="log" aria-live="polite" aria-label="Conversation">
          {messages.map((msg) => (
            <div key={msg.id} className={`va-message va-message--${msg.role}`}>
              {msg.role === 'agent' && (
                <div className="va-message-avatar"><FaPlane size={10} /></div>
              )}
              <div className="va-message-content">
                <div className={`va-bubble va-bubble--${msg.role}`}>
                  {msg.text.split('\n').map((line, i, arr) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < arr.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
                <span className="va-message-time">
                  {msg.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.quickReplies?.length > 0 && (
                  <div className="va-quick-replies">
                    {msg.quickReplies.map((reply) => (
                      <button
                        key={reply}
                        className="va-quick-reply"
                        onClick={() => handleQuickReply(reply)}
                        disabled={isProcessing}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {collectingPassenger && (
            <PassengerCard passenger={passenger} currentField={currentPaxField} />
          )}

          {interimText && (
            <div className="va-message va-message--user">
              <div className="va-message-content">
                <div className="va-bubble va-bubble--user va-bubble--interim">
                  {interimText}
                </div>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="va-message va-message--agent">
              <div className="va-message-avatar"><FaPlane size={10} /></div>
              <div className="va-message-content">
                <div className="va-bubble va-bubble--agent va-bubble--thinking">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Area ── */}
        <div className="va-input-area">
          <div className="va-mode-toggle">
            <button
              className={`va-mode-btn ${inputMode === 'voice' ? 'va-mode-btn--active' : ''}`}
              onClick={() => setInputMode('voice')}
            >
              <FaMicrophone size={12} /> Voice
            </button>
            <button
              className={`va-mode-btn ${inputMode === 'text' ? 'va-mode-btn--active' : ''}`}
              onClick={() => {
                setInputMode('text');
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
            >
              <FaKeyboard size={12} /> Text
            </button>
          </div>

          {inputMode === 'voice' ? (
            <div className="va-voice-controls">
              {!micSupported ? (
                <p className="va-no-mic">
                  Your browser doesn't support voice input. Switch to text mode.
                </p>
              ) : (
                <>
                  <button
                    className={[
                      'va-mic-btn',
                      isListening  ? 'va-mic-btn--active'     : '',
                      isProcessing ? 'va-mic-btn--processing' : '',
                    ].join(' ')}
                    onClick={handleMicToggle}
                    disabled={isProcessing || isSpeaking}
                    aria-label={isListening ? 'Stop listening' : 'Start listening'}
                    aria-pressed={isListening}
                  >
                    <div className="va-mic-rings">
                      {isListening && [1, 2, 3].map(i => (
                        <div key={i} className={`va-mic-ring va-mic-ring--${i}`} />
                      ))}
                    </div>
                    {isListening
                      ? <FaMicrophoneSlash size={22} />
                      : <FaMicrophone size={22} />
                    }
                  </button>

                  <p className="va-mic-hint">
                    {isListening
                      ? (collectingPassenger
                          ? `Say your ${PASSENGER_FIELDS.find(f => f.key === currentPaxField)?.label || 'answer'}…`
                          : 'Speak now…')
                      : isProcessing ? 'Processing…'
                      : isSpeaking   ? 'Speaking…'
                      : handsFree    ? 'Hands-free — will listen automatically'
                      :                'Tap the microphone to speak'}
                  </p>

                  {handsFree && (
                    <span className="va-handsfree-badge">
                      <FaHeadphones size={10} /> Hands-free on
                    </span>
                  )}
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleTextSubmit} className="va-text-input-row">
              <input
                ref={inputRef}
                type="text"
                className="va-text-input"
                placeholder={
                  collectingPassenger && currentPaxField
                    ? `Enter your ${PASSENGER_FIELDS.find(f => f.key === currentPaxField)?.label}…`
                    : 'Type your question…'
                }
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                disabled={isProcessing}
                aria-label="Type a message"
              />
              <button
                type="submit"
                className="va-send-btn"
                disabled={!inputText.trim() || isProcessing}
                aria-label="Send message"
              >
                <FaPaperPlane size={14} />
              </button>
            </form>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="va-footer">
          <span>Powered by Gemini AI · </span>
          <button className="va-footer-link" onClick={() => setInputMode('text')}>
            Having trouble? Try text mode
          </button>
        </div>

      </div>
    </div>
  );
}
