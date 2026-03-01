import { NavLink } from 'react-router-dom';
import { Zap, LayoutDashboard, BarChart2, GitCompare, Settings } from 'lucide-react';

const links = [
  { to: '/',           Icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/comparison', Icon: GitCompare,       label: 'Room Comparison' },
  { to: '/analytics',  Icon: BarChart2,        label: 'Energy Analytics' },
  { to: '/settings',   Icon: Settings,         label: 'System Settings' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Zap size={18} color="#F59E0B" fill="#F59E0B" />
        <span>SHEMS</span>
      </div>
      <nav className="sidebar-nav">
        {links.map(({ to, Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={15} strokeWidth={2} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        SHEMS v1.0.2 · Connected
      </div>
    </aside>
  );
}
