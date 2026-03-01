import { useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Sun, Moon, Download } from 'lucide-react';
import { ROOM_COLORS, generate24hTempData } from '../data/mockData';
import ScoreRing from '../components/ScoreRing';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const SCORE_COLORS = { EXCELLENT: '#10B981', GOOD: '#3B82F6', POOR: '#EF4444' };

const ROOM_KEYS = ['Living Room', 'Kitchen', 'Bedroom', 'Study Room'];
const ROOM_KEY_MAP = { 'Living Room': 'Living Room', 'Kitchen': 'Kitchen', 'Bedroom': 'Bedroom', 'Study Room': 'Study' };

const { labels, datasets } = generate24hTempData();

// Thin out to every 4th label for readability
const sparseLabels = labels.filter((_, i) => i % 4 === 0);

export default function RoomComparison({ rooms }) {
  const [activeRooms, setActiveRooms] = useState(new Set(ROOM_KEYS));

  const toggleRoom = r => setActiveRooms(prev => {
    const s = new Set(prev);
    if (s.has(r)) { if (s.size > 1) s.delete(r); } else s.add(r);
    return s;
  });

  const maxEnergy = Math.max(...rooms.map(r => r.energy24h));

  const lineData = {
    labels: sparseLabels,
    datasets: [
      ...(activeRooms.has('Living Room') ? [{
        label: 'Living',
        data: datasets['Living Room'].filter((_, i) => i % 4 === 0),
        borderColor: ROOM_COLORS['Living Room'],
        backgroundColor: ROOM_COLORS['Living Room'] + '18',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: false,
      }] : []),
      ...(activeRooms.has('Kitchen') ? [{
        label: 'Kitchen',
        data: datasets['Kitchen'].filter((_, i) => i % 4 === 0),
        borderColor: ROOM_COLORS['Kitchen'],
        backgroundColor: ROOM_COLORS['Kitchen'] + '18',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        borderDash: [6, 3],
        fill: false,
      }] : []),
      ...(activeRooms.has('Bedroom') ? [{
        label: 'Bed',
        data: datasets['Bedroom'].filter((_, i) => i % 4 === 0),
        borderColor: ROOM_COLORS['Bedroom'],
        backgroundColor: ROOM_COLORS['Bedroom'] + '18',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: false,
      }] : []),
      ...(activeRooms.has('Study Room') ? [{
        label: 'Study',
        data: datasets['Study'].filter((_, i) => i % 4 === 0),
        borderColor: ROOM_COLORS['Study Room'],
        backgroundColor: ROOM_COLORS['Study Room'] + '18',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: false,
      }] : []),
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: { grid: { color: '#F1F5F9' }, ticks: { color: '#94A3B8', font: { size: 11 } } },
      y: {
        grid: { color: '#F1F5F9' },
        ticks: { color: '#94A3B8', font: { size: 11 }, callback: v => `${v}°` },
        min: 15, max: 35,
      },
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Room Comparison</h1>
          <p>Real-time monitoring and historical analysis across zones.</p>
        </div>
        <div className="chip-tabs">
          {ROOM_KEYS.map(r => (
            <button
              key={r}
              className={`chip${activeRooms.has(r) ? ' active' : ''}`}
              onClick={() => toggleRoom(r)}
              style={activeRooms.has(r) ? { borderColor: ROOM_COLORS[r], background: ROOM_COLORS[r] + '18', color: ROOM_COLORS[r] } : {}}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROOM_COLORS[r], display: 'inline-block' }} />
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Live Metrics Table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Live Metrics</span>
          <button className="btn-link" style={{ display:'flex', alignItems:'center', gap:5 }}>
            <Download size={13} /> Export CSV
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ROOM NAME</th>
                <th>TEMPERATURE</th>
                <th>OCCUPANCY</th>
                <th>AC STATE</th>
                <th>LIGHT LEVEL</th>
                <th>ENERGY (24H)</th>
                <th>EST. COST</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map(room => {
                const color = ROOM_COLORS[room.name] || '#64748B';
                const aboveTarget = room.temperature > room.targetTemp + 1;
                return (
                  <tr key={room.id}>
                    <td>
                      <div className="room-dot">
                        <div className="dot" style={{ background: color }} />
                        {room.name}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: aboveTarget ? '#DC2626' : 'inherit' }}>
                          {room.temperature}°C {aboveTarget && <span style={{ color: '#DC2626' }}>▲</span>}
                        </span>
                        {aboveTarget
                          ? <span style={{ fontSize: 11, color: '#DC2626' }}>Above Target {room.targetTemp}°</span>
                          : <span style={{ fontSize: 11, color: '#94A3B8' }}>Target {room.targetTemp}°</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${room.presence ? 'badge-occupied' : 'badge-empty'}`}>
                        <span style={{ width:6, height:6, borderRadius:'50%', background: room.presence ? '#10B981' : '#94A3B8', display:'inline-block', marginRight:5 }} />
                        {room.presence ? 'Occupied' : 'Vacant'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{room.acState}</div>
                      {room.acState === 'COOLING' && <div style={{ fontSize: 11, color: '#94A3B8' }}>Fan: Auto</div>}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, display:'flex', alignItems:'center', gap:5 }}>
                        {room.lightLevel > 300
                          ? <Sun size={13} strokeWidth={2} color="#F59E0B" />
                          : <Moon size={13} strokeWidth={2} color="#94A3B8" />}
                        {room.lightLevel} lux
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: room.energy24h === Math.max(...rooms.map(r => r.energy24h)) ? '#DC2626' : 'inherit',
                      }}>
                        {room.energy24h.toFixed(3)} kWh
                      </span>
                      {room.energy24h === Math.max(...rooms.map(r => r.energy24h)) && (
                        <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 700 }}>Peak Usage</div>
                      )}
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 800,
                        color: room.energy24h === Math.max(...rooms.map(r => r.energy24h)) ? '#DC2626' : 'inherit',
                      }}>
                        ₦{Math.round(room.estimatedCost).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts row */}
      <div className="two-col" style={{ marginBottom: 20 }}>
        {/* Temperature trend */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">24h Temperature Trend</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              {[['Living', ROOM_COLORS['Living Room']], ['Kitchen', ROOM_COLORS['Kitchen']], ['Bed', ROOM_COLORS['Bedroom']], ['Study', ROOM_COLORS['Study Room']]].map(([l, c]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div className="card-body" style={{ height: 260 }}>
            <Line data={lineData} options={lineOptions} />
          </div>
        </div>

        {/* Total consumption */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Total Consumption</span>
          </div>
          <div className="card-body">
            {[...rooms].sort((a, b) => b.energy24h - a.energy24h).map(room => {
              const color = ROOM_COLORS[room.name] || '#64748B';
              const pct = (room.energy24h / maxEnergy) * 100;
              return (
                <div key={room.id} className="cons-item">
                  <div className="cons-header">
                    <span style={{ fontWeight: 600 }}>{room.name}</span>
                    <span style={{ fontWeight: 700 }}>{room.energy24h.toFixed(3)} kWh</span>
                  </div>
                  <div className="bar-track">
                    <div className="cons-bar bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 16, fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
              Daily average: {(rooms.reduce((s, r) => s + r.energy24h, 0) / rooms.length).toFixed(1)} kWh
            </div>
          </div>
        </div>
      </div>

      {/* Efficiency scores */}
      <div className="score-grid">
        {rooms.map(room => {
          const color = SCORE_COLORS[room.efficiencyLabel] || '#94A3B8';
          return (
            <div key={room.id} className="score-card">
              <ScoreRing score={room.efficiencyScore} color={color} size={68} />
              <div className="score-info">
                <div className="score-room">{room.name}</div>
                <div className="score-sub">Efficiency Score</div>
                <div className={`score-label ${room.efficiencyLabel.toLowerCase()}`}>
                  {room.efficiencyLabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
