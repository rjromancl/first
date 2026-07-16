/**
 * VoiceAgent.jsx
 *
 * Fully intelligent voice assistant:
 *  1. SINGLE-SHOT: one utterance books a flight (extracts from, to, dates, cabin, adults)
 *  2. TWO-OPTIONS: AI presents exactly 2 choices as large tappable/speakable buttons
 *  3. HANDS-FREE PASSENGER COLLECTION: mic auto-restarts after each answer,
 *     AI speaks the next question, user answers, repeat until all 7 fields done
 *  4. CONTINUOUS mode during passenger collection (mic never closes between fields)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaMicrophone, FaMicrophoneSlash, FaTimes, FaPlane,
  FaPaperPlane, FaVolumeUp, FaVolumeMute, FaKeyboard,
  FaRedo, FaExpand, FaCompress, FaUser, FaCheckCircle,
  FaHeadphones, FaArrowRight,
} from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import { parseVoiceInput, speak, stopSpeaking } from '../../utils/voiceNLP';
import './VoiceAgent.css';

// ── Constants ────────────────────────────────────────────────────
const WELCOME = {
  id: 'welcome', role: 'agent', timestamp: new Date(),
  text: "Hello! I'm your British Airways assistant. I can book flights, handle check-in, track flights and collect your travel details by voice. Try saying: Book London to New York for Christmas in business class.",
  quickReplies: ['Book a flight', 'Check in', 'Flight status', 'Destinations'],
};

const PAX_FIELDS = [
  { key: 'firstName',   label: 'First Name',    q: 'What is your first name?' },
  { key: 'lastName',    label: 'Last Name',      q: 'And your last name?' },
  { key: 'email',       label: 'Email',          q: 'What is your email address?' },
  { key: 'phone',       label: 'Phone',          q: 'What is your phone number including the country code?' },
  { key: 'dob',         label: 'Date of Birth',  q: 'What is your date of birth? Please say the day, month and year.' },
  { key: 'passport',    label: 'Passport No.',   q: 'What is your passport number?' },
  { key: 'nationality', label: 'Nationality',    q: 'And finally, what is your nationality?' },
];

let _id = 1;
const mkId = () => `m${Date.now()}${_id++}`;

// ── Passenger Progress Card ──────────────────────────────────────
function PassengerCard({ collected, currentField, currentQuestion }) {
  const done = PAX_FIELDS.filter(f => collected[f.key]);
  if (done.length === 0 && !currentField) return null;
  return (
    <div className="va-passenger-card">
      <div className="va-passenger-card-header">
        <FaUser size={12} />
        <span>Collecting passenger details</span>
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
                ? <span className="va-passenger-field-value"><FaCheckCircle size={10} /> {f.key === 'passport' ? '••••••••' : val}</span>
                : isActive
                  ? <span className="va-passenger-field-waiting">Listening…</span>
                  : <span className="va-passenger-field-empty">{f.placeholder || '–'}</span>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Two-Option Buttons ───────────────────────────────────────────
function TwoOptions({ options, onChoose, disabled }) {
  if (!options || options.length !== 2) return null;
  return (
    <div className="va-two-options">
      {options.map(opt => (
        <button key={opt} className="va-two-option-btn" onClick={() => onChoose(opt)} disabled={disabled}>
          {opt} <FaArrowRight size={12} />
        </button>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function VoiceAgent() {
  const { voiceAgentOpen, closeVoiceAgent, setSearchParams } = useApp();
  const navigate = useNavigate();

  // UI state
  const [messages,      setMessages]      = useState([WELCOME]);
  const [inputText,     setInputText]     = useState('');
  const [isProcessing,  setIsProcessing]  = useState(false);
  const [isSpeaking,    setIsSpeaking]    = useState(false);
  const [ttsEnabled,    setTtsEnabled]    = useState(true);
  const [inputMode,     setInputMode]     = useState('voice');
  const [isExpanded,    setIsExpanded]    = useState(false);
  const [agentStatus,   setAgentStatus]   = useState('idle');
  const [interimText,   setInterimText]   = useState('');
  const [handsFree,     setHandsFree]     = useState(true); // default ON

  // Gemini history
  const [geminiHistory, setGeminiHistory] = useState([]);

  // Passenger collection
  const [collectingPax, setCollectingPax] = useState(false);
  const [paxData,       setPaxData]       = useState({});
  const [currentField,  setCurrentField]  = useState(null);
  const [currentQ,      setCurrentQ]      = useState('');
  const [awaitingTwoOpt,setAwaitingTwoOpt]= useState(false);

  // Refs
  const messagesEndRef  = useRef(null);
  const inputRef        = useRef(null);
  const pendingNavRef   = useRef(null);
  const mountedRef      = useRef(true);

  // Live refs to avoid stale closures
  const geminiHistoryRef = useRef(geminiHistory);
  const paxDataRef       = useRef(paxData);
  const collectingRef    = useRef(collectingPax);
  const currentFieldRef  = useRef(currentField);
  const isProcessingRef  = useRef(isProcessing);
  const ttsEnabledRef    = useRef(ttsEnabled);
  const handsFreeRef     = useRef(handsFree);

  useEffect(() => { geminiHistoryRef.current = geminiHistory; },   [geminiHistory]);
  useEffect(() => { paxDataRef.current       = paxData; },        [paxData]);
  useEffect(() => { collectingRef.current    = collectingPax; },  [collectingPax]);
  useEffect(() => { currentFieldRef.current  = currentField; },   [currentField]);
  useEffect(() => { isProcessingRef.current  = isProcessing; },   [isProcessing]);
  useEffect(() => { ttsEnabledRef.current    = ttsEnabled; },     [ttsEnabled]);
  useEffect(() => { handsFreeRef.current     = handsFree; },      [handsFree]);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Scroll to bottom
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Message helpers ─────────────────────────────────────────────
  const addUserMsg = useCallback((text) => {
    setMessages(p => [...p, { id: mkId(), role: 'user', text, timestamp: new Date() }]);
  }, []);

  const addAgentMsg = useCallback((text, quickReplies = [], action = null) => {
    setMessages(p => [...p, { id: mkId(), role: 'agent', text, timestamp: new Date(), quickReplies, action }]);
  }, []);

  // ── TTS ─────────────────────────────────────────────────────────
  const speakMessage = useCallback(async (text) => {
    if (!ttsEnabledRef.current || !window.speechSynthesis) return;
    const clean = text.replace(/[^\x00-\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (mountedRef.current) setIsSpeaking(true);
    try { await speak(clean, { rate: 0.92, pitch: 1.0, lang: 'en-GB' }); } catch (_) {}
    if (mountedRef.current) setIsSpeaking(false);
  }, []);

  // ── Voice recognition callbacks (stable refs — declared BEFORE hook) ──
  const processInputRef  = useRef(null);
  const handleVoiceResult = useCallback((transcript) => {
    setInterimText('');
    processInputRef.current?.(transcript);
  }, []);

  const handleVoiceError = useCallback((error) => {
    if (!mountedRef.current) return;
    setAgentStatus('idle'); setInterimText('');
    if (error === 'not-allowed') {
      addAgentMsg('Microphone access was denied. Please allow mic access in your browser, or use text mode.', ['Switch to text']);
    } else if (error === 'no-speech' && !handsFreeRef.current) {
      addAgentMsg("I didn't hear anything. Tap the mic to try again.");
    }
  }, [addAgentMsg]);

  // ── Voice recognition hook — MUST be before any effect using isListening ──
  const {
    isListening, transcript: liveTranscript, supported: micSupported,
    startListening, stopListening, abortListening,
  } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onError:  handleVoiceError,
    lang: 'en-GB',
    continuous: collectingPax,
  });

  const isListeningRef = useRef(isListening);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { if (liveTranscript) setInterimText(liveTranscript); }, [liveTranscript]);

  // Agent status — safe: isListening declared above
  useEffect(() => {
    setAgentStatus(
      isListening  ? 'listening' :
      isProcessing ? 'thinking'  :
      isSpeaking   ? 'speaking'  : 'idle'
    );
  }, [isListening, isProcessing, isSpeaking]);

  // ── askNextField — speaks a question then auto-starts listening ─
  const askNextField = useCallback(async (fieldKey, question) => {
    if (!mountedRef.current) return;
    setCurrentField(fieldKey);
    setCurrentQ(question);
    addAgentMsg(question);
    await speakMessage(question);
    if (mountedRef.current && !isProcessingRef.current) {
      setTimeout(() => { if (mountedRef.current) startListening(); }, 400);
    }
  }, [addAgentMsg, speakMessage, startListening]);

  // ── processInput — core AI loop ─────────────────────────────────
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

      // COLLECT_PASSENGER — start field-by-field collection
      if (intent === 'COLLECT_PASSENGER') {
        setCollectingPax(true); setPaxData({});
        if (mountedRef.current) setIsProcessing(false);
        addAgentMsg(response.text, response.quickReplies);
        await speakMessage(response.text);
        await askNextField('firstName', PAX_FIELDS[0].q);
        return;
      }

      // PASSENGER_FIELD — save collected fields, ask next or complete
      if (intent === 'PASSENGER_FIELD' && passengerField) {
        const newData = { ...paxDataRef.current, ...(passengerField.collected || {}) };
        setPaxData(newData);
        paxDataRef.current = newData;

        if (passengerField.allCollected) {
          setCollectingPax(false); setCurrentField(null); setCurrentQ('');
          const navState = {
            prefillPassenger: newData,
            ...(entities.from          && { from:       entities.from }),
            ...(entities.to            && { to:         entities.to }),
            ...(entities.departureDate && { departDate: entities.departureDate }),
            ...(entities.returnDate    && { returnDate: entities.returnDate }),
            ...(entities.adults        && { adults:     entities.adults }),
            ...(entities.cabin         && { cabin:      entities.cabin }),
          };
          if (mountedRef.current) setIsProcessing(false);
          addAgentMsg(response.text, response.quickReplies);
          await speakMessage(response.text);
          if (mountedRef.current) navigate('/book', { state: navState });
          return;
        }

        if (mountedRef.current) setIsProcessing(false);
        const nextKey = passengerField.nextField;
        const nextQ   = passengerField.nextQuestion
          || PAX_FIELDS.find(f => f.key === nextKey)?.q
          || `Please tell me your ${nextKey}.`;
        await askNextField(nextKey, nextQ);
        return;
      }

      // PREFILL_BOOKING — all passenger fields collected at once
      if (response.action?.type === 'PREFILL_BOOKING') {
        setCollectingPax(false); setCurrentField(null); setCurrentQ(''); setPaxData({});
        const navState = { prefillPassenger: response.action.passenger, ...entities };
        if (mountedRef.current) setIsProcessing(false);
        addAgentMsg(response.text, response.quickReplies);
        await speakMessage(response.text);
        if (mountedRef.current) navigate('/book', { state: navState });
        return;
      }

      // TWO_OPTIONS — show 2 large buttons AND read options aloud
      if (intent === 'TWO_OPTIONS') {
        setAwaitingTwoOpt(true);
        if (mountedRef.current) setIsProcessing(false);
        addAgentMsg(response.text, response.quickReplies, response.action);
        await speakMessage(response.text);
        if (response.quickReplies?.length === 2) {
          await speakMessage(`Say ${response.quickReplies[0]}, or ${response.quickReplies[1]}.`);
        }
        if (handsFreeRef.current) setTimeout(() => { if (mountedRef.current) startListening(); }, 300);
        return;
      }

      // NAVIGATE — go to page and set search params
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
        addAgentMsg(response.text, response.quickReplies, response.action);
        pendingNavRef.current = response.action.path;
        await speakMessage(response.text);
        return;
      }

      // Plain conversational response
      if (mountedRef.current) setIsProcessing(false);
      addAgentMsg(response.text, response.quickReplies, response.action);
      await speakMessage(response.text);
      if (handsFreeRef.current && !collectingRef.current) {
        setTimeout(() => { if (mountedRef.current) startListening(); }, 600);
      }

    } catch (err) {
      console.error('[VoiceAgent]', err);
      if (!mountedRef.current) return;
      setIsProcessing(false);
      const msg = "I'm sorry, something went wrong. Please try again.";
      addAgentMsg(msg, ['Try again', 'Book a flight']);
      await speakMessage(msg);
    }
  }, [addUserMsg, addAgentMsg, speakMessage, askNextField, startListening, navigate, setSearchParams]);

  // Wire processInput into the stable ref used by handleVoiceResult
  useEffect(() => { processInputRef.current = processInput; }, [processInput]);

  // ── On open/close ───────────────────────────────────────────────
  useEffect(() => {
    if (voiceAgentOpen) {
      const t = setTimeout(async () => {
        if (mountedRef.current) {
          await speakMessage(WELCOME.text);
          if (handsFreeRef.current && mountedRef.current) startListening();
        }
      }, 400);
      return () => clearTimeout(t);
    } else {
      stopSpeaking(); abortListening();
      setCollectingPax(false); setCurrentField(null); setCurrentQ('');
    }
  }, [voiceAgentOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pending navigation after TTS ───────────────────────────────
  useEffect(() => {
    if (!isSpeaking && pendingNavRef.current) {
      const path = pendingNavRef.current;
      pendingNavRef.current = null;
      setTimeout(() => navigate(path), 300);
    }
  }, [isSpeaking, navigate]);

  // ── Hands-free: auto-listen after speaking (non-collection) ────
  useEffect(() => {
    if (handsFree && !isSpeaking && !isProcessing && !isListening && voiceAgentOpen && !collectingPax) {
      const t = setTimeout(() => { if (mountedRef.current) startListening(); }, 700);
      return () => clearTimeout(t);
    }
  }, [handsFree, isSpeaking, isProcessing, isListening, voiceAgentOpen, collectingPax]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Event handlers ──────────────────────────────────────────────
  const handleMicToggle = useCallback(() => {
    stopSpeaking(); setIsSpeaking(false);
    if (isListeningRef.current) { stopListening(); }
    else { setInterimText(''); startListening(); }
  }, [stopListening, startListening]);

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
    setAwaitingTwoOpt(false);
  }, []);

  // Status label
  const statusLabel = {
    idle: collectingPax ? `Asking: ${currentField || ''}` : (handsFree ? 'Hands-free' : 'Ready'),
    listening: collectingPax ? `Listening for ${currentField || 'answer'}…` : 'Listening…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
  }[agentStatus] || 'Ready';

  if (!voiceAgentOpen) return null;

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className={`va-overlay ${isExpanded ? 'va-overlay--expanded' : ''}`} role="dialog" aria-modal="true" aria-label="British Airways Voice Assistant">
      <div className="va-backdrop" onClick={closeVoiceAgent} />
      <div className={`va-panel ${isExpanded ? 'va-panel--expanded' : ''}`}>

        {/* Header */}
        <div className="va-header">
          <div className="va-header-left">
            <div className={`va-avatar ${agentStatus !== 'idle' ? `va-avatar--${agentStatus}` : ''}`}>
              <FaPlane size={16} />
            </div>
            <div className="va-header-info">
              <span className="va-header-name">BA Assistant · Groq AI</span>
              <span className={`va-status va-status--${agentStatus}`}>
                {agentStatus === 'listening' && <span className="va-pulse" />}
                {statusLabel}
              </span>
            </div>
          </div>
          <div className="va-header-actions">
            <button className={`va-icon-btn ${handsFree ? 'va-icon-btn--active' : ''}`} onClick={() => setHandsFree(h => !h)} title="Hands-free" aria-label="Toggle hands-free" aria-pressed={handsFree}>
              <FaHeadphones size={13} />
            </button>
            <button className={`va-icon-btn ${ttsEnabled ? 'va-icon-btn--active' : ''}`} onClick={() => { if (isSpeaking) stopSpeaking(); setTtsEnabled(t => !t); setIsSpeaking(false); }} title="Toggle voice" aria-label="Toggle voice">
              {ttsEnabled ? <FaVolumeUp size={14} /> : <FaVolumeMute size={14} />}
            </button>
            <button className="va-icon-btn" onClick={() => setIsExpanded(e => !e)} title="Expand" aria-label="Expand">
              {isExpanded ? <FaCompress size={13} /> : <FaExpand size={13} />}
            </button>
            <button className="va-icon-btn" onClick={handleClearChat} title="Clear" aria-label="Clear conversation"><FaRedo size={13} /></button>
            <button className="va-icon-btn va-icon-btn--close" onClick={closeVoiceAgent} title="Close" aria-label="Close"><FaTimes size={16} /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="va-messages" role="log" aria-live="polite">
          {messages.map(msg => (
            <div key={msg.id} className={`va-message va-message--${msg.role}`}>
              {msg.role === 'agent' && <div className="va-message-avatar"><FaPlane size={10} /></div>}
              <div className="va-message-content">
                <div className={`va-bubble va-bubble--${msg.role}`}>
                  {msg.text.split('\n').map((l, i, a) => (
                    <React.Fragment key={i}>{l}{i < a.length - 1 && <br />}</React.Fragment>
                  ))}
                </div>
                <span className="va-message-time">{msg.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                {/* Two-option buttons — large and prominent */}
                {msg.quickReplies?.length === 2 && awaitingTwoOpt && (
                  <TwoOptions options={msg.quickReplies} onChoose={handleQuickReply} disabled={isProcessing} />
                )}
                {/* Normal quick replies */}
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

          {/* Passenger card */}
          {collectingPax && <PassengerCard collected={paxData} currentField={currentField} currentQuestion={currentQ} />}

          {/* Interim transcript */}
          {interimText && (
            <div className="va-message va-message--user">
              <div className="va-message-content">
                <div className="va-bubble va-bubble--user va-bubble--interim">{interimText}</div>
              </div>
            </div>
          )}

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

        {/* Input area */}
        <div className="va-input-area">
          <div className="va-mode-toggle">
            <button className={`va-mode-btn ${inputMode === 'voice' ? 'va-mode-btn--active' : ''}`} onClick={() => setInputMode('voice')}>
              <FaMicrophone size={12} /> Voice
            </button>
            <button className={`va-mode-btn ${inputMode === 'text' ? 'va-mode-btn--active' : ''}`} onClick={() => { setInputMode('text'); setTimeout(() => inputRef.current?.focus(), 100); }}>
              <FaKeyboard size={12} /> Text
            </button>
          </div>

          {inputMode === 'voice' ? (
            <div className="va-voice-controls">
              {!micSupported ? (
                <p className="va-no-mic">Voice not supported. Use text mode.</p>
              ) : (
                <>
                  <button
                    className={['va-mic-btn', isListening ? 'va-mic-btn--active' : '', isProcessing ? 'va-mic-btn--processing' : ''].join(' ')}
                    onClick={handleMicToggle}
                    disabled={isProcessing || isSpeaking}
                    aria-label={isListening ? 'Stop' : 'Speak'}
                    aria-pressed={isListening}
                  >
                    <div className="va-mic-rings">
                      {isListening && [1,2,3].map(i => <div key={i} className={`va-mic-ring va-mic-ring--${i}`} />)}
                    </div>
                    {isListening ? <FaMicrophoneSlash size={22} /> : <FaMicrophone size={22} />}
                  </button>
                  <p className="va-mic-hint">
                    {isListening
                      ? (collectingPax ? `Say your ${PAX_FIELDS.find(f => f.key === currentField)?.label || 'answer'}…` : 'Speak now…')
                      : isProcessing ? 'Processing…'
                      : isSpeaking   ? 'Speaking…'
                      : handsFree    ? 'Hands-free on — listening automatically'
                      :                'Tap to speak — or say everything in one sentence!'}
                  </p>
                  {handsFree && <span className="va-handsfree-badge"><FaHeadphones size={10} /> Hands-free</span>}
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleTextSubmit} className="va-text-input-row">
              <input
                ref={inputRef} type="text" className="va-text-input"
                placeholder={collectingPax && currentField ? `Type your ${PAX_FIELDS.find(f => f.key === currentField)?.label}…` : 'Type anything — book, check in, ask about festivals…'}
                value={inputText} onChange={e => setInputText(e.target.value)}
                disabled={isProcessing} aria-label="Type a message"
              />
              <button type="submit" className="va-send-btn" disabled={!inputText.trim() || isProcessing} aria-label="Send">
                <FaPaperPlane size={14} />
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="va-footer">
          <span>Powered by Groq AI (llama-3.3-70b) · </span>
          <button className="va-footer-link" onClick={() => setInputMode('text')}>Having trouble? Use text</button>
        </div>
      </div>
    </div>
  );
}
