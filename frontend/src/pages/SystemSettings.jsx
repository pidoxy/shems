import { useState } from 'react';
import { Thermometer, Lightbulb, Zap, Home, Pencil, Ban, Check } from 'lucide-react';
import { ROOM_ICON_KEY } from '../data/mockData';
import RoomIcon from '../components/RoomIcon';

const DEFAULT_ROOMS = [
  { id: 'living_room', name: 'Living Room',    iconKey: 'sofa',       baseTemp: 24, acAuto: true,  lightsAuto: true  },
  { id: 'bedroom',     name: 'Master Bedroom', iconKey: 'bed',        baseTemp: 22, acAuto: true,  lightsAuto: false },
  { id: 'kitchen',     name: 'Kitchen',        iconKey: 'utensils',   baseTemp: 25, acAuto: false, lightsAuto: true  },
  { id: 'guest',       name: 'Guest Room',     iconKey: 'bed',        baseTemp: 24, acAuto: false, lightsAuto: false },
];

const ROOM_BG = {
  sofa:        '#EFF6FF',
  bed:         '#F5F3FF',
  utensils:    '#FFFBEB',
  'book-open': '#ECFDF5',
};
const ROOM_CLR = {
  sofa:        '#3B82F6',
  bed:         '#8B5CF6',
  utensils:    '#F59E0B',
  'book-open': '#10B981',
};

export default function SystemSettings() {
  const [acLow,      setAcLow]      = useState(24);
  const [acHigh,     setAcHigh]     = useState(28);
  const [minLight,   setMinLight]   = useState(300);
  const [tariffBand, setTariffBand] = useState('Band A (≥ 20 Hrs/day)');
  const [roomCfgs,   setRoomCfgs]   = useState(DEFAULT_ROOMS);
  const [saved,      setSaved]      = useState(false);
  const [editingId,  setEditingId]  = useState(null);

  const toggleAc    = id => setRoomCfgs(rs => rs.map(r => r.id === id ? { ...r, acAuto:    !r.acAuto    } : r));
  const toggleLight = id => setRoomCfgs(rs => rs.map(r => r.id === id ? { ...r, lightsAuto: !r.lightsAuto } : r));
  const handleSave  = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const lightPct = Math.round((minLight / 1000) * 100);

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>System Settings</h1>
          <p>Manage energy thresholds, device automation rules, and tariff configurations.</p>
        </div>
        <button className="btn btn-outline">Documentation</button>
      </div>

      {/* Top 3 cards */}
      <div className="settings-grid">

        {/* AC Control */}
        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-card-title">
              <Thermometer size={15} color="#EF4444" strokeWidth={2} /> AC Control
            </span>
            <span className="active-badge">Active</span>
          </div>
          <div className="form-group">
            <div className="dual-input">
              <div>
                <label className="form-label">LOWER LIMIT</label>
                <div className="unit-input">
                  <input type="number" className="form-input" value={acLow} min={16} max={acHigh - 1} onChange={e => setAcLow(+e.target.value)} />
                  <span className="unit-label">°C</span>
                </div>
              </div>
              <div>
                <label className="form-label">UPPER LIMIT</label>
                <div className="unit-input">
                  <input type="number" className="form-input" value={acHigh} min={acLow + 1} max={32} onChange={e => setAcHigh(+e.target.value)} />
                  <span className="unit-label">°C</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ margin: '8px 0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>
              <span>16°C</span><span>32°C</span>
            </div>
            <div style={{ position: 'relative', height: 6, borderRadius: 3, background: '#E2E8F0' }}>
              <div style={{ position: 'absolute', left: `${((acLow - 16) / 16) * 100}%`, right: `${100 - ((acHigh - 16) / 16) * 100}%`, height: '100%', background: '#BFDBFE', borderRadius: 3 }} />
              {[acLow, acHigh].map((v, i) => (
                <div key={i} style={{ position: 'absolute', left: `${((v - 16) / 16) * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 16, height: 16, borderRadius: '50%', background: '#3B82F6', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6, textAlign: 'center' }}>Drag handles to adjust comfort range.</div>
          <div style={{ marginTop: 10, display: 'flex', gap: '4%' }}>
            <input type="range" className="range-slider" min={16} max={32} value={acLow} onChange={e => setAcLow(Math.min(+e.target.value, acHigh - 1))} style={{ width: '48%' }} />
            <input type="range" className="range-slider" min={16} max={32} value={acHigh} onChange={e => setAcHigh(Math.max(+e.target.value, acLow + 1))} style={{ width: '48%' }} />
          </div>
        </div>

        {/* Lighting Control */}
        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-card-title">
              <Lightbulb size={15} color="#F59E0B" strokeWidth={2} /> Lighting Control
            </span>
            <span className="active-badge">Active</span>
          </div>
          <div className="form-group">
            <label className="form-label">MINIMUM LIGHT LEVEL</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="unit-input" style={{ flex: 1 }}>
                <input type="number" className="form-input" value={minLight} min={0} max={1000} step={50} onChange={e => setMinLight(+e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: '#F1F5F9', borderRadius: 8, fontSize: 12, color: '#64748B', fontWeight: 600, whiteSpace: 'nowrap' }}>
                lux &nbsp; Trigger Point
              </div>
            </div>
          </div>
          <div style={{ margin: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>
              <span style={{ fontWeight: 700 }}>Dark</span><span style={{ fontWeight: 700 }}>Bright</span>
            </div>
            <div className="light-gradient-bar" />
            <input type="range" className="range-slider" min={0} max={1000} value={minLight} onChange={e => setMinLight(+e.target.value)}
              style={{ width: '100%', background: `linear-gradient(to right, #1e293b ${lightPct}%, #F1F5F9 ${lightPct}%)` }} />
          </div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 8 }}>Lights turn on when ambient light drops below this level.</div>
        </div>

        {/* Tariff Config */}
        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-card-title">
              <Zap size={15} color="#F59E0B" fill="#F59E0B" /> Tariff Config
            </span>
          </div>
          <div className="form-group">
            <label className="form-label">Tariff Band</label>
            <select className="form-select" value={tariffBand} onChange={e => setTariffBand(e.target.value)}>
              <option>Band A (≥ 20 Hrs/day)</option>
              <option>Band B (≥ 16 Hrs/day)</option>
              <option>Band C (≥ 12 Hrs/day)</option>
              <option>Band D (≥ 8 Hrs/day)</option>
              <option>Band E (&lt; 8 Hrs/day)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Cost per Unit (kWh)</label>
            <div className="unit-input">
              <input type="text" className="form-input" defaultValue="₦  68.00" readOnly style={{ fontWeight: 700, fontSize: 18 }} />
              <span className="unit-label">NGN</span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Last updated: Today, 09:00 AM from utility provider.</div>
        </div>
      </div>

      {/* Room Configurations */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Home size={15} strokeWidth={2} /> Room Configurations
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Individual override settings for connected rooms.</div>
          </div>
          <button className="btn btn-primary" style={{ fontSize: 13 }}>+ Add Room</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ROOM NAME</th>
                <th>BASE TEMP</th>
                <th>AC AUTO</th>
                <th>LIGHTS AUTO</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {roomCfgs.map(room => (
                <tr key={room.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ background: ROOM_BG[room.iconKey] || '#F1F5F9', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <RoomIcon iconKey={room.iconKey} size={16} color={ROOM_CLR[room.iconKey] || '#64748B'} />
                      </span>
                      <span style={{ fontWeight: 600 }}>{room.name}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{room.baseTemp}°C</td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={room.acAuto} onChange={() => toggleAc(room.id)} />
                      <span className="slider" />
                    </label>
                  </td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={room.lightsAuto} onChange={() => toggleLight(room.id)} />
                      <span className="slider" />
                    </label>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <button className="btn-link" title="Edit" onClick={() => setEditingId(room.id === editingId ? null : room.id)}>
                        <Pencil size={14} strokeWidth={2} color="#64748B" />
                      </button>
                      <button className="btn-link" title="Disable">
                        <Ban size={14} strokeWidth={2} color="#CBD5E1" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 20px', fontSize: 12, color: '#94A3B8', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Showing {roomCfgs.length} of {roomCfgs.length} rooms</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 12 }}>‹</button>
            <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 12 }}>›</button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button className="btn btn-outline">Reset to Default</button>
        <button className="btn btn-primary" onClick={handleSave} style={{ background: saved ? '#10B981' : undefined, minWidth: 130, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          {saved ? <><Check size={14} /> Saved!</> : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
