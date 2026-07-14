import React, { useState } from 'react';
import {
  FaSearch, FaPlane, FaChair, FaBriefcase, FaArrowUp,
  FaTimes, FaCheck, FaDownload, FaPrint, FaEnvelope, FaStar,
} from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { bookingsAPI } from '../../services/api';
import './ManageBooking.css';

const TABS = [
  { id: 'overview', label: 'Overview',     icon: FaPlane },
  { id: 'seats',    label: 'Select Seats', icon: FaChair },
  { id: 'bags',     label: 'Add Bags',     icon: FaBriefcase },
  { id: 'upgrade',  label: 'Upgrade',      icon: FaArrowUp },
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
  { row: 22, seats: ['A','B','C','D','E','F'], cls: 'economy',  occupied: ['22B','22C'] },
];

export default function ManageBooking() {
  const { addNotification } = useApp();

  const [activeTab, setActiveTab] = useState('overview');
  const [ref, setRef]             = useState('');
  const [surname, setSurname]     = useState('');
  const [booking, setBooking]     = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError]         = useState('');
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [seatSaving, setSeatSaving]     = useState(false);
  const [seatSaved, setSeatSaved]       = useState(false);
  const [bags, setBags]               = useState({ checked: 0, cabin: 1 });
  const [bagsSaving, setBagsSaving]   = useState(false);
  const [bagsSaved, setBagsSaved]     = useState(false);
  const [upgradeRequested, setUpgradeRequested] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearching(true);
    setError('');
    try {
      const found = await bookingsAPI.retrieve(ref.trim().toUpperCase(), surname.trim());
      setBooking(found);
      setBags(found.bags || { checked: 0, cabin: 1 });
    } catch (err) {
      setError(err.message || 'Booking not found. Please check your reference and surname.');
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
      addNotification({ type: 'error', message: err.message || 'Could not save seat. Try again.' });
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
      addNotification({ type: 'error', message: err.message || 'Could not update bags. Try again.' });
    } finally {
      setBagsSaving(false);
    }
  };

  const STATUS_COLOR = { confirmed: 'green', cancelled: 'red', pending: 'grey' };

  return (
    <div className="manage">
      <div className="page-header">
        <div className="container">
          <h1>Manage My Booking</h1>
          <p>View, change and add extras to your booking</p>
        </div>
      </div>

      <div className="container manage__content">
        {!booking ? (
          /* ── Retrieve Form ── */
          <div className="manage__retrieve-wrap">
            <div className="card manage__retrieve-card">
              <div className="manage__retrieve-header">
                <FaSearch size={22} style={{ color: 'var(--ba-blue)' }} />
                <h2>Retrieve Your Booking</h2>
                <p>Enter your booking reference and surname to access your booking.</p>
              </div>

              <form onSubmit={handleSearch} className="manage__retrieve-form">
                <div className="form-group">
                  <label className="form-label">Booking Reference</label>
                  <input
                    className="form-control manage__ref-input"
                    placeholder="e.g. XYMBA1"
                    value={ref}
                    onChange={e => setRef(e.target.value.toUpperCase())}
                    required maxLength={6}
                  />
                  <small className="manage__field-hint">6-character reference from your confirmation email</small>
                </div>
                <div className="form-group">
                  <label className="form-label">Lead Passenger Surname</label>
                  <input className="form-control" placeholder="e.g. Wilson" value={surname} onChange={e => setSurname(e.target.value)} required />
                </div>
                {error && <div className="manage__error"><FaTimes size={14} /> {error}</div>}
                <button type="submit" className="btn btn-primary" disabled={searching}>
                  {searching
                    ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Searching…</>
                    : <><FaSearch size={14} /> Find Booking</>}
                </button>
              </form>

              <div className="manage__demo-hint">
                <strong>Demo bookings to try:</strong>
                <button onClick={() => { setRef('XYMBA1'); setSurname('Wilson'); }}>XYMBA1 / Wilson (Business LHR→JFK)</button>
                <button onClick={() => { setRef('PLCNR7'); setSurname('Johnson'); }}>PLCNR7 / Johnson (Economy LHR→CDG)</button>
              </div>
            </div>
          </div>
        ) : (
          /* ── Booking View ── */
          <div className="manage__booking-view">
            {/* Booking Header */}
            <div className="manage__booking-header card">
              <div className="manage__booking-ref">
                <span>Booking Reference</span>
                <strong>{booking.reference}</strong>
              </div>
              <div className="manage__booking-meta">
                <span className={`badge badge-${STATUS_COLOR[booking.status] || 'grey'}`}>{booking.status?.toUpperCase()}</span>
                <span className="manage__passenger-name">{booking.passenger?.firstName} {booking.passenger?.lastName}</span>
              </div>
              <div className="manage__booking-actions-top">
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><FaDownload size={12} /> Download</button>
                <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><FaPrint size={12} /> Print</button>
                <button className="btn btn-secondary btn-sm"><FaEnvelope size={12} /> Email</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setBooking(null); setRef(''); setSurname(''); }}>
                  <FaTimes size={12} /> Close
                </button>
              </div>
            </div>

            {/* Flight Details */}
            <div className="card manage__flight-card">
              <h3>Flight Details</h3>
              <div className="manage__flight-detail">
                <div className="manage__flight-segment">
                  <span className="manage__segment-label">Outbound</span>
                  <div className="manage__route">
                    <div className="manage__route-point">
                      <strong>{booking.outbound?.from}</strong>
                      <span>{booking.outbound?.departure ? new Date(booking.outbound.departure).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</span>
                    </div>
                    <div className="manage__route-line"><FaPlane size={14} style={{ color: 'var(--ba-blue)' }} /></div>
                    <div className="manage__route-point">
                      <strong>{booking.outbound?.to}</strong>
                      <span>{booking.outbound?.arrival ? new Date(booking.outbound.arrival).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</span>
                    </div>
                  </div>
                  <div className="manage__flight-meta">
                    <span>Flight: <strong>{booking.outbound?.flightNumber}</strong></span>
                    <span>Cabin: <strong>{booking.outbound?.cabin}</strong></span>
                    <span>Seat: <strong>{booking.outbound?.seat || 'Not Selected'}</strong></span>
                    {booking.tier && <span className="badge badge-gold">{booking.tier} Member</span>}
                  </div>
                </div>
              </div>
              {booking.aviosEarned > 0 && (
                <div className="manage__avios-row">
                  <FaStar size={14} style={{ color: 'var(--ba-gold)' }} />
                  <span>Avios earned on this booking: <strong>{Number(booking.aviosEarned).toLocaleString()}</strong></span>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="manage__tabs">
              {TABS.map(tab => (
                <button key={tab.id} className={`manage__tab ${activeTab === tab.id ? 'manage__tab--active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                  <tab.icon size={14} /> {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="manage__tab-content card">

              {/* Overview */}
              {activeTab === 'overview' && (
                <div className="manage__overview">
                  <h3>Booking Summary</h3>
                  <div className="manage__overview-grid">
                    <div className="manage__overview-item"><span>Passengers</span><strong>{booking.passengers} Adult{booking.passengers > 1 ? 's' : ''}</strong></div>
                    <div className="manage__overview-item"><span>Total Paid</span><strong>£{booking.totalPaid}</strong></div>
                    <div className="manage__overview-item"><span>Cabin Bags</span><strong>{booking.bags?.cabin} included</strong></div>
                    <div className="manage__overview-item"><span>Checked Bags</span><strong>{booking.bags?.checked} included</strong></div>
                    <div className="manage__overview-item"><span>Check-in Status</span><strong>{booking.checkedIn ? '✓ Checked In' : 'Not yet checked in'}</strong></div>
                    <div className="manage__overview-item"><span>Email</span><strong>{booking.passenger?.email}</strong></div>
                  </div>
                  <div className="manage__overview-actions">
                    <button className="btn btn-primary" onClick={() => setActiveTab('seats')}><FaChair size={13} /> Select Seats</button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('bags')}><FaBriefcase size={13} /> Add Bags</button>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('upgrade')}><FaArrowUp size={13} /> Request Upgrade</button>
                  </div>
                </div>
              )}

              {/* Seats */}
              {activeTab === 'seats' && (
                <div className="manage__seats">
                  <h3>Select Your Seat</h3>
                  <p className="manage__tab-desc">Choose your preferred seat for {booking.outbound?.flightNumber}</p>
                  <div className="manage__seat-legend">
                    <span className="manage__seat-legend-item manage__seat--available">Available</span>
                    <span className="manage__seat-legend-item manage__seat--selected">Selected</span>
                    <span className="manage__seat-legend-item manage__seat--occupied">Occupied</span>
                  </div>
                  <div className="manage__seat-map">
                    <div className="manage__seat-nose" />
                    {SEAT_MAP.map(row => (
                      <div key={row.row} className="manage__seat-row">
                        <span className="manage__row-num">{row.row}</span>
                        {row.seats.map((seat, idx) => {
                          const id         = `${row.row}${seat}`;
                          const isOccupied = row.occupied.includes(id);
                          const isSelected = selectedSeat === id;
                          return (
                            <React.Fragment key={seat}>
                              {idx === 3 && <div className="manage__seat-aisle" />}
                              <button
                                className={`manage__seat manage__seat--${row.cls} ${isOccupied ? 'manage__seat--occupied' : ''} ${isSelected ? 'manage__seat--selected' : ''}`}
                                disabled={isOccupied}
                                onClick={() => { setSelectedSeat(isSelected ? null : id); setSeatSaved(false); }}
                                title={`Seat ${id}`}
                              >{seat}</button>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {selectedSeat && !seatSaved && (
                    <div className="manage__seat-confirm">
                      <span>Selected: <strong>Seat {selectedSeat}</strong></span>
                      <button className="btn btn-primary btn-sm" onClick={handleConfirmSeat} disabled={seatSaving}>
                        {seatSaving ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <><FaCheck size={12} /> Confirm Seat</>}
                      </button>
                    </div>
                  )}
                  {seatSaved && (
                    <div className="manage__success"><FaCheck size={14} /> Seat {selectedSeat} confirmed!</div>
                  )}
                </div>
              )}

              {/* Bags */}
              {activeTab === 'bags' && (
                <div className="manage__bags">
                  <h3>Add Baggage</h3>
                  <p className="manage__tab-desc">Add extra bags to your booking.</p>
                  <div className="manage__bags-grid">
                    {[
                      { key: 'cabin',   label: 'Cabin Bag',    price: '1 included / Extra £30', max: 2, min: 1, color: 'var(--ba-blue)' },
                      { key: 'checked', label: 'Checked Bag',  price: 'From £40 per bag',       max: 5, min: 0, color: 'var(--ba-gold)' },
                    ].map(b => (
                      <div key={b.key} className="manage__bag-card card">
                        <FaBriefcase size={28} style={{ color: b.color }} />
                        <h4>{b.label}</h4>
                        <div className="manage__bag-controls">
                          <button className="manage__bag-btn" onClick={() => setBags(prev => ({ ...prev, [b.key]: Math.max(b.min, prev[b.key] - 1) }))}>−</button>
                          <span>{bags[b.key]}</span>
                          <button className="manage__bag-btn" onClick={() => setBags(prev => ({ ...prev, [b.key]: Math.min(b.max, prev[b.key] + 1) }))}>+</button>
                        </div>
                        <span className="manage__bag-price">{b.price}</span>
                      </div>
                    ))}
                  </div>
                  {bagsSaved ? (
                    <div className="manage__success"><FaCheck size={14} /> Baggage updated!</div>
                  ) : (
                    <div className="manage__bags-summary">
                      <span>Extra cost: <strong>£{bags.checked * 40 + Math.max(0, bags.cabin - 1) * 30}</strong></span>
                      <button className="btn btn-primary" onClick={handleUpdateBags} disabled={bagsSaving}>
                        {bagsSaving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Update Bags'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Upgrade */}
              {activeTab === 'upgrade' && (
                <div className="manage__upgrade">
                  <h3>Upgrade Your Journey</h3>
                  <p className="manage__tab-desc">Move to a higher cabin class for more comfort.</p>
                  {!upgradeRequested ? (
                    <div className="manage__upgrade-options">
                      {[
                        { cabin: 'Premium Economy', price: 199, perks: ['Extra legroom','Priority boarding','Enhanced meals','Dedicated crew'] },
                        { cabin: 'Business Class',  price: 599, highlight: true, perks: ['Fully flat bed','Fine dining','Lounge access','Priority check-in'] },
                        { cabin: 'First Class',     price: 1299, perks: ['Suite with door','Michelin-style dining','Concorde lounge','Chauffeur'] },
                      ].map(opt => (
                        <div key={opt.cabin} className={`manage__upgrade-card card ${opt.highlight ? 'manage__upgrade-card--highlight' : ''}`}>
                          {opt.highlight && <div className="manage__upgrade-badge">Most Popular</div>}
                          <h4>{opt.cabin}</h4>
                          <div className="manage__upgrade-price"><span>From</span><strong>£{opt.price}</strong><span>per person</span></div>
                          <ul className="manage__upgrade-perks">
                            {opt.perks.map(p => <li key={p}><FaCheck size={11} /> {p}</li>)}
                          </ul>
                          <button className={`btn ${opt.highlight ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setUpgradeRequested(true)}>
                            Request Upgrade
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="manage__success">
                      <FaCheck size={18} />
                      <div>
                        <strong>Upgrade request submitted!</strong>
                        <p>We'll confirm within 24 hours and send details to your email.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
