import React, { useEffect } from 'react';
import { FaCheck, FaTimes, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import './NotificationToast.css';

const icons = {
  success: FaCheck,
  error: FaTimes,
  warning: FaExclamationTriangle,
  info: FaInfoCircle,
};

function Toast({ notification }) {
  const { dismissNotification } = useApp();
  const Icon = icons[notification.type] || FaInfoCircle;

  useEffect(() => {
    const timer = setTimeout(() => {
      dismissNotification(notification.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification.id, dismissNotification]);

  return (
    <div className={`toast toast--${notification.type || 'info'}`} role="alert" aria-live="assertive">
      <div className="toast__icon">
        <Icon size={14} />
      </div>
      <span className="toast__message">{notification.message}</span>
      <button
        className="toast__close"
        onClick={() => dismissNotification(notification.id)}
        aria-label="Dismiss notification"
      >
        <FaTimes size={12} />
      </button>
    </div>
  );
}

export default function NotificationToast({ notifications }) {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="toast-container" aria-label="Notifications" role="region">
      {notifications.slice(0, 4).map((note) => (
        <Toast key={note.id} notification={note} />
      ))}
    </div>
  );
}
