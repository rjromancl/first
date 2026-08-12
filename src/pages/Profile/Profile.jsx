/**
 * Profile.jsx — Full User Profile Page
 *
 * Four tabs:
 *  1. Personal     — name, email, date of birth, phone
 *  2. Travel       — passport, nationality, known traveler number, home airport
 *  3. Preferences  — preferred seat, cabin, dietary requirement
 *  4. Security     — change password
 *
 * All fields save to PATCH /api/auth/profile and update AppContext so the
 * booking form can pre-fill instantly.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaUser, FaPlane, FaStar, FaLock, FaCheck, FaSave,
  FaPassport, FaPhone, FaEnvelope, FaBirthdayCake,
  FaShieldAlt, FaChair, FaUtensils, FaHome, FaEdit,
} from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { profileAPI } from '../../services/api';
import './Profile.css';

const TABS = [
  { id: 'personal',    label: 'Personal',    icon: FaUser },
  { id: 'travel',      label: 'Travel',      icon: FaPlane },
  { id: 'preferences', label: 'Preferences', icon: FaStar },
  { id: 'security',    label: 'Security',    icon: FaLock },
];

const NATIONALITIES = [
  { value:'GB', label:'British' },   { value:'US', label:'American' },
  { value:'IN', label:'Indian' },    { value:'AU', label:'Australian' },
  { value:'CA', label:'Canadian' },  { value:'DE', label:'German' },
  { value:'FR', label:'French' },    { value:'AE', label:'Emirati' },
  { value:'SG', label:'Singaporean'},{ value:'JP', label:'Japanese' },
  { value:'PK', label:'Pakistani' }, { value:'IE', label:'Irish' },
  { value:'ZA', label:'South African'},{ value:'NZ', label:'New Zealander' },
  { value:'OTHER', label:'Other' },
];

const DIETARY = [
  { value:'none',        label:'No preference' },
  { value:'vegetarian',  label:'Vegetarian' },
  { value:'vegan',       label:'Vegan' },
  { value:'halal',       label:'Halal' },
  { value:'kosher',      label:'Kosher' },
  { value:'gluten-free', label:'Gluten-Free' },
];

const SEATS = [
  { value:'window', label:'Window', icon:'🪟' },
  { value:'aisle',  label:'Aisle',  icon:'🚶' },
  { value:'middle', label:'Middle', icon:'💺' },
];

const CABINS = [
  { value:'economy',         label:'Economy' },
  { value:'premium_economy', label:'Premium Economy' },
  { value:'business',        label:'Business Class' },
  { value:'first',           label:'First Class' },
];

const TIER_COLORS = { Gold:'#c9a227', Silver:'#6b7280', Bronze:'#b87333', Blue:'#2563eb' };

export default function Profile() {
  const { user, isAuthenticated, updateUser, addNotification } = useApp();
  const navigate = useNavigate();

  const [tab, setTab]     = useState('personal');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState('');

  // ── Form state seeded from user object ───────────────────────
  const [personal, setPersonal] = useState({
    firstName:   user?.firstName   || '',
    lastName:    user?.lastName    || '',
    phone:       user?.phone       || '',
    dateOfBirth: user?.dateOfBirth || '',
  });

  const [travel, setTravel] = useState({
    nationality:         user?.nationality         || 'GB',
    passportNumber:      user?.passportNumber      || '',
    passportExpiry:      user?.passportExpiry      || '',
    knownTravelerNumber: user?.knownTravelerNumber || '',
    homeCityIATA:        user?.homeCityIATA        || 'LHR',
  });

  const [preferences, setPreferences] = useState({
    preferredSeat:      user?.preferredSeat      || 'window',
    preferredCabin:     user?.preferredCabin     || 'economy',
    dietaryPreference:  user?.dietaryPreference  || 'none',
  });

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  });
  const [securityError, setSecurityError] = useState('');

  // Re-seed if user loads after component mounts (token rehydration)
  useEffect(() => {
    if (!user) return;
    setPersonal({
      firstName: user.firstName || '', lastName: user.lastName || '',
      phone: user.phone || '', dateOfBirth: user.dateOfBirth || '',
    });
    setTravel({
      nationality: user.nationality || 'GB',
      passportNumber: user.passportNumber || '',
      passportExpiry: user.passportExpiry || '',
      knownTravelerNumber: user.knownTravelerNumber || '',
      homeCityIATA: user.homeCityIATA || 'LHR',
    });
    setPreferences({
      preferredSeat: user.preferredSeat || 'window',
      preferredCabin: user.preferredCabin || 'economy',
      dietaryPreference: user.dietaryPreference || 'none',
    });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  // ── Save helpers ──────────────────────────────────────────────
  const saveFields = async (fields, label) => {
    setSaving(true);
    setSaved('');
    try {
      const updated = await profileAPI.update(fields);
      updateUser(updated);
      setSaved(label);
      addNotification({ type: 'success', message: `${label} saved successfully.` });
      setTimeout(() => setSaved(''), 3000);
    } catch (err) {
      addNotification({ type: 'error', message: err.message || 'Save failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePersonal = (e) => {
    e.preventDefault();
    saveFields(personal, 'Personal details');
  };

  const handleSaveTravel = (e) => {
    e.preventDefault();
    saveFields(travel, 'Travel details');
  };

  const handleSavePreferences = (e) => {
    e.preventDefault();
    saveFields(preferences, 'Preferences');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSecurityError('');
    if (security.newPassword !== security.confirmPassword) {
      setSecurityError('New passwords do not match.');
      return;
    }
    if (security.newPassword.length < 8) {
      setSecurityError('New password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await profileAPI.changePassword(security.currentPassword, security.newPassword);
      addNotification({ type: 'success', message: 'Password changed successfully.' });
      setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSaved('Password');
      setTimeout(() => setSaved(''), 3000);
    } catch (err) {
      setSecurityError(err.message || 'Password change failed.');
    } finally {
      setSaving(false);
    }
  };

  const tierColor = TIER_COLORS[user?.tier] || '#2563eb';
  const initials  = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div className="profile">
      {/* Page header */}
      <div className="profile__hero">
        <div className="container">
          <div className="profile__hero-inner">
            {/* Avatar */}
            <div className="profile__avatar" style={{ borderColor: tierColor }}>
              {initials}
              <span className="profile__avatar-tier" style={{ background: tierColor }}>
                {user?.tier}
              </span>
            </div>
            <div className="profile__hero-info">
              <h1>{user?.firstName} {user?.lastName}</h1>
              <p className="profile__exec-number">
                <FaShieldAlt size={12} /> Executive Club &nbsp;·&nbsp; {user?.execNumber}
              </p>
              <div className="profile__avios-badge">
                <FaStar size={13} style={{ color: '#c9a227' }} />
                <strong>{(user?.avios || 0).toLocaleString()} Avios</strong>
                <span className="profile__tier-chip" style={{ background: tierColor }}>
                  {user?.tier} Member
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container profile__body">
        {/* Tab bar */}
        <div className="profile__tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`profile__tab ${tab === t.id ? 'profile__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="profile__panel">

          {/* ── PERSONAL ─────────────────────────────────────── */}
          {tab === 'personal' && (
            <form className="profile__form" onSubmit={handleSavePersonal}>
              <div className="profile__section-title">
                <FaUser size={15} /> Personal Information
              </div>
              <p className="profile__section-desc">
                Your name and contact details. These pre-fill automatically when you book a flight.
              </p>

              <div className="profile__grid">
                <div className="profile__field">
                  <label>First Name</label>
                  <input
                    className="form-control"
                    value={personal.firstName}
                    onChange={e => setPersonal(p => ({ ...p, firstName: e.target.value }))}
                    placeholder="First name"
                    required
                  />
                </div>
                <div className="profile__field">
                  <label>Last Name</label>
                  <input
                    className="form-control"
                    value={personal.lastName}
                    onChange={e => setPersonal(p => ({ ...p, lastName: e.target.value }))}
                    placeholder="Last name"
                    required
                  />
                </div>
                <div className="profile__field">
                  <label><FaPhone size={11} /> Phone Number</label>
                  <input
                    className="form-control"
                    type="tel"
                    value={personal.phone}
                    onChange={e => setPersonal(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+44 7xxx xxxxxx"
                  />
                </div>
                <div className="profile__field">
                  <label><FaBirthdayCake size={11} /> Date of Birth</label>
                  <input
                    className="form-control"
                    type="date"
                    value={personal.dateOfBirth}
                    onChange={e => setPersonal(p => ({ ...p, dateOfBirth: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="profile__field profile__field--full">
                  <label><FaEnvelope size={11} /> Email Address</label>
                  <input className="form-control" value={user?.email || ''} disabled />
                  <span className="profile__field-hint">Email cannot be changed.</span>
                </div>
              </div>

              <div className="profile__actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" style={{width:16,height:16,borderWidth:2}}/> : <><FaSave size={13}/> Save Personal Details</>}
                </button>
                {saved === 'Personal details' && (
                  <span className="profile__saved-msg"><FaCheck size={12}/> Saved</span>
                )}
              </div>
            </form>
          )}

          {/* ── TRAVEL ───────────────────────────────────────── */}
          {tab === 'travel' && (
            <form className="profile__form" onSubmit={handleSaveTravel}>
              <div className="profile__section-title">
                <FaPassport size={15} /> Travel Documents
              </div>
              <p className="profile__section-desc">
                Stored securely and used to pre-fill API and advance passenger information at booking.
              </p>

              <div className="profile__grid">
                <div className="profile__field">
                  <label>Nationality</label>
                  <select
                    className="form-control"
                    value={travel.nationality}
                    onChange={e => setTravel(p => ({ ...p, nationality: e.target.value }))}
                  >
                    {NATIONALITIES.map(n => (
                      <option key={n.value} value={n.value}>{n.label}</option>
                    ))}
                  </select>
                </div>
                <div className="profile__field">
                  <label><FaHome size={11} /> Home Airport</label>
                  <input
                    className="form-control"
                    value={travel.homeCityIATA}
                    onChange={e => setTravel(p => ({ ...p, homeCityIATA: e.target.value.toUpperCase().slice(0,3) }))}
                    placeholder="LHR"
                    maxLength={3}
                  />
                  <span className="profile__field-hint">3-letter IATA code. Used as default departure airport.</span>
                </div>
                <div className="profile__field">
                  <label><FaPassport size={11} /> Passport Number</label>
                  <input
                    className="form-control"
                    value={travel.passportNumber}
                    onChange={e => setTravel(p => ({ ...p, passportNumber: e.target.value.toUpperCase() }))}
                    placeholder="e.g. 123456789"
                  />
                </div>
                <div className="profile__field">
                  <label>Passport Expiry Date</label>
                  <input
                    className="form-control"
                    type="date"
                    value={travel.passportExpiry}
                    onChange={e => setTravel(p => ({ ...p, passportExpiry: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="profile__field profile__field--full">
                  <label>Known Traveler Number <span className="profile__optional">(optional)</span></label>
                  <input
                    className="form-control"
                    value={travel.knownTravelerNumber}
                    onChange={e => setTravel(p => ({ ...p, knownTravelerNumber: e.target.value }))}
                    placeholder="TSA PreCheck / Global Entry number"
                  />
                  <span className="profile__field-hint">Used for US border pre-clearance. Leave blank if not applicable.</span>
                </div>
              </div>

              {/* Passport expiry warning */}
              {travel.passportExpiry && new Date(travel.passportExpiry) < new Date(Date.now() + 180*24*60*60*1000) && (
                <div className="profile__warning">
                  ⚠️ Your passport expires within 6 months. Many countries require 6 months validity — consider renewing before your next trip.
                </div>
              )}

              <div className="profile__actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" style={{width:16,height:16,borderWidth:2}}/> : <><FaSave size={13}/> Save Travel Details</>}
                </button>
                {saved === 'Travel details' && (
                  <span className="profile__saved-msg"><FaCheck size={12}/> Saved</span>
                )}
              </div>
            </form>
          )}

          {/* ── PREFERENCES ──────────────────────────────────── */}
          {tab === 'preferences' && (
            <form className="profile__form" onSubmit={handleSavePreferences}>
              <div className="profile__section-title">
                <FaStar size={15} /> Travel Preferences
              </div>
              <p className="profile__section-desc">
                Set your defaults so the booking form pre-selects your favourite cabin and seat every time.
              </p>

              {/* Preferred seat */}
              <div className="profile__pref-group">
                <label className="profile__pref-label"><FaChair size={13}/> Preferred Seat Position</label>
                <div className="profile__seat-options">
                  {SEATS.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      className={`profile__seat-btn ${preferences.preferredSeat === s.value ? 'profile__seat-btn--active' : ''}`}
                      onClick={() => setPreferences(p => ({ ...p, preferredSeat: s.value }))}
                    >
                      <span className="profile__seat-icon">{s.icon}</span>
                      {s.label}
                      {preferences.preferredSeat === s.value && <FaCheck size={11} className="profile__seat-check"/>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred cabin */}
              <div className="profile__pref-group">
                <label className="profile__pref-label"><FaPlane size={13}/> Preferred Cabin Class</label>
                <div className="profile__cabin-options">
                  {CABINS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      className={`profile__cabin-btn ${preferences.preferredCabin === c.value ? 'profile__cabin-btn--active' : ''}`}
                      onClick={() => setPreferences(p => ({ ...p, preferredCabin: c.value }))}
                    >
                      {c.label}
                      {preferences.preferredCabin === c.value && <FaCheck size={11} className="profile__cabin-check"/>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dietary preference */}
              <div className="profile__pref-group">
                <label className="profile__pref-label"><FaUtensils size={13}/> Dietary Requirement</label>
                <select
                  className="form-control profile__select"
                  value={preferences.dietaryPreference}
                  onChange={e => setPreferences(p => ({ ...p, dietaryPreference: e.target.value }))}
                >
                  {DIETARY.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                <span className="profile__field-hint">
                  We will automatically request this meal type on all your bookings.
                </span>
              </div>

              <div className="profile__actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" style={{width:16,height:16,borderWidth:2}}/> : <><FaSave size={13}/> Save Preferences</>}
                </button>
                {saved === 'Preferences' && (
                  <span className="profile__saved-msg"><FaCheck size={12}/> Saved</span>
                )}
              </div>
            </form>
          )}

          {/* ── SECURITY ─────────────────────────────────────── */}
          {tab === 'security' && (
            <form className="profile__form" onSubmit={handleChangePassword}>
              <div className="profile__section-title">
                <FaLock size={15} /> Change Password
              </div>
              <p className="profile__section-desc">
                Choose a strong password of at least 8 characters.
              </p>

              <div className="profile__grid profile__grid--narrow">
                <div className="profile__field profile__field--full">
                  <label>Current Password</label>
                  <input
                    className="form-control"
                    type="password"
                    value={security.currentPassword}
                    onChange={e => setSecurity(p => ({ ...p, currentPassword: e.target.value }))}
                    placeholder="Enter current password"
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div className="profile__field">
                  <label>New Password</label>
                  <input
                    className="form-control"
                    type="password"
                    value={security.newPassword}
                    onChange={e => setSecurity(p => ({ ...p, newPassword: e.target.value }))}
                    placeholder="At least 8 characters"
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="profile__field">
                  <label>Confirm New Password</label>
                  <input
                    className={`form-control ${securityError ? 'is-invalid' : ''}`}
                    type="password"
                    value={security.confirmPassword}
                    onChange={e => setSecurity(p => ({ ...p, confirmPassword: e.target.value }))}
                    placeholder="Repeat new password"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {securityError && (
                <div className="profile__error">{securityError}</div>
              )}

              {/* Password strength */}
              {security.newPassword && (
                <div className="profile__strength">
                  {['Length ≥ 8','Uppercase','Number','Symbol'].map((rule, i) => {
                    const checks = [
                      security.newPassword.length >= 8,
                      /[A-Z]/.test(security.newPassword),
                      /[0-9]/.test(security.newPassword),
                      /[^a-zA-Z0-9]/.test(security.newPassword),
                    ];
                    return (
                      <span key={i} className={`profile__strength-rule ${checks[i] ? 'profile__strength-rule--ok' : ''}`}>
                        {checks[i] ? '✓' : '○'} {rule}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="profile__actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" style={{width:16,height:16,borderWidth:2}}/> : <><FaLock size={13}/> Update Password</>}
                </button>
                {saved === 'Password' && (
                  <span className="profile__saved-msg"><FaCheck size={12}/> Password updated</span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
