import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';

import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import VoiceAgent from './components/VoiceAgent/VoiceAgent';
import NotificationToast from './components/common/NotificationToast';

import Home from './pages/Home/Home';
import BookFlight from './pages/BookFlight/BookFlight';
import ManageBooking from './pages/ManageBooking/ManageBooking';
import CheckIn from './pages/CheckIn/CheckIn';
import FlightStatus from './pages/FlightStatus/FlightStatus';
import Destinations from './pages/Destinations/Destinations';
import ExecutiveClub from './pages/ExecutiveClub/ExecutiveClub';
import Login from './pages/Login/Login';

import './App.css';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
  return null;
}

function AppLayout() {
  const { voiceAgentOpen, notifications } = useApp();

  return (
    <div className="app">
      <Header />
      <div className="app__body">
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/book" element={<BookFlight />} />
          <Route path="/manage" element={<ManageBooking />} />
          <Route path="/check-in" element={<CheckIn />} />
          <Route path="/flight-status" element={<FlightStatus />} />
          <Route path="/destinations" element={<Destinations />} />
          <Route path="/executive-club" element={<ExecutiveClub />} />
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <Footer />

      {/* Global overlays */}
      <VoiceAgent />
      <NotificationToast notifications={notifications} />
    </div>
  );
}

function NotFound() {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center',
      padding: '40px 20px',
    }}>
      <div style={{ fontSize: 72, lineHeight: 1 }}>✈️</div>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--ba-dark-blue)' }}>
        Page Not Found
      </h1>
      <p style={{ color: 'var(--ba-text-light)', fontSize: 16, maxWidth: 400 }}>
        Looks like this page has taken off without us. Let's get you back on track.
      </p>
      <a href="/" className="btn btn-primary">Back to Home</a>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router>
        <AppLayout />
      </Router>
    </AppProvider>
  );
}
