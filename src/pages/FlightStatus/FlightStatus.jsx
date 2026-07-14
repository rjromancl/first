import React, { useState } from 'react';
import { FaPlane, FaSearch, FaMapMarkerAlt, FaSyncAlt } from 'react-icons/fa';
import { flightsAPI } from '../../services/api';
import './FlightStatus.css';

const STATUS_CONFIG = {
  'on-time':   { color: '#2e7d32', bg: '#e8f5e9', label: 'On Time' },
  'delayed':   { color: 'var(--ba-red)', bg: '#fdecea', label: 'Delayed' },
  'scheduled': { color: 'var(--ba-blue)', bg: 'var(--ba-light-blue)', label: 'Scheduled' },
  'landed':    { color: '#6b6b6b', bg: '#f0f0f0', label: 'Landed' },
  'boarding':  { color: '#e65100', bg: '#fff3e0', label: 'Boarding' },
  'cancelled': { color: 'var(--ba-red)', bg: '#fdecea', label: 'Cancelled' },
  'unknown':   { color: '#6b6b6b', bg: '#f0f0f0', label: 'Unknown' },
};

export default function FlightStatus() {
  const [searchType, setSearchType] = useState('flight');
  const [flightNum, setFlightNum]   = useState('');
  const [from, setFrom]             = useState('');
  const [to, setTo]                 = useState('');
  const [date, setDate]             = useState(new Date().toISOString().split('T')[0]);
  const [results, setResults]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await flightsAPI.getStatus({
        flightNumber: searchType === 'flight' ? flightNum.trim().toUpperCase() : undefined,
        from: searchType === 'route' ? from.trim().toUpperCase() : undefined,
        to:   searchType === 'route' ? to.trim().toUpperCase()   : undefined,
        date,
      });
      setResults(Array.isArray(data) ? data : [data]);
    } catch (err) {
      setError(err.message || 'Could not retrieve flight status. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flightstatus">
      <div className="page-header">
        <div className="container">
          <h1>Flight Status</h1>
          <p>Real-time information on British Airways flights worldwide</p>
        </div>
      </div>

      <div className="container flightstatus__content">
        <div className="card flightstatus__search">
          <div className="flightstatus__tabs">
            <button className={`flightstatus__tab ${searchType === 'flight' ? 'flightstatus__tab--active' : ''}`} onClick={() => setSearchType('flight')}>
              By Flight Number
            </button>
            <button className={`flightstatus__tab ${searchType === 'route' ? 'flightstatus__tab--active' : ''}`} onClick={() => setSearchType('route')}>
              By Route
            </button>
          </div>

          <form onSubmit={handleSearch} className="flightstatus__form">
            {searchType === 'flight' ? (
              <div className="form-group">
                <label className="form-label"><FaPlane size={11} /> Flight Number</label>
                <input
                  className="form-control flightstatus__big-input"
                  placeholder="e.g. BA117"
                  value={flightNum}
                  onChange={e => setFlightNum(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="flightstatus__route-row">
                <div className="form-group">
                  <label className="form-label"><FaMapMarkerAlt size={11} /> From</label>
                  <input className="form-control" placeholder="e.g. LHR" value={from} onChange={e => setFrom(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label"><FaMapMarkerAlt size={11} /> To</label>
                  <input className="form-control" placeholder="e.g. JFK" value={to} onChange={e => setTo(e.target.value)} required />
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Checking…</>
                : <><FaSearch size={13} /> Check Status</>}
            </button>
          </form>

          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--ba-text-light)' }}>
            <strong>Try:</strong> BA117 · BA204 · BA016
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: '#fdecea', color: 'var(--ba-red)', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 13 }}>
            {error}
          </div>
        )}

        {results && results.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--ba-text-light)' }}>
            <FaPlane size={40} style={{ opacity: 0.2, marginBottom: 16 }} />
            <p>No flights found for your search.</p>
          </div>
        )}

        {results && results.length > 0 && (
          <div className="flightstatus__results">
            <h2>{results.length} flight{results.length !== 1 ? 's' : ''} found</h2>
            {results.map((flight, i) => {
              const sc = STATUS_CONFIG[flight.status] || STATUS_CONFIG['unknown'];
              return (
                <div key={flight.flightNumber + i} className="card flightstatus__card">
                  <div className="flightstatus__card-header">
                    <div className="flightstatus__flight-num">
                      <div className="flightstatus__ba-logo">BA</div>
                      <div>
                        <strong>{flight.flightNumber}</strong>
                        <span>{flight.aircraft}</span>
                      </div>
                    </div>
                    <span className="flightstatus__status" style={{ background: sc.bg, color: sc.color }}>
                      {flight.statusLabel || sc.label}
                    </span>
                  </div>

                  <div className="flightstatus__route">
                    <div className="flightstatus__point">
                      <span className="flightstatus__point-label">Departure</span>
                      <strong className="flightstatus__time">{flight.scheduledDep}</strong>
                      {flight.actualDep && flight.actualDep !== flight.scheduledDep && (
                        <span className="flightstatus__actual">Actual: {flight.actualDep}</span>
                      )}
                    </div>
                    <div className="flightstatus__line-section">
                      <span className="flightstatus__route-label">{flight.route}</span>
                      <div className="flightstatus__progress-bar">
                        <div className="flightstatus__progress-fill" style={{ width: `${flight.progress || 0}%` }} />
                        <div className="flightstatus__plane-icon" style={{ left: `${flight.progress || 0}%` }}>
                          <FaPlane size={14} />
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--ba-text-light)' }}>{flight.progress || 0}% complete</span>
                    </div>
                    <div className="flightstatus__point flightstatus__point--right">
                      <span className="flightstatus__point-label">Arrival</span>
                      <strong className="flightstatus__time">{flight.scheduledArr}</strong>
                      {flight.actualArr && flight.actualArr !== flight.scheduledArr && (
                        <span className="flightstatus__actual">Actual: {flight.actualArr}</span>
                      )}
                    </div>
                  </div>

                  <div className="flightstatus__details">
                    <div><span>Terminal</span><strong>{flight.terminal || 'TBD'}</strong></div>
                    <div><span>Gate</span><strong>{flight.gate || 'TBD'}</strong></div>
                    <div><span>Progress</span><strong>{flight.progress || 0}%</strong></div>
                    <div><span>Aircraft</span><strong>{flight.aircraft || '—'}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
