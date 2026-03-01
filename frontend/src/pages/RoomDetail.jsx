import { useNavigate, useParams } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Tooltip, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  ArrowLeft, Settings, Bell,
  Thermometer, User, UserX, Sun, Moon,
  Wind, Lightbulb, Clock, Download,
} from 'lucide-react';
import { ROOM_COLORS, ROOM_ICON_KEY, ACTIVITY_LOG } from '../data/mockData';
import RoomIcon from '../components/RoomIcon';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

function generateTempHistory(baseTemp) {
  const labels = [], data = [];
  const now = new Date();
  for (let i = 120; i >= 0; i -= 5) {
    const t = new Date(now - i * 60000);
    labels.push(`${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`);
    const progress = (120 - i) / 120;
    data.push(+(baseTemp - 1.5 + Math.sin(progress * Math.PI * 0.8) * 3 + (Math.random() - 0.5) * 0.4).toFixed(1));
  }
  return { labels, data };
}

const ACTIVITY_COLORS = { motion: '#10B981', light: '#3B82F6', alert: '#EF4444', ac: '#EF4444', vacated: '#3B82F6' };

function exportActivityLog(roomName, log) {
  const header = 'TIME,EVENT,SOURCE,VALUE\n';
  const rows = log.map(ev =>
    [ev.time, `"${ev.event}"`, `"${ev.source}"`, `"${ev.value}"`].join(',')
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${roomName.replace(/\s+/g, '-').toLowerCase()}-activity-log.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function RoomDetail({ rooms, onOverride }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const room    = rooms.find(r => r.id === id) || rooms[0];
  const color   = ROOM_COLORS[room.name]   || '#3B82F6';
  const iconKey = ROOM_ICON_KEY[room.name] || 'sofa';
  const { labels, data: histData } = generateTempHistory(room.temperature - 1.2);

  const COOL_THRESH = 24, HEAT_THRESH = 28;
  const isHot = room.temperature >= HEAT_THRESH;

  const lineData = {
    labels,
    datasets: [
      { label: 'Temperature', data: histData, borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.06)', borderWidth: 2.5, pointRadius: 0, tension: 0.4, fill: true },
      { label: 'Thresholds',  data: Array(labels.length).fill(HEAT_THRESH), borderColor: '#FCA5A5', borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, fill: false },
      { label: '_cool',       data: Array(labels.length).fill(COOL_THRESH), borderColor: '#FCA5A5', borderWidth: 1.5, borderDash: [6, 4], pointRadius: 0, fill: false },
    ],
  };
  const lineOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true, position: 'bottom', align: 'center',
        labels: { boxWidth: 10, font: { size: 11 }, color: '#64748B', padding: 16 },
        filter: item => !item.text.startsWith('_'),
      },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 10 }, maxTicksLimit: 8 } },
      y: { grid: { color: '#F8FAFC' }, ticks: { color: '#94A3B8', font: { size: 11 }, callback: v => `${v}°C` }, min: 22, max: 31 },
    },
  };

  return (
    <div className="page">
      {/* Back */}
      <button className="back-link" onClick={() => navigate('/')}>
        <ArrowLeft size={14} /> All Rooms
      </button>

      {/* Room header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ background: color + '18', color, borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RoomIcon iconKey={iconKey} size={18} color={color} />
        </span>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>{room.name}</h1>
        <span className={`badge ${room.presence ? 'badge-occupied' : 'badge-empty'}`} style={{ fontSize: 11 }}>
          {room.presence ? 'OCCUPIED' : 'EMPTY'}
        </span>
        {(room._acOverride || room._lightOverride) && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', background: '#FFFBEB', color: '#92400E', borderRadius: 6, border: '1px solid #FDE68A' }}>
            Override Active
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ padding: '7px 10px' }} title="Room settings (coming soon)" onClick={() => navigate('/settings')}>
            <Settings size={14} strokeWidth={1.8} />
          </button>
          <button className="btn btn-outline" style={{ padding: '7px 10px' }} title="Alerts (coming soon)">
            <Bell size={14} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Top 3 stat cards */}
      <div className="detail-stat-grid">
        {/* Temperature */}
        <div className="detail-stat">
          <div className="detail-stat-label">Temperature</div>
          <div className={`detail-stat-value ${isHot ? '' : 'cool'}`}>{room.temperature}°C</div>
          <div className="detail-stat-sub" style={{ color: isHot ? '#DC2626' : '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
            {isHot ? '↗' : '↘'} 0.3°C vs last hour
          </div>
          <div style={{ marginTop: 12, opacity: .15 }}>
            <Thermometer size={52} strokeWidth={1.2} color={isHot ? '#DC2626' : '#3B82F6'} />
          </div>
        </div>

        {/* Occupancy */}
        <div className="detail-stat">
          <div className="detail-stat-label">Occupancy Status</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: room.presence ? '#10B981' : '#94A3B8', marginBottom: 4 }}>
            {room.presence ? 'Occupied' : 'Vacant'}
          </div>
          <div className="detail-stat-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} />
            {room.presence ? 'Presence detected' : 'No presence detected'}
          </div>
          <div style={{ marginTop: 12, opacity: room.presence ? .18 : .08 }}>
            {room.presence
              ? <User size={50} strokeWidth={1.2} color="#10B981" />
              : <UserX size={50} strokeWidth={1.2} color="#94A3B8" />}
          </div>
        </div>

        {/* Light Level */}
        <div className="detail-stat" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 16, right: 16 }}>
            <span style={{ padding: '3px 8px', background: '#FEF3C7', color: '#92400E', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
              {room.lightLevel < 150 ? 'Low' : room.lightLevel < 500 ? 'Medium' : 'High'}
            </span>
          </div>
          <div className="detail-stat-label">Light Level</div>
          <div className="detail-stat-value normal" style={{ color: room.lightLevel < 200 ? '#DC2626' : '#1E293B' }}>
            {room.lightLevel} <span style={{ fontSize: 16, fontWeight: 400 }}>lux</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="bar-track" style={{ height: 6 }}>
              <div className="bar-fill" style={{ width: `${Math.min(100, (room.lightLevel / 1000) * 100)}%`, background: room.lightLevel < 200 ? '#DC2626' : '#F59E0B' }} />
            </div>
          </div>
          <div style={{ marginTop: 12, opacity: .12 }}>
            {room.lightLevel > 300
              ? <Sun size={50} strokeWidth={1.2} color="#F59E0B" />
              : <Moon size={50} strokeWidth={1.2} color="#94A3B8" />}
          </div>
        </div>
      </div>

      {/* Device cards */}
      <div className="detail-devices">
        {/* AC */}
        <div className="device-card">
          <div className="device-card-header">
            <div>
              <div className="device-card-name">
                <Wind size={16} strokeWidth={1.8} color="#3B82F6" /> Air Conditioner
              </div>
              <span className={`state-badge ${room.acState.toLowerCase()}`}>{room.acState}</span>
              {room._acOverride && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '1px 6px', borderRadius: 4 }}>OVERRIDE</span>
              )}
            </div>
            <label className="toggle" title={room._acOverride ? 'Clear AC override' : 'Toggle AC override'}>
              <input
                type="checkbox"
                checked={room.acState !== 'OFF'}
                onChange={() => onOverride && onOverride(room.id, 'ac')}
              />
              <span className="slider" />
            </label>
          </div>
          <div className="device-params">
            <div className="param-box">
              <div className="param-label">COOL THRESHOLD</div>
              <div className="param-value">‹ {COOL_THRESH}°C</div>
            </div>
            <div className="param-box">
              <div className="param-label">HEAT THRESHOLD</div>
              <div className="param-value">› {HEAT_THRESH}°C</div>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">OPERATION MODE</label>
            <select className="form-select" defaultValue="Auto">
              <option>Auto</option><option>Manual</option><option>Eco</option><option>Turbo</option>
            </select>
          </div>
        </div>

        {/* Lighting */}
        <div className="device-card">
          <div className="device-card-header">
            <div>
              <div className="device-card-name">
                <Lightbulb size={16} strokeWidth={1.8} color={room.lightState === 'ON' ? '#F59E0B' : '#CBD5E1'} /> Smart Lighting
              </div>
              <span className={`state-badge ${room.lightState.toLowerCase()}`}>{room.lightState}</span>
              {room._lightOverride && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '1px 6px', borderRadius: 4 }}>OVERRIDE</span>
              )}
            </div>
            <label className="toggle" title={room._lightOverride ? 'Clear light override' : 'Toggle light override'}>
              <input
                type="checkbox"
                checked={room.lightState === 'ON'}
                onChange={() => onOverride && onOverride(room.id, 'light')}
              />
              <span className="slider" style={room.lightState === 'ON' ? { background: '#10B981' } : {}} />
            </label>
          </div>
          <div className="device-params">
            <div className="param-box" style={{ gridColumn: '1 / -1' }}>
              <div className="param-label">ACTIVATION THRESHOLD</div>
              <div className="param-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sun size={13} strokeWidth={2} color="#F59E0B" /> &lt; 300 lux
              </div>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">DIMMING MODE</label>
            <select className="form-select" defaultValue="Adaptive">
              <option>Adaptive</option><option>Fixed</option><option>Schedule</option>
            </select>
          </div>
        </div>
      </div>

      {/* Temperature History */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Temperature History (2hr)</span>
          <button className="btn-link" onClick={() => navigate('/analytics')}>View Report</button>
        </div>
        <div className="card-body" style={{ height: 240 }}>
          <Line data={lineData} options={lineOpts} />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Recent Activity</span>
          <button
            className="btn-link"
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={() => exportActivityLog(room.name, ACTIVITY_LOG)}
          >
            <Download size={13} /> Export Log
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>TIME</th><th>EVENT</th><th>SOURCE</th><th>VALUE</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVITY_LOG.map((ev, i) => (
                <tr key={i}>
                  <td style={{ color: '#3B82F6', fontWeight: 700, fontSize: 13 }}>{ev.time}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACTIVITY_COLORS[ev.type] || '#94A3B8', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{ev.event}</span>
                    </div>
                  </td>
                  <td style={{ color: '#3B82F6', fontWeight: 500 }}>{ev.source}</td>
                  <td style={{ fontWeight: 700, color: ev.value.includes('°') ? '#DC2626' : 'inherit' }}>{ev.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '14px', textAlign: 'center', borderTop: '1px solid #F1F5F9' }}>
          <button className="btn-link" style={{ color: '#64748B', fontSize: 12, letterSpacing: .5 }}>LOAD MORE EVENTS</button>
        </div>
      </div>
    </div>
  );
}
