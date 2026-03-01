import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AlertTriangle, Zap } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import RoomComparison from './pages/RoomComparison';
import EnergyAnalytics from './pages/EnergyAnalytics';
import SystemSettings from './pages/SystemSettings';
import RoomDetail from './pages/RoomDetail';
import { INITIAL_ROOMS, BASE_URL } from './data/mockData';

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

function simStep(room) {
  const now = new Date();
  const hh = now.getHours() + now.getMinutes() / 60;
  const daySine = Math.sin(Math.PI * ((hh - 6) / 18));
  const baseTempByRoom = { living_room: 29, bedroom: 27, kitchen: 30, study_room: 28 };
  const base = baseTempByRoom[room.id] ?? 28;
  const target = base + daySine * 4;
  const cooling = room.acState === 'COOLING' ? -0.3 : 0;
  const noise = (Math.random() - 0.5) * 0.4;
  const newTemp = Math.round((room.temperature * 0.85 + target * 0.15 + cooling + noise) * 10) / 10;
  const dayLight = Math.max(0, Math.round(900 * Math.max(0, daySine) + (Math.random() - 0.5) * 80));
  const lightLevel = room.presence && dayLight < LIGHT_THRESH
    ? Math.round(dayLight + Math.random() * 30)
    : dayLight;
  const occChance = hh >= 17 && hh <= 22 ? 0.85 : (hh >= 22 || hh < 6 ? 0.2 : 0.45);
  const presence = Math.random() < (room.presence ? 0.9 : occChance);
  const updated = { ...room, temperature: newTemp, lightLevel, presence };
  if (!room._acOverride) updated.acState = runACFSM(updated);
  if (!room._lightOverride) updated.lightState = runLightFSM(updated);
  updated.lightBrightness = updated.lightState === 'ON'
    ? Math.min(100, Math.round(100 - (lightLevel / LIGHT_THRESH) * 50))
    : 0;
  return updated;
}

// energyByRoom shape: { room_id: { ac, light, total } }
function mapRoom(r, energyByRoom = {}) {
  const energy24h = Math.round((energyByRoom[r.room_id]?.total ?? r.energy_24h ?? 0) * 1000) / 1000;
  const efficiency = r.efficiency ?? 75;
  return {
    id: r.room_id,
    name: r.name ?? r.room_id,
    temperature: r.temperature ?? 25,
    targetTemp: r.base_temp ?? 22,
    presence: Boolean(r.occupancy),          // backend returns 0/1 OR true/false
    lightLevel: r.light ?? 300,
    acState: r.ac_state ?? 'OFF',
    lightState: r.light_state ?? 'OFF',
    lightBrightness: r.light_on ? 80 : 0,
    energy24h,
    estimatedCost: energy24h * 68,           // NGN (tariff ₦68/kWh)
    efficiencyScore: efficiency,
    efficiencyLabel: efficiency >= 90 ? 'EXCELLENT' : efficiency >= 70 ? 'GOOD' : 'POOR',
    _acOverride: r.ac_override !== 'auto' && r.ac_override !== undefined,
    _lightOverride: r.light_override !== 'auto' && r.light_override !== undefined,
  };
}

async function fetchStatus() {
  const res = await fetch(`${BASE_URL}/api/status`);
  if (!res.ok) throw new Error('API offline');
  return res.json();
}

async function fetchEnergy() {
  try {
    const res = await fetch(`${BASE_URL}/api/energy`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function postTick(steps = 1) {
  const res = await fetch(`${BASE_URL}/api/tick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ steps }),
  });
  if (!res.ok) throw new Error('tick failed');
  return res.json();
}

async function postOverride(roomId, appliance, mode) {
  const res = await fetch(`${BASE_URL}/api/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room_id: roomId, appliance, mode }),
  });
  if (!res.ok) throw new Error('override failed');
  return res.json();
}

export default function App() {
  const [rooms, setRooms]       = useState(INITIAL_ROOMS);
  const [autoMode, setAutoMode] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [loading, setLoading]   = useState(true);
  const autoRef = useRef(autoMode);
  autoRef.current = autoMode;

  // Initial load
  useEffect(() => {
    Promise.all([fetchStatus(), fetchEnergy()])
      .then(([statusData, energyData]) => {
        if (statusData?.rooms) {
          const energyByRoom = energyData?.energy_by_room ?? {};
          setRooms(statusData.rooms.map(r => mapRoom(r, energyByRoom)));
          setApiOnline(true);
        }
      })
      .catch(() => setApiOnline(false))
      .finally(() => setLoading(false));
  }, []);

  // Reconnect loop — polls every 5 s while the banner is showing
  useEffect(() => {
    if (apiOnline || loading) return;
    const id = setInterval(() => {
      Promise.all([fetchStatus(), fetchEnergy()])
        .then(([statusData, energyData]) => {
          if (statusData?.rooms) {
            const energyByRoom = energyData?.energy_by_room ?? {};
            setRooms(statusData.rooms.map(r => mapRoom(r, energyByRoom)));
            setApiOnline(true);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [apiOnline, loading]);

  const tick = useCallback(async () => {
    if (apiOnline) {
      try {
        const [tickData, energyData] = await Promise.all([postTick(1), fetchEnergy()]);
        if (tickData?.state) {
          const energyByRoom = energyData?.energy_by_room ?? {};
          setRooms((prev) =>
            prev.map((room) => {
              const d = tickData.state[room.id];
              if (!d) return room;
              return mapRoom(d, energyByRoom);
            })
          );
        }
        return;
      } catch {
        setApiOnline(false);
      }
    }
    setRooms((prev) => prev.map(simStep));
  }, [apiOnline]);

  useEffect(() => {
    if (!autoMode) return;
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [autoMode, tick]);

  const handleOverride = useCallback(async (roomId, device) => {
    if (apiOnline) {
      try {
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return;
        let mode;
        if (device === 'ac') {
          mode = room._acOverride ? 'auto' : (room.acState === 'OFF' ? 'on' : 'off');
        } else {
          mode = room._lightOverride ? 'auto' : (room.lightState === 'ON' ? 'off' : 'on');
        }
        const updated = await postOverride(roomId, device === 'ac' ? 'ac' : 'light', mode);
        setRooms((prev) =>
          prev.map((r) =>
            r.id === roomId
              ? mapRoom({ ...updated, energy_24h: r.energy24h, efficiency: r.efficiencyScore })
              : r
          )
        );
        return;
      } catch {
        setApiOnline(false);
      }
    }
    setRooms((prev) =>
      prev.map((r) => {
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
      })
    );
  }, [rooms, apiOnline]);

  /* Loading screen while connecting */
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-inner">
          <div className="loading-pulse">
            <Zap size={32} color="#F59E0B" fill="#F59E0B" strokeWidth={2} />
          </div>
          <p>Starting SHEMS…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar apiOnline={apiOnline} />
      <div className="main">
        <Topbar onTick={tick} autoMode={autoMode} setAutoMode={setAutoMode} rooms={rooms} apiOnline={apiOnline} />
        {!apiOnline && (
          <div className="api-warn">
            <AlertTriangle size={13} strokeWidth={2} />
            Simulation mode — Flask backend not reachable at {BASE_URL}
          </div>
        )}
        <Routes>
          <Route path="/"           element={<Dashboard rooms={rooms} onOverride={handleOverride} />} />
          <Route path="/comparison" element={<RoomComparison rooms={rooms} />} />
          <Route path="/analytics"  element={<EnergyAnalytics rooms={rooms} />} />
          <Route path="/settings"   element={<SystemSettings rooms={rooms} apiOnline={apiOnline} baseUrl={BASE_URL} />} />
          <Route path="/room/:id"   element={<RoomDetail rooms={rooms} onOverride={handleOverride} apiOnline={apiOnline} baseUrl={BASE_URL} />} />
        </Routes>
      </div>
    </div>
  );
}
