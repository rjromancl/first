import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaStar, FaPlane, FaHotel, FaCar, FaGift, FaArrowRight, FaCheck } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { aviosAPI } from '../../services/api';
import './ExecutiveClub.css';

const TIERS = [
  { name: 'Blue',   points: '0+',    avios: 'Earn Avios on every flight',   perks: ['Avios on flights','Companion voucher','Online shopping'],                                          color: '#2196f3' },
  { name: 'Bronze', points: '300+',  avios: 'Earn 25% more Avios',          perks: ['All Blue perks','Lounge access purchase','Priority boarding','Extra baggage'],                    color: '#cd7f32' },
  { name: 'Silver', points: '600+',  avios: 'Earn 50% more Avios',          perks: ['All Bronze perks','Complimentary lounge','Free seat selection','Same-day flight changes'],        color: '#9e9e9e' },
  { name: 'Gold',   points: '1500+', avios: 'Earn 100% more Avios',         perks: ['All Silver perks','Concorde Room access','First class check-in','Guaranteed seat','Chauffeur'],  color: 'var(--ba-gold)' },
];

const PARTNERS = [
  { name: 'Hotels',       icon: FaHotel, desc: 'Earn Avios on hotel stays',        examples: ['Marriott','Hilton','IHG'] },
  { name: 'Car Hire',     icon: FaCar,   desc: 'Earn while you drive',              examples: ['Avis','Hertz','Enterprise'] },
  { name: 'Shopping',     icon: FaGift,  desc: 'Shop online and earn',              examples: ['Amazon','M&S','John Lewis'] },
  { name: 'More Flights', icon: FaPlane, desc: 'Earn on partner airlines',          examples: ['Iberia','Finnair','Qatar'] },
];

const SPEND_OPTIONS = [
  { title: 'Reward Flights', desc: 'Book flights using Avios — starting from 4,500 Avios for short haul', icon: FaPlane, avios: 'from 4,500' },
  { title: 'Cabin Upgrades', desc: 'Upgrade to Business or First Class using your Avios',                 icon: FaStar,  avios: 'from 30,000' },
  { title: 'Hotel Stays',    desc: 'Redeem Avios at over 100,000 hotels worldwide',                       icon: FaHotel, avios: 'from 5,000' },
  { title: 'Car Hire',       desc: 'Rent a car with Avios at your destination',                           icon: FaCar,   avios: 'from 3,000' },
];

export default function ExecutiveClub() {
  const { isAuthenticated, user } = useApp();

  const [calcForm, setCalcForm] = useState({ from: 'LHR', to: 'JFK', cabin: 'economy' });
  const [calcResult, setCalcResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [balance, setBalance] = useState(null);

  // Load Avios balance for logged-in users
  useEffect(() => {
    if (!isAuthenticated) return;
    aviosAPI.getBalance()
      .then(setBalance)
      .catch(() => {});
  }, [isAuthenticated]);

  const handleCalculate = async () => {
    setCalcLoading(true);
    try {
      const result = await aviosAPI.calculate(calcForm.from, calcForm.to, calcForm.cabin);
      setCalcResult(result);
    } catch {
      setCalcResult({ avios: null, error: 'Could not calculate. Try again.' });
    } finally {
      setCalcLoading(false);
    }
  };

  const liveAvios = balance?.avios ?? user?.avios ?? null;

  return (
    <div className="exclub">
      {/* Hero */}
      <div className="exclub__hero">
        <div className="exclub__hero-overlay" />
        <div className="container exclub__hero-content">
          <div className="exclub__hero-badge"><FaStar size={14} /> Executive Club</div>
          <h1>Unlock a World of Benefits</h1>
          <p>Join millions of members and earn Avios on flights, hotels, shopping and more.</p>
          {!isAuthenticated ? (
            <div className="exclub__hero-actions">
              <Link to="/login?register=true" className="btn btn-gold btn-lg">Join for Free</Link>
              <Link to="/login" className="btn btn-white">Sign In</Link>
            </div>
          ) : (
            <div className="exclub__member-info">
              <strong>Welcome back, {user?.firstName}!</strong>
              <span className="badge badge-gold">{balance?.tier || user?.tier || 'Blue'} Member</span>
              {liveAvios !== null && (
                <span className="exclub__avios-count"><FaStar size={13} /> {Number(liveAvios).toLocaleString()} Avios</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="container exclub__content">
        {/* Tier Cards */}
        <section id="tiers" className="section exclub__tiers">
          <h2 className="section-title">Membership Tiers</h2>
          <p className="section-subtitle">Climb the tiers and unlock greater rewards</p>
          <div className="exclub__tier-grid">
            {TIERS.map(tier => (
              <div key={tier.name} className="exclub__tier-card card">
                <div className="exclub__tier-header" style={{ background: tier.color }}>
                  <FaStar size={24} style={{ color: 'rgba(255,255,255,0.8)' }} />
                  <h3>{tier.name}</h3>
                  <span>{tier.points} Tier Points</span>
                </div>
                <div className="exclub__tier-body">
                  <p className="exclub__tier-avios">{tier.avios}</p>
                  <ul className="exclub__tier-perks">
                    {tier.perks.map(p => (
                      <li key={p}><FaCheck size={11} style={{ color: 'var(--ba-blue)' }} /> {p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Earn Avios */}
        <section id="earn" className="section exclub__earn">
          <h2 className="section-title">Earn Avios Everywhere</h2>
          <p className="section-subtitle">With our wide network of partners, every purchase counts</p>
          <div className="exclub__partners-grid">
            {PARTNERS.map(p => (
              <div key={p.name} className="exclub__partner-card card">
                <p.icon size={28} style={{ color: 'var(--ba-blue)' }} />
                <h4>{p.name}</h4>
                <p>{p.desc}</p>
                <div className="exclub__partner-examples">
                  {p.examples.map(ex => <span key={ex} className="badge badge-blue">{ex}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Avios Calculator */}
        <section id="calculator" className="section">
          <div className="card exclub__calc">
            <div className="exclub__calc-text">
              <h2>Avios Calculator</h2>
              <p>See how many Avios you could earn on your next flight</p>
            </div>
            <div className="exclub__calc-form">
              <div className="form-group">
                <label className="form-label">From</label>
                <select className="form-control" value={calcForm.from} onChange={e => setCalcForm(f => ({ ...f, from: e.target.value }))}>
                  <option value="LHR">London Heathrow</option>
                  <option value="LGW">London Gatwick</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">To</label>
                <select className="form-control" value={calcForm.to} onChange={e => setCalcForm(f => ({ ...f, to: e.target.value }))}>
                  <option value="JFK">New York JFK</option>
                  <option value="DXB">Dubai</option>
                  <option value="NRT">Tokyo</option>
                  <option value="SYD">Sydney</option>
                  <option value="BCN">Barcelona</option>
                  <option value="SIN">Singapore</option>
                  <option value="CPT">Cape Town</option>
                  <option value="BOM">Mumbai</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cabin</label>
                <select className="form-control" value={calcForm.cabin} onChange={e => setCalcForm(f => ({ ...f, cabin: e.target.value }))}>
                  <option value="economy">Economy</option>
                  <option value="premium_economy">Premium Economy</option>
                  <option value="business">Business Class</option>
                  <option value="first">First Class</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={handleCalculate} disabled={calcLoading}>
                {calcLoading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : 'Calculate'}
              </button>
            </div>
            {calcResult && !calcResult.error && (
              <div className="exclub__calc-result">
                <FaStar size={20} style={{ color: 'var(--ba-gold)' }} />
                <span>You'll earn approximately</span>
                <strong>{Number(calcResult.avios).toLocaleString()} Avios</strong>
                <span>({calcResult.distanceKm?.toLocaleString()} km · {calcResult.cabin})</span>
              </div>
            )}
            {calcResult?.error && (
              <div style={{ color: 'var(--ba-red)', fontSize: 13, marginTop: 12 }}>{calcResult.error}</div>
            )}
          </div>
        </section>

        {/* Spend */}
        <section id="spend" className="exclub__spend">
          <h2 className="section-title">Spend Your Avios</h2>
          <p className="section-subtitle">Use Avios to book reward flights, upgrades and more</p>
          <div className="exclub__spend-grid">
            {SPEND_OPTIONS.map(s => (
              <div key={s.title} className="exclub__spend-card card">
                <s.icon size={32} style={{ color: 'var(--ba-blue)' }} />
                <div className="badge badge-gold exclub__spend-avios">{s.avios} Avios</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {!isAuthenticated && (
          <div className="exclub__join-cta">
            <h2>Ready to Start Earning?</h2>
            <p>Joining is free and takes just a few minutes.</p>
            <Link to="/login?register=true" className="btn btn-primary btn-lg">
              Join the Executive Club Free <FaArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
