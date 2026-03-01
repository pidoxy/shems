from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List

from shems.control import RoomController
from shems.database import DataLogger, DatabaseManager, POWER_RATINGS_KW
from shems.sensors import RoomSensors

ROOMS = {
    "living_room": {"name": "Living Room", "base_temp": 29.0},
    "bedroom": {"name": "Bedroom", "base_temp": 27.0},
    "kitchen": {"name": "Kitchen", "base_temp": 30.0},
    "study_room": {"name": "Study Room", "base_temp": 28.0},
}


@dataclass
class RoomRuntime:
    room_id: str
    name: str
    sensors: RoomSensors
    controller: RoomController


@dataclass
class GlobalSettings:
    ac_lower_threshold: float = 24.0
    ac_upper_threshold: float = 28.0
    light_threshold: float = 300.0
    tariff_ngn_per_kwh: float = 68.0


class ShemsSimulation:
    def __init__(
        self,
        db_path: str = "shems.db",
        start_time: datetime | None = None,
        step_minutes: int = 5,
    ) -> None:
        self.db = DatabaseManager(db_path)
        self.logger = DataLogger(self.db)
        self.step = timedelta(minutes=step_minutes)
        self.start_time = start_time or datetime(2026, 1, 1, 0, 0, 0)
        self.current_time = self.start_time
        self.step_index = 0
        self.settings = GlobalSettings()

        self.rooms: Dict[str, RoomRuntime] = {}
        self.last_appliance_state: Dict[str, Dict[str, tuple[str, bool]]] = {}
        self.room_config: Dict[str, Dict[str, object]] = {}
        for idx, (room_id, cfg) in enumerate(ROOMS.items()):
            sensors = RoomSensors.create(room_id=room_id, base_temperature=float(cfg["base_temp"]), rng_seed=idx + 17)
            controller = RoomController(room_id=room_id)
            controller.ac_controller.set_thresholds(self.settings.ac_lower_threshold, self.settings.ac_upper_threshold)
            controller.light_controller.set_dark_threshold(self.settings.light_threshold)
            sensors.register_observer(controller)
            sensors.register_observer(self.logger)
            self.rooms[room_id] = RoomRuntime(room_id=room_id, name=str(cfg["name"]), sensors=sensors, controller=controller)
            self.last_appliance_state[room_id] = {
                "ac": ("OFF", False),
                "light": ("OFF", False),
            }
            self.room_config[room_id] = {
                "room_id": room_id,
                "name": str(cfg["name"]),
                "base_temp": float(cfg["base_temp"]),
                "ac_auto": True,
                "light_auto": True,
            }

    def _log_appliance_transitions(self, room_id: str) -> None:
        snapshot = self.rooms[room_id].controller.snapshot()
        current = {
            "ac": (snapshot.ac_state, snapshot.ac_on),
            "light": (snapshot.light_state, snapshot.light_on),
        }
        for appliance, (state, is_on) in current.items():
            prev_state, prev_on = self.last_appliance_state[room_id][appliance]
            if (state, is_on) != (prev_state, prev_on):
                self.db.log_appliance_transition(room_id, appliance, state, is_on, self.current_time)
                self.last_appliance_state[room_id][appliance] = (state, is_on)

    def tick(self) -> Dict[str, dict]:
        state: Dict[str, dict] = {}
        for room_id, runtime in self.rooms.items():
            ac_active = runtime.controller.ac_controller.is_on
            runtime.sensors.read_all(self.current_time, ac_active=ac_active)
            self._log_appliance_transitions(room_id)
            snapshot = runtime.controller.snapshot()
            state[room_id] = {
                "room_id": room_id,
                "name": runtime.name,
                "timestamp": self.current_time.isoformat(),
                "temperature": snapshot.temperature,
                "occupancy": snapshot.occupancy,
                "light": snapshot.light,
                "ac_state": snapshot.ac_state,
                "ac_on": snapshot.ac_on,
                "light_state": snapshot.light_state,
                "light_on": snapshot.light_on,
            }

        self.current_time += self.step
        self.step_index += 1
        return state

    def run(self, steps: int = 288) -> Dict[str, object]:
        for _ in range(steps):
            self.tick()
        return self.summary()

    def summary(self) -> Dict[str, object]:
        period_end = self.current_time
        energy_records = self.db.compute_energy(self.rooms.keys(), self.start_time, period_end, persist=False)

        totals = {
            "ac_kwh": 0.0,
            "lighting_kwh": 0.0,
            "total_kwh": 0.0,
        }
        by_room: Dict[str, Dict[str, float]] = {}
        for record in energy_records:
            room_energy = by_room.setdefault(record.room_id, {"ac": 0.0, "light": 0.0, "total": 0.0})
            room_energy[record.appliance] = record.energy_kwh
            room_energy["total"] += record.energy_kwh
            if record.appliance == "ac":
                totals["ac_kwh"] += record.energy_kwh
            elif record.appliance == "light":
                totals["lighting_kwh"] += record.energy_kwh
            totals["total_kwh"] += record.energy_kwh

        tariff = 68.0
        tariff = self.settings.tariff_ngn_per_kwh
        cost = totals["total_kwh"] * tariff
        step_hours = self.step.total_seconds() / 3600.0

        baseline_by_room: Dict[str, Dict[str, float]] = {}
        baseline_total = {"ac_kwh": 0.0, "lighting_kwh": 0.0, "total_kwh": 0.0}
        for room_id in self.rooms:
            counts = self.db.occupancy_counts(room_id, self.start_time, period_end)
            occupied_hours = counts["occupied_count"] * step_hours
            unoccupied_hours = max(0.0, (counts["total_count"] - counts["occupied_count"]) * step_hours)

            baseline_ac = (occupied_hours + (0.3 * unoccupied_hours)) * POWER_RATINGS_KW["ac"]
            baseline_light = (occupied_hours + (0.3 * unoccupied_hours)) * POWER_RATINGS_KW["light"]
            baseline_total_room = baseline_ac + baseline_light

            baseline_by_room[room_id] = {
                "ac": baseline_ac,
                "light": baseline_light,
                "total": baseline_total_room,
            }
            baseline_total["ac_kwh"] += baseline_ac
            baseline_total["lighting_kwh"] += baseline_light
            baseline_total["total_kwh"] += baseline_total_room

        savings_kwh = baseline_total["total_kwh"] - totals["total_kwh"]
        savings_pct = (savings_kwh / baseline_total["total_kwh"] * 100.0) if baseline_total["total_kwh"] > 0 else 0.0
        baseline_cost = baseline_total["total_kwh"] * tariff

        counts = self.db.table_counts()
        return {
            "simulated_period": {
                "start": self.start_time.isoformat(),
                "end": period_end.isoformat(),
                "steps": self.step_index,
                "step_minutes": int(self.step.total_seconds() / 60),
            },
            "database_counts": counts,
            "energy_by_room": by_room,
            "totals": totals,
            "cost_ngn": round(cost, 2),
            "baseline_without_shems": {
                "energy_by_room": baseline_by_room,
                "totals": baseline_total,
                "cost_ngn": round(baseline_cost, 2),
            },
            "savings": {
                "energy_kwh": savings_kwh,
                "cost_ngn": baseline_cost - cost,
                "percent": savings_pct,
            },
            "power_ratings_kw": POWER_RATINGS_KW,
        }

    def room_status(self, room_id: str) -> dict:
        runtime = self.rooms[room_id]
        snapshot = runtime.controller.snapshot()
        config = self.room_config[room_id]
        return {
            "room_id": room_id,
            "name": runtime.name,
            "timestamp": self.current_time.isoformat(),
            "temperature": snapshot.temperature,
            "occupancy": snapshot.occupancy,
            "light": snapshot.light,
            "ac_state": snapshot.ac_state,
            "ac_on": snapshot.ac_on,
            "light_state": snapshot.light_state,
            "light_on": snapshot.light_on,
            "ac_override": runtime.controller.ac_controller.override_mode,
            "light_override": runtime.controller.light_controller.override_mode,
            "ac_auto": bool(config["ac_auto"]),
            "light_auto": bool(config["light_auto"]),
            "base_temp": float(config["base_temp"]),
        }

    def override(self, room_id: str, appliance: str, mode: str) -> dict:
        runtime = self.rooms[room_id]
        runtime.controller.set_override(appliance, mode)  # type: ignore[arg-type]
        if appliance == "ac":
            self.room_config[room_id]["ac_auto"] = mode == "auto"
        elif appliance == "light":
            self.room_config[room_id]["light_auto"] = mode == "auto"
        self._log_appliance_transitions(room_id)
        return self.room_status(room_id)

    def statuses(self) -> List[dict]:
        return [self.room_status(room_id) for room_id in self.rooms]

    def get_settings(self) -> dict:
        return {
            "ac_lower_threshold": self.settings.ac_lower_threshold,
            "ac_upper_threshold": self.settings.ac_upper_threshold,
            "light_threshold": self.settings.light_threshold,
            "tariff_ngn_per_kwh": self.settings.tariff_ngn_per_kwh,
        }

    def update_settings(self, payload: dict) -> dict:
        lower = float(payload.get("ac_lower_threshold", self.settings.ac_lower_threshold))
        upper = float(payload.get("ac_upper_threshold", self.settings.ac_upper_threshold))
        light = float(payload.get("light_threshold", self.settings.light_threshold))
        tariff = float(payload.get("tariff_ngn_per_kwh", self.settings.tariff_ngn_per_kwh))

        if lower >= upper:
            raise ValueError("ac_lower_threshold must be less than ac_upper_threshold")
        if light < 0 or light > 1023:
            raise ValueError("light_threshold must be between 0 and 1023")
        if tariff <= 0:
            raise ValueError("tariff_ngn_per_kwh must be positive")

        self.settings = GlobalSettings(
            ac_lower_threshold=lower,
            ac_upper_threshold=upper,
            light_threshold=light,
            tariff_ngn_per_kwh=tariff,
        )

        for runtime in self.rooms.values():
            runtime.controller.ac_controller.set_thresholds(lower, upper)
            runtime.controller.light_controller.set_dark_threshold(light)
            runtime.controller.evaluate()

        return self.get_settings()

    def get_room_configs(self) -> List[dict]:
        return [dict(self.room_config[room_id]) for room_id in self.rooms]

    def update_room_config(self, room_id: str, payload: dict) -> dict:
        if room_id not in self.rooms:
            raise ValueError("room not found")

        runtime = self.rooms[room_id]
        config = self.room_config[room_id]

        if "name" in payload and str(payload["name"]).strip():
            new_name = str(payload["name"]).strip()
            config["name"] = new_name
            runtime.name = new_name

        if "base_temp" in payload:
            new_base = float(payload["base_temp"])
            config["base_temp"] = new_base
            runtime.sensors.base_temperature = new_base
            runtime.sensors.temperature_sensor.base_temperature = new_base

        if "ac_auto" in payload:
            ac_auto = bool(payload["ac_auto"])
            config["ac_auto"] = ac_auto
            runtime.controller.set_override("ac", "auto" if ac_auto else "off")

        if "light_auto" in payload:
            light_auto = bool(payload["light_auto"])
            config["light_auto"] = light_auto
            runtime.controller.set_override("light", "auto" if light_auto else "off")

        return dict(config)
