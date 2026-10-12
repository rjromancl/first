/**
 * VoiceBookingAnimator.jsx
 *
 * Beautiful animated overlay that shows step-by-step form filling
 * when the voice agent navigates to the booking page.
 *
 * Displays a floating panel with:
 * - Each field label + typewriter-animated value
 * - A progress bar that fills as each field completes
 * - Pulsing "AI is filling" badge
 * - Smooth entry / exit animations (CSS keyframes — no extra deps)
 */
import React, { useEffect, useState, useRef } from 'react';
import { FaMicrophone, FaPlane, FaCheckCircle, FaUser, FaCalendarAlt, FaChair } from 'react-icons/fa';
import './VoiceBookingAnimator.css';

// ── Typewriter hook ───────────────────────────────────────────────
function useTypewriter(target, speed = 38, active = true) {
  const [displayed, setDisplayed] = useState('');
  const idxRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!active || !target) { setDisplayed(target || ''); return; }
    idxRef.current = 0;
    setDisplayed('');
    const tick = () => {
      idxRef.current += 1;
      setDisplayed(target.slice(0, idxRef.current));
      if (idxRef.current < target.length) {
        timerRef.current = setTimeout(tick, speed);
      }
    };
    timerRef.current = setTimeout(tick, speed);
    return () => clearTimeout(timerRef.current);
  }, [target, speed, active]);

  const isDone = displayed.length === (target || '').length;
  return { displayed, isDone };
}

// ── Single animated field row ─────────────────────────────────────
function FieldRow({ icon, label, value, state /* 'waiting' | 'filling' | 'done' */ }) {
  const { displayed } = useTypewriter(value || '', 42, state === 'filling');

  return (
    <div className={`vba-field vba-field--${state}`}>
      <div className="vba-field-icon">{icon}</div>
      <div className="vba-field-body">
        <span className="vba-field-label">{label}</span>
        <span className="vba-field-value">
          {state === 'waiting' && <span className="vba-field-dash">—</span>}
          {state === 'filling' && (
            <>
              {displayed}
              <span className="vba-cursor">|</span>
            </>
          )}
          {state === 'done' && (
            <span className="vba-field-done-val">
              <FaCheckCircle size={11} className="vba-check" />
              {value}
            </span>
          )}
        </span>
      </div>
      {state === 'done' && <div className="vba-field-tick" />}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
/**
 * @param {Object}   navState      — location.state from VoiceAgent
 * @param {Function} onComplete    — called when all animations finish
 * @param {boolean}  visible       — mount/unmount control
 */
export default function VoiceBookingAnimator({ navState, onComplete, visible }) {
  const [phase, setPhase]         = useState('enter');   // enter | animating | done | exit
  const [currentIdx, setCurrentIdx] = useState(-1);
  const completedRef = useRef(false);

  if (!navState) return null;

  const pf = navState.prefillPassenger || {};

  // Build the field list from whatever the voice agent captured
  const fields = [
    { key: 'from',        icon: <FaPlane size={13} />,       label: 'From',         value: navState.from || '' },
    { key: 'to',          icon: <FaPlane size={13} style={{ transform: 'scaleX(-1)' }} />, label: 'To', value: navState.to || '' },
    { key: 'departDate',  icon: <FaCalendarAlt size={13} />, label: 'Depart',       value: navState.departDate || '' },
    { key: 'cabin',       icon: <FaChair size={13} />,       label: 'Cabin',        value: navState.cabin ? navState.cabin.replace(/_/g, ' ') : '' },
    { key: 'firstName',   icon: <FaUser size={13} />,        label: 'First Name',   value: pf.firstName || '' },
    { key: 'lastName',    icon: <FaUser size={13} />,        label: 'Last Name',    value: pf.lastName || '' },
    { key: 'phone',       icon: <FaUser size={13} />,        label: 'Phone',        value: pf.phone || '' },
    { key: 'nationality', icon: <FaUser size={13} />,        label: 'Nationality',  value: pf.nationality || '' },
  ].filter(f => f.value); // only show fields that were actually captured

  const total = fields.length;

  // If nothing was captured yet (e.g. bare voice navigation), show a
  // minimal "Searching…" placeholder so the overlay isn't empty
  const hasFields = total > 0;

  // Progress 0–100
  const progress = total === 0 ? 100 : Math.round(((currentIdx + 1) / total) * 100);

  // Kick off animation sequence after enter transition
  useEffect(() => {
    if (!visible || phase !== 'enter') return;
    // If no fields to animate, just show a brief "ready" state then complete
    if (!hasFields) {
      const t = setTimeout(() => {
        setPhase('done');
        if (!completedRef.current) {
          completedRef.current = true;
          setTimeout(() => { setPhase('exit'); setTimeout(() => onComplete?.(), 500); }, 700);
        }
      }, 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setPhase('animating');
      setCurrentIdx(0);
    }, 600);
    return () => clearTimeout(t);
  }, [visible, phase, hasFields]);

  // Advance to next field, then finish
  useEffect(() => {
    if (phase !== 'animating' || currentIdx < 0) return;

    const field = fields[currentIdx];
    if (!field) return;

    // Time per field: base 400ms + 28ms per character (typewriter speed 42ms/char minus overlap)
    const duration = 400 + (field.value.length * 28);

    const t = setTimeout(() => {
      if (currentIdx < fields.length - 1) {
        setCurrentIdx(i => i + 1);
      } else {
        // All done
        setPhase('done');
        if (!completedRef.current) {
          completedRef.current = true;
          setTimeout(() => {
            setPhase('exit');
            setTimeout(() => onComplete?.(), 500);
          }, 900);
        }
      }
    }, duration);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIdx]);

  if (!visible && phase === 'exit') return null;

  return (
    <div className={`vba-overlay vba-overlay--${phase}`} role="status" aria-live="polite">
      <div className={`vba-panel vba-panel--${phase}`}>

        {/* ── Header ── */}
        <div className="vba-header">
          <div className="vba-header-left">
            <div className="vba-mic-badge">
              <FaMicrophone size={14} />
            </div>
            <div>
              <div className="vba-title">Voice Booking</div>
              <div className="vba-subtitle">AI is filling your details</div>
            </div>
          </div>
          <div className="vba-dot-group">
            <span className="vba-dot vba-dot--1" />
            <span className="vba-dot vba-dot--2" />
            <span className="vba-dot vba-dot--3" />
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="vba-progress-track">
          <div
            className="vba-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="vba-progress-label">
          {phase === 'done'
            ? '✓ All details captured'
            : !hasFields
              ? 'Searching for flights…'
              : `Filling ${currentIdx + 1} of ${total}…`}
        </div>

        {/* ── Field list ── */}
        <div className="vba-fields">
          {fields.map((f, idx) => {
            let state = 'waiting';
            if (idx < currentIdx) state = 'done';
            else if (idx === currentIdx) state = 'filling';
            return (
              <FieldRow
                key={f.key}
                icon={f.icon}
                label={f.label}
                value={f.value}
                state={state}
              />
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className="vba-footer">
          <span className="vba-footer-pulse" />
          <span>Powered by Groq · llama-3.3-70b</span>
        </div>
      </div>
    </div>
  );
}
