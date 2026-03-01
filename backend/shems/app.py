from __future__ import annotations

from threading import Lock

from flask import Flask, jsonify, render_template, request
from flask_cors import CORS

from shems.simulation import ShemsSimulation


def create_app(db_path: str = "shems.db") -> Flask:
    app = Flask(__name__, template_folder="../templates")
    CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])
    sim = ShemsSimulation(db_path=db_path)
    lock = Lock()

    # Seed one initial tick so the dashboard has non-zero values on first load.
    with lock:
        sim.tick()

    @app.get("/")
    def index() -> str:
        return render_template("index.html")

    @app.get("/api/status")
    def api_status():
        with lock:
            return jsonify({"sim_time": sim.current_time.isoformat(), "rooms": sim.statuses()})

    @app.get("/api/room/<room_id>")
    def api_room(room_id: str):
        if room_id not in sim.rooms:
            return jsonify({"error": "room not found"}), 404
        with lock:
            return jsonify(sim.room_status(room_id))

    @app.get("/api/history/<room_id>/<sensor_type>")
    def api_history(room_id: str, sensor_type: str):
        if room_id not in sim.rooms:
            return jsonify({"error": "room not found"}), 404
        if sensor_type not in {"temperature", "occupancy", "light"}:
            return jsonify({"error": "invalid sensor type"}), 400
        limit = int(request.args.get("limit", 288))
        rows = sim.db.get_sensor_history(room_id, sensor_type, limit=limit)
        return jsonify({"room_id": room_id, "sensor_type": sensor_type, "history": rows})

    @app.get("/api/energy")
    def api_energy():
        with lock:
            return jsonify(sim.summary())

    @app.post("/api/override")
    def api_override():
        payload = request.get_json(silent=True) or {}
        room_id = payload.get("room_id")
        appliance = payload.get("appliance")
        mode = payload.get("mode")
        if room_id not in sim.rooms:
            return jsonify({"error": "room not found"}), 404
        if appliance not in {"ac", "light"}:
            return jsonify({"error": "invalid appliance"}), 400
        if mode not in {"auto", "on", "off"}:
            return jsonify({"error": "invalid mode"}), 400
        with lock:
            result = sim.override(room_id, appliance, mode)
        return jsonify(result)

    @app.post("/api/tick")
    def api_tick():
        payload = request.get_json(silent=True) or {}
        steps = max(1, int(payload.get("steps", 1)))
        last_state = None
        with lock:
            for _ in range(steps):
                last_state = sim.tick()
        return jsonify({"steps": steps, "sim_time": sim.current_time.isoformat(), "state": last_state})

    @app.get("/api/stats")
    def api_stats():
        return jsonify(sim.db.table_counts())

    @app.get("/api/settings")
    def api_settings():
        with lock:
            return jsonify(sim.get_settings())

    @app.post("/api/settings")
    def api_settings_update():
        payload = request.get_json(silent=True) or {}
        try:
            with lock:
                return jsonify(sim.update_settings(payload))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.get("/api/rooms/config")
    def api_rooms_config():
        with lock:
            return jsonify({"rooms": sim.get_room_configs()})

    @app.post("/api/rooms/config")
    def api_room_config_update():
        payload = request.get_json(silent=True) or {}
        room_id = payload.get("room_id")
        if room_id not in sim.rooms:
            return jsonify({"error": "room not found"}), 404
        try:
            with lock:
                result = sim.update_room_config(room_id, payload)
            return jsonify(result)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
