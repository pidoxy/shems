import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const AC_COOL = 24, AC_HEAT = 28;
const LIGHT_THRESH = 300;
const h = React.createElement;

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

/** Maps a backend room_status object to the frontend room shape.
 *  Key field corrections vs original code:
 *    r.occupancy  (was: r.pir / r.occupied)
 *    r.light      (was: r.ldr)
 *    r.name       (was: r.room_id for display name)
 */
function mapRoom(r) {
  const energy24h = r.energy_24h ?? 0;
  const efficiency = r.efficiency ?? 75;
  return {
    id: r.room_id,
    name: r.name ?? r.room_id,
    temperature: r.temperature ?? 25,
    targetTemp: r.base_temp ?? 22,
    presence: r.occupancy === true,
    lightLevel: r.light ?? 300,
    acState: r.ac_state ?? 'OFF',
    lightState: r.light_state ?? 'OFF',
    lightBrightness: r.light_on ? 80 : 0,
    energy24h,
    estimatedCost: energy24h * 0.2,
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
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [autoMode, setAutoMode] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const autoRef = useRef(autoMode);
  autoRef.current = autoMode;

  useEffect(() => {
    fetchStatus()
      .then((data) => {
        if (data?.rooms) {
          setRooms(data.rooms.map(mapRoom));
          setApiOnline(true);
        }
      })
      .catch(() => setApiOnline(false));
  }, []);

  const tick = useCallback(async () => {
    if (apiOnline) {
      try {
        const data = await postTick(1);
        if (data?.state) {
          setRooms((prev) =>
            prev.map((room) => {
              const d = data.state[room.id];
              if (!d) return room;
              return mapRoom({ ...d, energy_24h: room.energy24h, efficiency: room.efficiencyScore });
            })
          );
        }
        return;
      } catch {
        setApiOnline(false);
      }
    }
    setRooms((prev) => prev.map(simStep));
  }, [rooms, apiOnline]);

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

  return h('div', { className: 'layout' },
    h(Sidebar, null),
    h('div', { className: 'main' },
      h(Topbar, { onTick: tick, autoMode, setAutoMode }),
      !apiOnline && h('div', { className: 'api-warn' },
        h(AlertTriangle, { size: 13 }),
        `Running in simulation mode \u2014 Flask backend not reachable at ${BASE_URL}`
      ),
      h('div', { className: 'page' },
        h(Routes, null,
          h(Route, { path: '/', element: h(Dashboard, { rooms, onOverride: handleOverride }) }),
          h(Route, { path: '/comparison', element: h(RoomComparison, { rooms }) }),
          h(Route, { path: '/analytics', element: h(EnergyAnalytics, { rooms }) }),
          h(Route, { path: '/settings', element: h(SystemSettings, { rooms, apiOnline, baseUrl: BASE_URL }) }),
          h(Route, { path: '/room/:id', element: h(RoomDetail, { rooms, onOverride: handleOverride, apiOnline, baseUrl: BASE_URL }) })
        )
      )
    )
  );
}
