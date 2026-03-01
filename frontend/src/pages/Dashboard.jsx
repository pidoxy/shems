import { useNavigate } from 'react-router-dom';
import {
  Thermometer, User, UserX, Sun, Moon,
  Wind, Lightbulb, LampDesk,
} from 'lucide-react';
import { ROOM_COLORS, ROOM_ICON_KEY } from '../data/mockData';
import RoomIcon from '../components/RoomIcon';

function tempClass(t) {
  if (t >= 30) return 'hot';
  if (t >= 27) return 'warm';
  if (t <= 22) return 'cool';
  return 'normal';
}

function lightName(roomName) {
  if (roomName === 'Kitchen')    return 'Pendant Lights';
  if (roomName === 'Study Room') return 'Desk Lamp';
  return 'Main Lights';
}

function LightIcon({ roomName, size = 16 }) {
  if (roomName === 'Study Room') return <LampDesk size={size} strokeWidth={1.8} />;
  return <Lightbulb size={size} strokeWidth={1.8} />;
}

export default function Dashboard({ rooms, onOverride }) {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="room-grid">

        {rooms.map(room => {
          const color    = ROOM_COLORS[room.name] || '#64748B';
          const iconKey  = ROOM_ICON_KEY[room.name] || 'sofa';
          const occupied = room.presence;

          return (
            <div
              key={room.id}
              className="room-card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/room/${room.id}`)}
            >
              {/* Card header */}
              <div className="room-card-header">
                <div className="room-name">
                  <span
                    className="room-icon-wrap"
                    style={{ background: color + '18', color }}
                  >
                    <RoomIcon iconKey={iconKey} size={16} color={color} />
                  </span>
                  <span>{room.name}</span>
                </div>
                <span className={`badge ${occupied ? 'badge-occupied' : 'badge-empty'}`}>
                  {occupied ? 'OCCUPIED' : 'EMPTY'}
                </span>
              </div>

              {/* Sensors */}
              <div className="room-sensors">
                <div className="sensor-box">
                  <div className="sensor-label">TEMP</div>
                  <div className={`sensor-value ${tempClass(room.temperature)}`}>
                    <Thermometer size={14} strokeWidth={2} />
                    {room.temperature}°C
                  </div>
                </div>

                <div className="sensor-box">
                  <div className="sensor-label">PRESENCE</div>
                  <div className="sensor-value" style={{ color: occupied ? '#10B981' : '#CBD5E1' }}>
                    {occupied
                      ? <User size={22} strokeWidth={1.8} />
                      : <UserX size={22} strokeWidth={1.8} />}
                  </div>
                </div>

                <div className="sensor-box">
                  <div className="sensor-label">LIGHT</div>
                  <div className={`sensor-value ${room.lightLevel > 400 ? 'warm' : 'normal'}`}>
                    {room.lightLevel > 400
                      ? <Sun size={14} strokeWidth={2} />
                      : <Moon size={14} strokeWidth={2} />}
                    {room.lightLevel}
                    <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8' }}>/1023</span>
                  </div>
                </div>
              </div>

              {/* Devices */}
              <div className="room-devices" onClick={e => e.stopPropagation()}>
                {/* AC */}
                <div className="device-row">
                  <div className="device-info">
                    <span className="device-icon-wrap">
                      <Wind size={15} strokeWidth={1.8} color="#3B82F6" />
                    </span>
                    <div>
                      <div className="device-name">Air Conditioner</div>
                      <div className={`device-state ${room.acState.toLowerCase()}`}>
                        {room.acState}
                      </div>
                    </div>
                  </div>
                  <button
                    className={`btn-override${room._acOverride ? ' active' : ''}`}
                    title={room._acOverride ? 'Click to clear AC override' : 'Click to override AC'}
                    onClick={() => onOverride(room.id, 'ac')}
                  >
                    {room._acOverride ? 'Override ✓' : 'Override'}
                  </button>
                </div>

                {/* Light */}
                <div className="device-row">
                  <div className="device-info">
                    <span
                      className="device-icon-wrap"
                      style={{ color: room.lightState === 'ON' ? '#F59E0B' : '#CBD5E1' }}
                    >
                      <LightIcon roomName={room.name} size={15} />
                    </span>
                    <div>
                      <div className="device-name">{lightName(room.name)}</div>
                      <div className={`device-state ${room.lightState.toLowerCase()}`}>
                        {room.lightState === 'ON' ? `ON (${room.lightBrightness}%)` : 'OFF'}
                      </div>
                    </div>
                  </div>
                  <button
                    className={`btn-override${room._lightOverride ? ' active' : ''}`}
                    title={room._lightOverride ? 'Click to clear light override' : 'Click to override lights'}
                    onClick={() => onOverride(room.id, 'light')}
                  >
                    {room._lightOverride ? 'Override ✓' : 'Override'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
