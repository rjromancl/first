import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  FaPlane, FaSearch, FaExchangeAlt, FaMapMarkerAlt,
  FaCalendarAlt, FaUsers, FaChevronRight, FaCheck,
  FaWifi, FaUtensils, FaTv, FaBriefcase, FaTimes,
  FaShieldAlt, FaStar,
} from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { flightsAPI, airportsAPI, bookingsAPI } from '../../services/api';
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
  const [adults, setAdults] = useState(searchParams.adults || 1);
  const [cabin, setCabin] = useState(urlParams.get('cabin') || searchParams.cabin || 'economy');
  const [flights, setFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedCabinKey, setSelectedCabinKey] = useState('economy');
  const [loading, setLoading] = useState(false);
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [passenger, setPassenger] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: '',
    dob: '',
    passport: '',
    nationality: 'GB',
  });

  // ── Pre-fill from voice agent ──────────────────────────────────
  // When VoiceAgent collects passenger details it navigates here with
  // location.state = { prefillPassenger: {...}, from, to, departDate, ... }
  useEffect(() => {
    const s = location.state;
    if (!s) return;
    if (s.prefillPassenger) {
      setPassenger(prev => ({ ...prev, ...s.prefillPassenger }));
      // Jump straight to passenger step if all core fields present
      const pf = s.prefillPassenger;
      if (pf.firstName && pf.lastName && pf.email) {
        // If we also have flight search params, trigger search first
        if (s.from && s.to && s.departDate) {
          setFrom(s.from);
          setTo(s.to);
          setDepartDate(s.departDate);
          if (s.returnDate) setReturnDate(s.returnDate);
          if (s.adults)    setAdults(s.adults);
          if (s.cabin)     setCabin(s.cabin);
          // Auto-search so user lands on step 2 immediately
          setTimeout(() => document.getElementById('ba-flight-search-btn')?.click(), 400);
        } else {
          setStep(3); // jump straight to passenger details
        }
      }
    }
    // Clear state so a refresh doesn't re-apply it
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

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSearchError('');
    setSearchParams({ tripType, from, to, departDate, returnDate, adults, cabin });
    try {
      const result = await flightsAPI.search({
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        departureDate: departDate,
        returnDate: tripType === 'return' ? returnDate : undefined,
        adults,
        cabin: cabin.toUpperCase(),
      });
      setFlights(result.flights || []);
      setStep(2);
    } catch (err) {
      setSearchError(err.message || 'Flight search failed. Please try again.');
    } finally {
      setLoading(false);
      window.scrollTo(0, 0);
    }
  };

  const handleSelectFlight = (flight) => {
    setSelectedFlight(flight);
    setStep(3);
    window.scrollTo(0, 0);
  };

  const handlePassengerSubmit = (e) => {
    e.preventDefault();
    setStep(4);
    window.scrollTo(0, 0);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Build traveler payload from passenger form data
      const travelers = [{
        firstName: passenger.firstName,
        lastName:  passenger.lastName,
        email:     passenger.email,
        phone:     passenger.phone,
        dob:       passenger.dob,
        passport:  passenger.passport,
        nationality: passenger.nationality,
      }];
      // Replicate for multiple adults (same lead passenger for demo)
      for (let i = 1; i < adults; i++) travelers.push({ ...travelers[0] });

      const booking = await bookingsAPI.create(selectedFlight, travelers, [
        { emailAddress: passenger.email, phones: [{ deviceType: 'MOBILE', countryCallingCode: '44', number: passenger.phone.replace(/\D/g, '') || '7700900000' }] },
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
                      required
                    />
                    {fromSuggestions.length > 0 && (
                      <div className="bookflight__suggestions">
                        {fromSuggestions.map(a => (
                          <button type="button" key={a.code} className="bookflight__suggestion"
                            onClick={() => { setFrom(a.code); setFromSuggestions([]); }}>
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
                      required
                    />
                    {toSuggestions.length > 0 && (
                      <div className="bookflight__suggestions">
                        {toSuggestions.map(a => (
                          <button type="button" key={a.code} className="bookflight__suggestion"
                            onClick={() => { setTo(a.code); setToSuggestions([]); }}>
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

            <form className="card bookflight__pax-form" onSubmit={handlePassengerSubmit}>
              <h2>Passenger Details</h2>
              <p className="bookflight__pax-note">
                Please ensure all names match exactly as they appear on your passport.
              </p>

              <div className="bookflight__form-grid">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input className="form-control" required value={passenger.firstName}
                    onChange={e => setPassenger({...passenger, firstName: e.target.value})} placeholder="As on passport" />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="form-control" required value={passenger.lastName}
                    onChange={e => setPassenger({...passenger, lastName: e.target.value})} placeholder="As on passport" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-control" required value={passenger.email}
                    onChange={e => setPassenger({...passenger, email: e.target.value})} placeholder="booking@email.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input type="tel" className="form-control" required value={passenger.phone}
                    onChange={e => setPassenger({...passenger, phone: e.target.value})} placeholder="+44 7xxx xxxxxx" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input type="date" className="form-control" required value={passenger.dob}
                    onChange={e => setPassenger({...passenger, dob: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Passport Number</label>
                  <input className="form-control" required value={passenger.passport}
                    onChange={e => setPassenger({...passenger, passport: e.target.value})} placeholder="123456789" />
                </div>
                <div className="form-group">
                  <label className="form-label">Nationality</label>
                  <select className="form-control" value={passenger.nationality}
                    onChange={e => setPassenger({...passenger, nationality: e.target.value})}>
                    <option value="GB">British</option>
                    <option value="US">American</option>
                    <option value="AU">Australian</option>
                    <option value="CA">Canadian</option>
                    <option value="DE">German</option>
                    <option value="FR">French</option>
                    <option value="IN">Indian</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="bookflight__pax-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
                <button type="submit" className="btn btn-primary">Continue to Payment <FaChevronRight size={12} /></button>
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
              <form className="card bookflight__pay-form" onSubmit={handlePayment}>
                <h2>Payment Details</h2>
                <div className="bookflight__card-icons">
                  {['VISA', 'MC', 'AMEX'].map(c => (
                    <span key={c} className="bookflight__card-icon">{c}</span>
                  ))}
                </div>

                <div className="bookflight__form-grid">
                  <div className="form-group" style={{gridColumn:'1/-1'}}>
                    <label className="form-label">Card Number</label>
                    <input className="form-control" required placeholder="1234 5678 9012 3456"
                      maxLength={19}
                      value={paymentDetails.cardNumber}
                      onChange={e => setPaymentDetails({...paymentDetails, cardNumber: e.target.value})} />
                  </div>
                  <div className="form-group" style={{gridColumn:'1/-1'}}>
                    <label className="form-label">Name on Card</label>
                    <input className="form-control" required placeholder="J SMITH"
                      value={paymentDetails.cardName}
                      onChange={e => setPaymentDetails({...paymentDetails, cardName: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiry Date</label>
                    <input className="form-control" required placeholder="MM/YY" maxLength={5}
                      value={paymentDetails.expiry}
                      onChange={e => setPaymentDetails({...paymentDetails, expiry: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CVV</label>
                    <input className="form-control" required placeholder="123" maxLength={4} type="password"
                      value={paymentDetails.cvv}
                      onChange={e => setPaymentDetails({...paymentDetails, cvv: e.target.value})} />
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

              <p className="bookflight__confirm-email">
                A confirmation email has been sent to <strong>{passenger.email}</strong>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


