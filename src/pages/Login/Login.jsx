import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { FaUser, FaLock, FaEye, FaEyeSlash, FaPlane, FaStar } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { authAPI } from '../../services/api';
import './Login.css';

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login, addNotification } = useApp();

  const [mode, setMode]         = useState(params.get('register') === 'true' ? 'register' : 'login');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [form, setForm]         = useState({
    email: '', password: '', firstName: '', lastName: '', confirmPwd: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (mode === 'login') {
        result = await authAPI.login(form.email, form.password);
      } else {
        if (form.password !== form.confirmPwd) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        result = await authAPI.register(form.firstName, form.lastName, form.email, form.password);
      }

      // result = { user, token }
      login(result.user, result.token);
      addNotification({
        type: 'success',
        message: mode === 'login'
          ? `Welcome back, ${result.user.firstName}!`
          : `Account created! Welcome to the Executive Club.`,
      });
      navigate(mode === 'register' ? '/executive-club' : '/');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const field = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="login">
      <div className="login__bg" />
      <div className="login__overlay" />
      <div className="container login__content">
        <div className="card login__card">
          <div className="login__header">
            <div className="login__logo"><FaPlane size={20} /></div>
            <h1>British Airways</h1>
            <p>{mode === 'login'
              ? 'Sign in to manage your bookings and earn Avios'
              : 'Join the Executive Club and start earning Avios today'}</p>
          </div>

          <div className="login__tabs">
            <button className={`login__tab ${mode === 'login'    ? 'login__tab--active' : ''}`} onClick={() => setMode('login')}>Sign In</button>
            <button className={`login__tab ${mode === 'register' ? 'login__tab--active' : ''}`} onClick={() => setMode('register')}>Register</button>
          </div>

          <form onSubmit={handleSubmit} className="login__form">
            {mode === 'register' && (
              <div className="login__field-row">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input className="form-control" required placeholder="John" value={form.firstName} onChange={e => field('firstName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="form-control" required placeholder="Smith" value={form.lastName} onChange={e => field('lastName', e.target.value)} />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label"><FaUser size={11} /> Email Address</label>
              <input type="email" className="form-control" required placeholder="your@email.com" value={form.email} onChange={e => field('email', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label"><FaLock size={11} /> Password</label>
              <div className="login__pwd-wrap">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="form-control" required
                  placeholder={mode === 'register' ? 'Min. 8 characters' : 'Your password'}
                  value={form.password} onChange={e => field('password', e.target.value)}
                />
                <button type="button" className="login__pwd-toggle" onClick={() => setShowPwd(s => !s)}>
                  {showPwd ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label"><FaLock size={11} /> Confirm Password</label>
                <input type="password" className="form-control" required placeholder="Repeat your password" value={form.confirmPwd} onChange={e => field('confirmPwd', e.target.value)} />
              </div>
            )}

            {mode === 'login' && (
              <div className="login__forgot"><Link to="/">Forgot password?</Link></div>
            )}

            {error && <div className="login__error">{error}</div>}

            <button type="submit" className="btn btn-primary login__submit" disabled={loading}>
              {loading
                ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> {mode === 'login' ? 'Signing In…' : 'Creating Account…'}</>
                : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {mode === 'login' && (
            <div className="login__register-cta">
              <FaStar size={14} style={{ color: 'var(--ba-gold)' }} />
              <span>Not a member? <button className="login__link" onClick={() => setMode('register')}>Join the Executive Club</button> — it's free!</span>
            </div>
          )}

          <div className="login__demo-info">
            <strong>Demo:</strong> email <code>demo@ba.com</code> / password <code>demo1234</code>
          </div>
        </div>
      </div>
    </div>
  );
}
