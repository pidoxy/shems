// Mock data matching the SHEMS backend API structure
// Swap BASE_URL to your Flask server when running locally

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const ROOM_COLORS = {
  'Living Room': '#3B82F6',
  'Bedroom': '#8B5CF6',
  'Kitchen': '#F59E0B',
  'Study Room': '#10B981',
  'Master Bedroom': '#8B5CF6',
  'Guest Room': '#F97316',
  'Study': '#10B981',
};

// Icon keys — matched to lucide-react icon names used in components
export const ROOM_ICON_KEY = {
  'Living Room':    'sofa',
  'Bedroom':        'bed',
  'Master Bedroom': 'bed',
  'Kitchen':        'utensils',
  'Study Room':     'book-open',
  'Study':          'book-open',
  'Guest Room':     'bed',
};

// Static fallback rooms for when API is offline
export const INITIAL_ROOMS = [
  {
    id: 'living_room',
    name: 'Living Room',
    temperature: 31.2,
    targetTemp: 22,
    presence: true,
    lightLevel: 847,
    acState: 'COOLING',
    lightState: 'ON',
    lightBrightness: 80,
    energy24h: 12.4,
    estimatedCost: 2.48,
    efficiencyScore: 76,
    efficiencyLabel: 'GOOD',
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    temperature: 24.5,
    targetTemp: 20,
    presence: false,
    lightLevel: 0,
    acState: 'STANDBY',
    lightState: 'OFF',
    lightBrightness: 0,
    energy24h: 5.5,
    estimatedCost: 1.10,
    efficiencyScore: 92,
    efficiencyLabel: 'EXCELLENT',
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    temperature: 26.1,
    targetTemp: 24,
    presence: true,
    lightLevel: 520,
    acState: 'OFF',
    lightState: 'ON',
    lightBrightness: 100,
    energy24h: 8.2,
    estimatedCost: 1.64,
    efficiencyScore: 85,
    efficiencyLabel: 'EXCELLENT',
  },
  {
    id: 'study',
    name: 'Study Room',
    temperature: 26.5,
    targetTemp: 23,
    presence: false,
    lightLevel: 120,
    acState: 'OFF',
    lightState: 'OFF',
    lightBrightness: 0,
    energy24h: 14.8,
    estimatedCost: 2.96,
    efficiencyScore: 43,
    efficiencyLabel: 'POOR',
  },
];

// Generate 24h temperature trend data
export function generate24hTempData() {
  const labels = [];
  const datasets = {
    'Living Room': [],
    'Kitchen': [],
    'Bedroom': [],
    'Study': [],
  };
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 60) {
      labels.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  const bases = { 'Living Room': 26, 'Kitchen': 27.5, 'Bedroom': 24.5, 'Study': 26.5 };
  labels.forEach((_, i) => {
    const t = i / 23;
    const sine = Math.sin(Math.PI * t);
    Object.entries(bases).forEach(([room, base]) => {
      datasets[room].push(+(base + sine * 3.5 + (Math.random() - 0.5) * 0.6).toFixed(1));
    });
  });
  return { labels, datasets };
}

// Generate hourly consumption timeline
export function generateHourlyConsumption() {
  const labels = [];
  const room1 = [], room2 = [], room3 = [], room4 = [];
  for (let h = 0; h < 24; h++) {
    labels.push(`${String(h).padStart(2, '0')}:00`);
    const active = h >= 6 && h <= 22;
    const peak = h >= 10 && h <= 20;
    const r = () => +(Math.random() * (peak ? 1.2 : active ? 0.6 : 0.1)).toFixed(2);
    room1.push(r()); room2.push(r()); room3.push(r()); room4.push(r());
  }
  return { labels, room1, room2, room3, room4 };
}

export const ACTIVITY_LOG = [
  { time: '18:20', event: 'Motion Detected', source: 'PIR Sensor (Ceiling)', value: '-', type: 'motion' },
  { time: '18:20', event: 'Lights On', source: 'Automation Rule', value: '100%', type: 'light' },
  { time: '17:45', event: 'Temp Threshold Exceeded', source: 'System Alert', value: '28.1°C', type: 'alert' },
  { time: '17:45', event: 'AC Standby', source: 'Thermostat Logic', value: 'Idle', type: 'ac' },
  { time: '16:30', event: 'Room Vacated', source: 'PIR Sensor (Ceiling)', value: '-', type: 'vacated' },
];
