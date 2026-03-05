import { NavLink } from 'react-router-dom';
import { Zap, LayoutDashboard, BarChart2, GitCompare, Settings } from 'lucide-react';

const links = [
  { to: '/',           Icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/comparison', Icon: GitCompare,       label: 'Room Comparison' },
  { to: '/analytics',  Icon: BarChart2,        label: 'Energy Analytics' },
  { to: '/settings',   Icon: Settings,         label: 'System Settings' },
];

export default function Sidebar({ apiOnline, espOnline, open, onClose }) {
  const statusLabel = espOnline ? 'Hardware Live' : apiOnline ? 'Backend Live' : 'Simulation';
  const isOnline = espOnline || apiOnline;
  return (
    <>
      {/* Backdrop — mobile only, shown when drawer is open */}
      <div
        className={`sidebar-backdrop${open ? ' open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <Zap size={16} color="#F59E0B" fill="#F59E0B" strokeWidth={2} />
          <span>SHEMS</span>
        </div>

        <nav className="sidebar-nav">
          {links.map(({ to, Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={onClose}        /* close drawer when a page is selected */
            >
              <Icon size={15} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
          <span className="footer-text">v1.0.2 · {statusLabel}</span>
        </div>
      </aside>
    </>
  );
}
