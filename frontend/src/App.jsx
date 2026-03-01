import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import RoomComparison from './pages/RoomComparison';
import EnergyAnalytics from './pages/EnergyAnalytics';
import SystemSettings from './pages/SystemSettings';
import RoomDetail from './pages/RoomDetail';
import { INITIAL_ROOMS, BASE_URL } from './data/mockData';

/* ── FSM helpers (mirrors backend logic) ────────────────────────── */
const AC_COOL = 24, AC_HEAT = 28;
const LIGHT_THRESH = 300;

function runACFSM(room) {
  if (!room.presence) return 'OFF';
  if (room.acState === 'COOLING' && room.temperature >= AC_COOL) return 'COOLING';
  if (room.temperature >= AC_HEAT) return 'COOLING';
  return 'STANDBY';
}

function runLightFSM(room) {
  if (!room.presence) return 'OFF';
  return room.lightLevel < LIGHT_THRESH ? 'ON' : 'OFF';
}

/* ── Sensor simulation ──────────────────────────────────────────── */
function simStep(room) {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  const daySine = Math.sin(Math.PI * ((h - 6) / 18)); // peak at noon-ish

  // Temperature drift
  const baseTempByRoom = { living_room: 29, bedroom: 27, kitchen: 30, study: 28 };
  const base = baseTempByRoom[room.id] ?? 28;
  const target = base + daySine * 4;
  const cooling = room.acState === 'COOLING' ? -0.3 : 0;
  const noise = (Math.random() - 0.5) * 0.4;
  const newTemp = Math.round((room.temperature * 0.85 + target * 0.15 + cooling + noise) * 10) / 10;

  // Light level
  const dayLight = Math.max(0, Math.round(900 * Math.max(0, daySine) + (Math.random() - 0.5) * 80));
  const lightLevel = room.presence && dayLight < LIGHT_THRESH
    ? Math.round(dayLight + Math.random() * 30)
    : dayLight;

  // Occupancy: persist for a while, flip occasionally
  const occChance = (h >= 17 && h <= 22) ? 0.85 : (h >= 22 || h < 6) ? 0.2 : 0.45;
  const presence = Math.random() < (room.presence ? 0.9 : occChance);

  const updated = { ...room, temperature: newTemp, lightLevel, presence };

  // Run FSMs (unless overridden)
  if (!room._acOverride) updated.acState = runACFSM(updated);
  if (!room._lightOverride) updated.lightState = runLightFSM(updated);
  updated.lightBrightness = updated.lightState === 'ON' ? Math.min(100, Math.round(100 - (lightLevel / LIGHT_THRESH) * 50)) : 0;

  return updated;
}

/* ── API helpers ────────────────────────────────────────────────── */
async function fetchStatus() {
  const res = await fetch(`${BASE_URL}/api/status`);
  if (!res.ok) throw new Error('API offline');
  return res.json();
}

async function postTick(roomId) {
  const res = await fetch(`${BASE_URL}/api/tick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room_id: roomId }),
  });
  if (!res.ok) throw new Error('tick failed');
  return res.json();
}

/* ── Root App ────────────────────────────────────────────────────── */
export default function App() {
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [autoMode, setAutoMode] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const autoRef = useRef(autoMode);
  autoRef.current = autoMode;

  /* Try to pull live data from the Flask backend on mount */
  useEffect(() => {
    fetchStatus()
      .then(data => {
        if (data?.rooms) {
          setRooms(
            data.rooms.map(r => ({
              id: r.room_id?.toLowerCase().replace(/ /g, '_') ?? r.id,
              name: r.room_id ?? r.name,
              temperature: r.temperature ?? 25,
              targetTemp: 23,
              presence: r.pir === 1 || r.occupied === true,
              lightLevel: r.ldr ?? 300,
              acState: r.ac_state ?? 'OFF',
              lightState: r.light_state ?? 'OFF',
              lightBrightness: r.light_state === 'ON' ? 80 : 0,
              energy24h: r.energy_24h ?? 0,
              estimatedCost: (r.energy_24h ?? 0) * 0.2,
              efficiencyScore: r.efficiency ?? 75,
              efficiencyLabel: r.efficiency >= 90 ? 'EXCELLENT' : r.efficiency >= 70 ? 'GOOD' : 'POOR',
            }))
          );
          setApiOnline(true);
        }
      })
      .catch(() => setApiOnline(false));
  }, []);

  /* Auto-tick every 4 seconds when autoMode is on */
  useEffect(() => {
    if (!autoMode) return;
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [autoMode]); // eslint-disable-line

  const tick = useCallback(async () => {
    if (apiOnline) {
      // Try backend tick for each room
      try {
        const results = await Promise.all(
          rooms.map(r => postTick(r.name))
        );
        setRooms(prev => prev.map((room, i) => {
          const d = results[i];
          if (!d) return room;
          return {
            ...room,
            temperature: d.temperature ?? room.temperature,
            presence: d.pir === 1 || d.occupied === true,
            lightLevel: d.ldr ?? room.lightLevel,
            acState: d.ac_state ?? room.acState,
            lightState: d.light_state ?? room.lightState,
          };
        }));
        return;
      } catch {
        setApiOnline(false);
      }
    }
    // Fallback: local simulation
    setRooms(prev => prev.map(simStep));
  }, [rooms, apiOnline]);

  /* Manual override: toggle AC or light for a room */
  const handleOverride = useCallback((roomId, device) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== roomId) return r;
      if (device === 'ac') {
        const nextState = r.acState === 'OFF' ? 'STANDBY' : r.acState === 'STANDBY' ? 'COOLING' : 'OFF';
        return { ...r, acState: nextState, _acOverride: true };
      }
      if (device === 'light') {
        const nextState = r.lightState === 'ON' ? 'OFF' : 'ON';
        return { ...r, lightState: nextState, lightBrightness: nextState === 'ON' ? 80 : 0, _lightOverride: true };
      }
      return r;
    }));
  }, []);

  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <Topbar onTick={tick} autoMode={autoMode} setAutoMode={setAutoMode} />

        {/* API status bar */}
        {!apiOnline && (
          <div style={{
            background: '#FEF3C7', borderBottom: '1px solid #FDE68A',
            padding: '6px 24px', fontSize: 12, color: '#92400E', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <AlertTriangle size={13} strokeWidth={2} />
            Running in simulation mode — Flask backend not reachable at {BASE_URL}
          </div>
        )}

        <Routes>
          <Route path="/" element={<Dashboard rooms={rooms} onOverride={handleOverride} />} />
          <Route path="/comparison" element={<RoomComparison rooms={rooms} />} />
          <Route path="/analytics" element={<EnergyAnalytics rooms={rooms} />} />
          <Route path="/settings" element={<SystemSettings />} />
          <Route path="/room/:id" element={<RoomDetail rooms={rooms} />} />
        </Routes>
      </div>
    </div>
  );
}
