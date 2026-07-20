/**
 * VoiceAgent.jsx — Pro AI Voice Assistant
 *
 * Features:
 *  - Opens and starts listening IMMEDIATELY — no friction
 *  - Short welcome (5 words spoken, then mic opens)
 *  - Tap mic OR speak while AI is talking to interrupt
 *  - Live waveform bars while listening
 *  - Live transcript shown as floating bar (not chat bubble)
 *  - Hands-free: auto-listens after every AI response
 *  - Full-screen on mobile
 *  - Booking summary card shows captured details in real time
 *  - Single-shot full booking (flight + 4 passenger fields)
 *  - Step-by-step guided collection with voice
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaMicrophone, FaMicrophoneSlash, FaTimes, FaPlane,
  FaPaperPlane, FaVolumeUp, FaVolumeMute, FaKeyboard,
  FaRedo, FaCompress, FaExpand, FaUser, FaCheckCircle,
  FaHeadphones, FaArrowRight, FaBolt,
} from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import { parseVoiceInput, speak, stopSpeaking } from '../../utils/voiceNLP';
import './VoiceAgent.css';

// ── Constants ────────────────────────────────────────────────────
const WELCOME = {
  id: 'welcome', role: 'agent', timestamp: new Date(),
  text: "Hi! Where would you like to fly?",
  quickReplies: ['Book a flight', 'Check in', 'Flight status', 'My Avios'],
};

// Short spoken greeting — keeps it snappy
const WELCOME_SPOKEN = "Hi! I'm your BA assistant. Where would you like to fly?";

const PAX_FIELDS = [
  { key: 'firstName',   label: 'First Name',  q: 'Your first name?' },
  { key: 'lastName',    label: 'Last Name',    q: 'Last name?' },
  { key: 'phone',       label: 'Phone',        q: 'Phone number?' },
  { key: 'nationality', label: 'Nationality',  q: 'Your nationality?' },
];

// Suggested quick commands shown at start
const SUGGESTIONS = [
  'London to New York Christmas',
  'Dubai for Diwali economy',
  'Barcelona next weekend',
  'Check in XYMBA1',
];

let _id = 1;
const mkId = () => `m${Date.now()}${_id++}`;

// ── Waveform — live bars while listening ─────────────────────────
function Waveform({ active }) {
  return (
    <div className={`va-waveform ${active ? 'va-waveform--active' : ''}`}>
      {[1,2,3,4,5,6,7].map(i => (
        <div key={i} className="va-waveform-bar" style={{ animationDelay: `${i * 0.07}s` }} />
      ))}
    </div>
  );
}

// ── Booking Summary Card ──────────────────────────────────────────
function BookingCard({ entities, passenger }) {
  const hasEntities = entities && (entities.to || entities.departureDate);
  const hasPax = passenger && (passenger.firstName || passenger.phone);
  if (!hasEntities && !hasPax) return null;

  return (
    <div className="va-booking-card">
      <div className="va-booking-card-title">
        <FaBolt size={11} /> Captured
      </div>
      {hasEntities && (
        <div className="va-booking-card-row">
          {entities.from && <span className="va-booking-code">{entities.from}</span>}
          {entities.from && entities.to && <FaArrowRight size={10} className="va-booking-arrow" />}
          {entities.to && <span className="va-booking-code">{entities.to}</span>}
          {entities.departureDate && <span className="va-booking-date">{entities.departureDate}</span>}
          {entities.cabin && <span className="va-booking-cabin">{entities.cabin}</span>}
          {entities.adults > 1 && <span className="va-booking-adults">{entities.adults} pax</span>}
        </div>
      )}
      {hasPax && (
        <div className="va-booking-card-pax">
          {passenger.firstName && <span>{passenger.firstName} {passenger.lastName}</span>}
          {passenger.phone && <span>{passenger.phone}</span>}
          {passenger.nationality && <span>{passenger.nationality}</span>}
        </div>
      )}
    </div>
  );
}

// ── Passenger Progress Card ───────────────────────────────────────
function PassengerCard({ collected, currentField, currentQuestion }) {
  const done = PAX_FIELDS.filter(f => collected[f.key]);
  if (done.length === 0 && !currentField) return null;
  return (
    <div className="va-passenger-card">
      <div className="va-passenger-card-header">
        <FaUser size={11} />
        <span>Passenger details</span>
        <span className="va-passenger-progress">{done.length}/{PAX_FIELDS.length}</span>
      </div>
      {currentQuestion && (
        <div className="va-pax-current-question">
          <span className="va-pulse-dot" /> {currentQuestion}
        </div>
      )}
      <div className="va-passenger-fields">
        {PAX_FIELDS.map(f => {
          const val = collected[f.key];
          const isActive = f.key === currentField;
          return (
            <div key={f.key} className={`va-passenger-field ${val ? 'va-passenger-field--done' : ''} ${isActive ? 'va-passenger-field--active' : ''}`}>
              <span className="va-passenger-field-label">{f.label}</span>
              {val
                ? <span className="va-passenger-field-value"><FaCheckCircle size={10} /> {val}</span>
                : isActive
                  ? <span className="va-passenger-field-waiting">Listening…</span>
                  : <span className="va-passenger-field-empty">–</span>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Two large option buttons ──────────────────────────────────────
function TwoOptions({ options, onChoose, disabled }) {
  if (!options || options.length !== 2) return null;
  return (
    <div className="va-two-options">
      {options.map(opt => (
        <button key={opt} className="va-two-option-btn" onClick={() => onChoose(opt)} disabled={disabled}>
          {opt} <FaArrowRight size={11} />
        </button>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function VoiceAgent() {
  const { voiceAgentOpen, closeVoiceAgent, setSearchParams } = useApp();
  const navigate = useNavigate();

  // UI
  const [messages,       setMessages]       = useState([WELCOME]);
  const [inputText,      setInputText]      = useState('');
  const [isProcessing,   setIsProcessing]   = useState(false);
  const [isSpeaking,     setIsSpeaking]     = useState(false);
  const [ttsEnabled,     setTtsEnabled]     = useState(true);
  const [inputMode,      setInputMode]      = useState('voice');
  const [isExpanded,     setIsExpanded]     = useState(false);
  const [agentStatus,    setAgentStatus]    = useState('idle');
  const [interimText,    setInterimText]    = useState('');
  const [handsFree,      setHandsFree]      = useState(true);
  const [awaitingTwoOpt, setAwaitingTwoOpt] = useState(false);
  // Captured entities from AI — shown in BookingCard
  const [capturedEntities, setCapturedEntities] = useState({});
  const [capturedPax,      setCapturedPax]      = useState({});

  // Gemini history
  const [geminiHistory, setGeminiHistory] = useState([]);

  // Passenger collection
  const [collectingPax, setCollectingPax] = useState(false);
  const [paxData,       setPaxData]       = useState({});
  const [currentField,  setCurrentField]  = useState(null);
  const [currentQ,      setCurrentQ]      = useState('');

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const pendingNavRef  = useRef(null);
  const mountedRef     = useRef(true);

  // Live refs — avoid stale closures
  const geminiHistoryRef = useRef(geminiHistory);
  const paxDataRef       = useRef(paxData);
  const collectingRef    = useRef(collectingPax);
  const isProcessingRef  = useRef(isProcessing);
  const ttsEnabledRef    = useRef(ttsEnabled);
  const handsFreeRef     = useRef(handsFree);

  useEffect(() => { geminiHistoryRef.current = geminiHistory; }, [geminiHistory]);
  useEffect(() => { paxDataRef.current       = paxData;       }, [paxData]);
  useEffect(() => { collectingRef.current    = collectingPax; }, [collectingPax]);
  useEffect(() => { isProcessingRef.current  = isProcessing;  }, [isProcessing]);
  useEffect(() => { ttsEnabledRef.current    = ttsEnabled;    }, [ttsEnabled]);
  useEffect(() => { handsFreeRef.current     = handsFree;     }, [handsFree]);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Helpers ──────────────────────────────────────────────────────
  const addUserMsg = useCallback((text) => {
    setMessages(p => [...p, { id: mkId(), role: 'user', text, timestamp: new Date() }]);
  }, []);

  const addAgentMsg = useCallback((text, quickReplies = [], action = null) => {
    setMessages(p => [...p, { id: mkId(), role: 'agent', text, timestamp: new Date(), quickReplies, action }]);
  }, []);

  // ── TTS — speaks immediately, does NOT block mic in hands-free ──
  const speakMessage = useCallback(async (text) => {
    if (!ttsEnabledRef.current || !window.speechSynthesis) return;
    const clean = text.replace(/[^\x00-\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (mountedRef.current) setIsSpeaking(true);
    try { await speak(clean, { rate: 1.05, pitch: 1.0, lang: 'en-GB' }); } catch (_) {}
    if (mountedRef.current) setIsSpeaking(false);
  }, []);

  // ── Interrupt TTS and start listening immediately ─────────────
  const interruptAndListen = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
    setInterimText('');
    // Small delay so cancellation completes
    setTimeout(() => { if (mountedRef.current) startListening(); }, 80);
  }, []); // startListening added below after hook

  // ── Stable voice callbacks — declared BEFORE hook ─────────────
  const processInputRef = useRef(null);
  const handleVoiceResult = useCallback((transcript) => {
    setInterimText('');
    processInputRef.current?.(transcript);
  }, []);

  const handleVoiceError = useCallback((error) => {
    if (!mountedRef.current) return;
    setAgentStatus('idle'); setInterimText('');
    if (error === 'not-allowed') {
      addAgentMsg('Microphone access denied. Please allow mic access then try again.', ['Use text mode']);
      setInputMode('text');
    }
  }, [addAgentMsg]);

  // ── Voice recognition hook ────────────────────────────────────
  const {
    isListening, transcript: liveTranscript, supported: micSupported,
    startListening, stopListening, abortListening,
  } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onError:  handleVoiceError,
    lang:     'en-GB',
    continuous: collectingPax,
  });

  const isListeningRef = useRef(isListening);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { if (liveTranscript) setInterimText(liveTranscript); }, [liveTranscript]);

  // Patch interruptAndListen to use startListening from hook
  const interruptRef = useRef(null);
  useEffect(() => {
    interruptRef.current = () => {
      stopSpeaking();
      setIsSpeaking(false);
      setInterimText('');
      setTimeout(() => { if (mountedRef.current) startListening(); }, 80);
    };
  }, [startListening]);

  // Agent status
  useEffect(() => {
    setAgentStatus(
      isListening  ? 'listening' :
      isProcessing ? 'thinking'  :
      isSpeaking   ? 'speaking'  : 'idle'
    );
  }, [isListening, isProcessing, isSpeaking]);

  // ── Ask next passenger field ──────────────────────────────────
  const askNextField = useCallback(async (fieldKey, question) => {
    if (!mountedRef.current) return;
    setCurrentField(fieldKey);
    setCurrentQ(question);
    addAgentMsg(question);
    await speakMessage(question);
    if (mountedRef.current && !isProcessingRef.current) {
      setTimeout(() => { if (mountedRef.current) startListening(); }, 200);
    }
  }, [addAgentMsg, speakMessage, startListening]);

  // ── Core processing loop ──────────────────────────────────────
  const processInput = useCallback(async (text) => {
    if (!text || !text.trim() || isProcessingRef.current) return;
    const trimmed = text.trim();
    if (mountedRef.current) setIsProcessing(true);
    addUserMsg(trimmed);

    const updatedHistory = [...geminiHistoryRef.current, { role: 'user', text: trimmed }];

    try {
      const { intent, entities, response, passengerField } =
        await parseVoiceInput(trimmed, {}, updatedHistory);
      if (!mountedRef.current) return;

      setGeminiHistory([...updatedHistory, { role: 'model', text: response.text }]);

      // Update booking card with any extracted entities
      if (entities && Object.values(entities).some(v => v)) {
        setCapturedEntities(prev => ({ ...prev, ...entities }));
      }

      // ── COLLECT_PASSENGER ──────────────────────────────────────
      if (intent === 'COLLECT_PASSENGER') {
        setCollectingPax(true); setPaxData({});
        if (mountedRef.current) setIsProcessing(false);
        addAgentMsg(response.text, response.quickReplies);
        await speakMessage(response.text);
        await askNextField('firstName', PAX_FIELDS[0].q);
        return;
      }

      // ── PASSENGER_FIELD ────────────────────────────────────────
      if (intent === 'PASSENGER_FIELD' && passengerField) {
        const newData = { ...paxDataRef.current, ...(passengerField.collected || {}) };
        setPaxData(newData);
        paxDataRef.current = newData;
        setCapturedPax(newData);

        if (passengerField.allCollected) {
          setCollectingPax(false); setCurrentField(null); setCurrentQ('');
          const ents = { ...capturedEntities, ...entities };
          const navState = {
            prefillPassenger: newData,
            ...(ents.from          && { from:       ents.from }),
            ...(ents.to            && { to:         ents.to }),
            ...(ents.departureDate && { departDate: ents.departureDate }),
            ...(ents.returnDate    && { returnDate: ents.returnDate }),
            ...(ents.adults        && { adults:     ents.adults }),
            ...(ents.cabin         && { cabin:      ents.cabin }),
          };
          if (mountedRef.current) setIsProcessing(false);
          addAgentMsg(response.text, response.quickReplies);
          await speakMessage(response.text);
          if (mountedRef.current) navigate('/book', { state: navState });
          return;
        }

        if (mountedRef.current) setIsProcessing(false);
        const nextKey = passengerField.nextField;
        const nextQ   = passengerField.nextQuestion || PAX_FIELDS.find(f => f.key === nextKey)?.q || `Your ${nextKey}?`;
        await askNextField(nextKey, nextQ);
        return;
      }

      // ── FULL_BOOKING ───────────────────────────────────────────
      if (response.action?.type === 'FULL_BOOKING') {
        setCollectingPax(false); setCurrentField(null); setCurrentQ(''); setPaxData({});
        const navState = {
          prefillPassenger: response.action.passenger,
          from:       entities.from         || '',
          to:         entities.to           || '',
          departDate: entities.departureDate || '',
          returnDate: entities.returnDate   || '',
          adults:     entities.adults       || 1,
          cabin:      entities.cabin        || 'economy',
          tripType:   entities.tripType     || 'return',
          autoSearch: true,
          jumpToStep: 3,
        };
        setSearchParams({ tripType: entities.tripType || 'return', from: entities.from || '', to: entities.to || '', departDate: entities.departureDate || '', returnDate: entities.returnDate || '', adults: entities.adults || 1, cabin: entities.cabin || 'economy' });
        setCapturedPax(response.action.passenger || {});
        if (mountedRef.current) setIsProcessing(false);
        addAgentMsg(response.text, response.quickReplies);
        await speakMessage(response.text);
        if (mountedRef.current) navigate('/book', { state: navState });
        return;
      }

      // ── PREFILL_BOOKING ────────────────────────────────────────
      if (response.action?.type === 'PREFILL_BOOKING') {
        setCollectingPax(false); setCurrentField(null); setCurrentQ(''); setPaxData({});
        const navState = { prefillPassenger: response.action.passenger, ...entities };
        if (mountedRef.current) setIsProcessing(false);
        addAgentMsg(response.text, response.quickReplies);
        await speakMessage(response.text);
        if (mountedRef.current) navigate('/book', { state: navState });
        return;
      }

      // ── TWO_OPTIONS ────────────────────────────────────────────
      if (intent === 'TWO_OPTIONS') {
        setAwaitingTwoOpt(true);
        if (mountedRef.current) setIsProcessing(false);
        addAgentMsg(response.text, response.quickReplies, response.action);
        await speakMessage(response.text);
        if (response.quickReplies?.length === 2) {
          await speakMessage(`${response.quickReplies[0]}, or ${response.quickReplies[1]}?`);
        }
        if (handsFreeRef.current) setTimeout(() => { if (mountedRef.current) startListening(); }, 200);
        return;
      }

      // ── NAVIGATE ───────────────────────────────────────────────
      if (response.action?.type === 'NAVIGATE') {
        setSearchParams({ tripType: entities.tripType || 'return', from: entities.from || '', to: entities.to || '', departDate: entities.departureDate || '', returnDate: entities.returnDate || '', adults: entities.adults || 1, cabin: entities.cabin || 'economy' });
        if (mountedRef.current) setIsProcessing(false);
        addAgentMsg(response.text, response.quickReplies, response.action);
        pendingNavRef.current = response.action.path;
        await speakMessage(response.text);
        return;
      }

      // ── Plain response ─────────────────────────────────────────
      if (mountedRef.current) setIsProcessing(false);
      addAgentMsg(response.text, response.quickReplies, response.action);
      await speakMessage(response.text);
      if (handsFreeRef.current && !collectingRef.current) {
        setTimeout(() => { if (mountedRef.current) startListening(); }, 200);
      }

    } catch (err) {
      console.error('[VoiceAgent]', err);
      if (!mountedRef.current) return;
      setIsProcessing(false);
      const msg = "Sorry, something went wrong. Try again.";
      addAgentMsg(msg, ['Try again', 'Book a flight']);
      await speakMessage(msg);
    }
  }, [addUserMsg, addAgentMsg, speakMessage, askNextField, startListening, navigate, setSearchParams, capturedEntities]);

  useEffect(() => { processInputRef.current = processInput; }, [processInput]);

  // ── Lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    if (voiceAgentOpen) {
      // Open: speak short greeting then start listening immediately
      const t = setTimeout(async () => {
        if (!mountedRef.current) return;
        await speakMessage(WELCOME_SPOKEN);
        if (mountedRef.current) startListening();
      }, 300);
      return () => clearTimeout(t);
    } else {
      stopSpeaking(); abortListening();
      setCollectingPax(false); setCurrentField(null); setCurrentQ('');
      setInterimText(''); setAwaitingTwoOpt(false);
      setCapturedEntities({}); setCapturedPax({});
    }
  }, [voiceAgentOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate after TTS finishes
  useEffect(() => {
    if (!isSpeaking && pendingNavRef.current) {
      const path = pendingNavRef.current;
      pendingNavRef.current = null;
      setTimeout(() => navigate(path), 200);
    }
  }, [isSpeaking, navigate]);

  // Hands-free: auto-listen after AI speaks
  useEffect(() => {
    if (handsFree && !isSpeaking && !isProcessing && !isListening && voiceAgentOpen && !collectingPax) {
      const t = setTimeout(() => { if (mountedRef.current) startListening(); }, 400);
      return () => clearTimeout(t);
    }
  }, [handsFree, isSpeaking, isProcessing, isListening, voiceAgentOpen, collectingPax]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Event handlers ─────────────────────────────────────────────
  const handleMicToggle = useCallback(() => {
    if (isSpeaking) { interruptRef.current?.(); return; }
    stopSpeaking(); setIsSpeaking(false);
    if (isListeningRef.current) { stopListening(); }
    else { setInterimText(''); startListening(); }
  }, [isSpeaking, stopListening, startListening]);

  const handleTextSubmit = useCallback((e) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessingRef.current) return;
    const t = inputText.trim(); setInputText('');
    processInputRef.current(t);
  }, [inputText]);

  const handleQuickReply = useCallback((reply) => {
    if (isProcessingRef.current) return;
    setAwaitingTwoOpt(false);
    processInputRef.current(reply);
  }, []);

  const handleClearChat = useCallback(() => {
    stopSpeaking();
    setMessages([WELCOME]); setGeminiHistory([]); setInterimText('');
    setIsSpeaking(false); setIsProcessing(false);
    setCollectingPax(false); setPaxData({}); setCurrentField(null); setCurrentQ('');
    setAwaitingTwoOpt(false); setCapturedEntities({}); setCapturedPax({});
  }, []);

  // Status label
  const statusLabel = {
    idle:      handsFree ? 'Ready — always listening' : 'Ready',
    listening: collectingPax ? `Listening for ${PAX_FIELDS.find(f=>f.key===currentField)?.label||'answer'}` : 'Listening…',
    thinking:  'Thinking…',
    speaking:  'Tap mic to interrupt',
  }[agentStatus] || 'Ready';

  if (!voiceAgentOpen) return null;
  // ── Render ────────────────────────────────────────────────────
  return (
    <div className={`va-overlay ${isExpanded ? 'va-overlay--expanded' : ''}`}
         role="dialog" aria-modal="true" aria-label="British Airways Voice Assistant">
      <div className="va-backdrop" onClick={closeVoiceAgent} />
      <div className={`va-panel ${isExpanded ? 'va-panel--expanded' : ''}`}>

        {/* ── Header ── */}
        <div className="va-header">
          <div className="va-header-left">
            <div className={`va-avatar va-avatar--${agentStatus}`}>
              {agentStatus === 'listening' ? <Waveform active /> : <FaPlane size={15} />}
            </div>
            <div className="va-header-info">
              <span className="va-header-name">BA Voice Assistant</span>
              <span className={`va-status va-status--${agentStatus}`}>
                {agentStatus === 'listening' && <span className="va-pulse" />}
                {statusLabel}
              </span>
            </div>
          </div>
          <div className="va-header-actions">
            <button className={`va-icon-btn ${handsFree ? 'va-icon-btn--active' : ''}`}
              onClick={() => setHandsFree(h => !h)} title="Hands-free" aria-pressed={handsFree}>
              <FaHeadphones size={13} />
            </button>
            <button className={`va-icon-btn ${ttsEnabled ? 'va-icon-btn--active' : ''}`}
              onClick={() => { stopSpeaking(); setTtsEnabled(t => !t); setIsSpeaking(false); }}>
              {ttsEnabled ? <FaVolumeUp size={14} /> : <FaVolumeMute size={14} />}
            </button>
            <button className="va-icon-btn" onClick={() => setIsExpanded(e => !e)}>
              {isExpanded ? <FaCompress size={13} /> : <FaExpand size={13} />}
            </button>
            <button className="va-icon-btn" onClick={handleClearChat} title="Clear"><FaRedo size={13} /></button>
            <button className="va-icon-btn va-icon-btn--close" onClick={closeVoiceAgent}><FaTimes size={16} /></button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="va-messages" role="log" aria-live="polite">
          {messages.map(msg => (
            <div key={msg.id} className={`va-message va-message--${msg.role}`}>
              {msg.role === 'agent' && <div className="va-message-avatar"><FaPlane size={10} /></div>}
              <div className="va-message-content">
                <div className={`va-bubble va-bubble--${msg.role}`}>
                  {msg.text.split('\n').map((l, i, a) => (
                    <React.Fragment key={i}>{l}{i < a.length-1 && <br />}</React.Fragment>
                  ))}
                </div>
                <span className="va-message-time">
                  {msg.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.quickReplies?.length === 2 && awaitingTwoOpt && (
                  <TwoOptions options={msg.quickReplies} onChoose={handleQuickReply} disabled={isProcessing} />
                )}
                {msg.quickReplies?.length > 0 && !(msg.quickReplies.length === 2 && awaitingTwoOpt) && (
                  <div className="va-quick-replies">
                    {msg.quickReplies.map(r => (
                      <button key={r} className="va-quick-reply" onClick={() => handleQuickReply(r)} disabled={isProcessing}>{r}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Booking summary card */}
          <BookingCard entities={capturedEntities} passenger={capturedPax} />

          {/* Passenger collection card */}
          {collectingPax && <PassengerCard collected={paxData} currentField={currentField} currentQuestion={currentQ} />}

          {/* Thinking dots */}
          {isProcessing && (
            <div className="va-message va-message--agent">
              <div className="va-message-avatar"><FaPlane size={10} /></div>
              <div className="va-message-content">
                <div className="va-bubble va-bubble--agent va-bubble--thinking"><span /><span /><span /></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Live transcript bar (replaces inline interim bubble) ── */}
        {interimText && (
          <div className="va-interim-bar">
            <Waveform active />
            <span className="va-interim-text">{interimText}</span>
          </div>
        )}

        {/* ── Input area ── */}
        <div className="va-input-area">
          <div className="va-mode-toggle">
            <button className={`va-mode-btn ${inputMode==='voice'?'va-mode-btn--active':''}`} onClick={() => setInputMode('voice')}>
              <FaMicrophone size={12} /> Voice
            </button>
            <button className={`va-mode-btn ${inputMode==='text'?'va-mode-btn--active':''}`}
              onClick={() => { setInputMode('text'); setTimeout(() => inputRef.current?.focus(), 100); }}>
              <FaKeyboard size={12} /> Text
            </button>
          </div>

          {inputMode === 'voice' ? (
            <div className="va-voice-controls">
              {!micSupported ? (
                <p className="va-no-mic">Voice not supported in this browser. Use text mode.</p>
              ) : (
                <>
                  <button
                    className={['va-mic-btn', isListening?'va-mic-btn--active':'', isProcessing?'va-mic-btn--processing':'', isSpeaking?'va-mic-btn--interrupt':''].join(' ')}
                    onClick={handleMicToggle}
                    aria-label={isSpeaking ? 'Interrupt' : isListening ? 'Stop' : 'Speak'}
                    aria-pressed={isListening}
                  >
                    <div className="va-mic-rings">
                      {isListening && [1,2,3].map(i => <div key={i} className={`va-mic-ring va-mic-ring--${i}`} />)}
                    </div>
                    {isSpeaking
                      ? <FaVolumeMute size={22} />
                      : isListening
                        ? <FaMicrophoneSlash size={22} />
                        : <FaMicrophone size={22} />
                    }
                  </button>
                  <p className="va-mic-hint">
                    {isSpeaking   ? 'Tap to interrupt'
                    : isListening ? (collectingPax ? `Say your ${PAX_FIELDS.find(f=>f.key===currentField)?.label||'answer'}…` : 'Speak now…')
                    : isProcessing ? 'Thinking…'
                    : handsFree   ? 'Hands-free on'
                    :               'Tap to speak'}
                  </p>
                  {handsFree && <span className="va-handsfree-badge"><FaHeadphones size={10} /> Always listening</span>}
                  {/* Suggestion chips on first open */}
                  {messages.length <= 1 && !isListening && !isProcessing && (
                    <div className="va-suggestions">
                      {SUGGESTIONS.map(s => (
                        <button key={s} className="va-suggestion-chip" onClick={() => processInputRef.current(s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleTextSubmit} className="va-text-input-row">
              <input ref={inputRef} type="text" className="va-text-input"
                placeholder={collectingPax && currentField ? `Your ${PAX_FIELDS.find(f=>f.key===currentField)?.label}…` : 'Say or type anything…'}
                value={inputText} onChange={e => setInputText(e.target.value)}
                disabled={isProcessing} aria-label="Type a message" />
              <button type="submit" className="va-send-btn" disabled={!inputText.trim()||isProcessing}>
                <FaPaperPlane size={14} />
              </button>
            </form>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="va-footer">
          <span>Groq AI · llama-3.3-70b · </span>
          <button className="va-footer-link" onClick={() => setInputMode('text')}>Switch to text</button>
        </div>

      </div>
    </div>
  );
}
