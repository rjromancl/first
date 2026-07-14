/**
 * BookFlightScreen — 5-step booking wizard
 * Step 1: Search  →  2: Select flight  →  3: Passenger details  →  4: Review & Pay  →  5: Confirmation
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { flightsAPI, bookingsAPI } from '../services/api';
import AirportInput from '../components/AirportInput';
import PageHeader from '../components/PageHeader';
import { colors, spacing, radius, shadow, text } from '../theme';

const STEPS = ['Search', 'Flights', 'Passenger', 'Payment', 'Confirm'];

const CABIN_OPTIONS = [
  { value: 'economy',         label: 'Economy' },
  { value: 'premium_economy', label: 'Premium Economy' },
  { value: 'business',        label: 'Business Class' },
  { value: 'first',           label: 'First Class' },
];

// ── Step indicator ────────────────────────────────────────────────
function StepBar({ current }) {
  return (
    <View style={sb.bar}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done    = n < current;
        const active  = n === current;
        return (
          <React.Fragment key={label}>
            <View style={sb.step}>
              <View style={[sb.circle, done && sb.circleDone, active && sb.circleActive]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color={colors.white} />
                  : <Text style={[sb.circleText, active && sb.circleTextActive]}>{n}</Text>}
              </View>
              <Text style={[sb.stepLabel, active && sb.stepLabelActive]}>{label}</Text>
            </View>
            {i < STEPS.length - 1 && <View style={[sb.line, done && sb.lineDone]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const sb = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  step: { alignItems: 'center', gap: 3 },
  circle: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  circleActive: { backgroundColor: colors.blue },
  circleDone: { backgroundColor: colors.success },
  circleText: { fontSize: 11, fontWeight: '700', color: colors.textLight },
  circleTextActive: { color: colors.white },
  stepLabel: { fontSize: 9, color: colors.textLight, fontWeight: '600' },
  stepLabelActive: { color: colors.blue },
  line: { flex: 1, height: 1.5, backgroundColor: colors.border, marginTop: 12, marginHorizontal: 3 },
  lineDone: { backgroundColor: colors.success },
});

// ── Flight result card ────────────────────────────────────────────
function FlightCard({ flight, onSelect }) {
  const price = flight.price?.grandTotal || flight.price?.total || '—';
  const currency = flight.price?.currency || 'GBP';
  const seg = flight.itineraries?.[0]?.segments?.[0] || {};

  return (
    <TouchableOpacity style={[fc.card, shadow.md]} onPress={() => onSelect(flight)}>
      <View style={fc.row}>
        <View style={fc.baBox}><Text style={fc.baText}>BA</Text></View>
        <View style={{ flex: 1 }}>
          <View style={fc.routeRow}>
            <Text style={fc.time}>{seg.departure?.at?.substring(11, 16) || '—'}</Text>
            <View style={fc.lineWrap}>
              <Text style={fc.duration}>{flight.itineraries?.[0]?.duration?.replace('PT','').toLowerCase()}</Text>
              <View style={fc.line} />
              <Ionicons name="airplane" size={14} color={colors.blue} />
            </View>
            <Text style={fc.time}>{seg.arrival?.at?.substring(11, 16) || '—'}</Text>
          </View>
          <View style={fc.codeRow}>
            <Text style={fc.code}>{seg.departure?.iataCode}</Text>
            <Text style={[fc.code, { color: colors.textLight, fontSize: 11 }]}>
              {flight.numberOfStops === 0 ? 'Non-stop' : `${flight.numberOfStops} stop`}
            </Text>
            <Text style={fc.code}>{seg.arrival?.iataCode}</Text>
          </View>
        </View>
        <View style={fc.priceBox}>
          <Text style={fc.priceCur}>{currency}</Text>
          <Text style={fc.price}>{Number(price).toLocaleString()}</Text>
          <Text style={fc.perPax}>per person</Text>
        </View>
      </View>
      <View style={fc.amenities}>
        {['Wi-Fi', 'Meals', 'Entertainment'].map(a => (
          <View key={a} style={fc.amenity}>
            <Ionicons name="checkmark-circle-outline" size={12} color={colors.success} />
            <Text style={fc.amenityText}>{a}</Text>
          </View>
        ))}
      </View>
      <View style={fc.selectBtn}>
        <Text style={fc.selectBtnText}>Select</Text>
        <Ionicons name="arrow-forward" size={14} color={colors.white} />
      </View>
    </TouchableOpacity>
  );
}

const fc = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  baBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.darkBlue, alignItems: 'center', justifyContent: 'center' },
  baText: { color: colors.white, fontWeight: '900', fontSize: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 3 },
  time: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  lineWrap: { flex: 1, alignItems: 'center', gap: 2 },
  duration: { fontSize: 10, color: colors.textLight },
  line: { width: '100%', height: 1, backgroundColor: colors.border },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  priceBox: { alignItems: 'flex-end' },
  priceCur: { fontSize: 10, color: colors.textLight },
  price: { fontSize: 22, fontWeight: '900', color: colors.darkBlue },
  perPax: { fontSize: 10, color: colors.textLight },
  amenities: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  amenity: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  amenityText: { fontSize: 11, color: colors.textSecondary },
  selectBtn: { backgroundColor: colors.blue, borderRadius: radius.sm, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  selectBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});

// ── Main screen component ─────────────────────────────────────────
export default function BookFlightScreen() {
  const insets = useSafeAreaInsets();
  const { searchParams, setSearchParams, user, addBooking, addNotification } = useApp();

  const [step,           setStep]           = useState(1);
  const [tripType,       setTripType]       = useState(searchParams.tripType || 'return');
  const [from,           setFrom]           = useState(searchParams.from || '');
  const [to,             setTo]             = useState(searchParams.to || '');
  const [departDate,     setDepartDate]     = useState(searchParams.departDate || '');
  const [returnDate,     setReturnDate]     = useState(searchParams.returnDate || '');
  const [adults,         setAdults]         = useState(searchParams.adults || 1);
  const [cabin,          setCabin]          = useState(searchParams.cabin || 'economy');
  const [flights,        setFlights]        = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [searchError,    setSearchError]    = useState('');
  const [bookingRef,     setBookingRef]     = useState('');

  const [passenger, setPassenger] = useState({
    firstName: user?.firstName || '', lastName: user?.lastName || '',
    email: user?.email || '', phone: '', dob: '', passport: '', nationality: 'GB',
  });
  const [payment, setPayment] = useState({ cardNumber: '', cardName: '', expiry: '', cvv: '' });

  const pField = (k, v) => setPassenger(p => ({ ...p, [k]: v }));
  const pyField = (k, v) => setPayment(p => ({ ...p, [k]: v }));

  const handleSearch = async () => {
    if (!from || !to || !departDate) { setSearchError('Please fill in origin, destination and departure date.'); return; }
    setLoading(true); setSearchError('');
    setSearchParams({ tripType, from, to, departDate, returnDate, adults, cabin });
    try {
      const result = await flightsAPI.search({
        from: from.toUpperCase(), to: to.toUpperCase(),
        departureDate: departDate,
        returnDate: tripType === 'return' ? returnDate : undefined,
        adults, cabin: cabin.toUpperCase(),
      });
      setFlights(result.flights || []);
      setStep(2);
    } catch (err) {
      setSearchError(err.message || 'Flight search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFlight = (flight) => { setSelectedFlight(flight); setStep(3); };

  const handlePassengerNext = () => {
    if (!passenger.firstName || !passenger.lastName || !passenger.email) {
      addNotification({ type: 'error', message: 'Please fill in all required passenger fields.' });
      return;
    }
    setStep(4);
  };

  const handlePayment = async () => {
    if (!payment.cardNumber || !payment.cardName || !payment.expiry || !payment.cvv) {
      addNotification({ type: 'error', message: 'Please fill in all payment fields.' }); return;
    }
    setLoading(true);
    try {
      const travelers = [{
        id: '1', dateOfBirth: passenger.dob || '1990-01-01',
        name: { firstName: passenger.firstName, lastName: passenger.lastName },
        gender: 'MALE',
        contact: { emailAddress: passenger.email, phones: [{ number: passenger.phone || '07000000000', deviceType: 'MOBILE', countryCallingCode: '44' }] },
        documents: [{ documentType: 'PASSPORT', number: passenger.passport || 'AB123456', expiryDate: '2030-01-01', issuanceCountry: passenger.nationality, nationality: passenger.nationality, holder: true }],
      }];
      const booking = await bookingsAPI.create(selectedFlight, travelers, []);
      const ref = booking.reference || booking.id || `BA${Date.now().toString(36).toUpperCase()}`;
      setBookingRef(ref);
      addBooking({ ...booking, reference: ref });
      addNotification({ type: 'success', message: `Booking confirmed! Ref: ${ref}` });
      setStep(5);
    } catch (err) {
      addNotification({ type: 'error', message: err.message || 'Booking failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => { setStep(1); setFlights([]); setSelectedFlight(null); setBookingRef(''); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.offWhite }}>
      <PageHeader title="Book a Flight" subtitle={STEPS[step - 1]} />
      <StepBar current={step} />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">

        {/* ── STEP 1: Search ── */}
        {step === 1 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Find Your Flight</Text>

            {/* Trip type */}
            <View style={s.tripTabs}>
              {[['return','Return'],['oneway','One Way']].map(([v,l]) => (
                <TouchableOpacity key={v} style={[s.tripTab, tripType===v&&s.tripTabActive]} onPress={()=>setTripType(v)}>
                  <Text style={[s.tripTabText, tripType===v&&s.tripTabTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Airports */}
            <AirportInput label="From" value={from} onSelect={(code) => setFrom(code)} placeholder="Origin city or code" />
            <View style={s.swapRow}>
              <View style={s.swapLine} />
              <TouchableOpacity style={s.swapBtn} onPress={() => { const t=from; setFrom(to); setTo(t); }}>
                <Ionicons name="swap-vertical" size={18} color={colors.blue} />
              </TouchableOpacity>
              <View style={s.swapLine} />
            </View>
            <AirportInput label="To" value={to} onSelect={(code) => setTo(code)} placeholder="Destination city or code" />

            {/* Dates */}
            <Text style={s.label}>Departure Date</Text>
            <TextInput style={s.input} value={departDate} onChangeText={setDepartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.placeholder} />

            {tripType === 'return' && (
              <>
                <Text style={s.label}>Return Date</Text>
                <TextInput style={s.input} value={returnDate} onChangeText={setReturnDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.placeholder} />
              </>
            )}

            {/* Passengers */}
            <Text style={s.label}>Passengers</Text>
            <View style={s.counterRow}>
              <TouchableOpacity style={s.cBtn} onPress={() => setAdults(Math.max(1, adults-1))}>
                <Ionicons name="remove" size={18} color={colors.blue} />
              </TouchableOpacity>
              <Text style={s.cVal}>{adults} Adult{adults > 1 ? 's' : ''}</Text>
              <TouchableOpacity style={s.cBtn} onPress={() => setAdults(Math.min(9, adults+1))}>
                <Ionicons name="add" size={18} color={colors.blue} />
              </TouchableOpacity>
            </View>

            {/* Cabin */}
            <Text style={s.label}>Cabin Class</Text>
            <View style={s.cabinRow}>
              {CABIN_OPTIONS.map(c => (
                <TouchableOpacity key={c.value} style={[s.cabinChip, cabin===c.value&&s.cabinChipActive]} onPress={()=>setCabin(c.value)}>
                  <Text style={[s.cabinChipText, cabin===c.value&&s.cabinChipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {searchError ? (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={s.errorText}>{searchError}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={[s.primaryBtn, loading&&{opacity:0.7}]} onPress={handleSearch} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.white} /> : <>
                <Ionicons name="search" size={18} color={colors.white} />
                <Text style={s.primaryBtnText}>Search Flights</Text>
              </>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 2: Select flight ── */}
        {step === 2 && (
          <View>
            <View style={s.stepHeader}>
              <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn}>
                <Ionicons name="arrow-back" size={16} color={colors.blue} />
                <Text style={s.backBtnText}>Back</Text>
              </TouchableOpacity>
              <Text style={s.stepMeta}>{flights.length} flight{flights.length !== 1 ? 's' : ''} found</Text>
            </View>
            {flights.length === 0 && (
              <View style={s.emptyState}>
                <Ionicons name="airplane-outline" size={48} color={colors.textLight} />
                <Text style={s.emptyText}>No flights found. Try different dates or routes.</Text>
                <TouchableOpacity style={s.primaryBtn} onPress={() => setStep(1)}>
                  <Text style={s.primaryBtnText}>Modify Search</Text>
                </TouchableOpacity>
              </View>
            )}
            {flights.map((flight, i) => (
              <FlightCard key={i} flight={flight} onSelect={handleSelectFlight} />
            ))}
          </View>
        )}

        {/* ── STEP 3: Passenger details ── */}
        {step === 3 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Passenger Details</Text>
            <Text style={s.cardDesc}>Enter the passenger's information exactly as it appears on their passport.</Text>
            <View style={s.nameRow}>
              <View style={{flex:1}}>
                <Text style={s.label}>First Name *</Text>
                <TextInput style={s.input} value={passenger.firstName} onChangeText={v=>pField('firstName',v)} placeholder="John" placeholderTextColor={colors.placeholder} autoCapitalize="words" />
              </View>
              <View style={{flex:1}}>
                <Text style={s.label}>Last Name *</Text>
                <TextInput style={s.input} value={passenger.lastName} onChangeText={v=>pField('lastName',v)} placeholder="Smith" placeholderTextColor={colors.placeholder} autoCapitalize="words" />
              </View>
            </View>
            <Text style={s.label}>Email Address *</Text>
            <TextInput style={s.input} value={passenger.email} onChangeText={v=>pField('email',v)} placeholder="your@email.com" placeholderTextColor={colors.placeholder} keyboardType="email-address" autoCapitalize="none" />
            <Text style={s.label}>Phone Number</Text>
            <TextInput style={s.input} value={passenger.phone} onChangeText={v=>pField('phone',v)} placeholder="+44 7700 900000" placeholderTextColor={colors.placeholder} keyboardType="phone-pad" />
            <Text style={s.label}>Date of Birth</Text>
            <TextInput style={s.input} value={passenger.dob} onChangeText={v=>pField('dob',v)} placeholder="YYYY-MM-DD" placeholderTextColor={colors.placeholder} />
            <Text style={s.label}>Passport Number</Text>
            <TextInput style={s.input} value={passenger.passport} onChangeText={v=>pField('passport',v)} placeholder="AB123456" placeholderTextColor={colors.placeholder} autoCapitalize="characters" />
            <View style={s.navRow}>
              <TouchableOpacity style={s.secondaryBtn} onPress={() => setStep(2)}>
                <Ionicons name="arrow-back" size={16} color={colors.blue} />
                <Text style={s.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.primaryBtn, {flex:1}]} onPress={handlePassengerNext}>
                <Text style={s.primaryBtnText}>Continue to Payment</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── STEP 4: Payment ── */}
        {step === 4 && (
          <View>
            {/* Summary */}
            {selectedFlight && (
              <View style={[s.summaryCard, shadow.sm]}>
                <Text style={s.summaryTitle}>Order Summary</Text>
                <View style={s.summaryRow}>
                  <Text style={s.summaryKey}>Route</Text>
                  <Text style={s.summaryVal}>{from} → {to}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryKey}>Passengers</Text>
                  <Text style={s.summaryVal}>{adults} Adult{adults>1?'s':''}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Text style={s.summaryKey}>Cabin</Text>
                  <Text style={s.summaryVal}>{CABIN_OPTIONS.find(c=>c.value===cabin)?.label}</Text>
                </View>
                <View style={[s.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm }]}>
                  <Text style={[s.summaryKey, { fontWeight: '700' }]}>Total</Text>
                  <Text style={s.totalVal}>{selectedFlight.price?.currency} {Number(selectedFlight.price?.grandTotal || selectedFlight.price?.total || 0).toLocaleString()}</Text>
                </View>
              </View>
            )}

            <View style={s.card}>
              <Text style={s.cardTitle}>Payment Details</Text>
              <View style={s.cardRow}><Ionicons name="card-outline" size={20} color={colors.blue} /></View>
              <Text style={s.label}>Card Number</Text>
              <TextInput style={s.input} value={payment.cardNumber} onChangeText={v=>pyField('cardNumber',v)} placeholder="1234 5678 9012 3456" placeholderTextColor={colors.placeholder} keyboardType="numeric" maxLength={19} />
              <Text style={s.label}>Cardholder Name</Text>
              <TextInput style={s.input} value={payment.cardName} onChangeText={v=>pyField('cardName',v)} placeholder="John Smith" placeholderTextColor={colors.placeholder} autoCapitalize="words" />
              <View style={s.nameRow}>
                <View style={{flex:1}}>
                  <Text style={s.label}>Expiry Date</Text>
                  <TextInput style={s.input} value={payment.expiry} onChangeText={v=>pyField('expiry',v)} placeholder="MM/YY" placeholderTextColor={colors.placeholder} keyboardType="numeric" maxLength={5} />
                </View>
                <View style={{flex:1}}>
                  <Text style={s.label}>CVV</Text>
                  <TextInput style={s.input} value={payment.cvv} onChangeText={v=>pyField('cvv',v)} placeholder="123" placeholderTextColor={colors.placeholder} keyboardType="numeric" maxLength={4} secureTextEntry />
                </View>
              </View>
              <View style={s.secureRow}>
                <Ionicons name="lock-closed" size={13} color={colors.success} />
                <Text style={s.secureText}>Your payment is encrypted and secure</Text>
              </View>
              <View style={s.navRow}>
                <TouchableOpacity style={s.secondaryBtn} onPress={() => setStep(3)}>
                  <Ionicons name="arrow-back" size={16} color={colors.blue} />
                  <Text style={s.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.primaryBtn, {flex:1}, loading&&{opacity:0.7}]} onPress={handlePayment} disabled={loading}>
                  {loading ? <ActivityIndicator color={colors.white} /> : <>
                    <Ionicons name="lock-closed" size={16} color={colors.white} />
                    <Text style={s.primaryBtnText}>Confirm & Pay</Text>
                  </>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── STEP 5: Confirmation ── */}
        {step === 5 && (
          <View style={[s.card, {alignItems:'center'}]}>
            <View style={s.confirmIcon}>
              <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            </View>
            <Text style={s.confirmTitle}>Booking Confirmed!</Text>
            <Text style={s.confirmDesc}>Your flight has been booked. A confirmation email has been sent.</Text>
            <View style={s.refBox}>
              <Text style={s.refLabel}>Booking Reference</Text>
              <Text style={s.refValue}>{bookingRef}</Text>
            </View>
            <View style={[s.summaryCard, {width:'100%', alignSelf:'stretch'}]}>
              <View style={s.summaryRow}><Text style={s.summaryKey}>From</Text><Text style={s.summaryVal}>{from}</Text></View>
              <View style={s.summaryRow}><Text style={s.summaryKey}>To</Text><Text style={s.summaryVal}>{to}</Text></View>
              <View style={s.summaryRow}><Text style={s.summaryKey}>Depart</Text><Text style={s.summaryVal}>{departDate}</Text></View>
              <View style={s.summaryRow}><Text style={s.summaryKey}>Passengers</Text><Text style={s.summaryVal}>{adults}</Text></View>
              <View style={s.summaryRow}><Text style={s.summaryKey}>Cabin</Text><Text style={s.summaryVal}>{CABIN_OPTIONS.find(c=>c.value===cabin)?.label}</Text></View>
            </View>
            <TouchableOpacity style={s.primaryBtn} onPress={handleReset}>
              <Ionicons name="airplane" size={16} color={colors.white} />
              <Text style={s.primaryBtnText}>Book Another Flight</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardTitle: { ...text.h3, marginBottom: 4 },
  cardDesc: { ...text.body, marginBottom: spacing.md },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: spacing.sm, letterSpacing: 0.3 },
  input: { backgroundColor: colors.inputBg, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.textPrimary },
  tripTabs: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  tripTab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radius.sm, backgroundColor: colors.lightBlue },
  tripTabActive: { backgroundColor: colors.blue },
  tripTabText: { fontSize: 13, fontWeight: '600', color: colors.blue },
  tripTabTextActive: { color: colors.white },
  swapRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xs, gap: spacing.sm },
  swapLine: { flex: 1, height: 1, backgroundColor: colors.border },
  swapBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.lightBlue, alignItems: 'center', justifyContent: 'center' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  cBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.lightBlue, alignItems: 'center', justifyContent: 'center' },
  cVal: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  cabinRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  cabinChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.lightBlue },
  cabinChipActive: { backgroundColor: colors.blue },
  cabinChipText: { fontSize: 12, fontWeight: '600', color: colors.blue },
  cabinChipTextActive: { color: colors.white },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.errorBg, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
  errorText: { flex: 1, color: colors.error, fontSize: 13, fontWeight: '600' },
  primaryBtn: { backgroundColor: colors.blue, borderRadius: radius.md, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.md },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.blue, marginTop: spacing.md },
  secondaryBtnText: { color: colors.blue, fontWeight: '700', fontSize: 14 },
  navRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  stepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backBtnText: { color: colors.blue, fontWeight: '600', fontSize: 14 },
  stepMeta: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  emptyText: { color: colors.textLight, fontSize: 14, textAlign: 'center' },
  summaryCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  summaryTitle: { ...text.h4, marginBottom: spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  summaryKey: { fontSize: 13, color: colors.textSecondary },
  summaryVal: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  totalVal: { fontSize: 18, fontWeight: '900', color: colors.darkBlue },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, marginBottom: spacing.sm },
  secureText: { fontSize: 12, color: colors.success },
  confirmIcon: { marginBottom: spacing.md },
  confirmTitle: { ...text.h2, textAlign: 'center', marginBottom: spacing.sm },
  confirmDesc: { ...text.body, textAlign: 'center', marginBottom: spacing.lg },
  refBox: { backgroundColor: colors.lightBlue, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.md, width: '100%' },
  refLabel: { fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  refValue: { fontSize: 26, fontWeight: '900', color: colors.darkBlue, letterSpacing: 4 },
});
