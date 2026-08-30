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
  FaHeadphones, FaArrowRight, FaBolt, FaSearch,
} from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { useVoiceRecognition } from '../../hooks/useVoiceRecognition';
import { parseVoiceInput, speak, stopSpeaking } from '../../utils/voiceNLP';
import { LANGUAGES, getTranslation } from '../../utils/translations';
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

// ── Agent Chain-of-Thought Telemetry Trace ─────────────────────
function ThoughtTracePanel({ logs }) {
  if (!logs || logs.length === 0) return null;
  return (
    <div className="va-telemetry-panel">
      <div className="va-telemetry-header">
        <span className="va-telemetry-pulse" />
        <span>Agent Telemetry &amp; CoT Trace</span>
      </div>
      <div className="va-telemetry-logs">
        {logs.map((log, idx) => (
          <div key={idx} className="va-telemetry-line">
            <span className="va-telemetry-time">{log.time}</span>
            <span className="va-telemetry-icon">{log.icon}</span>
            <span className="va-telemetry-msg">{log.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Proactive Smart Deals & Insights ────────────────────────────
function ProactiveDealsCard({ entities }) {
  if (!entities || (!entities.to && !entities.destination)) return null;
  const dest = (entities.to || entities.destination || '').toUpperCase();

  const DEALS = {
    JFK: { text: 'Upgrade to Club World (Business) for just 12,500 Avios!', perk: 'Access to LHR Galleries First Lounge' },
    DXB: { text: 'Earn 2x Avios on Dubai flights booked this month!', perk: 'Complimentary Chauffeur Transfer for First Class' },
    NRT: { text: 'Direct London-Tokyo route operating daily on Boeing 787-9', perk: 'Japanese In-flight Menu & Saké Tasting' },
    SYD: { text: 'Double Tier Points eligible on Sydney flights!', perk: 'Kangaroo Route Lounge Refresh in Singapore' },
    BCN: { text: 'Club Europe fares from £149 — includes 2x 32kg bags', perk: 'Fast Track Security & Lounge Access' }
  };

  const deal = DEALS[dest] || { text: 'Earn Avios on this route with B Airways & Oneworld partners.', perk: 'Flexible Booking Guarantee' };

  return (
    <div className="va-proactive-card">
      <div className="va-proactive-header">
        <FaBolt className="va-proactive-icon" />
        <span>Proactive Agent Insights — {dest}</span>
      </div>
      <div className="va-proactive-body">
        <p className="va-proactive-deal">💡 {deal.text}</p>
        <span className="va-proactive-badge">✨ {deal.perk}</span>
      </div>
    </div>
  );
}

// ── Inline Flight Results Card ──────────────────────────────────
function FlightResultsCard({ flights, entities, onBook }) {
  if (!flights || flights.length === 0) return null;
  const { from = 'LHR', to = '', departureDate = '', cabin = 'economy' } = entities || {};
  return (
    <div className="va-flights-card">
      <div className="va-flights-header">
        <FaPlane size={11} className="va-flights-icon" />
        <span>Available Flights — {from} → {to}</span>
        <span className="va-flights-date">{departureDate}</span>
      </div>
      <div className="va-flights-list">
        {flights.map((f, i) => {
          const price     = f.price?.grandTotal || f.price?.total || '—';
          const dep       = f.itineraries?.[0]?.segments?.[0]?.departure?.at || f.departure || '';
          const arr       = f.itineraries?.[0]?.segments?.at(-1)?.arrival?.at  || f.arrival  || '';
          const depTime   = dep.includes('T') ? dep.split('T')[1].slice(0, 5) : dep.slice(0, 5) || '—';
          const arrTime   = arr.includes('T') ? arr.split('T')[1].slice(0, 5) : arr.slice(0, 5) || '—';
          const stops     = (f.stops ?? f.numberOfStops ?? 0) === 0 ? 'Non-stop' : `${f.stops} stop`;
          const flightNum = f.flightNumber || f.id || `Flight ${i + 1}`;
          return (
            <div key={f.id || i} className="va-flight-row">
              <div className="va-flight-row-left">
                <span className="va-flight-num">{flightNum}</span>
                <span className="va-flight-times">{depTime || '—'} → {arrTime || '—'}</span>
                <span className="va-flight-stops">{stops}</span>
              </div>
              <div className="va-flight-row-right">
                <span className="va-flight-price">£{price}</span>
                <button
                  className="va-flight-book-btn"
                  onClick={() => onBook(f, { from, to, departureDate, cabin })}
                  aria-label={`Book ${flightNum} for £${price}`}
                >
                  Book <FaArrowRight size={9} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Multilingual Voice Accent Selector ─────────────────────────
function LanguageSelector({ lang, onSelect }) {
  return (
    <div className="va-lang-selector">
      {LANGUAGES.map(l => (
        <button
          key={l.code}
          className={`va-lang-chip ${lang === l.code ? 'va-lang-chip--active' : ''}`}
          onClick={() => onSelect(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

// ── Confirmed E-Ticket Card ─────────────────────────────────────
function TicketCard({ booking }) {
  if (!booking) return null;
  const { pnr, paxName, from, to, departureDate, cabin, seat = '14A' } = booking;
  return (
    <div className="va-ticket-card">
      <div className="va-ticket-header">
        <FaCheckCircle className="va-ticket-check" />
        <span>CONFIRMED E-TICKET — PNR: <strong className="va-ticket-pnr">{pnr}</strong></span>
      </div>
      <div className="va-ticket-body">
        <div className="va-ticket-route">
          <span className="va-ticket-code">{from || 'LHR'}</span>
          <FaArrowRight className="va-ticket-arrow" />
          <span className="va-ticket-code">{to || 'JFK'}</span>
        </div>
        <div className="va-ticket-details">
          <span>👤 {paxName || 'Passenger'}</span>
          <span>📅 {departureDate || '2026-12-28'}</span>
          <span>💺 Seat {seat} ({cabin || 'Economy'})</span>
        </div>
        <div className="va-ticket-status">
          <span>✨ Status: CONFIRMED &amp; TICKETED</span>
          <small>E-Ticket issued by B Airways</small>
        </div>
      </div>
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

export default function VoiceAgent() {
  const { voiceAgentOpen, closeVoiceAgent, setSearchParams, setBookingSource, language, setLanguage } = useApp();
  const navigate = useNavigate();

  // ── Catch any unhandled errors so the panel doesn't vanish silently ──────
  useEffect(() => {
    const handler = (e) => {
      console.error('[VoiceAgent] Uncaught error:', e.error || e.message || e);
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);

  // ── Guard backdrop clicks for 400ms after open so the opening click
  //    doesn't immediately close the panel ─────────────────────────────────
  const backdropReadyRef = useRef(false);
  useEffect(() => {
    if (voiceAgentOpen) {
      backdropReadyRef.current = false;
      const t = setTimeout(() => { backdropReadyRef.current = true; }, 400);
      return () => clearTimeout(t);
    }
  }, [voiceAgentOpen]);

  // UI
  const [selectedLang,   setSelectedLang]   = useState(language || 'en-GB');

  useEffect(() => {
    if (language && language !== selectedLang) {
      setSelectedLang(language);
    }
  }, [language]);

  const handleSelectLang = (code) => {
    setSelectedLang(code);
    if (setLanguage) setLanguage(code);
  };

  const [messages,       setMessages]       = useState([{
    id: 'welcome', role: 'agent', timestamp: new Date(),
    text: getTranslation(selectedLang, 'voiceWelcome'),
    quickReplies: [
      getTranslation(selectedLang, 'qrBookFlight'),
      getTranslation(selectedLang, 'qrCheckIn'),
      getTranslation(selectedLang, 'qrStatus'),
      getTranslation(selectedLang, 'qrAvios'),
    ],
  }]);
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
  const [telemetryLogs,  setTelemetryLogs]  = useState([
    { time: new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' }), icon: '🚀', text: 'Agent initialized — RAG vector engine ready' }
  ]);
  const [capturedEntities, setCapturedEntities] = useState({});
  const [capturedPax,      setCapturedPax]      = useState({});
  const [completedBooking, setCompletedBooking] = useState(null);

  // Seat selection state — voice-driven seat pick before passenger collection
  const [selectingSeat,       setSelectingSeat]       = useState(false);
  const [selectedVoiceSeat,   setSelectedVoiceSeat]   = useState(null);
  const [pendingFlightForSeat, setPendingFlightForSeat] = useState(null); // { flight, entities }

  // Live refs so callbacks always see current values
  const capturedEntitiesRef = useRef({});
  const capturedPaxRef      = useRef({});
  const selectingSeatRef    = useRef(false);
  const pendingFlightRef    = useRef(null);
  const selectedVoiceSeatRef = useRef(null);
  const currentFieldRef     = useRef(null);   // live ref for passenger collection field
  const pendingFlightForSeatRef = useRef(null); // alias for pendingFlightRef
  const lastFlightResultsRef = useRef([]);     // last inline flight list shown to user
  useEffect(() => { capturedEntitiesRef.current = capturedEntities; }, [capturedEntities]);
  useEffect(() => { capturedPaxRef.current      = capturedPax;      }, [capturedPax]);
  useEffect(() => { selectingSeatRef.current    = selectingSeat;    }, [selectingSeat]);
  useEffect(() => { pendingFlightRef.current    = pendingFlightForSeat; pendingFlightForSeatRef.current = pendingFlightForSeat; }, [pendingFlightForSeat]);
  useEffect(() => { selectedVoiceSeatRef.current = selectedVoiceSeat; }, [selectedVoiceSeat]);

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

  // Keep currentFieldRef in sync so passenger intercept always sees current field
  useEffect(() => { currentFieldRef.current = currentField; }, [currentField]);

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

  const addAgentMsg = useCallback((text, quickReplies = [], action = null, flightResults = []) => {
    setMessages(p => [...p, { id: mkId(), role: 'agent', text, timestamp: new Date(), quickReplies, action, flightResults }]);
    if (flightResults && flightResults.length > 0) {
      lastFlightResultsRef.current = flightResults;
    }
  }, []);

  const selectedLangRef = useRef(selectedLang);
  useEffect(() => { selectedLangRef.current = selectedLang; }, [selectedLang]);

  const addTelemetryLog = useCallback((icon, text) => {
    const time = new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    setTelemetryLogs(prev => [...prev.slice(-5), { time, icon, text }]);
  }, []);

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
    lang:     selectedLang,
    continuous: collectingPax,
  });

  // ── TTS — speaks immediately, auto-restarts mic in hands-free ──
  const speakMessage = useCallback(async (text) => {
    if (!ttsEnabledRef.current || !window.speechSynthesis) return;
    const clean = text.replace(/[\*\_\#\`]/g, '').replace(/\s+/g, ' ').trim();
    if (mountedRef.current) setIsSpeaking(true);
    addTelemetryLog('📢', `Speech output: ${selectedLangRef.current}`);
    try { await speak(clean, { rate: 1.05, pitch: 1.0, lang: selectedLangRef.current }); } catch (_) {}
    if (mountedRef.current) setIsSpeaking(false);
    // NOTE: mic restart is handled by the hands-free useEffect below,
    // not here — prevents double-start after greeting
  }, [addTelemetryLog]);

  // ── Interrupt TTS and start listening immediately ─────────────
  const interruptAndListen = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
    setInterimText('');
    // Small delay so cancellation completes
    setTimeout(() => { if (mountedRef.current) startListening(); }, 80);
  }, [startListening]);

  const isListeningRef = useRef(isListening);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => {
    if (liveTranscript) {
      setInterimText(liveTranscript);
      // Automatic speech interruption if user speaks while AI is speaking
      if (isSpeaking) {
        stopSpeaking();
        setIsSpeaking(false);
        addTelemetryLog('⚡', `Speech Interrupted by user voice input: "${liveTranscript}"`);
      }
    }
  }, [liveTranscript, isSpeaking, addTelemetryLog]);

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
    if (mountedRef.current) {
      setTimeout(() => { if (mountedRef.current) startListening(); }, 150);
    }
  }, [addAgentMsg, speakMessage, startListening]);

  // ── Book a specific inline flight result ─────────────────────
  // Instead of immediately navigating, start seat selection → passenger collection flow
  const handleBookFlight = useCallback((flight, flightEntities) => {
    // Store flight + entities for later navigation after seat + passenger collection
    const mergedEntities = {
      from:          flightEntities.from          || 'LHR',
      to:            flightEntities.to            || '',
      departureDate: flightEntities.departureDate || '',
      cabin:         flightEntities.cabin         || 'economy',
    };
    setPendingFlightForSeat({ flight, entities: mergedEntities });
    setCapturedEntities(prev => ({ ...prev, ...mergedEntities }));
    setSelectingSeat(true);
    setSelectedVoiceSeat(null);

    const seatMsg = `Great choice! Before we continue, would you like to choose a seat? You can say "window", "aisle", a specific seat like "14A", or "skip" to choose later.`;
    addAgentMsg(seatMsg, ['Window seat', 'Aisle seat', 'Middle seat', 'Skip seat selection']);
    speakMessage(seatMsg);
    addTelemetryLog('💺', 'Seat selection: Awaiting user preference');
  }, [addAgentMsg, speakMessage, addTelemetryLog]);

  // Ref so handleQuickReply and processInput can call it without stale closure
  const handleBookFlightRef = useRef(null);
  useEffect(() => { handleBookFlightRef.current = handleBookFlight; }, [handleBookFlight]);

  // ── Core processing loop ──────────────────────────────────────
  const processInput = useCallback(async (text) => {
    if (!text || !text.trim() || isProcessingRef.current) return;
    const trimmed = text.trim();

    // ── PASSENGER COLLECTION MODE — intercept BEFORE NLP ────────
    // When we're actively collecting passenger fields, treat the raw
    // transcript as the answer — don't send through NLP at all.
    if (collectingRef.current && currentFieldRef.current) {
      if (mountedRef.current) setIsProcessing(true);
      addUserMsg(trimmed);

      const field = currentFieldRef.current;
      const val   = trimmed.trim().replace(/^(my (name is|first name is|last name is|phone (number )?is|nationality is)|i am|call me)\s+/i, '').trim();

      const newData = { ...paxDataRef.current, [field]: val };
      setPaxData(newData);
      paxDataRef.current = newData;
      setCapturedPax(newData);

      const fieldOrder = ['firstName', 'lastName', 'phone', 'nationality'];
      const nextIndex  = fieldOrder.indexOf(field) + 1;

      if (nextIndex < fieldOrder.length) {
        // Ask the next field
        const nextField = fieldOrder[nextIndex];
        const nextQ = PAX_FIELDS.find(f => f.key === nextField)?.q || `Your ${nextField}?`;
        if (mountedRef.current) setIsProcessing(false);
        await askNextField(nextField, nextQ);
      } else {
        // All 4 fields collected — navigate to booking
        setCollectingPax(false);
        setCurrentField(null);
        setCurrentQ('');

        const pending = pendingFlightForSeatRef.current;
        const ents    = capturedEntitiesRef.current;
        const doneMsg = `Got it! Booking your flight from ${ents.from || 'LHR'} to ${ents.to || ''} for ${val}. Taking you to payment!`;
        addAgentMsg(doneMsg);
        await speakMessage(doneMsg);

        const navState = {
          prefillPassenger: newData,
          from:       ents.from         || 'LHR',
          to:         ents.to           || '',
          departDate: ents.departureDate || '',
          returnDate: '',
          adults:     ents.adults       || 1,
          cabin:      ents.cabin        || 'economy',
          tripType:   'return',
          autoSearch: true,
          jumpToStep: 4,
          isVoiceBooking: true,
          selectedFlight: pending?.flight || null,
        };
        setBookingSource('voice');
        stopSpeaking();
        stopListening();
        if (mountedRef.current) {
          setIsProcessing(false);
          setTimeout(() => { closeVoiceAgent(); navigate('/book', { state: navState }); }, 400);
        }
      }
      return;
    }

    // ── FLIGHT NUMBER SELECTION — user says "book BA007" / "select BA009" ──
    // Intercept BEFORE seat mode so flight selection always works
    const flightSelectMatch = trimmed.match(/\b(?:book|select|choose|pick|take|i(?:'d| would) like(?: to)?(?: (?:book|select|take))?)\s+(?:flight\s+)?(?:ba|british airways)\s*0*(\d{2,4})\b/i)
      || trimmed.match(/\b(?:ba|british airways)\s*0*(\d{2,4})\b/i);
    if (flightSelectMatch && lastFlightResultsRef.current.length > 0) {
      const requestedNum = flightSelectMatch[flightSelectMatch.length - 1]; // last capture group
      const flights = lastFlightResultsRef.current;
      // Find flight by number
      const matched = flights.find(f => {
        const fn = (f.flightNumber || f.id || '').replace(/\D/g, '');
        return fn === requestedNum || fn === requestedNum.replace(/^0+/, '');
      }) || null;

      if (matched) {
        addUserMsg(trimmed);
        const ents = capturedEntitiesRef.current;
        handleBookFlightRef.current(matched, {
          from: ents.from || 'LHR',
          to: ents.to || '',
          departureDate: ents.departureDate || '',
          cabin: ents.cabin || 'economy',
        });
        return;
      }
    }

    // ── SEAT SELECTION MODE — intercept input before NLP ────────
    if (selectingSeatRef.current) {
      if (mountedRef.current) setIsProcessing(true);
      addUserMsg(trimmed);

      const lower = trimmed.toLowerCase();

      // ── If user says a flight number like "BA007" / "book BA 007" / "select BA007"
      // they're trying to pick a flight, not a seat — exit seat mode and treat as NLP
      const flightNumMatch = lower.match(/\b(ba|british airways)\s*0*(\d{2,4})\b/i);
      if (flightNumMatch || /\b(book|select|choose|pick|take)\b.*\b(flight|ba)\b/i.test(lower)) {
        // Exit seat mode silently and re-process through normal NLP
        setSelectingSeat(false);
        if (mountedRef.current) setIsProcessing(false);
        // Re-run without the seat intercept
        processInputRef.current(trimmed);
        return;
      }

      let seatCode = null;

      // Parse seat preference
      if (/skip|no thanks|no seat|later|don'?t care|any seat/i.test(lower)) {
        seatCode = 'SKIP';
      } else if (/window/i.test(lower)) {
        seatCode = '10A';
      } else if (/aisle/i.test(lower)) {
        seatCode = '10C';
      } else if (/middle/i.test(lower)) {
        seatCode = '10B';
      } else if (/extra legroom|legroom/i.test(lower)) {
        seatCode = '2A';
      } else if (/front|first row/i.test(lower)) {
        seatCode = '1A';
      } else if (/back|rear|last row/i.test(lower)) {
        seatCode = '21A';
      } else {
        // Try to parse a specific seat code like "14A", "row 14 seat A", "seat 14 A"
        const seatMatch = lower.match(/(?:seat\s*)?(?:row\s*)?(\d{1,2})\s*([a-f])\b/i);
        if (seatMatch) {
          seatCode = `${seatMatch[1]}${seatMatch[2].toUpperCase()}`;
        }
      }

      if (!seatCode) {
        // Didn't understand — ask again with clearer prompt
        if (mountedRef.current) setIsProcessing(false);
        const retryMsg = 'For seat selection say "window", "aisle", "middle", a specific seat like "14A", or "skip" to skip.';
        addAgentMsg(retryMsg, ['Window seat', 'Aisle seat', 'Middle seat', 'Skip seat selection']);
        await speakMessage(retryMsg);
        return;
      }

      // Seat selected (or skipped)
      setSelectingSeat(false);
      if (seatCode === 'SKIP') {
        setSelectedVoiceSeat(null);
        addTelemetryLog('💺', 'Seat selection: Skipped by user');
        const skipMsg = 'No problem, you can choose a seat later. Let me collect your passenger details.';
        addAgentMsg(skipMsg);
        await speakMessage(skipMsg);
      } else {
        setSelectedVoiceSeat(seatCode);
        addTelemetryLog('💺', `Seat selection: User chose seat ${seatCode}`);
        const seatLabel = { A:'window', B:'middle', C:'aisle', D:'aisle', E:'middle', F:'window' };
        const label = seatLabel[seatCode.slice(-1)] || '';
        const confirmMsg = `Seat ${seatCode}${label ? ` — ${label} seat` : ''} selected! Now let me get your passenger details.`;
        addAgentMsg(confirmMsg);
        await speakMessage(confirmMsg);
      }

      // Start passenger collection
      setCollectingPax(true);
      setPaxData({});
      if (mountedRef.current) setIsProcessing(false);
      await askNextField('firstName', PAX_FIELDS[0].q);
      return;
    }
    if (mountedRef.current) setIsProcessing(true);
    addUserMsg(trimmed);
    addTelemetryLog('🔍', `RAG Vector DB: Searching context for "${trimmed.substring(0, 30)}..."`);

    const updatedHistory = [...geminiHistoryRef.current, { role: 'user', text: trimmed }];

    // ── Inject captured route into history so fallbackResponse can always find it ──
    // If we already have a route from a previous turn, prepend a synthetic model
    // message so extractEntitiesFromHistory picks it up even when API is offline.
    const ents = capturedEntitiesRef.current;
    if (ents?.from && ents?.to) {
      const synth = {
        role: 'model',
        text: `Available Flights — ${ents.from} → ${ents.to} on ${ents.departureDate || ''}`,
      };
      // Only add if not already present
      if (!updatedHistory.some(m => m.text?.includes(`${ents.from} → ${ents.to}`))) {
        updatedHistory.unshift(synth);
      }
    }

    try {
      const parsed =
        await parseVoiceInput(trimmed, {}, updatedHistory);

      // BUG-FUNC-003: null means a newer request superseded this one — discard silently
      if (!parsed) {
        if (mountedRef.current) setIsProcessing(false);
        return;
      }

      const { intent, entities, response, passengerField } = parsed;
      if (!mountedRef.current) return;

      addTelemetryLog('🧠', `LLM Reasoning: Resolved intent as "${intent || 'QUERY'}"`);
      if (response?.diagnosticNotice) {
        addTelemetryLog('⚠️', response.diagnosticNotice);
      }
      if (response?.action) {
        const actName = typeof response.action === 'string' ? response.action : (response.action.type || 'ACTION');
        addTelemetryLog('⚡', `Tool Execution: Executing autonomous action [${actName}]`);
      }

      setGeminiHistory([...updatedHistory, { role: 'model', text: response.text }]);

      // Update booking card with any extracted entities
      if (entities && Object.values(entities).some(v => v)) {
        setCapturedEntities(prev => ({ ...prev, ...entities }));
      }

      // ── EXIT_CONVERSATION ────────────────────────────────────
      if (intent === 'EXIT_CONVERSATION' || response.action?.type === 'EXIT_CONVERSATION') {
        stopSpeaking();
        stopListening();
        setHandsFree(false);
        if (mountedRef.current) setIsProcessing(false);
        addAgentMsg(response.text, response.quickReplies);
        await speak(response.text, { rate: 1.05, pitch: 1.0, lang: selectedLangRef.current });
        return;
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
          const pending = pendingFlightRef.current;
          const navState = {
            prefillPassenger: newData,
            ...(ents.from          && { from:       ents.from }),
            ...(ents.to            && { to:         ents.to }),
            ...(ents.departureDate && { departDate: ents.departureDate }),
            ...(ents.returnDate    && { returnDate: ents.returnDate }),
            ...(ents.adults        && { adults:     ents.adults }),
            ...(ents.cabin         && { cabin:      ents.cabin }),
            ...(selectedVoiceSeatRef.current && { selectedSeat: selectedVoiceSeatRef.current }),
            ...(pending?.flight    && { selectedFlight: pending.flight }),
            autoSearch: true,
            jumpToStep: 3,
            isVoiceBooking: true,
          };
          if (mountedRef.current) setIsProcessing(false);
          addAgentMsg(response.text, response.quickReplies);
          await speakMessage(response.text);
          stopSpeaking();
          stopListening();
          setBookingSource('voice');
          if (mountedRef.current) {
            setTimeout(() => { closeVoiceAgent(); navigate('/book', { state: navState }); }, 350);
          }
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
        const pnrCode = 'BA-' + Math.floor(10000 + Math.random() * 90000);
        const paxName = `${response.action.passenger?.firstName || 'Passenger'} ${response.action.passenger?.lastName || ''}`.trim();
        setCompletedBooking({
          pnr: pnrCode, paxName,
          from: entities.from || 'LHR', to: entities.to || 'JFK',
          departureDate: entities.departureDate || '2026-12-28',
          cabin: entities.cabin || 'Economy', seat: '14A'
        });
        const navState = {
          prefillPassenger: response.action.passenger,
          from: entities.from || '', to: entities.to || '',
          departDate: entities.departureDate || '', returnDate: entities.returnDate || '',
          adults: entities.adults || 1, cabin: entities.cabin || 'economy',
          tripType: entities.tripType || 'return',
          autoSearch: true, jumpToStep: 4,
          isVoiceBooking: true,
        };
        setSearchParams({ tripType: entities.tripType || 'return', from: entities.from || '', to: entities.to || '', departDate: entities.departureDate || '', returnDate: entities.returnDate || '', adults: entities.adults || 1, cabin: entities.cabin || 'economy' });
        setCapturedPax(response.action.passenger || {});
        setBookingSource('voice');
        if (mountedRef.current) setIsProcessing(false);
        addAgentMsg(response.text, response.quickReplies);
        await speakMessage(response.text);
        stopSpeaking();
        stopListening();
        if (mountedRef.current) {
          setTimeout(() => { closeVoiceAgent(); navigate('/book', { state: navState }); }, 350);
        }
        return;
      }

      // ── PREFILL_BOOKING / VOICE BOOKING ────────────────────────
      if (response.action?.type === 'PREFILL_BOOKING') {
        setCollectingPax(false); setCurrentField(null); setCurrentQ(''); setPaxData({});
        const voicePax = response.action.passenger || capturedPax || {};
        const hasSpokenPax = voicePax.firstName && voicePax.lastName;
        setCapturedEntities(prev => ({ ...prev, ...entities }));
        setSearchParams({ tripType: entities.tripType || 'return', from: entities.from || 'LHR', to: entities.to || 'JFK', departDate: entities.departureDate || '', returnDate: entities.returnDate || '', adults: entities.adults || 1, cabin: entities.cabin || 'economy' });
        setCapturedPax(voicePax);
        if (mountedRef.current) setIsProcessing(false);

        // If LLM returned real flight results, show them inline — don't auto-navigate
        const flightResults = parsed.flightResults || response.flightResults || [];
        if (flightResults.length > 0) {
          // Build quick replies from actual flight numbers so user can say the flight number
          const flightQRs = flightResults.slice(0, 3).map(f => {
            const num = f.flightNumber || f.id || '';
            const price = f.price?.grandTotal || f.price?.total || '';
            return num ? `Book ${num}${price ? ` £${price}` : ''}` : null;
          }).filter(Boolean);
          const qrs = flightQRs.length > 0
            ? [...flightQRs, 'Book cheapest', 'Change date']
            : (response.quickReplies || ['Book cheapest', 'Change date', 'Change cabin']);
          addAgentMsg(response.text, qrs, response.action, flightResults);
          await speakMessage(response.text);
          // Speak flight options so user knows what to say
          if (flightResults.length > 0) {
            const optText = flightResults.slice(0, 3).map((f, i) => {
              const num = f.flightNumber || f.id || `Flight ${i+1}`;
              const price = f.price?.grandTotal || f.price?.total || '';
              const dep = f.itineraries?.[0]?.segments?.[0]?.departure?.at || '';
              const time = dep.includes('T') ? dep.split('T')[1].slice(0,5) : '';
              return `${num}${time ? ` at ${time}` : ''}${price ? `, £${price}` : ''}`;
            }).join('. ');
            await speakMessage(`You can say: Book cheapest, or a specific flight like ${flightResults[0]?.flightNumber || 'BA 007'}. Options: ${optText}`);
          }
          if (handsFreeRef.current) setTimeout(() => { if (mountedRef.current) startListening(); }, 200);
        } else if (!hasSpokenPax) {
          // No inline results AND passenger details missing → start seat + passenger collection in voice
          addAgentMsg(response.text, response.quickReplies, response.action);
          await speakMessage(response.text);

          // Store flight context for later navigation
          setPendingFlightForSeat({ flight: null, entities });
          setSelectingSeat(true);
          setSelectedVoiceSeat(null);

          const seatMsg = `Would you like to choose a seat? Say "window", "aisle", a specific seat like "14A", or "skip".`;
          addAgentMsg(seatMsg, ['Window seat', 'Aisle seat', 'Skip seat selection']);
          await speakMessage(seatMsg);
          addTelemetryLog('💺', 'Seat selection: Awaiting user preference');
        } else {
          // Has passenger data already — navigate directly
          const navState = {
            prefillPassenger: voicePax,
            from:       entities.from         || 'LHR',
            to:         entities.to           || 'JFK',
            departDate: entities.departureDate || '',
            returnDate: entities.returnDate   || '',
            adults:     entities.adults       || 1,
            cabin:      entities.cabin        || 'economy',
            tripType:   entities.tripType     || 'return',
            autoSearch: true,
            jumpToStep: 4,
            isVoiceBooking: true,
          };
          addAgentMsg(response.text, response.quickReplies, response.action);
          await speakMessage(response.text);
          stopSpeaking();
          stopListening();
          setBookingSource('voice');
          if (mountedRef.current) {
            setTimeout(() => { closeVoiceAgent(); navigate('/book', { state: navState }); }, 350);
          }
        }
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
  }, [addUserMsg, addAgentMsg, speakMessage, askNextField, startListening, navigate, setSearchParams, capturedEntities, stopListening, closeVoiceAgent, setBookingSource]);

  useEffect(() => { processInputRef.current = processInput; }, [processInput]);

  // ── Lifecycle ─────────────────────────────────────────────────
  const hasOpenedRef = useRef(false);
  useEffect(() => {
    if (voiceAgentOpen) {
      hasOpenedRef.current = true;
      // ── Full reset every time the agent opens — no stale history ──
      setMessages([{
        id: 'welcome', role: 'agent', timestamp: new Date(),
        text: getTranslation(selectedLangRef.current, 'voiceWelcome'),
        quickReplies: [
          getTranslation(selectedLangRef.current, 'qrBookFlight'),
          getTranslation(selectedLangRef.current, 'qrCheckIn'),
          getTranslation(selectedLangRef.current, 'qrStatus'),
          getTranslation(selectedLangRef.current, 'qrAvios'),
        ],
      }]);
      setGeminiHistory([]);
      setCompletedBooking(null);
      setCapturedEntities({}); setCapturedPax({});
      setPaxData({}); setCurrentField(null); setCurrentQ('');
      setCollectingPax(false); setSelectingSeat(false);
      setSelectedVoiceSeat(null); setPendingFlightForSeat(null);
      setAwaitingTwoOpt(false); setInterimText(''); setIsProcessing(false);
      setTelemetryLogs([{
        time: new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
        icon: '🚀', text: 'Agent initialized — RAG vector engine ready'
      }]);
      capturedEntitiesRef.current = {};
      capturedPaxRef.current = {};
      lastFlightResultsRef.current = [];

      // Speak greeting — hands-free effect will start mic automatically
      // when isSpeaking flips to false (no double-start)
      const t = setTimeout(async () => {
        if (!mountedRef.current) return;
        await speakMessage(WELCOME_SPOKEN);
        // Don't call startListening() here — the hands-free useEffect
        // fires as soon as isSpeaking becomes false and starts the mic
      }, 300);
      return () => clearTimeout(t);
    } else {
      // Only run cleanup if it has actually been open before
      if (!hasOpenedRef.current) return;
      stopSpeaking(); abortListening();
      setCollectingPax(false); setCurrentField(null); setCurrentQ('');
      setInterimText(''); setAwaitingTwoOpt(false);
      setCapturedEntities({}); setCapturedPax({});
      setSelectingSeat(false); setSelectedVoiceSeat(null); setPendingFlightForSeat(null);
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

    const r = reply.toLowerCase().trim();

    // ── Context-aware quick replies ──────────────────────────────────
    // Use refs so we always see the latest capturedEntities / capturedPax
    const ents = capturedEntitiesRef.current;
    const pax  = capturedPaxRef.current;
    const hasRoute = ents?.from && ents?.to;

    // "Book BA007 £540" or "Book BA009" — specific flight from quick reply ──
    const quickFlightMatch = reply.match(/^book\s+(ba|british airways)\s*0*(\d{2,4})/i);
    if (quickFlightMatch && lastFlightResultsRef.current.length > 0) {
      const requestedNum = quickFlightMatch[2];
      const flights = lastFlightResultsRef.current;
      const matched = flights.find(f => {
        const fn = (f.flightNumber || f.id || '').replace(/\D/g, '');
        return fn === requestedNum || fn === requestedNum.replace(/^0+/, '');
      }) || flights[0];
      if (matched) {
        handleBookFlightRef.current(matched, {
          from: ents.from || 'LHR',
          to: ents.to || '',
          departureDate: ents.departureDate || ents.departDate || '',
          cabin: ents.cabin || 'economy',
        });
        return;
      }
    }

    // "Book cheapest" / "Book cheapest flight" ────────────────────────
    if (/book cheapest|cheapest|cheapest flight/i.test(reply) && hasRoute) {
      const navState = {
        prefillPassenger: pax || {},
        from:       ents.from,
        to:         ents.to,
        departDate: ents.departureDate || ents.departDate || '',
        returnDate: ents.returnDate || '',
        adults:     ents.adults || 1,
        cabin:      ents.cabin || 'economy',
        tripType:   ents.tripType || 'return',
        autoSearch: true,
        jumpToStep: 3,
        isVoiceBooking: true,
      };
      setSearchParams({
        tripType: ents.tripType || 'return',
        from: ents.from, to: ents.to,
        departDate: ents.departureDate || ents.departDate || '',
        returnDate: ents.returnDate || '',
        adults: ents.adults || 1,
        cabin: ents.cabin || 'economy',
      });
      setBookingSource('voice');
      addAgentMsg(`Booking the cheapest flight from ${ents.from} → ${ents.to}. Taking you to the booking page!`);
      // Stop listening + close drawer BEFORE navigating to prevent re-trigger
      stopSpeaking();
      stopListening();
      setTimeout(() => { closeVoiceAgent(); navigate('/book', { state: navState }); }, 400);
      return;
    }

    // "Yes, book it" ───────────────────────────────────────────────────
    if (/^yes,?\s*book\s*it$/i.test(reply) && hasRoute) {
      const navState = {
        prefillPassenger: pax || {},
        from: ents.from, to: ents.to,
        departDate: ents.departureDate || ents.departDate || '',
        returnDate: '', adults: ents.adults || 1,
        cabin: ents.cabin || 'economy',
        tripType: 'return', autoSearch: true, jumpToStep: 3, isVoiceBooking: true,
      };
      setBookingSource('voice');
      addAgentMsg(`Booking from ${ents.from} → ${ents.to}!`);
      stopSpeaking();
      stopListening();
      setTimeout(() => { closeVoiceAgent(); navigate('/book', { state: navState }); }, 400);
      return;
    }

    // "Change date" ────────────────────────────────────────────────────
    if (/change date|different date|another date/i.test(reply) && hasRoute) {
      addAgentMsg(
        `Which date would you like to fly from ${ents.from} to ${ents.to}?`,
        ['Tomorrow', 'Next week', 'Christmas', 'New Year']
      );
      return;
    }

    // "Change cabin" ───────────────────────────────────────────────────
    if (/change cabin|different cabin|upgrade cabin/i.test(reply) && hasRoute) {
      addAgentMsg(
        `Which cabin class for ${ents.from} → ${ents.to}?`,
        ['Economy', 'Business Class', 'First Class', 'Premium Economy']
      );
      return;
    }

    // Cabin selection after "Change cabin" prompt ─────────────────────
    if (/^(economy|business class|first class|premium economy)$/i.test(reply) && hasRoute) {
      const cabinMap = { 'economy':'economy', 'business class':'business', 'first class':'first', 'premium economy':'premium_economy' };
      const newCabin = cabinMap[r] || 'economy';
      setCapturedEntities(prev => ({ ...prev, cabin: newCabin }));
      processInputRef.current(`${ents.from} to ${ents.to} ${newCabin}`);
      return;
    }

    // Date selection after "Change date" prompt ───────────────────────
    if (/^(tomorrow|next week|christmas|new year)$/i.test(reply) && hasRoute) {
      processInputRef.current(`${ents.from} to ${ents.to} ${reply}`);
      return;
    }

    // All other replies → normal NLP flow
    processInputRef.current(reply);
  }, [navigate, setSearchParams, setBookingSource, addAgentMsg, stopListening, closeVoiceAgent]);

  const handleClearChat = useCallback(() => {
    stopSpeaking();
    setMessages([WELCOME]); setGeminiHistory([]); setInterimText('');
    setIsSpeaking(false); setIsProcessing(false);
    setCollectingPax(false); setPaxData({}); setCurrentField(null); setCurrentQ('');
    setAwaitingTwoOpt(false); setCapturedEntities({}); setCapturedPax({});
    setSelectingSeat(false); setSelectedVoiceSeat(null); setPendingFlightForSeat(null);
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
         data-ba-component="voice-assistant">
      <div
        className="va-backdrop"
        role="presentation"
        onClick={() => { if (backdropReadyRef.current) closeVoiceAgent(); }}
      />
      <div className={`va-panel ${isExpanded ? 'va-panel--expanded' : ''}`}
           role="dialog" aria-modal="true" aria-label="B Airways Voice Assistant"
           onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="va-header">
          <div className="va-header-left">
            <div className={`va-avatar va-avatar--${agentStatus}`}>
              {agentStatus === 'listening' ? <Waveform active /> : <FaPlane size={15} />}
            </div>
            <div className="va-header-info">
              <span className="va-header-name">BA Advanced Agentic AI</span>
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

        {/* ── Multilingual Language Bar ── */}
        <LanguageSelector lang={selectedLang} onSelect={handleSelectLang} />

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
                {/* Inline flight results — shown when backend returned real flights */}
                {msg.role === 'agent' && msg.flightResults?.length > 0 && (
                  <FlightResultsCard
                    flights={msg.flightResults}
                    entities={capturedEntities}
                    onBook={handleBookFlight}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Confirmed E-Ticket Card */}
          <TicketCard booking={completedBooking} />

          {/* Proactive Smart Deals Card */}
          <ProactiveDealsCard entities={capturedEntities} />

          {/* Booking summary card */}
          <BookingCard entities={capturedEntities} passenger={capturedPax} />

          {/* Chain-of-Thought Telemetry Trace Panel */}
          <ThoughtTracePanel logs={telemetryLogs} />

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
