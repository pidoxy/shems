import { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, SkipForward, Thermometer, Wind, Lightbulb,
  CheckCircle, Settings, LogOut, User, X, Zap, Menu,
} from 'lucide-react';

const PAGE_TITLES = {
  '/':           'Dashboard',
  '/comparison': 'Room Comparison',
  '/analytics':  'Energy Analytics',
  '/settings':   'System Settings',
};

// Static historical alerts (always present)
const STATIC_ALERTS = [
  { id: 's1', type: 'success', msg: 'SHEMS started successfully', time: 'Today, 08:00', read: true },
  { id: 's2', type: 'info',    msg: 'Backend connected — live data active', time: 'Today, 08:00', read: true },
];

function fmtTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function Topbar({ onTick, autoMode, setAutoMode, rooms = [], apiOnline, onMenuClick }) {
  const [time, setTime] = useState(() => fmtTime(new Date()));
  const loc = useLocation();
  const navigate = useNavigate();

  const [notifOpen,   setNotifOpen]   = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [readIds,     setReadIds]     = useState(new Set(['s1', 's2']));

  const notifRef   = useRef(null);
  const profileRef = useRef(null);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setTime(fmtTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e) {
      if (notifRef.current   && !notifRef.current.contains(e.target))   setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Build live alerts from room state
  const liveAlerts = useMemo(() => {
    const alerts = [];
    rooms.forEach(r => {
      if (r.temperature >= 28) {
        alerts.push({
          id: `temp-${r.id}`,
          type: 'danger',
          msg: `High temperature in ${r.name}: ${r.temperature}°C`,
          time: 'Just now',
          icon: 'thermometer',
        });
      } else if (r.temperature >= 26) {
        alerts.push({
          id: `temp-warn-${r.id}`,
          type: 'warning',
          msg: `${r.name} temperature elevated: ${r.temperature}°C`,
          time: 'Just now',
          icon: 'thermometer',
        });
      }
      if (r._acOverride) {
        alerts.push({
          id: `override-ac-${r.id}`,
          type: 'info',
          msg: `AC manual override active — ${r.name}`,
          time: 'Just now',
          icon: 'wind',
        });
      }
      if (r._lightOverride) {
        alerts.push({
          id: `override-light-${r.id}`,
          type: 'info',
          msg: `Lights manual override active — ${r.name}`,
          time: 'Just now',
          icon: 'light',
        });
      }
    });
    if (!apiOnline) {
      alerts.push({
        id: 'offline',
        type: 'warning',
        msg: 'Backend offline — running in simulation mode',
        time: 'Just now',
        icon: 'zap',
      });
    }
    return alerts;
  }, [rooms, apiOnline]);

  const allAlerts = [...liveAlerts, ...STATIC_ALERTS];
  const unreadCount = allAlerts.filter(a => !readIds.has(a.id)).length;

  const markAllRead = () => setReadIds(new Set(allAlerts.map(a => a.id)));
  const markRead    = (id) => setReadIds(prev => new Set([...prev, id]));

  const title = Object.entries(PAGE_TITLES).find(([k]) => loc.pathname === k)?.[1] ?? 'SHEMS';

  function NotifIcon({ type, iconKey }) {
    const color = type === 'danger' ? '#DC2626' : type === 'warning' ? '#D97706' : type === 'success' ? '#059669' : '#2563EB';
    if (iconKey === 'thermometer') return <Thermometer size={13} color={color} />;
    if (iconKey === 'wind')        return <Wind        size={13} color={color} />;
    if (iconKey === 'light')       return <Lightbulb   size={13} color={color} />;
    if (iconKey === 'zap')         return <Zap         size={13} color={color} />;
    return <div className={`notif-dot ${type}`} />;
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        {/* Hamburger — mobile only */}
        <button className="hamburger" onClick={onMenuClick} aria-label="Open navigation">
          <Menu size={18} strokeWidth={2} />
        </button>
        <span className="topbar-title">{title}</span>
      </div>

      <div className="topbar-right">
        <span className="clock">{time}</span>
        <div className="topbar-divider" />

        <button
          className={`btn-auto${autoMode ? ' active' : ''}`}
          onClick={() => setAutoMode(v => !v)}
          title={autoMode ? 'Auto mode on — click to stop' : 'Start auto simulation'}
        >
          <span className={`auto-dot${autoMode ? ' on' : ''}`} />
          <span className="btn-text">{autoMode ? 'Auto On' : 'Auto'}</span>
        </button>

        <button className="btn-step" onClick={onTick} title="Step simulation forward">
          <SkipForward size={12} strokeWidth={2} />
          <span className="btn-text">Step</span>
        </button>

        {/* ── Notifications ── */}
        <div className="topbar-btn-wrap" ref={notifRef}>
          <button
            style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 4, borderRadius: 6 }}
            onClick={() => { setNotifOpen(v => !v); setProfileOpen(false); }}
            title="Notifications"
          >
            <Bell size={16} strokeWidth={1.8} color={notifOpen ? 'var(--primary)' : 'var(--text-light)'} />
            {unreadCount > 0 && (
              <span className="alert-badge" style={{ position: 'absolute', top: -3, right: -4, lineHeight: 1 }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="topbar-dropdown notif-panel">
              <div className="dropdown-header">
                <span className="dropdown-header-title">Notifications</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {unreadCount > 0 && (
                    <button className="dropdown-btn-ghost" onClick={markAllRead}>
                      Mark all read
                    </button>
                  )}
                  <button className="dropdown-btn-ghost" style={{ padding: '2px 4px' }} onClick={() => setNotifOpen(false)}>
                    <X size={13} />
                  </button>
                </div>
              </div>

              <div className="notif-list">
                {allAlerts.length === 0 ? (
                  <div className="notif-empty">No notifications</div>
                ) : (
                  allAlerts.map(alert => {
                    const isUnread = !readIds.has(alert.id);
                    return (
                      <div
                        key={alert.id}
                        className={`notif-item${isUnread ? ' unread' : ''}`}
                        onClick={() => markRead(alert.id)}
                      >
                        <div style={{ paddingTop: 3, flexShrink: 0 }}>
                          {alert.icon
                            ? <NotifIcon type={alert.type} iconKey={alert.icon} />
                            : <div className={`notif-dot ${alert.type}`} />}
                        </div>
                        <div className="notif-body">
                          <div className="notif-msg">{alert.msg}</div>
                          <div className="notif-time">{alert.time}</div>
                        </div>
                        {isUnread && (
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 5 }} />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="dropdown-footer">
                <button
                  className="dropdown-btn-ghost"
                  style={{ width: '100%', padding: '4px 0' }}
                  onClick={() => { navigate('/analytics'); setNotifOpen(false); }}
                >
                  View Energy Report →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Profile ── */}
        <div className="topbar-btn-wrap" ref={profileRef}>
          <div
            className="avatar"
            style={profileOpen ? { outline: '2px solid var(--primary)', outlineOffset: 2 } : {}}
            onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); }}
            title="Profile"
          >
            SH
          </div>

          {profileOpen && (
            <div className="topbar-dropdown profile-panel">
              {/* User info */}
              <div className="profile-top">
                <div className="profile-avatar-lg">SH</div>
                <div className="profile-name">SHEMS Admin</div>
                <div className="profile-email">admin@shems.local</div>
                <span className="profile-role">System Administrator</span>
              </div>

              {/* System info strip */}
              <div style={{ padding: '8px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                <span>Version 1.0.2</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: apiOnline ? 'var(--success)' : 'var(--text-light)', display: 'inline-block' }} />
                  {apiOnline ? 'Backend Live' : 'Simulation'}
                </span>
              </div>

              {/* Menu items */}
              <div className="profile-menu">
                <button className="profile-menu-item" onClick={() => { navigate('/settings'); setProfileOpen(false); }}>
                  <Settings size={14} strokeWidth={1.8} /> System Settings
                </button>
                <button className="profile-menu-item" onClick={() => { setProfileOpen(false); }}>
                  <User size={14} strokeWidth={1.8} /> Edit Profile
                </button>
                <div className="profile-menu-sep" />
                <button
                  className="profile-menu-item danger"
                  onClick={() => {
                    setProfileOpen(false);
                    // No real auth — just show a toast-like alert
                    alert('Sign out is not available in this demo.');
                  }}
                >
                  <LogOut size={14} strokeWidth={1.8} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
