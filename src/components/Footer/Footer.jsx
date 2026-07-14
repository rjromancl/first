import React from 'react';
import { Link } from 'react-router-dom';
import {
  FaPlane, FaFacebook, FaTwitter, FaInstagram,
  FaYoutube, FaLinkedin, FaApple, FaGooglePlay,
} from 'react-icons/fa';
import './Footer.css';

const footerLinks = [
  {
    heading: 'Book & Travel',
    links: [
      { label: 'Search Flights', path: '/book' },
      { label: 'Check-in Online', path: '/check-in' },
      { label: 'Flight Status', path: '/flight-status' },
      { label: 'Manage Booking', path: '/manage' },
      { label: 'Seat Selection', path: '/manage?tab=seats' },
      { label: 'Add Baggage', path: '/manage?tab=bags' },
    ],
  },
  {
    heading: 'Destinations & Offers',
    links: [
      { label: 'Holiday Destinations', path: '/destinations' },
      { label: 'Current Offers', path: '/destinations#offers' },
      { label: 'City Breaks', path: '/destinations?cat=city' },
      { label: 'Beach Holidays', path: '/destinations?cat=beach' },
      { label: 'Luxury Travel', path: '/destinations?cat=luxury' },
      { label: 'City Guides', path: '/destinations' },
    ],
  },
  {
    heading: 'Executive Club',
    links: [
      { label: 'Join the Club', path: '/executive-club' },
      { label: 'Earn Avios', path: '/executive-club#earn' },
      { label: 'Spend Avios', path: '/executive-club#spend' },
      { label: 'Tier Benefits', path: '/executive-club#tiers' },
      { label: 'Partner Rewards', path: '/executive-club#partners' },
      { label: 'Avios Calculator', path: '/executive-club#calculator' },
    ],
  },
  {
    heading: 'Help & Support',
    links: [
      { label: 'Help Centre', path: '/' },
      { label: 'Contact Us', path: '/' },
      { label: 'Accessibility', path: '/' },
      { label: 'Travel Information', path: '/' },
      { label: 'Refunds', path: '/' },
      { label: 'Covid-19 Info', path: '/' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="footer">
      {/* Newsletter */}
      <div className="footer__newsletter">
        <div className="container footer__newsletter-inner">
          <div>
            <h3>Stay up to date with our latest offers</h3>
            <p>Sign up for exclusive deals, flight inspiration and travel tips.</p>
          </div>
          <form className="footer__newsletter-form" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Enter your email address"
              className="footer__newsletter-input"
              aria-label="Email address for newsletter"
            />
            <button type="submit" className="btn btn-gold">Subscribe</button>
          </form>
        </div>
      </div>

      {/* Main footer */}
      <div className="footer__main">
        <div className="container">
          {/* Links Grid */}
          <div className="footer__links-grid">
            {footerLinks.map((section) => (
              <div key={section.heading} className="footer__links-section">
                <h4 className="footer__links-heading">{section.heading}</h4>
                <ul className="footer__links-list">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.path} className="footer__link">{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Divider */}
          <hr className="footer__divider" />

          {/* Bottom row */}
          <div className="footer__bottom">
            {/* Logo + tagline */}
            <div className="footer__brand">
              <Link to="/" className="footer__logo">
                <div className="footer__logo-icon">
                  <FaPlane size={18} />
                </div>
                <span>British Airways</span>
              </Link>
              <p className="footer__tagline">
                We take more people to more destinations than any other UK airline.
              </p>

              {/* Social */}
              <div className="footer__social">
                <a href="https://facebook.com/britishairways" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="footer__social-link">
                  <FaFacebook size={18} />
                </a>
                <a href="https://twitter.com/British_Airways" target="_blank" rel="noopener noreferrer" aria-label="Twitter / X" className="footer__social-link">
                  <FaTwitter size={18} />
                </a>
                <a href="https://instagram.com/british_airways" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="footer__social-link">
                  <FaInstagram size={18} />
                </a>
                <a href="https://youtube.com/britishairways" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="footer__social-link">
                  <FaYoutube size={18} />
                </a>
                <a href="https://linkedin.com/company/british-airways" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="footer__social-link">
                  <FaLinkedin size={18} />
                </a>
              </div>
            </div>

            {/* App downloads */}
            <div className="footer__apps">
              <p className="footer__apps-title">Download our app</p>
              <a
                href="https://apps.apple.com/gb/app/british-airways/id284793089"
                target="_blank"
                rel="noopener noreferrer"
                className="footer__app-btn"
                aria-label="Download on the App Store"
              >
                <FaApple size={20} />
                <div>
                  <span>Download on the</span>
                  <strong>App Store</strong>
                </div>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.ba.mobile"
                target="_blank"
                rel="noopener noreferrer"
                className="footer__app-btn"
                aria-label="Get it on Google Play"
              >
                <FaGooglePlay size={20} />
                <div>
                  <span>Get it on</span>
                  <strong>Google Play</strong>
                </div>
              </a>
            </div>
          </div>

          {/* Legal */}
          <div className="footer__legal">
            <p>© {new Date().getFullYear()} British Airways Plc. All rights reserved. Waterside, PO Box 365, Harmondsworth, UB7 0GB.</p>
            <div className="footer__legal-links">
              <a href="/" className="footer__legal-link">Privacy Policy</a>
              <a href="/" className="footer__legal-link">Cookie Policy</a>
              <a href="/" className="footer__legal-link">Terms & Conditions</a>
              <a href="/" className="footer__legal-link">Sitemap</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
