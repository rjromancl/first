/**
 * HelpSupport.jsx — RAG-powered Help & Support page.
 *
 * Features:
 *  - Agentic AI chat powered by Groq llama-3.3-70b + BA knowledge base
 *  - Multi-turn conversation with full history
 *  - Source citation chips on every AI answer
 *  - Suggested follow-up questions after each reply
 *  - Starter question cards (12 topics) on empty state
 *  - Category filter tabs (All / Baggage / Avios / Rights / Lounge / Cabin)
 *  - Typing indicator with animated dots
 *  - Markdown-style bold (**text**) and bullet rendering
 *  - "Was this helpful?" thumbs feedback per message
 *  - Keyboard shortcut: Enter to send, Shift+Enter for newline
 *  - Fully responsive (mobile + desktop)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaRobot, FaPaperPlane, FaTimes, FaThumbsUp, FaThumbsDown,
         FaRedo, FaSearch, FaChevronRight, FaExternalLinkAlt, FaArrowRight } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { askHelpAgent, STARTER_QUESTIONS, CATEGORY_ICONS } from '../../services/helpService';
import './HelpSupport.css';

// ── Markdown-lite renderer ─────────────────────────────────────────────────
// Handles **bold**, bullet lists (lines starting with •/-/*), and newlines.
function RichText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <span className="help__rich-text">
      {lines.map((line, i) => {
        const isBullet = /^[•\-\*]\s/.test(line.trim());
        const parts = line.replace(/^[•\-\*]\s/, '').split(/\*\*(.*?)\*\*/g);
        const rendered = parts.map((p, j) =>
          j % 2 === 1 ? <strong key={j}>{p}</strong> : p
        );
        return (
          <React.Fragment key={i}>
            {isBullet
              ? <span className="help__bullet">• {rendered}</span>
              : rendered}
            {i < lines.length - 1 && !isBullet && <br />}
          </React.Fragment>
        );
      })}
    </span>
  );
}

// ── Source citation chip ───────────────────────────────────────────────────
function SourceChip({ source }) {
  const icon = CATEGORY_ICONS[source.category] || '📋';
  return (
    <span className={`help__source-chip help__source-chip--${source.category}`}>
      {icon} {source.label}
    </span>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="help__message help__message--agent">
      <div className="help__avatar help__avatar--agent">
        <FaRobot size={14} />
      </div>
      <div className="help__bubble help__bubble--agent help__bubble--typing">
        <span className="help__typing-dot" />
        <span className="help__typing-dot" />
        <span className="help__typing-dot" />
      </div>
    </div>
  );
}

// ── Starter question card ──────────────────────────────────────────────────
function StarterCard({ item, onAsk }) {
  const icon = CATEGORY_ICONS[item.category] || '📋';
  return (
    <button className="help__starter-card" onClick={() => onAsk(item.q)}>
      <span className="help__starter-icon">{icon}</span>
      <span className="help__starter-text">{item.q}</span>
      <FaChevronRight size={11} className="help__starter-arrow" />
    </button>
  );
}

// ── Category filter tabs ───────────────────────────────────────────────────
const FILTER_TABS = [
  { key: 'all',           label: 'All Topics',    icon: '🔍' },
  { key: 'baggage',       label: 'Baggage',       icon: '🧳' },
  { key: 'executive-club',label: 'Avios',         icon: '⭐' },
  { key: 'uk261',         label: 'Your Rights',   icon: '⚖️' },
  { key: 'lounge',        label: 'Lounges',       icon: '🛋️' },
  { key: 'cabin',         label: 'Cabins',        icon: '💺' },
  { key: 'service',       label: 'Services',      icon: '🛎️' },
];

// ── Individual chat message ────────────────────────────────────────────────
function ChatMessage({ msg, onSuggestedQuestion, onNavigate }) {
  const [feedback, setFeedback] = useState(null); // 'up' | 'down' | null
  const isAgent = msg.role === 'agent';

  return (
    <div className={`help__message help__message--${msg.role}`}>
      {isAgent && (
        <div className="help__avatar help__avatar--agent">
          <FaRobot size={14} />
        </div>
      )}

      <div className={`help__bubble-wrap ${isAgent ? 'help__bubble-wrap--agent' : ''}`}>
        <div className={`help__bubble help__bubble--${msg.role}`}>
          <RichText text={msg.text} />
        </div>

        {/* Tool result summary badge */}
        {isAgent && msg.toolSummary && (
          <div className="help__tool-badge">
            <span className="help__tool-badge-icon">⚡</span>
            <span className="help__tool-badge-text">{msg.toolSummary}</span>
          </div>
        )}

        {/* Live tool data — flight list */}
        {isAgent && msg.toolResult?.flights?.length > 0 && (
          <div className="help__tool-results">
            {msg.toolResult.flights.map((f, i) => (
              <div key={i} className="help__tool-flight">
                <span className="help__tool-flight-num">{f.flightNumber}</span>
                <span className="help__tool-flight-route">{f.departure?.slice(11,16) || '—'} → {f.arrival?.slice(11,16) || '—'}</span>
                <span className="help__tool-flight-price">{f.price}</span>
                <span className={`help__tool-flight-stops ${f.stops === 0 ? 'help__tool-flight-direct' : ''}`}>{f.stops === 0 ? 'Direct' : `${f.stops} stop`}</span>
              </div>
            ))}
          </div>
        )}

        {/* Live tool data — booking details */}
        {isAgent && msg.toolResult?.found && msg.toolResult?.reference && (
          <div className="help__tool-booking">
            <div className="help__tool-booking-ref">{msg.toolResult.reference} · {msg.toolResult.status?.toUpperCase()}</div>
            <div className="help__tool-booking-route">{msg.toolResult.outbound?.from} → {msg.toolResult.outbound?.to} · {msg.toolResult.outbound?.cabin}</div>
            {msg.toolResult.outbound?.seat && <div className="help__tool-booking-seat">Seat: {msg.toolResult.outbound.seat}</div>}
          </div>
        )}

        {/* Action button — navigate to app page */}
        {isAgent && msg.action?.type === 'navigate' && (
          <button
            className="help__action-btn"
            onClick={() => onNavigate(msg.action.path)}
          >
            <FaArrowRight size={12} />
            {msg.action.label}
          </button>
        )}

        {/* Source citations */}
        {isAgent && msg.sources?.length > 0 && (
          <div className="help__sources">
            <span className="help__sources-label">Sources:</span>
            {msg.sources.map((s, i) => <SourceChip key={i} source={s} />)}
          </div>
        )}

        {/* Suggested follow-ups */}
        {isAgent && msg.suggestedQuestions?.length > 0 && (
          <div className="help__suggested">
            {msg.suggestedQuestions.map((q, i) => (
              <button
                key={i}
                className="help__suggested-btn"
                onClick={() => onSuggestedQuestion(q)}
              >
                {q} <FaChevronRight size={10} />
              </button>
            ))}
          </div>
        )}

        {/* Feedback thumbs */}
        {isAgent && !msg.isError && (
          <div className="help__feedback">
            <span className="help__feedback-label">Was this helpful?</span>
            <button
              className={`help__feedback-btn ${feedback === 'up' ? 'help__feedback-btn--active' : ''}`}
              onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
              title="Yes, helpful"
            >
              <FaThumbsUp size={12} />
            </button>
            <button
              className={`help__feedback-btn ${feedback === 'down' ? 'help__feedback-btn--active-neg' : ''}`}
              onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
              title="Not helpful"
            >
              <FaThumbsDown size={12} />
            </button>
            {feedback && (
              <span className="help__feedback-thanks">
                {feedback === 'up' ? 'Thanks! 😊' : 'Thanks, we\'ll improve!'}
              </span>
            )}
          </div>
        )}

        <span className="help__timestamp">
          {msg.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ── Main HelpSupport component ─────────────────────────────────────────────
export default function HelpSupport() {
  const { addNotification } = useApp();
  const navigate = useNavigate();

  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [activeTab,  setActiveTab]  = useState('all');
  const [searchQ,    setSearchQ]    = useState('');

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const historyRef     = useRef([]); // [{role, content}] for Groq

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  const addMessage = useCallback((role, data) => {
    const msg = {
      id:                 Date.now() + Math.random(),
      role,
      text:               typeof data === 'string' ? data : data.text,
      action:             typeof data === 'string' ? null : (data.action || null),
      toolSummary:        typeof data === 'string' ? null : (data.toolSummary || null),
      toolResult:         typeof data === 'string' ? null : (data.toolResult || null),
      sources:            data.sources            || [],
      suggestedQuestions: data.suggestedQuestions || [],
      intent:             data.intent             || 'general',
      isError:            data.isError            || false,
      timestamp:          new Date(),
    };
    setMessages(prev => [...prev, msg]);

    // Keep conversation history for AI
    if (role === 'user') {
      historyRef.current.push({ role: 'user',      content: msg.text });
    } else if (role === 'agent') {
      historyRef.current.push({ role: 'assistant', content: msg.text });
    }
    // Cap history to last 20 turns
    if (historyRef.current.length > 20) {
      historyRef.current = historyRef.current.slice(-20);
    }
  }, []);

  const sendQuestion = useCallback(async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;

    setInput('');
    setLoading(true);
    addMessage('user', q);

    try {
      const result = await askHelpAgent(q, historyRef.current);
      addMessage('agent', result);
    } catch (err) {
      addMessage('agent', {
        text: 'Sorry, I\'m having trouble connecting right now. Please try again or visit **ba.com/help**.',
        sources: [],
        suggestedQuestions: ['What is the baggage allowance?', 'How do I claim a refund?'],
        isError: true,
      });
      addNotification({ type: 'error', message: 'Help AI unavailable — try again shortly.' });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, addMessage, addNotification]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  };

  const handleClear = () => {
    setMessages([]);
    historyRef.current = [];
    setInput('');
    inputRef.current?.focus();
  };

  // Filtered starter questions
  const filteredStarters = STARTER_QUESTIONS.filter(s => {
    const matchesTab  = activeTab === 'all' || s.category === activeTab;
    const matchesSearch = !searchQ || s.q.toLowerCase().includes(searchQ.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const isEmpty = messages.length === 0;

  return (
    <div className="help">
      {/* Page header */}
      <div className="help__hero">
        <div className="container">
          <div className="help__hero-inner">
            <div className="help__hero-text">
              <h1>Help &amp; Support</h1>
              <p>Ask anything about baggage, Avios, check-in, your rights, lounges, or cabin classes. Powered by the official British Airways knowledge base.</p>
            </div>
            <div className="help__hero-badge">
              <FaRobot size={28} />
              <div>
                <strong>BA AI Agent</strong>
                <span>RAG-powered · Always accurate</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container help__layout">

        {/* ── Left: Chat panel ─────────────────────────────────────── */}
        <div className="help__chat-panel">
          <div className="help__chat-toolbar">
            <div className="help__chat-title">
              <span className="help__online-dot" />
              AI Support Agent
            </div>
            {!isEmpty && (
              <button className="help__clear-btn" onClick={handleClear} title="Clear conversation">
                <FaRedo size={13} /> New chat
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="help__messages">
            {isEmpty && (
              <div className="help__empty-state">
                <div className="help__empty-icon"><FaRobot size={36} /></div>
                <h3>How can I help you today?</h3>
                <p>Ask me anything about British Airways — baggage rules, Avios points, your passenger rights, lounges, and more.</p>
              </div>
            )}

            {messages.map(msg => (
              <ChatMessage
                key={msg.id}
                msg={msg}
                onSuggestedQuestion={sendQuestion}
                onNavigate={(path) => navigate(path)}
              />
            ))}

            {loading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="help__input-bar">
            <textarea
              ref={inputRef}
              className="help__input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
              rows={1}
              disabled={loading}
            />
            <button
              className="help__send-btn"
              onClick={() => sendQuestion()}
              disabled={!input.trim() || loading}
              title="Send"
            >
              <FaPaperPlane size={16} />
            </button>
          </div>

          <div className="help__input-hint">
            Answers are based on the official BA knowledge base · For urgent issues call <strong>+44 (0)344 493 0787</strong>
          </div>
        </div>

        {/* ── Right: Starter questions panel ──────────────────────── */}
        <div className="help__starters-panel">
          <h2 className="help__starters-title">Browse Help Topics</h2>

          {/* Search */}
          <div className="help__starters-search">
            <FaSearch size={14} className="help__starters-search-icon" />
            <input
              type="text"
              placeholder="Search questions…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className="help__starters-search-input"
            />
            {searchQ && (
              <button className="help__starters-search-clear" onClick={() => setSearchQ('')}>
                <FaTimes size={12} />
              </button>
            )}
          </div>

          {/* Category tabs */}
          <div className="help__filter-tabs">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                className={`help__filter-tab ${activeTab === tab.key ? 'help__filter-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Starter cards */}
          <div className="help__starters-list">
            {filteredStarters.length > 0
              ? filteredStarters.map((item, i) => (
                  <StarterCard key={i} item={item} onAsk={sendQuestion} />
                ))
              : (
                <div className="help__starters-empty">
                  No questions match "<strong>{searchQ}</strong>"
                </div>
              )
            }
          </div>

          {/* External links */}
          <div className="help__external-links">
            <h3>More Help</h3>
            <a href="https://www.britishairways.com/travel/customerservice/public/en_gb" target="_blank" rel="noopener noreferrer" className="help__ext-link">
              <FaExternalLinkAlt size={11} /> BA Customer Service
            </a>
            <a href="https://www.britishairways.com/content/information/baggage" target="_blank" rel="noopener noreferrer" className="help__ext-link">
              <FaExternalLinkAlt size={11} /> Baggage Information
            </a>
            <a href="https://www.britishairways.com/travel/executiveclub" target="_blank" rel="noopener noreferrer" className="help__ext-link">
              <FaExternalLinkAlt size={11} /> Executive Club
            </a>
            <a href="https://www.britishairways.com/travel/claim-form" target="_blank" rel="noopener noreferrer" className="help__ext-link">
              <FaExternalLinkAlt size={11} /> Submit a Claim
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
