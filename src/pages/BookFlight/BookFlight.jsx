import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  FaPlane, FaSearch, FaExchangeAlt, FaMapMarkerAlt,
  FaCalendarAlt, FaUsers, FaChevronRight, FaCheck,
  FaWifi, FaUtensils, FaTv, FaBriefcase, FaTimes,
  FaShieldAlt, FaStar, FaChair,
} from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { flightsAPI, airportsAPI, bookingsAPI } from '../../services/api';
import {
  validatePassenger,
  validateFirstName,
  validateLastName,
  validatePhone,
  validateNationality,
  validatePaymentDetails,
  validateCardNumber,
  validateCVV,
  validateExpiry,
  validateCardName,
  formatCardNumber,
  sanitizeInput,
} from '../../utils/validation';
import './BookFlight.css';

// debounce helper — avoids hammering the airport API on every keystroke
function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
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
  const { searchParams, setSearchParams, addBooking, addNotification, user } = useApp();

  const [step, setStep] = useState(1);
  const [tripType, setTripType] = useState(searchParams.tripType || 'return');
  const [from, setFrom] = useState(urlParams.get('from') || searchParams.from || '');
  const [to, setTo] = useState(urlParams.get('to') || searchParams.to || '');
  const [departDate, setDepartDate] = useState(searchParams.departDate || '');
  const [returnDate, setReturnDate] = useState(searchParams.returnDate || '');
  const [adults, setAdults] = useState(Number(searchParams.adults) || 1);
  const [cabin, setCabin] = useState(urlParams.get('cabin') || searchParams.cabin || 'economy');
  const [flights, setFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedCabinKey, setSelectedCabinKey] = useState('economy');
  const [selectedSeat, setSelectedSeat] = useState(location.state?.selectedSeat || '14A');
  const [loading, setLoading] = useState(false);
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [passenger, setPassenger] = useState({
    firstName: user?.firstName || '',
    lastName:  user?.lastName  || '',
    phone:     '',
    nationality: 'GB',
  });
  const [passengerErrors, setPassengerErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [paymentErrors, setPaymentErrors] = useState({});
  const [touchedPaymentFields, setTouchedPaymentFields] = useState({});

  // ── Pre-fill from voice agent ──────────────────────────────────
  // When VoiceAgent does booking it navigates here with
  // location.state = { prefillPassenger: {...}, from, to, departDate, jumpToStep: 4, autoSearch: true }
  useEffect(() => {
    const s = location.state;
    if (!s) return;
    if (s.prefillPassenger || s.autoSearch || s.from) {
      const pf = s.prefillPassenger || {};
      setPassenger(prev => ({
        firstName:   pf.firstName   || prev.firstName   || '',
        lastName:    pf.lastName    || prev.lastName    || '',
        phone:       pf.phone       || prev.phone       || '',
        nationality: pf.nationality || prev.nationality || '',
      }));

      if (s.from)       setFrom(s.from);
      if (s.to)         setTo(s.to);
      if (s.departDate) setDepartDate(s.departDate);
      if (s.returnDate) setReturnDate(s.returnDate);
      if (s.adults)     setAdults(Number(s.adults));
      if (s.cabin)      setCabin(s.cabin);
      if (s.tripType)   setTripType(s.tripType);
      if (s.selectedFlight) setSelectedFlight(s.selectedFlight);
      if (s.jumpToStep) jumpToStepRef.current = s.jumpToStep;

      if (s.autoSearch) {
        setTimeout(() => document.getElementById('ba-flight-search-btn')?.click(), 300);
      } else if (s.jumpToStep) {
        setStep(s.jumpToStep);
      }
    }
    window.history.replaceState({}, '', window.location.pathname + window.location.search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
        setStep(jumpToStepRef.current);
        jumpToStepRef.current = null; // consume it
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
    setStep(nextStep);
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
    setTouchedFields({ firstName: true, lastName: true, phone: true, nationality: true });
    const validation = validatePassenger(passenger);
    setPassengerErrors(validation.errors);

    if (!validation.isValid) {
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
      val = rawValue.replace(/\D/g, '').slice(0, 4);
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
      // Build traveler payload from passenger form data
      const travelers = [{
        firstName:   passenger.firstName,
        lastName:    passenger.lastName,
        phone:       passenger.phone,
        nationality: passenger.nationality,
      }];
      // Replicate for multiple adults (same lead passenger for demo)
      for (let i = 1; i < adults; i++) travelers.push({ ...travelers[0] });

      const booking = await bookingsAPI.create(selectedFlight, travelers, [
        { phones: [{ deviceType: 'MOBILE', countryCallingCode: '44', number: passenger.phone.replace(/\D/g, '') || '7700900000' }] },
      ]);

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

  return (
    <div className="bookflight">
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
                <p>{departDate} · {adults} Adult{adults>1?'s':''} · {cabinOptions.find(c=>c.value===cabin)?.label}</p>
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Passenger Details */}
        {step === 3 && (
          <div className="bookflight__passenger">
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
              <h2>Passenger Details</h2>
              <p className="bookflight__pax-note">
                Enter your details as the lead passenger.
              </p>

              <div className="bookflight__form-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="passenger-first-name">First Name</label>
                  <input
                    id="passenger-first-name"
                    className={`form-control ${touchedFields.firstName && passengerErrors.firstName ? 'is-invalid' : ''}`}
                    required
                    value={passenger.firstName}
                    onChange={e => handlePassengerFieldChange('firstName', e.target.value)}
                    onBlur={() => handlePassengerFieldBlur('firstName')}
                    placeholder="First name"
                    aria-invalid={!!(touchedFields.firstName && passengerErrors.firstName)}
                  />
                  {touchedFields.firstName && passengerErrors.firstName && (
                    <span className="field-error-msg" style={{ color: '#d32f2f', fontSize: '0.82rem', marginTop: '4px', display: 'block' }}>
                      {passengerErrors.firstName}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="passenger-last-name">Last Name</label>
                  <input
                    id="passenger-last-name"
                    className={`form-control ${touchedFields.lastName && passengerErrors.lastName ? 'is-invalid' : ''}`}
                    required
                    value={passenger.lastName}
                    onChange={e => handlePassengerFieldChange('lastName', e.target.value)}
                    onBlur={() => handlePassengerFieldBlur('lastName')}
                    placeholder="Last name"
                    aria-invalid={!!(touchedFields.lastName && passengerErrors.lastName)}
                  />
                  {touchedFields.lastName && passengerErrors.lastName && (
                    <span className="field-error-msg" style={{ color: '#d32f2f', fontSize: '0.82rem', marginTop: '4px', display: 'block' }}>
                      {passengerErrors.lastName}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="passenger-phone">Phone Number</label>
                  <input
                    id="passenger-phone"
                    type="tel"
                    className={`form-control ${touchedFields.phone && passengerErrors.phone ? 'is-invalid' : ''}`}
                    required
                    value={passenger.phone}
                    onChange={e => handlePassengerFieldChange('phone', e.target.value)}
                    onBlur={() => handlePassengerFieldBlur('phone')}
                    placeholder="+44 7xxx xxxxxx"
                    aria-invalid={!!(touchedFields.phone && passengerErrors.phone)}
                  />
                  {touchedFields.phone && passengerErrors.phone && (
                    <span className="field-error-msg" style={{ color: '#d32f2f', fontSize: '0.82rem', marginTop: '4px', display: 'block' }}>
                      {passengerErrors.phone}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="passenger-nationality">Nationality</label>
                  <select
                    id="passenger-nationality"
                    className={`form-control ${touchedFields.nationality && passengerErrors.nationality ? 'is-invalid' : ''}`}
                    value={passenger.nationality}
                    onChange={e => handlePassengerFieldChange('nationality', e.target.value)}
                    onBlur={() => handlePassengerFieldBlur('nationality')}
                    aria-invalid={!!(touchedFields.nationality && passengerErrors.nationality)}
                  >
                    <option value="GB">British</option>
                    <option value="US">American</option>
                    <option value="AU">Australian</option>
                    <option value="CA">Canadian</option>
                    <option value="DE">German</option>
                    <option value="FR">French</option>
                    <option value="IN">Indian</option>
                    <option value="PK">Pakistani</option>
                    <option value="IE">Irish</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {touchedFields.nationality && passengerErrors.nationality && (
                    <span className="field-error-msg" style={{ color: '#d32f2f', fontSize: '0.82rem', marginTop: '4px', display: 'block' }}>
                      {passengerErrors.nationality}
                    </span>
                  )}
                </div>
              </div>

              {/* Seat Selection */}
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--ba-border)' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'var(--ba-blue)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaChair /> Select Your Preferred Seat
                </h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--ba-text-secondary)', marginBottom: '14px' }}>
                  Standard seat selection is included. Choose your preferred seat below:
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {['10A (Window)', '10B (Aisle)', '12A (Window)', '14A (Window)', '14B (Middle)', '15C (Aisle)', '20F (Window)'].map(s => {
                    const seatCode = s.split(' ')[0];
                    const isSelected = selectedSeat === seatCode;
                    return (
                      <button
                        key={s}
                        type="button"
                        className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '8px 14px', fontSize: '0.88rem', borderRadius: '6px' }}
                        onClick={() => setSelectedSeat(seatCode)}
                      >
                        {isSelected ? '✓ ' : ''}{s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bookflight__pax-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
                <button type="submit" className="btn btn-primary">Proceed to Payment Gateway <FaChevronRight size={12} /></button>
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
                      placeholder={paymentDetails.cardNumber.replace(/\D/g, '').startsWith('34') || paymentDetails.cardNumber.replace(/\D/g, '').startsWith('37') ? '1234' : '123'}
                      maxLength={4}
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
                          cvv: '1234',
                        });
                        setPaymentErrors({});
                      }}
                    >
                      💳 Amex (15-digit / 4-digit CVV)
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