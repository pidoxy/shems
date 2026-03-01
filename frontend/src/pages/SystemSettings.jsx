import { useState, useEffect } from 'react';
import { Thermometer, Lightbulb, Zap, Home, Pencil, Ban, Check } from 'lucide-react';
import { ROOM_ICON_KEY } from '../data/mockData';
import RoomIcon from '../components/RoomIcon';

const DEFAULT_ROOMS = [
  { id: 'living_room', name: 'Living Room',  iconKey: 'sofa',      baseTemp: 24, acAuto: true,  lightsAuto: true  },
  { id: 'bedroom',     name: 'Bedroom',       iconKey: 'bed',       baseTemp: 22, acAuto: true,  lightsAuto: false },
  { id: 'kitchen',     name: 'Kitchen',       iconKey: 'utensils',  baseTemp: 25, acAuto: false, lightsAuto: true  },
  { id: 'study_room',  name: 'Study Room',    iconKey: 'book-open', baseTemp: 24, acAuto: false, lightsAuto: false },
];

const ROOM_BG  = { sofa: '#EFF6FF', bed: '#F5F3FF', utensils: '#FFFBEB', 'book-open': '#ECFDF5' };
const ROOM_CLR = { sofa: '#3B82F6', bed: '#8B5CF6', utensils: '#F59E0B', 'book-open': '#10B981' };

export default function SystemSettings({ apiOnline, baseUrl }) {
  const [acLow,      setAcLow]      = useState(24);
  const [acHigh,     setAcHigh]     = useState(28);
  const [minLight,   setMinLight]   = useState(300);
  const [tariffBand, setTariffBand] = useState('Band A (≥ 20 Hrs/day)');
  const [tariffRate, setTariffRate] = useState(68);
  const [roomCfgs,   setRoomCfgs]   = useState(DEFAULT_ROOMS);
  const [saved,      setSaved]      = useState(false);
  const [editingId,  setEditingId]  = useState(null);

  // Load settings + room configs from backend on mount (when connected)
  useEffect(() => {
    if (!apiOnline || !baseUrl) return;

    fetch(`${baseUrl}/api/settings`)
      .then(r => r.json())
      .then(d => {
        if (d.ac_lower_threshold !== undefined) setAcLow(d.ac_lower_threshold);
        if (d.ac_upper_threshold !== undefined) setAcHigh(d.ac_upper_threshold);
        if (d.light_threshold    !== undefined) setMinLight(d.light_threshold);
        if (d.tariff_ngn_per_kwh !== undefined) setTariffRate(d.tariff_ngn_per_kwh);
      })
      .catch(() => {});

    fetch(`${baseUrl}/api/rooms/config`)
      .then(r => r.json())
      .then(d => {
        if (d.rooms) {
          setRoomCfgs(d.rooms.map(r => ({
            id:         r.room_id,
            name:       r.name,
            iconKey:    ROOM_ICON_KEY[r.name] ?? 'sofa',
            baseTemp:   r.base_temp,
            acAuto:     r.ac_auto,
            lightsAuto: r.light_auto,
          })));
        }
      })
      .catch(() => {});
  }, [apiOnline, baseUrl]);

  // Toggle AC auto — optimistic update + immediate POST when connected
  const toggleAc = (id) => {
    setRoomCfgs(rs => rs.map(r => r.id === id ? { ...r, acAuto: !r.acAuto } : r));
    if (apiOnline && baseUrl) {
      const room = roomCfgs.find(r => r.id === id);
      if (room) {
        fetch(`${baseUrl}/api/rooms/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_id: id, ac_auto: !room.acAuto }),
        }).catch(() => {});
      }
    }
  };

  // Toggle Lights auto — optimistic update + immediate POST when connected
  const toggleLight = (id) => {
    setRoomCfgs(rs => rs.map(r => r.id === id ? { ...r, lightsAuto: !r.lightsAuto } : r));
    if (apiOnline && baseUrl) {
      const room = roomCfgs.find(r => r.id === id);
      if (room) {
        fetch(`${baseUrl}/api/rooms/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_id: id, light_auto: !room.lightsAuto }),
        }).catch(() => {});
      }
    }
  };

  // Save global settings to backend
  const handleSave = async () => {
    if (apiOnline && baseUrl) {
      try {
        await fetch(`${baseUrl}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ac_lower_threshold: acLow,
            ac_upper_threshold: acHigh,
            light_threshold:    minLight,
            tariff_ngn_per_kwh: tariffRate,
          }),
        });
      } catch (_) {}
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const lightPct = Math.round(minLight / 1023 * 100);

  return (
    <div className="page">
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>System Settings</h1>
          <p>Manage energy thresholds, device automation rules, and tariff configurations.</p>
        </div>
        <button className="btn btn-outline">Documentation</button>
      </div>

      {/* Settings cards */}
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
                  <input type="number" className="form-input" value={acLow} min={16} max={acHigh - 1}
                    onChange={e => setAcLow(+e.target.value)} />
                  <span className="unit-label">°C</span>
                </div>
              </div>
              <div>
                <label className="form-label">UPPER LIMIT</label>
                <div className="unit-input">
                  <input type="number" className="form-input" value={acHigh} min={acLow + 1} max={32}
                    onChange={e => setAcHigh(+e.target.value)} />
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
              <div style={{ position: 'absolute', left: `${(acLow - 16) / 16 * 100}%`, right: `${100 - (acHigh - 16) / 16 * 100}%`, height: '100%', background: '#BFDBFE', borderRadius: 3 }} />
              {[acLow, acHigh].map((v, i) => (
                <div key={i} style={{ position: 'absolute', left: `${(v - 16) / 16 * 100}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 16, height: 16, borderRadius: '50%', background: '#3B82F6', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
              ))}
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>Drag handles to adjust comfort range.</p>
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
            <div className="unit-input">
              <input type="number" className="form-input" value={minLight} min={0} max={1023}
                onChange={e => setMinLight(+e.target.value)} />
              <span className="unit-label">lux</span>
              <span style={{ marginLeft: 6, fontSize: 11, color: '#64748B' }}>Trigger Point</span>
            </div>
          </div>
          <div style={{ margin: '10px 0 4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>
              <span>Dark</span><span>Bright</span>
            </div>
            <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'linear-gradient(to right,#1E293B,#FEF9C3)' }}>
              <div style={{ position: 'absolute', left: `${lightPct}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 16, height: 16, borderRadius: '50%', background: '#F59E0B', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>Lights turn on when ambient light drops below this level.</p>
        </div>

        {/* Tariff Config */}
        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-card-title">
              <Zap size={15} color="#F59E0B" strokeWidth={2} /> Tariff Config
            </span>
          </div>
          <div className="form-group">
            <label className="form-label">TARIFF BAND</label>
            <select className="form-select" value={tariffBand} onChange={e => setTariffBand(e.target.value)}>
              <option>Band A (≥ 20 Hrs/day)</option>
              <option>Band B (16–20 Hrs/day)</option>
              <option>Band C (12–16 Hrs/day)</option>
              <option>Band D (8–12 Hrs/day)</option>
              <option>Band E (&lt; 8 Hrs/day)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">COST PER UNIT (KWH)</label>
            <div className="unit-input">
              <span className="unit-label" style={{ marginRight: 4 }}>₦</span>
              <input type="number" className="form-input" value={tariffRate} min={1} step={0.5}
                onChange={e => setTariffRate(+e.target.value)} style={{ flex: 1 }} />
              <span className="unit-label">NGN</span>
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
            Last updated: Today, 09:00 AM from utility provider.
          </p>
        </div>
      </div>

      {/* Room Configurations */}
      <div className="settings-card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div className="settings-card-title" style={{ marginBottom: 2 }}>
              <Home size={15} color="#6366F1" strokeWidth={2} /> Room Configurations
            </div>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Individual override settings for connected rooms.</p>
          </div>
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>+ Add Room</button>
        </div>
        <table className="room-config-table">
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
            {roomCfgs.map(r => {
              const bg  = ROOM_BG[r.iconKey]  ?? '#F8FAFC';
              const clr = ROOM_CLR[r.iconKey] ?? '#64748B';
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: bg }}>
                        <RoomIcon iconKey={r.iconKey} size={14} color={clr} />
                      </span>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{r.name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 14, color: '#374151' }}>{r.baseTemp}°C</td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={r.acAuto} onChange={() => toggleAc(r.id)} />
                      <span className="slider" />
                    </label>
                  </td>
                  <td>
                    <label className="toggle">
                      <input type="checkbox" checked={r.lightsAuto} onChange={() => toggleLight(r.id)} />
                      <span className="slider" />
                    </label>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="icon-btn" title="Edit" onClick={() => setEditingId(r.id)}>
                        <Pencil size={13} />
                      </button>
                      <button className="icon-btn icon-btn-danger" title="Remove">
                        <Ban size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 8, fontSize: 12, color: '#94A3B8' }}>Showing {roomCfgs.length} of {roomCfgs.length} rooms</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
          <button className="btn btn-sm" style={{ fontSize: 12 }}>‹</button>
          <button className="btn btn-sm" style={{ fontSize: 12 }}>›</button>
        </div>
      </div>

      {/* Footer actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
        <button className="btn btn-outline" onClick={() => {
          setAcLow(24); setAcHigh(28); setMinLight(300); setTariffRate(68);
          setRoomCfgs(DEFAULT_ROOMS);
        }}>Reset to Default</button>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <><Check size={14} /> Saved!</> : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
