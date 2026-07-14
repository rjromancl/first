import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  FaPlane, FaBars, FaTimes, FaUser, FaChevronDown,
  FaMicrophone, FaBell, FaSignOutAlt, FaTicketAlt,
  FaGlobe, FaSearch,
} from 'react-icons/fa';
import './Header.css';

const navItems = [
  {
    label: 'Book',
    path: '/book',
    children: [
      { label: 'Search Flights', path: '/book' },
      { label: 'Multi-City', path: '/book?type=multicity' },
      { label: 'Holidays', path: '/destinations' },
      { label: 'Upgrade', path: '/manage' },
    ],
  },
  {
    label: 'Check-in',
    path: '/check-in',
  },
  {
    label: 'Manage',
    path: '/manage',
    children: [
      { label: 'Manage My Booking', path: '/manage' },
      { label: 'Select Seats', path: '/manage?tab=seats' },
      { label: 'Add Bags', path: '/manage?tab=bags' },
      { label: 'Upgrade Offer', path: '/manage?tab=upgrade' },
    ],
  },
  {
    label: 'Flight Status',
    path: '/flight-status',
  },
  {
    label: 'Destinations',
    path: '/destinations',
  },
  {
    label: 'Executive Club',
    path: '/executive-club',
  },
];

export default function Header() {
  const { isAuthenticated, user, logout, notifications, toggleVoiceAgent } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const headerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setActiveDropdown(null);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate('/');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className={`header ${scrolled ? 'header--scrolled' : ''}`} ref={headerRef}>
      {/* Top bar */}
      <div className="header__topbar">
        <div className="container header__topbar-inner">
          <div className="header__topbar-links">
            <button className="header__topbar-btn">
              <FaGlobe size={12} />
              <span>EN – GBP</span>
            </button>
            <a href="tel:+448444930787" className="header__topbar-link">
              Call us: 0844 493 0787
            </a>
          </div>
          <div className="header__topbar-links">
            {isAuthenticated ? (
              <span className="header__topbar-welcome">
                Welcome, {user?.firstName}
              </span>
            ) : (
              <>
                <Link to="/login" className="header__topbar-link">Sign in</Link>
                <span className="header__topbar-divider">|</span>
                <Link to="/login?register=true" className="header__topbar-link">Register</Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="header__main">
        <div className="container header__main-inner">
          {/* Logo */}
          <Link to="/" className="header__logo" aria-label="British Airways home">
            <div className="header__logo-icon">
              <FaPlane size={22} />
            </div>
            <div className="header__logo-text">
              <span className="header__logo-brand">British Airways</span>
              <span className="header__logo-tagline">Fly the World</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="header__nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <div
                key={item.label}
                className={`header__nav-item ${activeDropdown === item.label ? 'header__nav-item--active' : ''}`}
                onMouseEnter={() => item.children && setActiveDropdown(item.label)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`
                  }
                  onClick={() => setActiveDropdown(null)}
                >
                  {item.label}
                  {item.children && <FaChevronDown size={10} className="header__nav-chevron" />}
                </NavLink>

                {item.children && activeDropdown === item.label && (
                  <div className="header__dropdown">
                    {item.children.map((child) => (
                      <Link
                        key={child.label}
                        to={child.path}
                        className="header__dropdown-item"
                        onClick={() => setActiveDropdown(null)}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="header__actions">
            {/* Voice Agent */}
            <button
              className="header__action-btn header__action-btn--voice"
              onClick={toggleVoiceAgent}
              aria-label="Open voice assistant"
              title="Voice Assistant"
            >
              <FaMicrophone size={16} />
              <span className="header__action-label">Ask BA</span>
            </button>

            {/* Notifications */}
            {isAuthenticated && (
              <button className="header__action-btn header__action-btn--notif" aria-label="Notifications">
                <FaBell size={16} />
                {unreadCount > 0 && (
                  <span className="header__notif-badge">{unreadCount}</span>
                )}
              </button>
            )}

            {/* User Menu */}
            {isAuthenticated ? (
              <div className="header__user-menu">
                <button
                  className="header__user-btn"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-label="User menu"
                  aria-expanded={userMenuOpen}
                >
                  <div className="header__avatar">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                  <FaChevronDown size={10} />
                </button>

                {userMenuOpen && (
                  <div className="header__user-dropdown">
                    <div className="header__user-info">
                      <strong>{user?.firstName} {user?.lastName}</strong>
                      <span>{user?.email}</span>
                      {user?.tier && (
                        <span className={`badge badge-gold header__tier`}>
                          {user.tier} Member
                        </span>
                      )}
                    </div>
                    <div className="header__user-links">
                      <Link to="/executive-club" onClick={() => setUserMenuOpen(false)}>
                        <FaTicketAlt size={13} /> My Avios
                      </Link>
                      <Link to="/manage" onClick={() => setUserMenuOpen(false)}>
                        <FaPlane size={13} /> My Bookings
                      </Link>
                      <Link to="/login" onClick={() => setUserMenuOpen(false)}>
                        <FaUser size={13} /> My Profile
                      </Link>
                      <button onClick={handleLogout} className="header__logout">
                        <FaSignOutAlt size={13} /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">
                <FaUser size={13} /> Sign In
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              className="header__hamburger"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="header__mobile-menu">
          <nav>
            {navItems.map((item) => (
              <div key={item.label} className="header__mobile-nav-item">
                <NavLink
                  to={item.path}
                  className="header__mobile-nav-link"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
                {item.children && (
                  <div className="header__mobile-sub">
                    {item.children.map((child) => (
                      <Link
                        key={child.label}
                        to={child.path}
                        className="header__mobile-sub-link"
                        onClick={() => setMenuOpen(false)}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="header__mobile-actions">
            <button className="btn btn-primary" onClick={() => { toggleVoiceAgent(); setMenuOpen(false); }}>
              <FaMicrophone size={14} /> Voice Assistant
            </button>
            {!isAuthenticated && (
              <Link to="/login" className="btn btn-secondary" onClick={() => setMenuOpen(false)}>
                Sign In / Register
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
