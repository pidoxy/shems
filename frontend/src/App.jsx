import { useState, useEffect, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AlertTriangle, Zap, Wifi } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import RoomComparison from './pages/RoomComparison';
import EnergyAnalytics from './pages/EnergyAnalytics';
import SystemSettings from './pages/SystemSettings';
import RoomDetail from './pages/RoomDetail';
import { INITIAL_ROOMS, BASE_URL, ESP32_URL } from './data/mockData';

// ── FSM Thresholds (same as Arduino) ─────────────────────────
const AC_COOL = 24, AC_HEAT = 28;
const LIGHT_THRESH = 300;  // raw LDR scale (0–1023)

// ── FSM Logic (runs client-side on live hardware data) ───────
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

// ── Simulation step (fallback when ESP32 is offline) ─────────
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

// ── Map Flask backend response → internal room shape ─────────
function mapRoom(r, energyByRoom = {}) {
  const energy24h = Math.round((energyByRoom[r.room_id]?.total ?? r.energy_24h ?? 0) * 1000) / 1000;
  const efficiency = r.efficiency ?? 75;
  return {
    id: r.room_id,
    name: r.name ?? r.room_id,
    temperature: r.temperature ?? 25,
    targetTemp: r.base_temp ?? 22,
    presence: Boolean(r.occupancy),
    lightLevel: r.light ?? 300,
    acState: r.ac_state ?? 'OFF',
    lightState: r.light_state ?? 'OFF',
    lightBrightness: r.light_on ? 80 : 0,
    energy24h,
    estimatedCost: energy24h * 68,
    efficiencyScore: efficiency,
    efficiencyLabel: efficiency >= 90 ? 'EXCELLENT' : efficiency >= 70 ? 'GOOD' : 'POOR',
    _acOverride: r.ac_override !== 'auto' && r.ac_override !== undefined,
    _lightOverride: r.light_override !== 'auto' && r.light_override !== undefined,
  };
}

// ── Map ESP32 /api/sensors response → internal room shape ────
// ESP32 returns: { tempC, lightPct (0-100), motion (bool), redLed, ylwLed, ... }
// We map it to the same shape the dashboard expects for "living_room"
function mapESP32ToRoom(esp, prevRoom) {
  const temperature = esp.tempC ?? 25;
  const presence = Boolean(esp.motion);
  // Convert lightPct (0–100%) → raw LDR scale (0–1023) for FSM compatibility
  const lightLevel = Math.round((esp.lightPct / 100) * 1023);

  const room = {
    ...prevRoom,
    temperature,
    presence,
    lightLevel,
    // Extra hardware info from ESP32
    _tempOk: esp.tempOk ?? true,
    _redLed: esp.redLed ?? false,
    _ylwLed: esp.ylwLed ?? false,
    _motionCount: esp.motionCount ?? 0,
    _uptime: esp.uptime ?? 0,
  };

  // Run FSM on live data (unless manually overridden)
  if (!room._acOverride) room.acState = runACFSM(room);
  if (!room._lightOverride) room.lightState = runLightFSM(room);
  room.lightBrightness = room.lightState === 'ON'
    ? Math.min(100, Math.round(100 - (lightLevel / LIGHT_THRESH) * 50))
    : 0;

  return room;
}

// ── ESP32 fetch helper ───────────────────────────────────────
async function fetchESP32Sensors() {
  const res = await fetch(`${ESP32_URL}/api/sensors`);
  if (!res.ok) throw new Error('ESP32 offline');
  return res.json();
}

async function fetchESP32Status() {
  const res = await fetch(`${ESP32_URL}/api/status`);
  if (!res.ok) throw new Error('ESP32 status offline');
  return res.json();
}

// ── Flask backend fetch helpers (for simulated rooms) ────────
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

// ══════════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [rooms, setRooms]               = useState(INITIAL_ROOMS);
  const [autoMode, setAutoMode]         = useState(false);
  const [apiOnline, setApiOnline]       = useState(false);   // Flask backend
  const [espOnline, setEspOnline]       = useState(false);   // ESP32 hardware
  const [espStatus, setEspStatus]       = useState(null);    // ESP32 board info
  const [loading, setLoading]           = useState(true);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  // ── Initial load: try ESP32 first, then Flask backend ──────
  useEffect(() => {
    async function init() {
      // 1) Try ESP32 hardware (for living_room)
      let espOk = false;
      try {
        const [espData, espStat] = await Promise.all([fetchESP32Sensors(), fetchESP32Status()]);
        setEspStatus(espStat);
        setRooms(prev => prev.map(room =>
          room.id === 'living_room' ? mapESP32ToRoom(espData, room) : room
        ));
        setEspOnline(true);
        espOk = true;
      } catch {
        setEspOnline(false);
      }

      // 2) Try Flask backend (for simulated rooms)
      try {
        const [statusData, energyData] = await Promise.all([fetchStatus(), fetchEnergy()]);
        if (statusData?.rooms) {
          const energyByRoom = energyData?.energy_by_room ?? {};
          setRooms(prev => {
            const mapped = statusData.rooms.map(r => mapRoom(r, energyByRoom));
            // If ESP32 is live, keep living_room from hardware, use Flask for the rest
            if (espOk) {
              const espLivingRoom = prev.find(r => r.id === 'living_room');
              return mapped.map(r => r.id === 'living_room' && espLivingRoom ? espLivingRoom : r);
            }
            return mapped;
          });
          setApiOnline(true);
        }
      } catch {
        setApiOnline(false);
      }

      setLoading(false);
    }
    init();
  }, []);

  // ── ESP32 live polling: fetch hardware sensors every 2s ────
  useEffect(() => {
    if (!espOnline) return;
    const id = setInterval(async () => {
      try {
        const espData = await fetchESP32Sensors();
        setRooms(prev => prev.map(room =>
          room.id === 'living_room' ? mapESP32ToRoom(espData, room) : room
        ));
      } catch {
        setEspOnline(false);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [espOnline]);

  // ── ESP32 reconnect: try to reconnect every 5s when offline ──
  useEffect(() => {
    if (espOnline || loading) return;
    const id = setInterval(async () => {
      try {
        const [espData, espStat] = await Promise.all([fetchESP32Sensors(), fetchESP32Status()]);
        setEspStatus(espStat);
        setRooms(prev => prev.map(room =>
          room.id === 'living_room' ? mapESP32ToRoom(espData, room) : room
        ));
        setEspOnline(true);
      } catch { /* still offline */ }
    }, 5000);
    return () => clearInterval(id);
  }, [espOnline, loading]);

  // ── Flask reconnect loop (for simulated rooms) ─────────────
  useEffect(() => {
    if (apiOnline || loading) return;
    const id = setInterval(() => {
      Promise.all([fetchStatus(), fetchEnergy()])
        .then(([statusData, energyData]) => {
          if (statusData?.rooms) {
            const energyByRoom = energyData?.energy_by_room ?? {};
            setRooms(prev => {
              const mapped = statusData.rooms.map(r => mapRoom(r, energyByRoom));
              if (espOnline) {
                const espLivingRoom = prev.find(r => r.id === 'living_room');
                return mapped.map(r => r.id === 'living_room' && espLivingRoom ? espLivingRoom : r);
              }
              return mapped;
            });
            setApiOnline(true);
          }
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [apiOnline, loading, espOnline]);

  // ── Tick (advance simulation for non-hardware rooms) ───────
  const tick = useCallback(async () => {
    if (apiOnline) {
      try {
        const [tickData, energyData] = await Promise.all([postTick(1), fetchEnergy()]);
        if (tickData?.state) {
          const energyByRoom = energyData?.energy_by_room ?? {};
          setRooms((prev) =>
            prev.map((room) => {
              // living_room is driven by ESP32 hardware, skip Flask tick for it
              if (room.id === 'living_room' && espOnline) return room;
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
    // Fallback: client-side sim for non-ESP32 rooms
    setRooms((prev) => prev.map(room => {
      if (room.id === 'living_room' && espOnline) return room;
      return simStep(room);
    }));
  }, [apiOnline, espOnline]);

  useEffect(() => {
    if (!autoMode) return;
    const id = setInterval(tick, 4000);
    return () => clearInterval(id);
  }, [autoMode, tick]);

  // ── Override handler ───────────────────────────────────────
  const handleOverride = useCallback(async (roomId, device) => {
    // For living_room on ESP32: toggle FSM override locally
    if (roomId === 'living_room' && espOnline) {
      setRooms(prev => prev.map(r => {
        if (r.id !== roomId) return r;
        if (device === 'ac') {
          const isOverriding = !r._acOverride;
          const nextState = isOverriding
            ? (r.acState === 'COOLING' ? 'OFF' : 'COOLING')
            : runACFSM(r);
          return { ...r, acState: nextState, _acOverride: isOverriding };
        }
        if (device === 'light') {
          const isOverriding = !r._lightOverride;
          const nextState = isOverriding
            ? (r.lightState === 'ON' ? 'OFF' : 'ON')
            : runLightFSM(r);
          return {
            ...r,
            lightState: nextState,
            lightBrightness: nextState === 'ON' ? 80 : 0,
            _lightOverride: isOverriding,
          };
        }
        return r;
      }));
      return;
    }

    // For Flask-backed rooms
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
  }, [rooms, apiOnline, espOnline]);

  /* Loading screen while connecting */
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-inner">
          <div className="loading-pulse">
            <Zap size={32} color="#F59E0B" fill="#F59E0B" strokeWidth={2} />
          </div>
          <p>Connecting to SHEMS hardware…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="layout">
      <Sidebar apiOnline={apiOnline} espOnline={espOnline} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main">
        <Topbar
          onTick={tick}
          autoMode={autoMode}
          setAutoMode={setAutoMode}
          rooms={rooms}
          apiOnline={apiOnline}
          espOnline={espOnline}
          espStatus={espStatus}
          onMenuClick={() => setSidebarOpen(v => !v)}
          sidebarOpen={sidebarOpen}
        />
        {espOnline && (
          <div className="esp-live-banner">
            <Wifi size={13} strokeWidth={2} />
            Live hardware — ESP32 connected at {ESP32_URL.replace('https://', '')}
            {espStatus?.uptime != null && ` · Uptime ${Math.floor(espStatus.uptime / 60)}m`}
          </div>
        )}
        {!apiOnline && !espOnline && (
          <div className="api-warn">
            <AlertTriangle size={13} strokeWidth={2} />
            Simulation mode — No hardware or backend reachable
          </div>
        )}
        {!apiOnline && espOnline && (
          <div className="api-warn" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B' }}>
            <AlertTriangle size={13} strokeWidth={2} />
            Flask backend offline — Rooms 2-4 running in simulation mode
          </div>
        )}
        <Routes>
          <Route path="/"           element={<Dashboard rooms={rooms} onOverride={handleOverride} espOnline={espOnline} />} />
          <Route path="/comparison" element={<RoomComparison rooms={rooms} />} />
          <Route path="/analytics"  element={<EnergyAnalytics rooms={rooms} />} />
          <Route path="/settings"   element={<SystemSettings rooms={rooms} apiOnline={apiOnline} baseUrl={BASE_URL} espUrl={ESP32_URL} espOnline={espOnline} />} />
          <Route path="/room/:id"   element={<RoomDetail rooms={rooms} onOverride={handleOverride} apiOnline={apiOnline} baseUrl={BASE_URL} espOnline={espOnline} />} />
        </Routes>
      </div>
    </div>
  );
}
