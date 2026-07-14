import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaPlane, FaSearch, FaArrowRight, FaStar, FaShieldAlt,
  FaWifi, FaUtensils, FaTv, FaChargingStation, FaChevronRight,
  FaMapMarkerAlt, FaCalendarAlt, FaUsers, FaExchangeAlt,
} from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { destinations, offers } from '../../data/destinations';
import './Home.css';

const cabins = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium Economy' },
  { value: 'business', label: 'Business Class' },
  { value: 'first', label: 'First Class' },
];

const popularRoutes = [
  { from: 'London', to: 'New York', fromCode: 'LHR', toCode: 'JFK', price: 349 },
  { from: 'London', to: 'Dubai', fromCode: 'LHR', toCode: 'DXB', price: 299 },
  { from: 'London', to: 'Tokyo', fromCode: 'LHR', toCode: 'NRT', price: 649 },
  { from: 'London', to: 'Sydney', fromCode: 'LHR', toCode: 'SYD', price: 799 },
  { from: 'London', to: 'Barcelona', fromCode: 'LHR', toCode: 'BCN', price: 89 },
  { from: 'London', to: 'Singapore', fromCode: 'LHR', toCode: 'SIN', price: 579 },
];

const features = [
  { icon: FaWifi, title: 'In-flight Wi-Fi', desc: 'Stay connected across the globe with high-speed Wi-Fi on most long-haul flights.' },
  { icon: FaUtensils, title: 'Award-winning Dining', desc: 'Enjoy freshly prepared meals and a curated drinks selection at 35,000 feet.' },
  { icon: FaTv, title: 'Thousands of Entertainment', desc: 'Movies, TV, music and more with our in-flight entertainment system.' },
  { icon: FaChargingStation, title: 'USB & Power Sockets', desc: 'Keep your devices charged throughout your journey.' },
];

export default function Home() {
  const navigate = useNavigate();
  const { setSearchParams } = useApp();

  const [tripType, setTripType] = useState('return');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [departDate, setDepartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [cabin, setCabin] = useState('economy');

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams({ tripType, from, to, departDate, returnDate, passengers, cabin });
    navigate('/book');
  };

  return (
    <main className="home">
      {/* Hero Section */}
      <section className="home__hero">
        <div className="home__hero-bg">
          <div className="home__hero-overlay" />
        </div>
        <div className="container home__hero-content">
          <div className="home__hero-text">
            <span className="home__hero-eyebrow">British Airways</span>
            <h1 className="home__hero-title">
              Fly the World<br />
              <span>in Comfort &amp; Style</span>
            </h1>
            <p className="home__hero-subtitle">
              Over 200 destinations worldwide. Award-winning service. Earn Avios every flight.
            </p>
            <div className="home__hero-stats">
              <div className="home__stat">
                <strong>200+</strong>
                <span>Destinations</span>
              </div>
              <div className="home__stat">
                <strong>100M+</strong>
                <span>Passengers annually</span>
              </div>
              <div className="home__stat">
                <strong>75+</strong>
                <span>Years of flying</span>
              </div>
            </div>
          </div>

          {/* Search Widget */}
          <div className="home__search-card">
            <div className="home__search-tabs">
              {['return', 'oneway', 'multicity'].map((type) => (
                <button
                  key={type}
                  className={`home__search-tab ${tripType === type ? 'home__search-tab--active' : ''}`}
                  onClick={() => setTripType(type)}
                >
                  {type === 'return' ? 'Return' : type === 'oneway' ? 'One Way' : 'Multi-City'}
                </button>
              ))}
            </div>

            <form className="home__search-form" onSubmit={handleSearch}>
              <div className="home__search-row home__search-row--airports">
                <div className="home__search-field">
                  <label className="form-label">
                    <FaMapMarkerAlt size={11} /> From
                  </label>
                  <input
                    type="text"
                    className="form-control home__search-input"
                    placeholder="City or airport"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="button"
                  className="home__swap-btn"
                  onClick={handleSwap}
                  aria-label="Swap origin and destination"
                  title="Swap"
                >
                  <FaExchangeAlt size={14} />
                </button>

                <div className="home__search-field">
                  <label className="form-label">
                    <FaMapMarkerAlt size={11} /> To
                  </label>
                  <input
                    type="text"
                    className="form-control home__search-input"
                    placeholder="City or airport"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="home__search-row home__search-row--dates">
                <div className="home__search-field">
                  <label className="form-label">
                    <FaCalendarAlt size={11} /> Depart
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={departDate}
                    onChange={(e) => setDepartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                {tripType === 'return' && (
                  <div className="home__search-field">
                    <label className="form-label">
                      <FaCalendarAlt size={11} /> Return
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      min={departDate || new Date().toISOString().split('T')[0]}
                    />
                  </div>
                )}
              </div>

              <div className="home__search-row home__search-row--options">
                <div className="home__search-field">
                  <label className="form-label">
                    <FaUsers size={11} /> Passengers
                  </label>
                  <select
                    className="form-control"
                    value={passengers}
                    onChange={(e) => setPassengers(Number(e.target.value))}
                  >
                    {[1,2,3,4,5,6,7,8].map(n => (
                      <option key={n} value={n}>{n} {n === 1 ? 'Adult' : 'Adults'}</option>
                    ))}
                  </select>
                </div>

                <div className="home__search-field">
                  <label className="form-label">
                    <FaPlane size={11} /> Cabin Class
                  </label>
                  <select
                    className="form-control"
                    value={cabin}
                    onChange={(e) => setCabin(e.target.value)}
                  >
                    {cabins.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary home__search-btn">
                  <FaSearch size={14} /> Search Flights
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="home__quick-actions">
        <div className="container">
          <div className="home__quick-grid">
            {[
              { icon: FaPlane, label: 'Book a Flight', desc: 'Search hundreds of routes', path: '/book', color: 'blue' },
              { icon: FaSearch, label: 'Check-in Online', desc: 'From 24 hours before', path: '/check-in', color: 'gold' },
              { icon: FaShieldAlt, label: 'Manage Booking', desc: 'Update your travel plans', path: '/manage', color: 'blue' },
              { icon: FaStar, label: 'Executive Club', desc: 'Earn & spend Avios', path: '/executive-club', color: 'gold' },
            ].map((item) => (
              <Link key={item.label} to={item.path} className={`home__quick-card home__quick-card--${item.color}`}>
                <div className="home__quick-icon">
                  <item.icon size={24} />
                </div>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.desc}</span>
                </div>
                <FaChevronRight size={14} className="home__quick-arrow" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Destinations */}
      <section className="section home__destinations">
        <div className="container">
          <div className="home__section-header">
            <div>
              <h2 className="section-title">Popular Destinations</h2>
              <p className="section-subtitle">Explore our most-loved routes from London</p>
            </div>
            <Link to="/destinations" className="btn btn-secondary btn-sm">
              View All <FaArrowRight size={12} />
            </Link>
          </div>

          <div className="home__destinations-grid">
            {destinations.slice(0, 6).map((dest) => (
              <Link
                key={dest.id}
                to={`/destinations?dest=${dest.code}`}
                className="home__dest-card card card-hover"
              >
                <div
                  className="home__dest-img"
                  style={{ backgroundImage: `url(${dest.image})` }}
                  role="img"
                  aria-label={`${dest.city}, ${dest.country}`}
                >
                  <div className="home__dest-overlay" />
                  <div className="home__dest-info">
                    <span className="home__dest-city">{dest.city}</span>
                    <span className="home__dest-country">{dest.country}</span>
                  </div>
                </div>
                <div className="home__dest-footer">
                  <span className="home__dest-flight">
                    <FaPlane size={11} /> {dest.flightTime}
                  </span>
                  <span className="home__dest-price">
                    From <strong>£{dest.fromPrice}</strong>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Offers Banner */}
      <section className="home__offers-banner">
        <div className="container">
          <div className="home__section-header">
            <div>
              <h2 className="section-title" style={{ color: 'var(--ba-white)' }}>Current Offers</h2>
              <p className="section-subtitle" style={{ color: 'rgba(255,255,255,0.75)' }}>
                Save big on your next adventure
              </p>
            </div>
            <Link to="/destinations#offers" className="btn btn-white btn-sm">
              All Offers <FaArrowRight size={12} />
            </Link>
          </div>

          <div className="home__offers-grid">
            {offers.map((offer) => (
              <div key={offer.id} className="home__offer-card">
                <div
                  className="home__offer-img"
                  style={{ backgroundImage: `url(${offer.image})` }}
                />
                <div className="home__offer-body">
                  <span className="badge badge-gold">{offer.discount}</span>
                  <h3>{offer.title}</h3>
                  <p>{offer.description}</p>
                  <div className="home__offer-footer">
                    <code className="home__offer-code">{offer.promoCode}</code>
                    <span className="home__offer-expiry">Until {offer.validUntil}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Routes */}
      <section className="section home__routes">
        <div className="container">
          <h2 className="section-title">Popular Routes</h2>
          <p className="section-subtitle">Handpicked flights from London Heathrow</p>

          <div className="home__routes-grid">
            {popularRoutes.map((route) => (
              <Link
                key={`${route.fromCode}-${route.toCode}`}
                to={`/book?from=${route.fromCode}&to=${route.toCode}`}
                className="home__route-card card card-hover"
              >
                <div className="home__route-cities">
                  <span className="home__route-from">
                    <FaMapMarkerAlt size={12} /> {route.from}
                  </span>
                  <FaPlane size={14} className="home__route-plane" />
                  <span className="home__route-to">{route.to}</span>
                </div>
                <div className="home__route-price">
                  <span>From</span>
                  <strong>£{route.price}</strong>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features / Cabin Experience */}
      <section className="section home__features">
        <div className="container">
          <div className="home__features-layout">
            <div className="home__features-text">
              <h2 className="section-title">Your Comfort Is Our Priority</h2>
              <p className="section-subtitle">
                Every British Airways flight is designed around your comfort, from the moment you board to the moment you land.
              </p>
              <div className="home__features-list">
                {features.map((f) => (
                  <div key={f.title} className="home__feature-item">
                    <div className="home__feature-icon">
                      <f.icon size={20} />
                    </div>
                    <div>
                      <strong>{f.title}</strong>
                      <p>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/book" className="btn btn-primary">
                Book Your Flight <FaArrowRight size={14} />
              </Link>
            </div>

            <div className="home__features-cabin">
              <div className="home__cabin-card home__cabin-card--business">
                <h3>Business Class</h3>
                <p>Fully flat beds, fine dining and dedicated service.</p>
                <Link to="/book?cabin=business" className="btn btn-white btn-sm">
                  Explore <FaArrowRight size={11} />
                </Link>
              </div>
              <div className="home__cabin-card home__cabin-card--first">
                <h3>First Class</h3>
                <p>The ultimate expression of travel luxury.</p>
                <Link to="/book?cabin=first" className="btn btn-gold btn-sm">
                  Explore <FaArrowRight size={11} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Executive Club CTA */}
      <section className="home__club-cta">
        <div className="container home__club-cta-inner">
          <div>
            <div className="home__club-badge">
              <FaStar size={16} /> Executive Club
            </div>
            <h2>Earn Avios on Every Flight</h2>
            <p>
              Join millions of members collecting Avios points. Spend them on flights,
              upgrades, hotels and more. Bronze, Silver, Gold and Premier tiers — each
              with exclusive benefits.
            </p>
            <div className="home__club-actions">
              <Link to="/executive-club" className="btn btn-gold">
                Join for Free <FaArrowRight size={14} />
              </Link>
              <Link to="/executive-club#earn" className="btn btn-white">
                How to Earn
              </Link>
            </div>
          </div>
          <div className="home__club-tiers">
            {['Blue', 'Bronze', 'Silver', 'Gold'].map((tier, i) => (
              <div key={tier} className={`home__club-tier home__club-tier--${tier.toLowerCase()}`}>
                <FaStar size={i + 12} />
                <span>{tier}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
