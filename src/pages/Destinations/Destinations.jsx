import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaPlane, FaArrowRight } from 'react-icons/fa';
import { destinationsAPI } from '../../services/api';
import './Destinations.css';

export default function Destinations() {
  const [filter, setFilter]           = useState('all');
  const [destinations, setDestinations] = useState([]);
  const [offers, setOffers]           = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      destinationsAPI.list(),
      destinationsAPI.getOffers(),
    ])
      .then(([dests, offs]) => {
        setDestinations(dests || []);
        setOffers(offs || []);
      })
      .catch(() => {
        // Silently fall back to empty — not critical
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all'
    ? destinations
    : destinations.filter(d => d.category === filter);

  return (
    <div className="destinations">
      <div className="page-header">
        <div className="container">
          <h1>Explore Destinations</h1>
          <p>Discover your next adventure with British Airways</p>
        </div>
      </div>

      <div className="container destinations__content">
        <div className="destinations__filters">
          {['all', 'city', 'beach', 'adventure', 'luxury'].map(f => (
            <button
              key={f}
              className={`destinations__filter ${filter === f ? 'destinations__filter--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <span className="spinner" />
          </div>
        ) : (
          <div className="destinations__grid">
            {filtered.map(dest => (
              <div key={dest.id || dest.code} className="destinations__card card card-hover">
                <div
                  className="destinations__img"
                  style={{ backgroundImage: `url(${dest.image})` }}
                  role="img"
                  aria-label={`${dest.city}, ${dest.country}`}
                />
                <div className="destinations__card-body">
                  <div className="destinations__header">
                    <h3>{dest.city}</h3>
                    <span className="destinations__country">{dest.country}</span>
                  </div>
                  <p className="destinations__desc">{dest.description}</p>
                  <div className="destinations__meta">
                    <span className="destinations__flight"><FaPlane size={11} /> {dest.flightTime}</span>
                    <span className="destinations__price">from <strong>£{dest.fromPrice}</strong></span>
                  </div>
                  <Link to={`/book?to=${dest.code}`} className="btn btn-primary btn-sm">
                    Book Now <FaArrowRight size={11} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Offers */}
        {offers.length > 0 && (
          <section id="offers" className="destinations__offers">
            <h2>Current Offers</h2>
            <div className="destinations__offers-grid">
              {offers.map(offer => (
                <div key={offer.id} className="destinations__offer-card card card-hover">
                  <div className="destinations__offer-img" style={{ backgroundImage: `url(${offer.image})` }} />
                  <div className="destinations__offer-body">
                    <span className="badge badge-gold">{offer.discount}</span>
                    <h3>{offer.title}</h3>
                    <p>{offer.description}</p>
                    <div className="destinations__offer-footer">
                      <code>{offer.promoCode}</code>
                      <span className="destinations__offer-expiry">Until {offer.validUntil}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
