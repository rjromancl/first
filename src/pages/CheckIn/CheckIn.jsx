import React, { useState } from 'react';
import { FaPlane, FaDownload, FaPrint, FaEnvelope, FaCheck, FaQrcode } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { checkinAPI } from '../../services/api';
import './CheckIn.css';

export default function CheckIn() {
  const { addNotification } = useApp();

  const [ref, setRef]               = useState('');
  const [surname, setSurname]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [boardingPass, setBoardingPass] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await checkinAPI.checkIn(ref.trim().toUpperCase(), surname.trim());
      setBoardingPass(result.boardingPass);
      addNotification({ type: 'success', message: result.alreadyCheckedIn ? 'Already checked in — boarding pass retrieved.' : 'Check-in successful!' });
    } catch (err) {
      setError(err.message || 'Check-in failed. Please verify your booking reference and surname.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="checkin">
      <div className="page-header">
        <div className="container">
          <h1>Online Check-in</h1>
          <p>Check in from 24 hours before your flight departs</p>
        </div>
      </div>

      <div className="container checkin__content">
        {!boardingPass ? (
          <div className="card checkin__form-card">
            <h2>Enter Your Details</h2>
            <p>Check in opens 24 hours before your scheduled departure and closes 1 hour before.</p>
            <form onSubmit={handleSearch} className="checkin__form">
              <div className="form-group">
                <label className="form-label">Booking Reference</label>
                <input
                  className="form-control"
                  placeholder="e.g. XYMBA1"
                  value={ref}
                  onChange={e => setRef(e.target.value.toUpperCase())}
                  required maxLength={6}
                  style={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, fontSize: 18 }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Surname (as on passport)</label>
                <input className="form-control" placeholder="e.g. Wilson" value={surname} onChange={e => setSurname(e.target.value)} required />
              </div>

              {error && <div className="checkin__error">{error}</div>}

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading
                  ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Checking in…</>
                  : <><FaCheck size={13} /> Check In Now</>}
              </button>
            </form>

            <div className="checkin__demo">
              <strong>Demo bookings:</strong>
              <button onClick={() => { setRef('XYMBA1'); setSurname('Wilson'); }}>XYMBA1 / Wilson (Business LHR→JFK)</button>
              <button onClick={() => { setRef('PLCNR7'); setSurname('Johnson'); }}>PLCNR7 / Johnson (Economy LHR→CDG)</button>
            </div>
          </div>
        ) : (
          <div className="card checkin__success-card">
            <div className="checkin__success-icon"><FaCheck size={28} /></div>
            <h2>You're Checked In!</h2>
            <p>Your boarding pass is ready. Save it to your device or print it.</p>

            <div className="checkin__bp-preview">
              <div className="checkin__bp-header">
                <strong>British Airways Boarding Pass</strong>
                <span>{boardingPass.flight?.number}</span>
              </div>
              <div className="checkin__bp-info">
                <div>
                  <span>Passenger</span>
                  <strong>{boardingPass.passenger?.name}</strong>
                </div>
                <div>
                  <span>Flight</span>
                  <strong>{boardingPass.flight?.number}</strong>
                </div>
                <div>
                  <span>From</span>
                  <strong>{boardingPass.flight?.from}</strong>
                </div>
                <div>
                  <span>To</span>
                  <strong>{boardingPass.flight?.to}</strong>
                </div>
                <div>
                  <span>Date</span>
                  <strong>{boardingPass.flight?.date}</strong>
                </div>
                <div>
                  <span>Departure</span>
                  <strong>{boardingPass.flight?.departure}</strong>
                </div>
                <div>
                  <span>Boarding</span>
                  <strong>{boardingPass.flight?.boarding}</strong>
                </div>
                <div>
                  <span>Seat</span>
                  <strong>{boardingPass.flight?.seat}</strong>
                </div>
                <div>
                  <span>Cabin</span>
                  <strong>{boardingPass.flight?.cabin}</strong>
                </div>
                <div>
                  <span>Gate</span>
                  <strong>{boardingPass.flight?.gate || 'TBD'}</strong>
                </div>
                <div>
                  <span>Terminal</span>
                  <strong>{boardingPass.flight?.terminal}</strong>
                </div>
                <div>
                  <span>Ref</span>
                  <strong>{boardingPass.reference}</strong>
                </div>
              </div>
              <div className="checkin__bp-barcode" title={boardingPass.barcodeData} />
            </div>

            <div className="checkin__bp-actions">
              <button className="btn btn-primary" onClick={() => window.print()}>
                <FaDownload size={13} /> Download
              </button>
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <FaPrint size={13} /> Print
              </button>
              <button className="btn btn-secondary" onClick={() => addNotification({ type: 'info', message: 'Boarding pass emailed!' })}>
                <FaEnvelope size={13} /> Email
              </button>
              <button className="btn btn-secondary" onClick={() => { setBoardingPass(null); setRef(''); setSurname(''); }}>
                Check In Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
