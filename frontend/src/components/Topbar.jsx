import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Play, SkipForward } from 'lucide-react';

const PAGE_TITLES = {
  '/':           'SHEMS Dashboard',
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
        <div className="clock">{time}</div>
        <button className="btn-auto" onClick={() => setAutoMode(v => !v)}>
          <Play size={12} fill="currentColor" />
          {autoMode ? 'Auto ON' : 'Auto OFF'}
        </button>
        <button className="btn-step" onClick={onTick}>
          <SkipForward size={13} />
          Step
        </button>
        <div style={{ position: 'relative', cursor: 'pointer' }}>
          <Bell size={18} strokeWidth={1.8} color="#64748B" />
          <span className="alert-badge" style={{ position: 'absolute', top: -5, right: -5 }}>2</span>
        </div>
        <div className="avatar">SH</div>
      </div>
    </header>
  );
}

function fmtTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
