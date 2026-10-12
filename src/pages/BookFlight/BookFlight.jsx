import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  FaPlane, FaSearch, FaExchangeAlt, FaMapMarkerAlt,
  FaCalendarAlt, FaUsers, FaChevronRight, FaCheck,
  FaWifi, FaUtensils, FaTv, FaBriefcase, FaTimes,
  FaShieldAlt, FaStar, FaChair, FaMicrophone, FaStopwatch,
} from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { flightsAPI, airportsAPI, bookingsAPI } from '../../services/api';
import {
  validatePassenger, validateFirstName, validateLastName,
  validatePhone, validateNationality, validatePaymentDetails,
  validateCardNumber, validateCVV, validateExpiry, validateCardName,
  formatCardNumber, sanitizeInput,
} from '../../utils/validation';
import VoiceBookingAnimator from '../../components/VoiceBookingAnimator/VoiceBookingAnimator';
import './BookFlight.css';

// debounce helper — avoids hammering the airport API on every keystroke
function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

// ── Stopwatch hook ─────────────────────────────────────────────────────────
function useStopwatch(running) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);
  const rafRef   = useRef(null);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsed * 1000;
      const tick = () => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => { setElapsed(0); startRef.current = null; };
  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };
  return { elapsed, formatted: fmt(elapsed), reset };
}

// ── Booking Source + Timer badge ───────────────────────────────────────────
function BookingSourceBar({ source, formatted }) {
  if (!source) return null;
  const isVoice = source === 'voice';
  return (
    <div className="bookflight__source-bar">
      <span className={`bookflight__source-badge bookflight__source-badge--${isVoice ? 'voice' : 'normal'}`}>
        <span className="bookflight__source-badge-dot" />
        {isVoice ? <FaMicrophone size={11} /> : <FaSearch size={11} />}
        {isVoice ? 'Voice Booking' : 'Manual Booking'}
      </span>
      <span className={`bookflight__timer bookflight__timer--${isVoice ? 'voice' : 'normal'}`}>
        <span className="bookflight__timer-icon"><FaStopwatch size={13} /></span>
        <span className="bookflight__timer-label">Time</span>
        {formatted}
      </span>
    </div>
  );
}

// ── Voice Seat Selection Popup ─────────────────────────────────────────────
// Full interactive seat map shown immediately when voice navigates to /book
const SEAT_MAP = [
  // [row, cols, type]  type: 'standard' | 'legroom' | 'occupied'
  { row: 1,  cols: ['A','C','D','F'], type: 'legroom'  },
  { row: 2,  cols: ['A','C','D','F'], type: 'legroom'  },
  { row: 10, cols: ['A','B','C','D','E','F'], type: 'standard', occupied: ['B','E'] },
  { row: 11, cols: ['A','B','C','D','E','F'], type: 'standard', occupied: ['A'] },
  { row: 12, cols: ['A','B','C','D','E','F'], type: 'standard', occupied: ['D','F'] },
  { row: 14, cols: ['A','B','C','D','E','F'], type: 'standard', occupied: ['C'] },
  { row: 15, cols: ['A','B','C','D','E','F'], type: 'standard', occupied: ['B','E'] },
  { row: 20, cols: ['A','B','C','D','E','F'], type: 'standard', occupied: ['A','D'] },
  { row: 21, cols: ['A','B','C','D','E','F'], type: 'standard', occupied: ['C','F'] },
];

const SEAT_LABELS = { A:'Window', B:'Middle', C:'Aisle', D:'Aisle', E:'Middle', F:'Window' };

// ── Parse a spoken seat command into a concrete seat code ────────────────
function parseSeatCommand(text) {
  const lower = (text || '').toLowerCase().trim();
  if (/skip|no thanks|no seat|later|don'?t care|any seat/i.test(lower)) return 'SKIP';
  if (/window/i.test(lower))  return '10A';
  if (/aisle/i.test(lower))   return '10C';
  if (/middle/i.test(lower))  return '10B';
  if (/front|first|row 1/i.test(lower)) return '1A';
  if (/extra legroom|legroom/i.test(lower)) return '2A';
  if (/back|last|rear/i.test(lower))    return '21A';
  // specific seat code: "14A", "row 14 seat A", "seat 14 A"
  const m = lower.match(/(?:row\s*)?(\d{1,2})\s*(?:seat\s*)?([a-f])/i);
  if (m) return `${m[1]}${m[2].toUpperCase()}`;
  return null;
}

function VoiceSeatPopup({ flight, from, to, cabin, onConfirm, onSkip, preSelected = null }) {
  const [selected,    setSelected]    = useState(preSelected);
  const [listening,   setListening]   = useState(false);
  const [voiceHint,   setVoiceHint]   = useState('');
  const [voiceStatus, setVoiceStatus] = useState('idle'); // idle | listening | understood | error
  const recRef = useRef(null);

  // ── Auto-confirm if a seat was pre-selected by voice in VoiceAgent ──────
  useEffect(() => {
    if (preSelected && preSelected !== 'SKIP') {
      setSelected(preSelected);
      // Short delay so user can see the selection before it confirms
      const t = setTimeout(() => onConfirm(preSelected), 1200);
      return () => clearTimeout(t);
    }
    if (preSelected === 'SKIP') {
      const t = setTimeout(() => onSkip(), 800);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Voice recognition inside the popup ──────────────────────────────────
  const SpeechRecognition = typeof window !== 'undefined'
    && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const startVoice = () => {
    if (!SpeechRecognition || listening) return;
    const r = new SpeechRecognition();
    r.lang = 'en-GB';
    r.continuous = false;
    r.interimResults = true;
    recRef.current = r;

    r.onstart  = () => { setListening(true); setVoiceStatus('listening'); setVoiceHint(''); };
    r.onend    = () => { setListening(false); if (voiceStatus === 'listening') setVoiceStatus('idle'); };
    r.onerror  = () => { setListening(false); setVoiceStatus('error'); setVoiceHint('Mic error — try again'); };

    r.onresult = (event) => {
      const result  = event.results[event.resultIndex];
      const text    = result[0]?.transcript || '';
      const isFinal = result.isFinal;
      setVoiceHint(text);
      if (isFinal) {
        const code = parseSeatCommand(text);
        if (code === 'SKIP') {
          setVoiceStatus('understood');
          setVoiceHint('Skipping seat selection…');
          setTimeout(() => onSkip(), 700);
        } else if (code) {
          // Check if seat is in map and not occupied
          const rowNum = parseInt(code, 10);
          const col    = code.slice(-1);
          const rowDef = SEAT_MAP.find(r => r.row === rowNum);
          const isOcc  = rowDef?.occupied?.includes(col);
          if (isOcc) {
            setVoiceStatus('error');
            setVoiceHint(`Seat ${code} is occupied. Say another seat.`);
            setTimeout(() => startVoice(), 1500);
          } else {
            setSelected(code);
            setVoiceStatus('understood');
            setVoiceHint(`Seat ${code} selected! Confirming…`);
            setTimeout(() => onConfirm(code), 900);
          }
        } else {
          setVoiceStatus('error');
          setVoiceHint('Didn\'t catch that. Say "window", "aisle", "14A", or "skip".');
          setTimeout(() => startVoice(), 1800);
        }
      }
    };

    try { r.start(); } catch (_) {}
  };

  const stopVoice = () => {
    try { recRef.current?.stop(); } catch (_) {}
    setListening(false);
    setVoiceStatus('idle');
  };

  // Auto-start voice on mount (if no pre-selection)
  useEffect(() => {
    if (!preSelected && SpeechRecognition) {
      // Speak prompt then start listening
      if (window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(
          'Please choose a seat. You can say window, aisle, middle, a seat number like 14 A, or skip.'
        );
        u.rate = 1.05; u.lang = 'en-GB';
        u.onend = () => startVoice();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } else {
        setTimeout(() => startVoice(), 400);
      }
    }
    return () => {
      try { recRef.current?.abort(); } catch (_) {}
      window.speechSynthesis?.cancel();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeat = (code, isOccupied) => {
    if (isOccupied) return;
    stopVoice();
    setSelected(code);
  };

  const selectedLabel = selected && selected !== 'SKIP'
    ? `Row ${selected.replace(/[A-F]/i, '')}, Seat ${selected.slice(-1)} (${SEAT_LABELS[selected.slice(-1)] || ''})`
    : null;

  // If pre-selected, show a brief auto-confirm screen
  if (preSelected && preSelected !== 'SKIP') {
    return (
      <div className="seatpopup__overlay" role="dialog" aria-modal="true" aria-label="Seat confirmed">
        <div className="seatpopup seatpopup--autoconfirm">
          <div className="seatpopup__autoconfirm-icon">💺</div>
          <h2 className="seatpopup__autoconfirm-title">Seat {preSelected} confirmed!</h2>
          <p className="seatpopup__autoconfirm-sub">
            {SEAT_LABELS[preSelected.slice(-1)] || ''} seat — Row {preSelected.replace(/[A-F]/i, '')}
          </p>
          <div className="seatpopup__autoconfirm-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="seatpopup__overlay" role="dialog" aria-modal="true" aria-label="Select your seat">
      <div className="seatpopup">
        {/* Header */}
        <div className="seatpopup__header">
          <div className="seatpopup__header-left">
            <div className="seatpopup__icon">💺</div>
            <div>
              <h2 className="seatpopup__title">Select Your Seat</h2>
              <p className="seatpopup__subtitle">Voice booking — say your preference</p>
            </div>
          </div>
          <div className="seatpopup__voice-badge">
            <span className="seatpopup__voice-dot" />
            Voice
          </div>
        </div>

        {/* Voice command bar */}
        <div className={`seatpopup__voice-bar seatpopup__voice-bar--${voiceStatus}`}>
          <button
            className={`seatpopup__mic-btn ${listening ? 'seatpopup__mic-btn--active' : ''}`}
            onClick={listening ? stopVoice : startVoice}
            aria-label={listening ? 'Stop listening' : 'Start voice seat selection'}
            title={listening ? 'Stop' : 'Tap to speak'}
          >
            <FaMicrophone size={14} />
          </button>
          <span className="seatpopup__voice-hint">
            {voiceStatus === 'listening' && (voiceHint || 'Listening… say "window", "aisle", "14A", or "skip"')}
            {voiceStatus === 'understood' && (voiceHint || 'Got it!')}
            {voiceStatus === 'error'     && (voiceHint || 'Try again')}
            {voiceStatus === 'idle'      && 'Say "window", "aisle", a seat like "14A", or "skip"'}
          </span>
          {listening && (
            <span className="seatpopup__voice-bars">
              {[1,2,3,4,5].map(i => (
                <span key={i} className="seatpopup__voice-bar-dot" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </span>
          )}
        </div>

        {/* Quick voice command chips */}
        <div className="seatpopup__voice-chips">
          {[
            { label: '🪟 Window', cmd: 'window seat' },
            { label: '🚶 Aisle',  cmd: 'aisle seat'  },
            { label: '🧍 Middle', cmd: 'middle seat'  },
            { label: '📐 Extra Legroom', cmd: 'extra legroom' },
            { label: '⏭ Skip',   cmd: 'skip'         },
          ].map(({ label, cmd }) => (
            <button
              key={cmd}
              className="seatpopup__voice-chip"
              onClick={() => {
                stopVoice();
                const code = parseSeatCommand(cmd);
                if (code === 'SKIP') { onSkip(); return; }
                if (code) { setSelected(code); setTimeout(() => onConfirm(code), 300); }
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="seatpopup__body">
          {/* Flight strip */}
          <div className="seatpopup__flight-info">
            <span className="seatpopup__flight-code">{flight?.flightNumber || 'BA—'}</span>
            <span className="seatpopup__flight-sep">·</span>
            <span>{from || 'LHR'}</span>
            <FaPlane size={11} style={{ color: '#075aaa', margin: '0 2px' }} />
            <span>{to || 'JFK'}</span>
            <span className="seatpopup__flight-sep">·</span>
            <span style={{ textTransform: 'capitalize' }}>{cabin || 'Economy'}</span>
          </div>

          {/* Legend */}
          <div className="seatpopup__legend">
            {[
              { cls: 'available', label: 'Available' },
              { cls: 'selected',  label: 'Selected'  },
              { cls: 'occupied',  label: 'Occupied'  },
              { cls: 'legroom',   label: 'Extra Legroom (+£25)' },
            ].map(l => (
              <span key={l.cls} className="seatpopup__legend-item">
                <span className={`seatpopup__legend-dot seatpopup__legend-dot--${l.cls}`} />
                {l.label}
              </span>
            ))}
          </div>

          {/* Cabin label */}
          <div className="seatpopup__cabin-label">Economy Cabin — B Airways</div>

          {/* Seat map */}
          <div className="seatpopup__map">
            {SEAT_MAP.map(({ row, cols, type, occupied = [] }) => (
              <div key={row} className="seatpopup__row">
                <span className="seatpopup__row-num">{row}</span>
                {['A','B','C'].map(col => {
                  if (!cols.includes(col)) return <span key={col} style={{ width: 34 }} />;
                  const code = `${row}${col}`;
                  const isOcc = occupied.includes(col);
                  const isSel = selected === code;
                  const cls = [
                    'seatpopup__seat',
                    isOcc ? 'seatpopup__seat--occupied' : type === 'legroom' ? 'seatpopup__seat--extra-legroom' : 'seatpopup__seat--available',
                    isSel ? 'seatpopup__seat--selected' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <button key={col} className={cls} onClick={() => handleSeat(code, isOcc)}
                      title={isOcc ? 'Occupied' : `${code} — ${SEAT_LABELS[col] || ''}`}
                      disabled={isOcc} aria-label={`Seat ${code}`}>
                      {isSel ? '✓' : col}
                    </button>
                  );
                })}
                <span className="seatpopup__aisle" />
                {['D','E','F'].map(col => {
                  if (!cols.includes(col)) return <span key={col} style={{ width: 34 }} />;
                  const code = `${row}${col}`;
                  const isOcc = occupied.includes(col);
                  const isSel = selected === code;
                  const cls = [
                    'seatpopup__seat',
                    isOcc ? 'seatpopup__seat--occupied' : type === 'legroom' ? 'seatpopup__seat--extra-legroom' : 'seatpopup__seat--available',
                    isSel ? 'seatpopup__seat--selected' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <button key={col} className={cls} onClick={() => handleSeat(code, isOcc)}
                      title={isOcc ? 'Occupied' : `${code} — ${SEAT_LABELS[col] || ''}`}
                      disabled={isOcc} aria-label={`Seat ${code}`}>
                      {isSel ? '✓' : col}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Selected summary */}
          {selected && (
            <div className="seatpopup__selected-summary">
              <span className="seatpopup__selected-summary-icon">💺</span>
              <div>
                <strong>{selected}</strong>{' '}
                <span>— {selectedLabel}</span>
                {SEAT_MAP.find(r => r.row === Number(selected.replace(/[A-F]/i,'')) && r.type === 'legroom') && (
                  <span style={{ color:'#9a7a1a', fontWeight:700, marginLeft:6 }}>+£25 (Extra Legroom)</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="seatpopup__footer">
          <button className="seatpopup__skip-btn" onClick={() => { stopVoice(); onSkip(); }}>
            Skip for now
          </button>
          <button
            className="btn btn-primary seatpopup__confirm-btn"
            disabled={!selected}
            onClick={() => { stopVoice(); onConfirm(selected); }}
          >
            <FaCheck size={13} /> Confirm Seat {selected || ''}
          </button>
        </div>
      </div>
    </div>
  );
}

const steps = ['Search', 'Select Flight', 'Passenger Details', 'Review & Pay', 'Confirmation'];

const cabinOptions = [
  { value: 'economy', label: 'Economy', key: 'economy' },
  { value: 'premium_economy', label: 'Premium Economy', key: 'premiumEconomy' },
  { value: 'business', label: 'Business Class', key: 'businessClass' },
  { value: 'first', label: 'First Class', key: 'firstClass' },
];

export default function BookFlight() {
  const navigate = useNavigate();
  const location = useLocation();
  const [urlParams] = useSearchParams();
  const { searchParams, setSearchParams, addBooking, addNotification, user,
          bookingSource, bookingStartedAt, setBookingSource, clearBookingSource } = useApp();

  // Detect voice booking from location state or context
  // Use a ref captured at mount AND keep it true if bookingSource becomes 'voice'
  const isVoiceBookingRef = useRef(
    !!(location.state?.isVoiceBooking || bookingSource === 'voice')
  );
  // Update ref whenever bookingSource changes
  useEffect(() => {
    if (bookingSource === 'voice') isVoiceBookingRef.current = true;
  }, [bookingSource]);
  const isVoiceBooking = isVoiceBookingRef.current || bookingSource === 'voice';

  // Set source on mount if coming from voice nav state
  useEffect(() => {
    const fromVoice = location.state?.isVoiceBooking || bookingSource === 'voice';
    if (fromVoice) {
      isVoiceBookingRef.current = true;
      if (bookingSource !== 'voice') setBookingSource('voice');
    } else if (!bookingSource) {
      setBookingSource('normal');
    }
    // Reset on unmount
    return () => clearBookingSource();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stopwatch — starts when component mounts
  const { formatted: timerFormatted } = useStopwatch(true);

  // Voice seat popup state
  const [showSeatPopup, setShowSeatPopup] = useState(false);

  const [step, setStep] = useState(1);
  const [tripType, setTripType] = useState(searchParams.tripType || 'return');
  const [from, setFrom] = useState(urlParams.get('from') || searchParams.from || user?.homeCityIATA || '');
  const [to, setTo] = useState(urlParams.get('to') || searchParams.to || '');
  const [departDate, setDepartDate] = useState(searchParams.departDate || '');
  const [returnDate, setReturnDate] = useState(searchParams.returnDate || '');
  const [adults, setAdults] = useState(Number(searchParams.adults) || 1);
  const [cabin, setCabin] = useState(urlParams.get('cabin') || searchParams.cabin || user?.preferredCabin || 'economy');
  const [flights, setFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedCabinKey, setSelectedCabinKey] = useState('economy');
  const [selectedSeat, setSelectedSeat] = useState(
    location.state?.selectedSeat ||
    // map profile preference to a concrete seat code
    (user?.preferredSeat === 'window' ? '10A' : user?.preferredSeat === 'aisle' ? '10B' : '14B') ||
    '14A'
  );
  const [loading, setLoading] = useState(false);
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  // ── Travelers array — index 0 is lead (pre-filled from profile), extra are custom ──
  const makeBlankPassenger = () => ({
    firstName: '', lastName: '', phone: '', nationality: 'GB', isProfile: false,
  });
  const makeProfilePassenger = () => ({
    firstName:   user?.firstName   || '',
    lastName:    user?.lastName    || '',
    phone:       user?.phone       || '',
    nationality: user?.nationality || 'GB',
    isProfile: true,   // flag so UI shows "Pre-filled from profile"
  });

  const [travelers, setTravelers] = useState([makeProfilePassenger()]);
  const [travelerErrors, setTravelerErrors] = useState([{}]);
  const [travelerTouched, setTravelerTouched] = useState([{}]);
  // Keep single `passenger` alias pointing to traveler[0] for backwards compat
  // with the voice-agent pre-fill useEffect below.
  const passenger    = travelers[0];
  const setPassenger = (updater) =>
    setTravelers(prev => {
      const next = [...prev];
      next[0] = typeof updater === 'function' ? updater(next[0]) : { ...next[0], ...updater };
      return next;
    });
  // Legacy per-field error/touched state — still used by payment form
  const [passengerErrors, setPassengerErrors]   = useState({});
  const [touchedFields,   setTouchedFields]     = useState({});
  const [paymentErrors, setPaymentErrors] = useState({});
  const [touchedPaymentFields, setTouchedPaymentFields] = useState({});

  // ── Pre-fill from voice agent ──────────────────────────────────
  // Store nav state in a ref synchronously so autoSearch can use them
  // before React flushes all the setState calls.
  const voiceNavRef = useRef(location.state || null);
  const [autoSearchTrigger, setAutoSearchTrigger] = useState(false);

  // ── Voice Booking Animator ─────────────────────────────────────
  // Show the animated fill overlay whenever voice navigates here.
  // Fields are applied immediately (needed for auto-search), but the
  // animator overlays the page and plays the typewriter sequence so
  // the user sees each field being "filled" one by one.
  const [showAnimator, setShowAnimator]     = useState(false);
  const [animatorNavState, setAnimatorNavState] = useState(null);

  useEffect(() => {
    const s = voiceNavRef.current;
    if (!s) return;
    if (s.prefillPassenger || s.autoSearch || s.from) {
      const pf = s.prefillPassenger || {};

      // 1. Apply all field values immediately so auto-search has them
      setPassenger(prev => ({
        firstName:   pf.firstName   || prev.firstName   || '',
        lastName:    pf.lastName    || prev.lastName    || '',
        phone:       pf.phone       || prev.phone       || (s.isVoiceBooking ? '+44 7700 900000' : ''),
        nationality: pf.nationality || prev.nationality || (s.isVoiceBooking ? 'GB' : ''),
      }));

      if (s.from)           setFrom(s.from);
      if (s.to)             setTo(s.to);
      if (s.departDate)     setDepartDate(s.departDate);
      if (s.returnDate)     setReturnDate(s.returnDate);
      if (s.adults)         setAdults(Number(s.adults));
      if (s.cabin)          setCabin(s.cabin);
      if (s.tripType)       setTripType(s.tripType);
      if (s.selectedFlight) setSelectedFlight(s.selectedFlight);
      if (s.jumpToStep)     jumpToStepRef.current = s.jumpToStep;

      // 2. Show the animator overlay for voice bookings
      if (s.isVoiceBooking) {
        setAnimatorNavState(s);
        setShowAnimator(true);
        // Delay auto-search until the animation finishes (onComplete fires it)
        // Non-voice bookings still trigger immediately below
      } else if (s.autoSearch) {
        setAutoSearchTrigger(true);
      } else if (s.jumpToStep && !s.isVoiceBooking) {
        setStep(s.jumpToStep);
      }
    }
    window.history.replaceState({}, '', window.location.pathname + window.location.search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-search effect — fires after state updates are committed
  useEffect(() => {
    if (!autoSearchTrigger) return;
    setAutoSearchTrigger(false);
    const s = voiceNavRef.current;
    if (!s) return;
    // Build search params directly from nav state (bypasses stale state closure)
    const fromCode = s.from || from;
    const toCode   = s.to   || to;
    const depDate  = s.departDate || departDate;
    const adultsCt = Number(s.adults || adults || 1);
    const cabinVal = s.cabin || cabin || 'economy';
    if (!fromCode || !toCode || !depDate) return;

    setLoading(true);
    setSearchError('');
    setFrom(fromCode);
    setTo(toCode);
    flightsAPI.search({
      from: fromCode, to: toCode,
      departureDate: depDate,
      returnDate: s.tripType === 'return' ? (s.returnDate || '') : undefined,
      adults: adultsCt,
      cabin: cabinVal.toUpperCase(),
    }).then(result => {
      const results = result.flights || [];
      setFlights(results);
      if (results.length > 0) {
        const best = results.find(f => (f.seatsLeft?.[selectedCabinKey] ?? 0) > 0) || results[0];
        setSelectedFlight(best);
        // Always show seat popup for voice bookings
        setShowSeatPopup(true);
        jumpToStepRef.current = 4;
      } else {
        setStep(2);
        setSearchError('No flights found for this route and date. Please try different options.');
      }
    }).catch(err => {
      setSearchError(err.message || 'Flight search failed. Please try again.');
    }).finally(() => {
      setLoading(false);
      window.scrollTo(0, 0);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSearchTrigger]);
  const [paymentDetails, setPaymentDetails] = useState({
    cardNumber: '',
    cardName: '',
    expiry: '',
    cvv: '',
  });
  const [bookingRef, setBookingRef] = useState('');

  useEffect(() => {
    const cabinMap = { economy: 'economy', premium_economy: 'premiumEconomy', business: 'businessClass', first: 'firstClass' };
    setSelectedCabinKey(cabinMap[cabin] || 'economy');
  }, [cabin]);

  const [searchError, setSearchError] = React.useState('');

  // ── City → IATA resolver ───────────────────────────────────────
  // Allows users to type city names and still pass the 3-char IATA
  // validation on the backend.
  const CITY_TO_IATA = {
    london:'LHR', heathrow:'LHR', gatwick:'LGW',
    'new york':'JFK', nyc:'JFK', newyork:'JFK',
    dubai:'DXB', tokyo:'NRT', narita:'NRT', haneda:'HND',
    sydney:'SYD', singapore:'SIN', changi:'SIN',
    barcelona:'BCN', paris:'CDG', amsterdam:'AMS',
    rome:'FCO', istanbul:'IST', madrid:'MAD',
    mumbai:'BOM', bombay:'BOM', delhi:'DEL',
    chennai:'MAA', madras:'MAA', frankfurt:'FRA',
    zurich:'ZRH', dublin:'DUB', 'cape town':'CPT',
    'los angeles':'LAX', chicago:'ORD', toronto:'YYZ',
    hongkong:'HKG', 'hong kong':'HKG', bangkok:'BKK',
    'kuala lumpur':'KUL', 'sao paulo':'GRU',
  };
  const resolveIATA = (val) => {
    const trimmed = val.trim();
    // Already a 3-char IATA code
    if (/^[A-Z]{3}$/i.test(trimmed)) return trimmed.toUpperCase();
    // Look up in city map
    return CITY_TO_IATA[trimmed.toLowerCase()] || trimmed.toUpperCase();
  };

  // Live airport autocomplete — calls backend → Amadeus referenceData/locations
  const fetchAirports = React.useCallback(async (query, setter) => {
    if (query.length < 2) { setter([]); return; }
    try {
      const results = await airportsAPI.search(query);
      setter(results || []);
    } catch {
      // fall back silently — user can still type a raw code
      setter([]);
    }
  }, []);

  const debouncedFetchFrom = useDebounce((q) => fetchAirports(q, setFromSuggestions), 300);
  const debouncedFetchTo   = useDebounce((q) => fetchAirports(q, setToSuggestions),   300);

  // jumpToStep ref — set by voice FULL_BOOKING to skip to passenger step
  // after the flight is chosen. Declared above handleSearch (moved up from
  // its original position below handleSelectFlight) so handleSearch can
  // read/consume it too, not just handleSelectFlight.
  const jumpToStepRef = useRef(location.state?.jumpToStep || null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSearchError('');

    // Resolve city names to IATA codes before sending to backend
    const fromCode = resolveIATA(from);
    const toCode   = resolveIATA(to);

    // Update displayed values so the user sees the resolved code
    setFrom(fromCode);
    setTo(toCode);

    // BUG-FUNC-001: block same origin and destination
    if (fromCode && toCode && fromCode === toCode) {
      setSearchError('Origin and destination cannot be the same airport.');
      setLoading(false);
      return;
    }

    // BUG-FUNC-002: block return date before departure date
    if (tripType === 'return' && returnDate && departDate && returnDate <= departDate) {
      setSearchError('Return date must be after the departure date.');
      setLoading(false);
      return;
    }

    setSearchParams({ tripType, from: fromCode, to: toCode, departDate, returnDate, adults, cabin });
    try {
      const result = await flightsAPI.search({
        from: fromCode,
        to: toCode,
        departureDate: departDate,
        returnDate: tripType === 'return' ? returnDate : undefined,
        adults,
        cabin: cabin.toUpperCase(),
      });
      const results = result.flights || [];
      setFlights(results);

      // If this search was auto-triggered by the voice one-shot booking flow
      // (VoiceAgent set autoSearch + jumpToStep), don't stop at the flight
      // list waiting for a manual "Select" click — auto-pick the best match
      // for the requested cabin and continue straight to the step voice
      // already decided on (passenger details). This is what makes "book me
      // a business class flight..." actually land somewhere other than an
      // untouched results list.
      if (jumpToStepRef.current && results.length > 0) {
        const bestFlight =
          results.find(f => (f.seatsLeft?.[selectedCabinKey] ?? 0) > 0) || results[0];
        setSelectedFlight(bestFlight);
        // Voice booking: show seat popup, then jump to payment (step 4) directly
        if (isVoiceBookingRef.current || bookingSource === 'voice') {
          // Override jumpToStep to 4 so we skip past passenger form
          jumpToStepRef.current = 4;
          setShowSeatPopup(true);
        } else {
          setStep(jumpToStepRef.current);
          jumpToStepRef.current = null;
        }
      } else if (results.length === 0) {
        // No flights matched — surface that instead of silently sitting on
        // an empty Step 2 with no explanation.
        setStep(2);
      } else {
        setStep(2);
      }
    } catch (err) {
      setSearchError(err.message || 'Flight search failed. Please try again.');
    } finally {
      setLoading(false);
      window.scrollTo(0, 0);
    }
  };

  const handleSelectFlight = (flight) => {
    setSelectedFlight(flight);
    const nextStep = jumpToStepRef.current || 3;
    jumpToStepRef.current = null; // consume it
    // For voice bookings: show seat popup before proceeding
    if (isVoiceBookingRef.current || bookingSource === 'voice') {
      setShowSeatPopup(true);
      jumpToStepRef.current = nextStep;
    } else {
      setStep(nextStep);
    }
    window.scrollTo(0, 0);
  };

  const handlePassengerFieldChange = (field, rawValue) => {
    const val = sanitizeInput(rawValue);
    const updated = { ...passenger, [field]: val };
    setPassenger(updated);

    if (touchedFields[field]) {
      let err = null;
      if (field === 'firstName') err = validateFirstName(val);
      else if (field === 'lastName') err = validateLastName(val);
      else if (field === 'phone') err = validatePhone(val);
      else if (field === 'nationality') err = validateNationality(val);

      setPassengerErrors(prev => ({ ...prev, [field]: err }));
    }
  };

  const handlePassengerFieldBlur = (field) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    let err = null;
    if (field === 'firstName') err = validateFirstName(passenger.firstName);
    else if (field === 'lastName') err = validateLastName(passenger.lastName);
    else if (field === 'phone') err = validatePhone(passenger.phone);
    else if (field === 'nationality') err = validateNationality(passenger.nationality);

    setPassengerErrors(prev => ({ ...prev, [field]: err }));
  };

  const handlePassengerSubmit = (e) => {
    e.preventDefault();

    // ── Voice booking fast-path ─────────────────────────────────
    // isVoiceBookingRef.current is the stable flag — never stale
    if (isVoiceBookingRef.current || bookingSource === 'voice') {
      setStep(4);
      window.scrollTo(0, 0);
      return;
    }

    // Validate every traveler row
    const errors = travelers.map(t => {
      const v = validatePassenger(t);
      return v.errors;
    });
    setTravelerErrors(errors);
    setTravelerTouched(travelers.map(() => ({
      firstName: true, lastName: true, phone: true, nationality: true,
    })));

    const allValid = errors.every(e =>
      !e.firstName && !e.lastName && !e.phone && !e.nationality
    );
    if (!allValid) {
      addNotification({ type: 'error', message: 'Please correct the highlighted errors in passenger details.' });
      return;
    }
    setStep(4);
    window.scrollTo(0, 0);
  };

  const handlePaymentFieldChange = (field, rawValue) => {
    let val = rawValue;
    if (field === 'cardNumber') {
      val = formatCardNumber(rawValue);
    } else if (field === 'cvv') {
      val = rawValue.replace(/\D/g, '').slice(0, 3);
    } else if (field === 'expiry') {
      const cleaned = rawValue.replace(/[^\d\/]/g, '');
      if (cleaned.length === 2 && !cleaned.includes('/') && paymentDetails.expiry.length < 2) {
        val = cleaned + '/';
      } else {
        val = cleaned.slice(0, 5);
      }
    }
    const updated = { ...paymentDetails, [field]: val };
    setPaymentDetails(updated);

    if (touchedPaymentFields[field]) {
      let err = null;
      if (field === 'cardNumber') err = validateCardNumber(val);
      else if (field === 'cardName') err = validateCardName(val);
      else if (field === 'expiry') err = validateExpiry(val);
      else if (field === 'cvv') err = validateCVV(val, updated.cardNumber);

      setPaymentErrors(prev => ({ ...prev, [field]: err }));

      if (field === 'cardNumber' && touchedPaymentFields.cvv) {
        setPaymentErrors(prev => ({ ...prev, cvv: validateCVV(updated.cvv, val) }));
      }
    }
  };

  const handlePaymentFieldBlur = (field) => {
    setTouchedPaymentFields(prev => ({ ...prev, [field]: true }));
    let err = null;
    if (field === 'cardNumber') err = validateCardNumber(paymentDetails.cardNumber);
    else if (field === 'cardName') err = validateCardName(paymentDetails.cardName);
    else if (field === 'expiry') err = validateExpiry(paymentDetails.expiry);
    else if (field === 'cvv') err = validateCVV(paymentDetails.cvv, paymentDetails.cardNumber);

    setPaymentErrors(prev => ({ ...prev, [field]: err }));
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setTouchedPaymentFields({ cardNumber: true, cardName: true, expiry: true, cvv: true });
    const validation = validatePaymentDetails(paymentDetails);
    setPaymentErrors(validation.errors);

    if (!validation.isValid) {
      addNotification({ type: 'error', message: 'Please correct the highlighted errors in payment details.' });
      return;
    }

    setLoading(true);
    try {
      // Build traveler payload from the full travelers array
      const travelersPayload = travelers.map(t => ({
        firstName:   t.firstName,
        lastName:    t.lastName,
        phone:       t.phone,
        nationality: t.nationality,
      }));

      // If more seats than traveler rows, pad with last traveler's data
      while (travelersPayload.length < adults) {
        travelersPayload.push({ ...travelersPayload[travelersPayload.length - 1] });
      }
      const lead = travelersPayload[0];

      const booking = await bookingsAPI.create(selectedFlight, travelersPayload, [
        { phones: [{ deviceType: 'MOBILE', countryCallingCode: '44', number: (lead.phone || '').replace(/\D/g, '') || '7700900000' }] },
      ]);

      // Persist the seat the user chose (was previously only shown in UI)
      if (selectedSeat) {
        try { await bookingsAPI.selectSeat(booking.reference, selectedSeat); } catch (_) {}
      }

      setBookingRef(booking.reference);
      addBooking(booking);
      addNotification({ type: 'success', message: `Booking confirmed! Reference: ${booking.reference}` });
      setStep(5);
      window.scrollTo(0, 0);
    } catch (err) {
      addNotification({ type: 'error', message: err.message || 'Payment failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Seat popup callbacks (voice booking only)
  const handleSeatPopupConfirm = (seatCode) => {
    setSelectedSeat(seatCode);
    setShowSeatPopup(false);
    const nextStep = jumpToStepRef.current || 3;
    jumpToStepRef.current = null;
    setStep(nextStep);
    window.scrollTo(0, 0);
  };

  const handleSeatPopupSkip = () => {
    setShowSeatPopup(false);
    const nextStep = jumpToStepRef.current || 3;
    jumpToStepRef.current = null;
    setStep(nextStep);
    window.scrollTo(0, 0);
  };

  return (
    <div className="bookflight">
      {/* Voice Booking Animator — animated field-fill overlay */}
      {showAnimator && (
        <VoiceBookingAnimator
          navState={animatorNavState}
          visible={showAnimator}
          onComplete={() => {
            setShowAnimator(false);
            // Now trigger the auto-search / step jump that was deferred
            const s = voiceNavRef.current;
            if (s?.autoSearch) {
              setAutoSearchTrigger(true);
            } else if (s?.jumpToStep) {
              setStep(s.jumpToStep);
            }
          }}
        />
      )}

      {/* Voice Seat Popup — shown when voice booking selects a flight */}
      {showSeatPopup && (
        <VoiceSeatPopup
          flight={selectedFlight}
          from={from}
          to={to}
          cabin={cabin}
          preSelected={location.state?.selectedSeat || null}
          onConfirm={handleSeatPopupConfirm}
          onSkip={handleSeatPopupSkip}
        />
      )}

      {/* Page Header */}
      <div className="page-header">
        <div className="container">
          <h1>Book a Flight</h1>
          <p>Search hundreds of routes and find the best fare for your journey</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bookflight__steps">
        <div className="container">
          <div className="bookflight__steps-row">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`bookflight__step ${step === i + 1 ? 'bookflight__step--active' : ''} ${step > i + 1 ? 'bookflight__step--done' : ''}`}
              >
                <div className="bookflight__step-num">
                  {step > i + 1 ? <FaCheck size={12} /> : i + 1}
                </div>
                <span>{s}</span>
                {i < steps.length - 1 && <div className="bookflight__step-line" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Booking Source + Timer bar */}
      {(bookingSource) && (
        <div className="container">
          <BookingSourceBar source={bookingSource} formatted={timerFormatted} />
        </div>
      )}

      <div className="container bookflight__content">

        {/* STEP 1: Search */}
        {step === 1 && (
          <div className="bookflight__search-wrap">
            <div className="card bookflight__search-card">
              <div className="bookflight__trip-tabs">
                {[['return','Return'],['oneway','One Way'],['multicity','Multi-City']].map(([val, lbl]) => (
                  <button
                    key={val}
                    className={`bookflight__trip-tab ${tripType === val ? 'bookflight__trip-tab--active' : ''}`}
                    onClick={() => setTripType(val)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSearch} className="bookflight__form">
                <div className="bookflight__form-row">
                  {/* From */}
                  <div className="bookflight__field" style={{ position: 'relative' }}>
                    <label className="form-label"><FaMapMarkerAlt size={11} /> From</label>
                    <input
                      className="form-control bookflight__big-input"
                      placeholder="City or airport code"
                      value={from}
                      onChange={e => { setFrom(e.target.value); debouncedFetchFrom(e.target.value); }}
                      onBlur={() => setTimeout(() => setFromSuggestions([]), 150)}
                      autoComplete="off"
                      required
                    />
                    {fromSuggestions.length > 0 && (
                      <div className="bookflight__suggestions">
                        {fromSuggestions.map(a => (
                          <button type="button" key={a.code} className="bookflight__suggestion"
                            onMouseDown={e => { e.preventDefault(); setFrom(a.code); setFromSuggestions([]); }}>
                            <strong>{a.code}</strong> — {a.city}, {a.country}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button type="button" className="bookflight__swap" onClick={() => { const t = from; setFrom(to); setTo(t); }}>
                    <FaExchangeAlt size={16} />
                  </button>

                  {/* To */}
                  <div className="bookflight__field" style={{ position: 'relative' }}>
                    <label className="form-label"><FaMapMarkerAlt size={11} /> To</label>
                    <input
                      className="form-control bookflight__big-input"
                      placeholder="City or airport code"
                      value={to}
                      onChange={e => { setTo(e.target.value); debouncedFetchTo(e.target.value); }}
                      onBlur={() => setTimeout(() => setToSuggestions([]), 150)}
                      autoComplete="off"
                      required
                    />
                    {toSuggestions.length > 0 && (
                      <div className="bookflight__suggestions">
                        {toSuggestions.map(a => (
                          <button type="button" key={a.code} className="bookflight__suggestion"
                            onMouseDown={e => { e.preventDefault(); setTo(a.code); setToSuggestions([]); }}>
                            <strong>{a.code}</strong> — {a.city}, {a.country}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bookflight__form-row">
                  <div className="bookflight__field">
                    <label className="form-label"><FaCalendarAlt size={11} /> Depart</label>
                    <input type="date" className="form-control" value={departDate}
                      onChange={e => setDepartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]} required />
                  </div>

                  {tripType === 'return' && (
                    <div className="bookflight__field">
                      <label className="form-label"><FaCalendarAlt size={11} /> Return</label>
                      <input type="date" className="form-control" value={returnDate}
                        onChange={e => setReturnDate(e.target.value)}
                        min={departDate || new Date().toISOString().split('T')[0]} />
                    </div>
                  )}

                  <div className="bookflight__field">
                    <label className="form-label"><FaUsers size={11} /> Passengers</label>
                    <select className="form-control" value={adults} onChange={e => setAdults(+e.target.value)}>
                      {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} Adult{n>1?'s':''}</option>)}
                    </select>
                  </div>

                  <div className="bookflight__field">
                    <label className="form-label"><FaPlane size={11} /> Cabin</label>
                    <select className="form-control" value={cabin} onChange={e => setCabin(e.target.value)}>
                      {cabinOptions.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>

                  <button type="submit" id="ba-flight-search-btn" className="btn btn-primary bookflight__search-btn" disabled={loading}>
                    {loading ? <span className="spinner" style={{width:18,height:18,borderWidth:2}} /> : <><FaSearch size={14} /> Search</>}
                  </button>
                </div>
                {searchError && (
                  <div className="bookflight__search-error">
                    <FaTimes size={13} /> {searchError}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* STEP 2: Select Flight */}
        {step === 2 && (
          <div className="bookflight__results">
            <div className="bookflight__results-header">
              <div>
                <h2>{from} <FaPlane size={14} style={{color:'var(--ba-blue)',margin:'0 6px'}} /> {to}</h2>
                <p>
                  {departDate} · {adults} Adult{adults>1?'s':''} · {cabinOptions.find(c=>c.value===cabin)?.label}
                  {isVoiceBooking && (
                    <span style={{marginLeft:10,background:'#075aaa',color:'#fff',borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700}}>
                      <FaMicrophone size={9} style={{marginRight:4}} />Voice Search
                    </span>
                  )}
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setStep(1)}>
                Modify Search
              </button>
            </div>

            <div className="bookflight__flight-list">
              {flights.length === 0 ? (
                <div className="bookflight__no-results">
                  <FaPlane size={40} style={{ color: 'var(--ba-border)', margin: '0 auto' }} />
                  <h3>No flights found</h3>
                  <p>No available flights match your search. Try different dates or a nearby airport.</p>
                  <button className="btn btn-secondary" onClick={() => setStep(1)}>Modify Search</button>
                </div>
              ) : flights.map(flight => (
                <div key={flight.id} className="bookflight__flight-card card">
                  <div className="bookflight__flight-main">
                    <div className="bookflight__airline">
                      <div className="bookflight__airline-logo">BA</div>
                      <div>
                        <strong>{flight.flightNumber}</strong>
                        <span>{flight.aircraft}</span>
                      </div>
                    </div>

                    <div className="bookflight__times">
                      <div className="bookflight__time">
                        <strong>{flight.departure}</strong>
                        <span>{flight.from}</span>
                      </div>
                      <div className="bookflight__duration">
                        <span>{flight.duration}</span>
                        <div className="bookflight__flight-line">
                          <div className="bookflight__dot" />
                          <div className="bookflight__line" />
                          <FaPlane size={12} style={{color:'var(--ba-blue)'}} />
                          <div className="bookflight__line" />
                          <div className="bookflight__dot" />
                        </div>
                        <span>{flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop (${flight.stopAirport})`}</span>
                      </div>
                      <div className="bookflight__time">
                        <strong>{flight.arrival}</strong>
                        <span>{flight.to}</span>
                      </div>
                    </div>

                    <div className="bookflight__amenities">
                      {flight.amenities.map(a => (
                        <span key={a} className="bookflight__amenity">
                          {a === 'Wi-Fi' && <FaWifi size={11} />}
                          {a === 'Meals' && <FaUtensils size={11} />}
                          {a === 'Entertainment' && <FaTv size={11} />}
                          {a === 'USB Charging' && <FaBriefcase size={11} />}
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bookflight__cabin-prices">
                    {cabinOptions.map(opt => (
                      <div
                        key={opt.key}
                        className={`bookflight__cabin-price ${selectedCabinKey === opt.key ? 'bookflight__cabin-price--selected' : ''}`}
                        onClick={() => setSelectedCabinKey(opt.key)}
                      >
                        <span className="bookflight__cabin-label">{opt.label}</span>
                        <strong className="bookflight__cabin-amt">£{flight.prices[opt.key]}</strong>
                        <span className="bookflight__cabin-seats">{flight.seatsLeft[opt.key]} left</span>
                      </div>
                    ))}
                    <button
                      className="btn btn-primary"
                      onClick={() => handleSelectFlight(flight)}
                    >
                      Select <FaChevronRight size={12} />
                    </button>
                    {/* Quick Book: logged-in users with full profile skip Step 3 */}
                    {user?.phone && user?.nationality && (
                      <button
                        className="btn btn-secondary bookflight__quickbook-btn"
                        title="Skip passenger form — pre-filled from your profile"
                        onClick={() => {
                          setSelectedFlight(flight);
                          setStep(4);
                          window.scrollTo(0, 0);
                        }}
                      >
                        ⚡ Quick Book
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Passenger Details */}
        {step === 3 && (
          <div className="bookflight__passenger">
            {/* Flight summary strip */}
            <div className="bookflight__selected-summary card">
              <h3>Selected Flight</h3>
              <div className="bookflight__summary-row">
                <span><FaPlane size={13} /> {selectedFlight?.flightNumber}</span>
                <span>{from} → {to}</span>
                <span>{selectedFlight?.departure} – {selectedFlight?.arrival}</span>
                <span>{cabinOptions.find(c=>c.key===selectedCabinKey)?.label}</span>
                <strong>£{selectedFlight?.prices[selectedCabinKey] * adults}</strong>
              </div>
            </div>

            <form className="card bookflight__pax-form" noValidate onSubmit={handlePassengerSubmit}>
              <div className="bookflight__pax-header">
                <h2>Passenger Details</h2>
                <span className="bookflight__pax-count">
                  {travelers.length} / {adults} passenger{adults > 1 ? 's' : ''}
                </span>
              </div>
              <p className="bookflight__pax-note">
                Passenger 1 is pre-filled from your profile. Edit or confirm, then add extra passengers below.
              </p>

              {/* ── Traveler cards ─────────────────────────────────────── */}
              {travelers.map((t, idx) => {
                const errs    = travelerErrors[idx]    || {};
                const touched = travelerTouched[idx]   || {};
                const isLead  = idx === 0;
                const isProfiled = t.isProfile && isLead;

                const setField = (field, val) => {
                  setTravelers(prev => {
                    const next = [...prev];
                    next[idx] = { ...next[idx], [field]: sanitizeInput(val), isProfile: false };
                    return next;
                  });
                  // live validate if touched
                  if (touched[field]) {
                    const fn = { firstName: validateFirstName, lastName: validateLastName, phone: validatePhone, nationality: validateNationality }[field];
                    if (fn) setTravelerErrors(pe => { const n=[...pe]; n[idx]={...n[idx],[field]:fn(sanitizeInput(val))}; return n; });
                  }
                };

                const blurField = (field) => {
                  setTravelerTouched(prev => { const n=[...prev]; n[idx]={...n[idx],[field]:true}; return n; });
                  const fn = { firstName: validateFirstName, lastName: validateLastName, phone: validatePhone, nationality: validateNationality }[field];
                  if (fn) setTravelerErrors(pe => { const n=[...pe]; n[idx]={...n[idx],[field]:fn(t[field]||'')}; return n; });
                };

                return (
                  <div key={idx} className={`bookflight__pax-card ${isProfiled ? 'bookflight__pax-card--profile' : ''}`}>
                    <div className="bookflight__pax-card-header">
                      <div className="bookflight__pax-card-title">
                        <span className="bookflight__pax-index">
                          {isLead ? '👤' : `✈️`} Passenger {idx + 1}
                          {isLead && <span className="bookflight__pax-lead-badge">Lead</span>}
                        </span>
                        {isProfiled && (
                          <span className="bookflight__pax-profile-tag">
                            ⚡ Pre-filled from your profile
                          </span>
                        )}
                      </div>
                      {!isLead && (
                        <button
                          type="button"
                          className="bookflight__pax-remove"
                          onClick={() => {
                            setTravelers(p => p.filter((_, i) => i !== idx));
                            setTravelerErrors(p => p.filter((_, i) => i !== idx));
                            setTravelerTouched(p => p.filter((_, i) => i !== idx));
                          }}
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    <div className="bookflight__form-grid">
                      {/* First Name */}
                      <div className="form-group">
                        <label className="form-label">First Name</label>
                        <input
                          className={`form-control ${touched.firstName && errs.firstName ? 'is-invalid' : ''}`}
                          value={t.firstName}
                          onChange={e => setField('firstName', e.target.value)}
                          onBlur={() => blurField('firstName')}
                          placeholder="First name"
                          required
                        />
                        {touched.firstName && errs.firstName && (
                          <span className="field-error-msg" style={{color:'#d32f2f',fontSize:'0.82rem',marginTop:'4px',display:'block'}}>{errs.firstName}</span>
                        )}
                      </div>

                      {/* Last Name */}
                      <div className="form-group">
                        <label className="form-label">Last Name</label>
                        <input
                          className={`form-control ${touched.lastName && errs.lastName ? 'is-invalid' : ''}`}
                          value={t.lastName}
                          onChange={e => setField('lastName', e.target.value)}
                          onBlur={() => blurField('lastName')}
                          placeholder="Last name"
                          required
                        />
                        {touched.lastName && errs.lastName && (
                          <span className="field-error-msg" style={{color:'#d32f2f',fontSize:'0.82rem',marginTop:'4px',display:'block'}}>{errs.lastName}</span>
                        )}
                      </div>

                      {/* Phone */}
                      <div className="form-group">
                        <label className="form-label">Phone Number</label>
                        <input
                          type="tel"
                          className={`form-control ${touched.phone && errs.phone ? 'is-invalid' : ''}`}
                          value={t.phone}
                          onChange={e => setField('phone', e.target.value)}
                          onBlur={() => blurField('phone')}
                          placeholder="+44 7xxx xxxxxx"
                          required
                        />
                        {touched.phone && errs.phone && (
                          <span className="field-error-msg" style={{color:'#d32f2f',fontSize:'0.82rem',marginTop:'4px',display:'block'}}>{errs.phone}</span>
                        )}
                      </div>

                      {/* Nationality */}
                      <div className="form-group">
                        <label className="form-label">Nationality</label>
                        <select
                          className={`form-control ${touched.nationality && errs.nationality ? 'is-invalid' : ''}`}
                          value={t.nationality}
                          onChange={e => setField('nationality', e.target.value)}
                          onBlur={() => blurField('nationality')}
                        >
                          {[
                            ['GB','British'],['US','American'],['AU','Australian'],['CA','Canadian'],
                            ['DE','German'],['FR','French'],['IN','Indian'],['AE','Emirati'],
                            ['SG','Singaporean'],['JP','Japanese'],['PK','Pakistani'],['IE','Irish'],
                            ['ZA','South African'],['OTHER','Other'],
                          ].map(([val, lbl]) => (
                            <option key={val} value={val}>{lbl}</option>
                          ))}
                        </select>
                        {touched.nationality && errs.nationality && (
                          <span className="field-error-msg" style={{color:'#d32f2f',fontSize:'0.82rem',marginTop:'4px',display:'block'}}>{errs.nationality}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* ── Add Passenger button ───────────────────────────────── */}
              {travelers.length < adults && (
                <button
                  type="button"
                  className="bookflight__pax-add"
                  onClick={() => {
                    setTravelers(p => [...p, makeBlankPassenger()]);
                    setTravelerErrors(p => [...p, {}]);
                    setTravelerTouched(p => [...p, {}]);
                  }}
                >
                  + Add Passenger {travelers.length + 1} of {adults}
                </button>
              )}
              {travelers.length >= adults && adults > 1 && (
                <p className="bookflight__pax-all-added">
                  ✓ All {adults} passengers added
                </p>
              )}

              {/* ── Seat Selection ─────────────────────────────────────── */}
              <div className="bookflight__seat-section">
                <h3><FaChair /> Select Preferred Seat</h3>
                <p>Standard seat selection is included. Your profile preference is pre-selected.</p>
                <div className="bookflight__seat-btns">
                  {['10A (Window)', '10B (Aisle)', '12A (Window)', '14A (Window)', '14B (Middle)', '15C (Aisle)', '20F (Window)'].map(s => {
                    const code = s.split(' ')[0];
                    return (
                      <button
                        key={s}
                        type="button"
                        className={`btn ${selectedSeat === code ? 'btn-primary' : 'btn-secondary'} bookflight__seat-btn`}
                        onClick={() => setSelectedSeat(code)}
                      >
                        {selectedSeat === code ? '✓ ' : ''}{s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bookflight__pax-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
                {/* Voice booking: show a prominent skip button so users aren't blocked */}
                {isVoiceBooking && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: 'linear-gradient(135deg,#075aaa,#011627)', display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => { setStep(4); window.scrollTo(0,0); }}
                  >
                    <FaMicrophone size={13} /> Continue to Payment
                  </button>
                )}
                <button type="submit" className="btn btn-primary">
                  Proceed to Payment <FaChevronRight size={12} />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 4: Review & Pay */}
        {step === 4 && (
          <div className="bookflight__payment">
            <div className="bookflight__payment-layout">
              {/* Order Summary */}
              <div className="card bookflight__order-summary">
                <h3>Order Summary</h3>
                <div className="bookflight__summary-item">
                  <span>Flight {selectedFlight?.flightNumber}</span>
                  <span>{from} → {to}</span>
                </div>
                <div className="bookflight__summary-item">
                  <span>Cabin</span>
                  <span>{cabinOptions.find(c=>c.key===selectedCabinKey)?.label}</span>
                </div>
                <div className="bookflight__summary-item">
                  <span>Selected Seat</span>
                  <strong>{selectedSeat} (Confirmed)</strong>
                </div>
                <div className="bookflight__summary-item">
                  <span>Passengers</span>
                  <span>{adults} Adult{adults>1?'s':''}</span>
                </div>
                <div className="bookflight__summary-item">
                  <span>Fare per person</span>
                  <span>£{selectedFlight?.prices[selectedCabinKey]}</span>
                </div>
                <div className="bookflight__summary-item bookflight__summary-item--taxes">
                  <span>Taxes & Fees</span>
                  <span>£{Math.floor(selectedFlight?.prices[selectedCabinKey] * 0.12)}</span>
                </div>
                <div className="bookflight__summary-total">
                  <span>Total</span>
                  <strong>£{Math.floor(selectedFlight?.prices[selectedCabinKey] * adults * 1.12)}</strong>
                </div>
                <div className="bookflight__avios-earn">
                  <FaStar size={14} style={{color:'var(--ba-gold)'}} />
                  You'll earn ~{Math.floor(selectedFlight?.prices[selectedCabinKey] * 1.5)} Avios
                </div>
              </div>

              {/* Payment Form */}
              <form className="card bookflight__pay-form" noValidate onSubmit={handlePayment}>
                <h2>Payment Details</h2>
                <div className="bookflight__card-icons">
                  {['VISA', 'MC', 'AMEX'].map(c => (
                    <span key={c} className="bookflight__card-icon">{c}</span>
                  ))}
                </div>

                <div className="bookflight__form-grid">
                  <div className="form-group" style={{gridColumn:'1/-1'}}>
                    <label className="form-label" htmlFor="card-number">Card Number</label>
                    <input
                      id="card-number"
                      className={`form-control ${touchedPaymentFields.cardNumber && paymentErrors.cardNumber ? 'is-invalid' : ''}`}
                      required
                      placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      value={paymentDetails.cardNumber}
                      onChange={e => handlePaymentFieldChange('cardNumber', e.target.value)}
                      onBlur={() => handlePaymentFieldBlur('cardNumber')}
                      aria-invalid={!!(touchedPaymentFields.cardNumber && paymentErrors.cardNumber)}
                    />
                    {touchedPaymentFields.cardNumber && paymentErrors.cardNumber && (
                      <span className="field-error-msg" style={{ color: '#d32f2f', fontSize: '0.82rem', marginTop: '4px', display: 'block' }}>
                        {paymentErrors.cardNumber}
                      </span>
                    )}
                  </div>
                  <div className="form-group" style={{gridColumn:'1/-1'}}>
                    <label className="form-label" htmlFor="card-name">Name on Card</label>
                    <input
                      id="card-name"
                      className={`form-control ${touchedPaymentFields.cardName && paymentErrors.cardName ? 'is-invalid' : ''}`}
                      required
                      placeholder="J SMITH"
                      value={paymentDetails.cardName}
                      onChange={e => handlePaymentFieldChange('cardName', e.target.value)}
                      onBlur={() => handlePaymentFieldBlur('cardName')}
                      aria-invalid={!!(touchedPaymentFields.cardName && paymentErrors.cardName)}
                    />
                    {touchedPaymentFields.cardName && paymentErrors.cardName && (
                      <span className="field-error-msg" style={{ color: '#d32f2f', fontSize: '0.82rem', marginTop: '4px', display: 'block' }}>
                        {paymentErrors.cardName}
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="card-expiry">Expiry Date</label>
                    <input
                      id="card-expiry"
                      className={`form-control ${touchedPaymentFields.expiry && paymentErrors.expiry ? 'is-invalid' : ''}`}
                      required
                      placeholder="MM/YY"
                      maxLength={5}
                      value={paymentDetails.expiry}
                      onChange={e => handlePaymentFieldChange('expiry', e.target.value)}
                      onBlur={() => handlePaymentFieldBlur('expiry')}
                      aria-invalid={!!(touchedPaymentFields.expiry && paymentErrors.expiry)}
                    />
                    {touchedPaymentFields.expiry && paymentErrors.expiry && (
                      <span className="field-error-msg" style={{ color: '#d32f2f', fontSize: '0.82rem', marginTop: '4px', display: 'block' }}>
                        {paymentErrors.expiry}
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="card-cvv">CVV</label>
                    <input
                      id="card-cvv"
                      className={`form-control ${touchedPaymentFields.cvv && paymentErrors.cvv ? 'is-invalid' : ''}`}
                      required
                      placeholder="123"
                      maxLength={3}
                      type="password"
                      value={paymentDetails.cvv}
                      onChange={e => handlePaymentFieldChange('cvv', e.target.value)}
                      onBlur={() => handlePaymentFieldBlur('cvv')}
                      aria-invalid={!!(touchedPaymentFields.cvv && paymentErrors.cvv)}
                    />
                    {touchedPaymentFields.cvv && paymentErrors.cvv && (
                      <span className="field-error-msg" style={{ color: '#d32f2f', fontSize: '0.82rem', marginTop: '4px', display: 'block' }}>
                        {paymentErrors.cvv}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '16px', background: '#f0f4f8', padding: '12px', borderRadius: '8px', border: '1px solid #d0dbe5' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--ba-blue)', display: 'block', marginBottom: '6px' }}>
                    Demo Cards (Click to Autofill):
                  </span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '4px' }}
                      onClick={() => {
                        setPaymentDetails({
                          cardNumber: '4532 0151 1283 0366',
                          cardName: 'JOHN SMITH',
                          expiry: '12/28',
                          cvv: '123',
                        });
                        setPaymentErrors({});
                      }}
                    >
                      💳 Visa (16-digit / 3-digit CVV)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '4px' }}
                      onClick={() => {
                        setPaymentDetails({
                          cardNumber: '1234 5678 9012 3451',
                          cardName: 'RAJA ABILASH',
                          expiry: '12/28',
                          cvv: '123',
                        });
                        setPaymentErrors({});
                      }}
                    >
                      💳 Raja Abilash (1234 5678 9012 3451)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem', borderRadius: '4px' }}
                      onClick={() => {
                        setPaymentDetails({
                          cardNumber: '3782 822463 10005',
                          cardName: 'JANE SMITH',
                          expiry: '09/29',
                          cvv: '123',
                        });
                        setPaymentErrors({});
                      }}
                    >
                      💳 Amex (15-digit / 3-digit CVV)
                    </button>
                  </div>
                </div>

                <div className="bookflight__secure-note">
                  <FaShieldAlt size={14} style={{color:'var(--ba-blue)'}} />
                  <span>Your payment is secured with 256-bit SSL encryption.</span>
                </div>

                <div className="bookflight__pax-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(3)}>Back</button>
                  <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                    {loading
                      ? <><span className="spinner" style={{width:18,height:18,borderWidth:2}} /> Processing...</>
                      : `Pay £${Math.floor(selectedFlight?.prices[selectedCabinKey] * adults * 1.12)}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* STEP 5: Confirmation */}
        {step === 5 && (
          <div className="bookflight__confirmation">
            <div className="bookflight__confirm-card card">
              <div className="bookflight__confirm-icon">
                <FaCheck size={32} />
              </div>
              <h2>Booking Confirmed!</h2>
              <p>Thank you, {passenger.firstName}. Your booking is confirmed.</p>
              {/* Show booking method + time taken */}
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:12}}>
                <span style={{
                  display:'inline-flex',alignItems:'center',gap:6,padding:'5px 14px',
                  borderRadius:20,fontSize:12,fontWeight:700,
                  background: isVoiceBooking ? 'linear-gradient(135deg,#011627,#075aaa)' : '#f0f4f8',
                  color: isVoiceBooking ? '#fff' : '#2c3e50',
                  border: isVoiceBooking ? '1px solid #2196f3' : '1px solid #c8d6e2',
                }}>
                  {isVoiceBooking ? <FaMicrophone size={11} /> : <FaSearch size={11} />}
                  {isVoiceBooking ? 'Voice Booking' : 'Manual Booking'} · {timerFormatted}
                </span>
              </div>

              <div className="bookflight__confirm-ref">
                <span>Booking Reference</span>
                <strong>{bookingRef}</strong>
              </div>

              <div className="bookflight__confirm-details">
                <div className="bookflight__confirm-row">
                  <span>Flight</span><strong>{selectedFlight?.flightNumber}</strong>
                </div>
                <div className="bookflight__confirm-row">
                  <span>Route</span><strong>{from} → {to}</strong>
                </div>
                <div className="bookflight__confirm-row">
                  <span>Date</span><strong>{departDate}</strong>
                </div>
                <div className="bookflight__confirm-row">
                  <span>Departure</span><strong>{selectedFlight?.departure}</strong>
                </div>
                <div className="bookflight__confirm-row">
                  <span>Cabin</span><strong>{cabinOptions.find(c=>c.key===selectedCabinKey)?.label}</strong>
                </div>
                <div className="bookflight__confirm-row">
                  <span>Passengers</span><strong>{adults}</strong>
                </div>
              </div>

              <div className="bookflight__confirm-avios">
                <FaStar size={16} style={{color:'var(--ba-gold)'}} />
                <span>You'll earn <strong>{Math.floor(selectedFlight?.prices[selectedCabinKey] * 1.5)} Avios</strong> on this booking!</span>
              </div>

              <div className="bookflight__confirm-actions">
                <button className="btn btn-primary" onClick={() => navigate('/check-in')}>
                  Check-in Online
                </button>
                <button className="btn btn-secondary" onClick={() => navigate('/manage')}>
                  Manage Booking
                </button>
                <button className="btn btn-secondary" onClick={() => { setStep(1); setSelectedFlight(null); }}>
                  Book Another Flight
                </button>
              </div>

              {passenger.phone && (
                <p className="bookflight__confirm-email">
                  A confirmation SMS/notice will be sent to <strong>{passenger.phone}</strong>
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}