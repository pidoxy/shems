import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, SkipForward, Play } from 'lucide-react';

const PAGE_TITLES = {
  '/':           'Dashboard',
  '/comparison': 'Room Comparison',
  '/analytics':  'Energy Analytics',
  '/settings':   'System Settings',
};

export default function Topbar({ onTick, autoMode, setAutoMode }) {
  const [time, setTime] = useState(() => fmtTime(new Date()));
  const loc = useLocation();

  useEffect(() => {
    const id = setInterval(() => setTime(fmtTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  const title = Object.entries(PAGE_TITLES).find(([k]) => loc.pathname === k)?.[1] ?? 'SHEMS';

  return (
    <header className="topbar">
      <div className="topbar-left">
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
        <button className="btn-step" onClick={onTick} title="Step simulation">
          <SkipForward size={12} strokeWidth={2} />
          <span className="btn-text">Step</span>
        </button>
        <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <Bell size={16} strokeWidth={1.8} color="var(--text-light)" />
          <span className="alert-badge" style={{ position: 'absolute', top: -5, right: -6, lineHeight: 1 }}>2</span>
        </div>
        <div className="avatar">SH</div>
      </div>
    </header>
  );
}

function fmtTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
