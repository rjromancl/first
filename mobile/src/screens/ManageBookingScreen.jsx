import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bookingsAPI } from '../services/api';
import { useApp } from '../context/AppContext';
import PageHeader from '../components/PageHeader';
import { colors, spacing, radius, shadow, text } from '../theme';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'airplane-outline' },
  { id: 'seats',    label: 'Seats',    icon: 'grid-outline' },
  { id: 'bags',     label: 'Bags',     icon: 'briefcase-outline' },
  { id: 'upgrade',  label: 'Upgrade',  icon: 'arrow-up-circle-outline' },
];

const SEAT_MAP = [
  { row: 1,  seats: ['A','B','C','D','E','F'], cls: 'first',    occupied: ['1B','1E'] },
  { row: 2,  seats: ['A','B','C','D','E','F'], cls: 'first',    occupied: ['2A'] },
  { row: 3,  seats: ['A','B','C','D','E','F'], cls: 'business', occupied: ['3C','3F'] },
  { row: 4,  seats: ['A','B','C','D','E','F'], cls: 'business', occupied: ['4B'] },
  { row: 10, seats: ['A','B','C','D','E','F'], cls: 'economy',  occupied: ['10D'] },
  { row: 11, seats: ['A','B','C','D','E','F'], cls: 'economy',  occupied: ['11A','11F'] },
  { row: 12, seats: ['A','B','C','D','E','F'], cls: 'economy',  occupied: ['12C','12D'] },
  { row: 20, seats: ['A','B','C','D','E','F'], cls: 'economy',  occupied: [] },
  { row: 21, seats: ['A','B','C','D','E','F'], cls: 'economy',  occupied: ['21E'] },
];

const SEAT_COLORS = {
  first:    colors.gold,
  business: colors.blue,
  economy:  '#64b5f6',
};

const UPGRADE_OPTIONS = [
  { cabin: 'Premium Economy', price: 199,  perks: ['Extra legroom','Priority boarding','Enhanced meals','Dedicated crew'] },
  { cabin: 'Business Class',  price: 599,  highlight: true, perks: ['Fully flat bed','Fine dining','Lounge access','Priority check-in'] },
  { cabin: 'First Class',     price: 1299, perks: ['Suite with door','Michelin dining','Concorde lounge','Chauffeur'] },
];

export default function ManageBookingScreen() {
  const insets = useSafeAreaInsets();
  const { addNotification } = useApp();

  const [activeTab,   setActiveTab]   = useState('overview');
  const [ref,         setRef]         = useState('');
  const [surname,     setSurname]     = useState('');
  const [booking,     setBooking]     = useState(null);
  const [searching,   setSearching]   = useState(false);
  const [error,       setError]       = useState('');
  const [selectedSeat,setSelectedSeat]= useState(null);
  const [seatSaving,  setSeatSaving]  = useState(false);
  const [seatSaved,   setSeatSaved]   = useState(false);
  const [bags,        setBags]        = useState({ checked: 0, cabin: 1 });
  const [bagsSaving,  setBagsSaving]  = useState(false);
  const [bagsSaved,   setBagsSaved]   = useState(false);
  const [upgradeRequested, setUpgradeRequested] = useState(false);

  const handleSearch = async () => {
    if (!ref.trim() || !surname.trim()) { setError('Please fill in both fields.'); return; }
    setSearching(true); setError('');
    try {
      const found = await bookingsAPI.retrieve(ref.trim().toUpperCase(), surname.trim());
      setBooking(found);
      setBags(found.bags || { checked: 0, cabin: 1 });
    } catch (err) {
      setError(err.message || 'Booking not found. Check your reference and surname.');
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmSeat = async () => {
    if (!selectedSeat) return;
    setSeatSaving(true);
    try {
      await bookingsAPI.selectSeat(booking.reference, selectedSeat);
      setBooking(b => ({ ...b, outbound: { ...b.outbound, seat: selectedSeat } }));
      setSeatSaved(true);
      addNotification({ type: 'success', message: `Seat ${selectedSeat} confirmed!` });
    } catch (err) {
      addNotification({ type: 'error', message: err.message || 'Could not save seat.' });
    } finally {
      setSeatSaving(false);
    }
  };

  const handleUpdateBags = async () => {
    setBagsSaving(true);
    try {
      await bookingsAPI.updateBags(booking.reference, bags.checked, bags.cabin);
      setBagsSaved(true);
      addNotification({ type: 'success', message: 'Baggage updated successfully!' });
    } catch (err) {
      addNotification({ type: 'error', message: err.message || 'Could not update bags.' });
    } finally {
      setBagsSaving(false);
    }
  };

  if (!booking) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }} keyboardShouldPersistTaps="handled">
        <PageHeader title="Manage My Booking" subtitle="View, change and add extras to your booking" />
        <View style={styles.content}>
          <View style={[styles.card, shadow.md]}>
            <View style={styles.cardHeader}>
              <Ionicons name="search" size={24} color={colors.blue} />
              <Text style={styles.cardTitle}>Retrieve Your Booking</Text>
            </View>
            <Text style={styles.cardDesc}>Enter your booking reference and surname to continue.</Text>
            <Text style={styles.label}>Booking Reference</Text>
            <TextInput style={[styles.input, styles.refInput]} value={ref} onChangeText={v => setRef(v.toUpperCase())}
              placeholder="e.g. XYMBA1" placeholderTextColor={colors.placeholder} autoCapitalize="characters" maxLength={6} />
            <Text style={styles.label}>Lead Passenger Surname</Text>
            <TextInput style={styles.input} value={surname} onChangeText={setSurname}
              placeholder="e.g. Wilson" placeholderTextColor={colors.placeholder} autoCapitalize="words" />
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={[styles.primaryBtn, searching && { opacity: 0.7 }]} onPress={handleSearch} disabled={searching}>
              {searching ? <ActivityIndicator color={colors.white} /> : <>
                <Ionicons name="search" size={18} color={colors.white} />
                <Text style={styles.primaryBtnText}>Find Booking</Text>
              </>}
            </TouchableOpacity>
          </View>
          <View style={[styles.demoCard, shadow.sm]}>
            <Text style={styles.demoTitle}>Demo Bookings</Text>
            {[{ ref: 'XYMBA1', surname: 'Wilson', label: 'XYMBA1 / Wilson — Business LHR→JFK' },
              { ref: 'PLCNR7', surname: 'Johnson', label: 'PLCNR7 / Johnson — Economy LHR→CDG' }].map(d => (
              <TouchableOpacity key={d.ref} style={styles.demoBtn} onPress={() => { setRef(d.ref); setSurname(d.surname); }}>
                <Ionicons name="airplane-outline" size={14} color={colors.blue} />
                <Text style={styles.demoBtnText}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
      <PageHeader title="My Booking" subtitle={`Reference: ${booking.reference}`} />
      <View style={styles.content}>
        {/* Booking Header */}
        <View style={[styles.card, shadow.md]}>
          <View style={styles.bookingHeaderRow}>
            <View>
              <Text style={styles.refLabel}>Booking Reference</Text>
              <Text style={styles.refValue}>{booking.reference}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: booking.status === 'confirmed' ? colors.successBg : colors.errorBg }]}>
              <Text style={[styles.statusText, { color: booking.status === 'confirmed' ? colors.success : colors.error }]}>
                {booking.status?.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.passengerName}>{booking.passenger?.firstName} {booking.passenger?.lastName}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.smBtn} onPress={() => Share.share({ message: `Booking ref: ${booking.reference}` })}>
              <Ionicons name="share-outline" size={14} color={colors.blue} />
              <Text style={styles.smBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smBtn, { borderColor: colors.error }]} onPress={() => setBooking(null)}>
              <Ionicons name="close-outline" size={14} color={colors.error} />
              <Text style={[styles.smBtnText, { color: colors.error }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Flight Details */}
        <View style={[styles.card, shadow.sm]}>
          <Text style={styles.cardTitle}>Flight Details</Text>
          <View style={styles.routeRow}>
            <View style={styles.routePoint}>
              <Text style={styles.routeCode}>{booking.outbound?.from}</Text>
              <Text style={styles.routeTime}>{booking.outbound?.departure ? new Date(booking.outbound.departure).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</Text>
            </View>
            <Ionicons name="airplane" size={20} color={colors.blue} style={{ marginTop: 4 }} />
            <View style={[styles.routePoint, { alignItems: 'flex-end' }]}>
              <Text style={styles.routeCode}>{booking.outbound?.to}</Text>
              <Text style={styles.routeTime}>{booking.outbound?.arrival ? new Date(booking.outbound.arrival).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</Text>
            </View>
          </View>
          <View style={styles.flightMetaRow}>
            <Text style={styles.flightMeta}>Flight: <Text style={styles.flightMetaBold}>{booking.outbound?.flightNumber}</Text></Text>
            <Text style={styles.flightMeta}>Cabin: <Text style={styles.flightMetaBold}>{booking.outbound?.cabin}</Text></Text>
            <Text style={styles.flightMeta}>Seat: <Text style={styles.flightMetaBold}>{booking.outbound?.seat || 'Not selected'}</Text></Text>
          </View>
          {booking.aviosEarned > 0 && (
            <View style={styles.aviosRow}>
              <Ionicons name="star" size={14} color={colors.gold} />
              <Text style={styles.aviosText}>Avios earned: <Text style={{ fontWeight: '700' }}>{Number(booking.aviosEarned).toLocaleString()}</Text></Text>
            </View>
          )}
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          {TABS.map(tab => (
            <TouchableOpacity key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => setActiveTab(tab.id)}>
              <Ionicons name={tab.icon} size={15} color={activeTab === tab.id ? colors.white : colors.blue} />
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab Content */}
        <View style={[styles.card, shadow.sm]}>
          {activeTab === 'overview' && (
            <View>
              <Text style={styles.cardTitle}>Booking Summary</Text>
              <View style={styles.overviewGrid}>
                {[['Passengers', `${booking.passengers} Adult${booking.passengers > 1 ? 's' : ''}`],
                  ['Total Paid', `£${booking.totalPaid}`],
                  ['Cabin Bags', `${booking.bags?.cabin} included`],
                  ['Checked Bags', `${booking.bags?.checked} included`],
                  ['Check-in', booking.checkedIn ? '✓ Checked In' : 'Not yet'],
                  ['Email', booking.passenger?.email]].map(([k, v]) => (
                  <View key={k} style={styles.overviewItem}>
                    <Text style={styles.overviewKey}>{k}</Text>
                    <Text style={styles.overviewVal}>{v}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.overviewActions}>
                {[['seats','Select Seats','grid-outline'],['bags','Add Bags','briefcase-outline'],['upgrade','Upgrade','arrow-up-circle-outline']].map(([id, label, icon]) => (
                  <TouchableOpacity key={id} style={styles.overviewBtn} onPress={() => setActiveTab(id)}>
                    <Ionicons name={icon} size={16} color={colors.blue} />
                    <Text style={styles.overviewBtnText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {activeTab === 'seats' && (
            <View>
              <Text style={styles.cardTitle}>Select Your Seat</Text>
              <Text style={styles.cardDesc}>Choose a seat for {booking.outbound?.flightNumber}</Text>
              <View style={styles.seatLegend}>
                {[['Available', colors.lightBlue], ['Selected', colors.blue], ['Occupied', '#ccc']].map(([l, c]) => (
                  <View key={l} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: c }]} />
                    <Text style={styles.legendText}>{l}</Text>
                  </View>
                ))}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {SEAT_MAP.map(row => (
                    <View key={row.row} style={styles.seatRow}>
                      <Text style={styles.rowNum}>{row.row}</Text>
                      {row.seats.map((seat, idx) => {
                        const id = `${row.row}${seat}`;
                        const isOccupied = row.occupied.includes(id);
                        const isSelected = selectedSeat === id;
                        return (
                          <React.Fragment key={seat}>
                            {idx === 3 && <View style={styles.aisle} />}
                            <TouchableOpacity
                              style={[styles.seat,
                                { backgroundColor: isOccupied ? '#ddd' : isSelected ? colors.blue : SEAT_COLORS[row.cls] + '55' },
                                isSelected && styles.seatSelected,
                              ]}
                              disabled={isOccupied}
                              onPress={() => { setSelectedSeat(isSelected ? null : id); setSeatSaved(false); }}
                            >
                              <Text style={[styles.seatText, isSelected && { color: colors.white }]}>{seat}</Text>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
              {selectedSeat && !seatSaved && (
                <View style={styles.seatConfirmRow}>
                  <Text style={styles.seatConfirmText}>Selected: <Text style={{ fontWeight: '700' }}>Seat {selectedSeat}</Text></Text>
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmSeat} disabled={seatSaving}>
                    {seatSaving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.confirmBtnText}>Confirm</Text>}
                  </TouchableOpacity>
                </View>
              )}
              {seatSaved && (
                <View style={styles.successRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.successText}>Seat {selectedSeat} confirmed!</Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'bags' && (
            <View>
              <Text style={styles.cardTitle}>Add Baggage</Text>
              <Text style={styles.cardDesc}>Add extra bags to your booking</Text>
              {[{ key: 'cabin', label: 'Cabin Bag', price: '1 included / Extra £30', max: 2, min: 1 },
                { key: 'checked', label: 'Checked Bag', price: 'From £40 per bag', max: 5, min: 0 }].map(b => (
                <View key={b.key} style={styles.bagCard}>
                  <Ionicons name="briefcase-outline" size={26} color={colors.blue} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bagLabel}>{b.label}</Text>
                    <Text style={styles.bagPrice}>{b.price}</Text>
                  </View>
                  <View style={styles.counterRow}>
                    <TouchableOpacity style={styles.cBtn} onPress={() => setBags(p => ({ ...p, [b.key]: Math.max(b.min, p[b.key] - 1) }))}>
                      <Ionicons name="remove" size={16} color={colors.blue} />
                    </TouchableOpacity>
                    <Text style={styles.cVal}>{bags[b.key]}</Text>
                    <TouchableOpacity style={styles.cBtn} onPress={() => setBags(p => ({ ...p, [b.key]: Math.min(b.max, p[b.key] + 1) }))}>
                      <Ionicons name="add" size={16} color={colors.blue} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {bagsSaved ? (
                <View style={styles.successRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={styles.successText}>Baggage updated!</Text>
                </View>
              ) : (
                <View style={styles.bagSummaryRow}>
                  <Text style={styles.bagTotal}>Extra cost: <Text style={{ fontWeight: '800' }}>£{bags.checked * 40 + Math.max(0, bags.cabin - 1) * 30}</Text></Text>
                  <TouchableOpacity style={styles.confirmBtn} onPress={handleUpdateBags} disabled={bagsSaving}>
                    {bagsSaving ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.confirmBtnText}>Update Bags</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {activeTab === 'upgrade' && (
            <View>
              <Text style={styles.cardTitle}>Upgrade Your Journey</Text>
              <Text style={styles.cardDesc}>Move to a higher cabin for more comfort</Text>
              {!upgradeRequested ? UPGRADE_OPTIONS.map(opt => (
                <View key={opt.cabin} style={[styles.upgradeCard, opt.highlight && styles.upgradeCardHighlight]}>
                  {opt.highlight && <View style={styles.popularBadge}><Text style={styles.popularText}>Most Popular</Text></View>}
                  <Text style={styles.upgradeCabin}>{opt.cabin}</Text>
                  <Text style={styles.upgradePrice}>From <Text style={styles.upgradePriceAmount}>£{opt.price}</Text> per person</Text>
                  <View style={styles.upgradePerks}>
                    {opt.perks.map(p => (
                      <View key={p} style={styles.perkRow}>
                        <Ionicons name="checkmark-circle" size={14} color={opt.highlight ? colors.white : colors.blue} />
                        <Text style={[styles.perkText, opt.highlight && { color: colors.white }]}>{p}</Text>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity style={[styles.upgradeBtn, opt.highlight && styles.upgradeBtnHighlight]} onPress={() => setUpgradeRequested(true)}>
                    <Text style={[styles.upgradeBtnText, opt.highlight && { color: colors.white }]}>Request Upgrade</Text>
                  </TouchableOpacity>
                </View>
              )) : (
                <View style={styles.successRow}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                  <View>
                    <Text style={[styles.successText, { fontWeight: '800' }]}>Upgrade request submitted!</Text>
                    <Text style={styles.upgradeNote}>We'll confirm within 24 hours by email.</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: spacing.lg },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  cardTitle: { ...text.h3, marginBottom: 4 },
  cardDesc: { ...text.body, marginBottom: spacing.md },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: spacing.sm, letterSpacing: 0.3 },
  input: { backgroundColor: colors.inputBg, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.textPrimary },
  refInput: { letterSpacing: 4, fontWeight: '700', fontSize: 18, textAlign: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.errorBg, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
  errorText: { flex: 1, color: colors.error, fontSize: 13, fontWeight: '600' },
  primaryBtn: { backgroundColor: colors.blue, borderRadius: radius.md, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing.lg },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  demoCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md },
  demoTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  demoBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  demoBtnText: { fontSize: 13, color: colors.blue, fontWeight: '600' },
  bookingHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xs },
  refLabel: { fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  refValue: { fontSize: 22, fontWeight: '800', color: colors.darkBlue, letterSpacing: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full },
  statusText: { fontSize: 12, fontWeight: '700' },
  passengerName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  smBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.blue },
  smBtnText: { fontSize: 13, fontWeight: '600', color: colors.blue },
  routeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  routePoint: { flex: 1 },
  routeCode: { fontSize: 24, fontWeight: '800', color: colors.darkBlue },
  routeTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  flightMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  flightMeta: { fontSize: 12, color: colors.textSecondary },
  flightMetaBold: { fontWeight: '700', color: colors.textPrimary },
  aviosRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  aviosText: { fontSize: 13, color: colors.textSecondary },
  tabsScroll: { marginBottom: spacing.md },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.full, backgroundColor: colors.lightBlue, marginRight: spacing.xs },
  tabActive: { backgroundColor: colors.blue },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.blue },
  tabTextActive: { color: colors.white },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  overviewItem: { width: '47%' },
  overviewKey: { fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  overviewVal: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  overviewActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  overviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.lightBlue },
  overviewBtnText: { fontSize: 13, fontWeight: '600', color: colors.blue },
  seatLegend: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 14, height: 14, borderRadius: 3 },
  legendText: { fontSize: 12, color: colors.textSecondary },
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  rowNum: { width: 20, fontSize: 11, color: colors.textLight, textAlign: 'right' },
  aisle: { width: 12 },
  seat: { width: 30, height: 30, borderRadius: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  seatSelected: { borderColor: colors.blue, borderWidth: 2 },
  seatText: { fontSize: 11, fontWeight: '600', color: colors.textPrimary },
  seatConfirmRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, padding: spacing.sm, backgroundColor: colors.lightBlue, borderRadius: radius.sm },
  seatConfirmText: { fontSize: 14, color: colors.textPrimary },
  confirmBtn: { backgroundColor: colors.blue, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 8 },
  confirmBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.successBg, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.md },
  successText: { color: colors.success, fontSize: 14, fontWeight: '600' },
  bagCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.offWhite, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  bagLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  bagPrice: { fontSize: 12, color: colors.textSecondary },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.blue },
  cVal: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, minWidth: 20, textAlign: 'center' },
  bagSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  bagTotal: { fontSize: 14, color: colors.textSecondary },
  upgradeCard: { backgroundColor: colors.offWhite, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, position: 'relative' },
  upgradeCardHighlight: { backgroundColor: colors.blue },
  popularBadge: { backgroundColor: colors.gold, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: spacing.xs },
  popularText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  upgradeCabin: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
  upgradePrice: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
  upgradePriceAmount: { fontSize: 18, fontWeight: '800', color: colors.darkBlue },
  upgradePerks: { gap: 4, marginBottom: spacing.sm },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perkText: { fontSize: 13, color: colors.textPrimary },
  upgradeBtn: { backgroundColor: colors.white, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: colors.blue },
  upgradeBtnHighlight: { backgroundColor: colors.darkBlue, borderColor: colors.darkBlue },
  upgradeBtnText: { fontSize: 14, fontWeight: '700', color: colors.blue },
  upgradeNote: { fontSize: 12, color: colors.success, marginTop: 2 },
});
