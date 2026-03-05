# Smart Home Room 1 — REST API Documentation

## Base URL

```
https://apartments-locked-surprised-presence.trycloudflare.com
```

> **Note:** This URL changes each time `cloudflared` is restarted. Update it accordingly.

---

## Authentication

None required. All endpoints are public with CORS enabled (`Access-Control-Allow-Origin: *`).

---

## Endpoints

### `GET /api/sensors`

Returns the current sensor readings from Room 1.

**Request:**

```http
GET /api/sensors HTTP/1.1
Host: apartments-locked-surprised-presence.trycloudflare.com
```

**Response:** `200 OK` — `application/json`

```json
{
  "tempC": 27.3,
  "tempF": 81.1,
  "tempV": 0.273,
  "tempRaw": 339,
  "tempOk": true,
  "lightPct": 65,
  "lightV": 2.14,
  "lightRaw": 2663,
  "motion": false,
  "motionCount": 12,
  "redLed": false,
  "ylwLed": false,
  "uptime": 3600,
  "timestamp": 3645000
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `tempC` | `float` | Temperature in Celsius |
| `tempF` | `float` | Temperature in Fahrenheit |
| `tempV` | `float` | LM35 sensor voltage (V) |
| `tempRaw` | `int` | Raw ADC reading (0–4095) |
| `tempOk` | `bool` | `true` if LM35 sensor is connected and working |
| `lightPct` | `int` | Ambient light level (0–100%) |
| `lightV` | `float` | LDR sensor voltage (V) |
| `lightRaw` | `int` | Raw ADC reading (0–4095) |
| `motion` | `bool` | `true` if PIR motion is currently detected |
| `motionCount` | `int` | Total motion triggers since last boot |
| `redLed` | `bool` | Red LED state — ON when temp ≥ 30°C |
| `ylwLed` | `bool` | Yellow LED state — ON when light < 20% |
| `uptime` | `int` | Seconds since ESP32 booted |
| `timestamp` | `int` | ESP32 `millis()` value at time of response |

---

### `GET /api/status`

Returns system and network information.

**Request:**

```http
GET /api/status HTTP/1.1
Host: apartments-locked-surprised-presence.trycloudflare.com
```

**Response:** `200 OK` — `application/json`

```json
{
  "board": "ESP32 DevKit",
  "room": "Room 1",
  "uptime": 3600,
  "freeHeap": 180000,
  "wifiMode": "Station",
  "wifiSSID": "Hackeinstein",
  "wsClients": 1,
  "adcCalibrated": true,
  "ip": "192.168.43.105",
  "rssi": -45
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `board` | `string` | Board identifier |
| `room` | `string` | Room name |
| `uptime` | `int` | Seconds since boot |
| `freeHeap` | `int` | Free RAM in bytes |
| `wifiMode` | `string` | `"Station"` (joined network) or `"AP"` (own hotspot) |
| `wifiSSID` | `string` | Connected WiFi network name |
| `wsClients` | `int` | Number of active WebSocket dashboard connections |
| `adcCalibrated` | `bool` | Whether ESP32 factory ADC calibration was found |
| `ip` | `string` | ESP32 local IP address |
| `rssi` | `int` | WiFi signal strength in dBm (Station mode only) |

---

### `GET /`

Returns the full real-time HTML dashboard. Open in a browser for live monitoring with WebSocket updates.

---

## WebSocket (Real-Time)

**URL:** `wss://apartments-locked-surprised-presence.trycloudflare.com/ws` (via tunnel)  
**Local:** `ws://<ESP32_IP>:81/`

Pushes JSON sensor data (same schema as `/api/sensors` minus `timestamp`) every **500ms** to all connected clients.

---

## Usage Examples

### cURL

```bash
curl https://apartments-locked-surprised-presence.trycloudflare.com/api/sensors
```

### Python

```python
import requests

API = "https://apartments-locked-surprised-presence.trycloudflare.com"

# Get sensor data
data = requests.get(f"{API}/api/sensors").json()
print(f"Temperature: {data['tempC']}°C")
print(f"Light: {data['lightPct']}%")
print(f"Motion: {'Yes' if data['motion'] else 'No'}")

# Get system status
status = requests.get(f"{API}/api/status").json()
print(f"Uptime: {status['uptime']}s, Free RAM: {status['freeHeap']} bytes")
```

### JavaScript (fetch)

```javascript
const API = "https://apartments-locked-surprised-presence.trycloudflare.com";

const data = await fetch(`${API}/api/sensors`).then(r => r.json());
console.log(`Temp: ${data.tempC}°C, Light: ${data.lightPct}%`);
```

### JavaScript (polling every 2s)

```javascript
const API = "https://apartments-locked-surprised-presence.trycloudflare.com";

setInterval(async () => {
  const d = await fetch(`${API}/api/sensors`).then(r => r.json());
  document.getElementById("temp").textContent = d.tempC + "°C";
  document.getElementById("light").textContent = d.lightPct + "%";
  document.getElementById("motion").textContent = d.motion ? "ACTIVE" : "Clear";
}, 2000);
```

---

## Rate Limits

None enforced. The ESP32 handles requests sequentially, so avoid polling faster than every **500ms** to prevent blocking sensor reads.

---

## Error Handling

- If the ESP32 is offline or the tunnel is down, requests will timeout.
- If the LM35 temperature sensor is disconnected, `tempOk` will be `false` and `tempC`/`tempF` will read `0`.
- The API always returns `200 OK` — check `tempOk` field to detect sensor issues.

---

## Hardware

| Component | Pin | Description |
|-----------|-----|-------------|
| LM35 Temperature | D32 | Analog temperature sensor (10mV/°C) |
| LDR Light | D34 | Light-dependent resistor |
| HC-SR501 PIR | D26 | Passive infrared motion sensor |
| Red LED | D16 | High temperature indicator (≥ 30°C) |
| Yellow LED | D17 | Low light indicator (< 20%) |
| Built-in LED | D2 | Motion activity indicator |
