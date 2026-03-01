from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Literal

from shems.sensors import SensorObserver

OverrideMode = Literal["auto", "on", "off"]


class ACController:
    def __init__(self, lower_threshold: float = 24.0, upper_threshold: float = 28.0) -> None:
        self.lower_threshold = lower_threshold
        self.upper_threshold = upper_threshold
        self.state = "OFF"
        self._override: OverrideMode = "auto"

    def set_override(self, mode: OverrideMode) -> None:
        self._override = mode

    @property
    def override_mode(self) -> OverrideMode:
        return self._override

    def set_thresholds(self, lower_threshold: float, upper_threshold: float) -> None:
        if lower_threshold >= upper_threshold:
            raise ValueError("lower threshold must be less than upper threshold")
        self.lower_threshold = lower_threshold
        self.upper_threshold = upper_threshold

    @property
    def is_on(self) -> bool:
        return self.state == "COOLING"

    def update(self, temperature: float, occupied: bool) -> str:
        if self._override == "on":
            self.state = "COOLING"
            return self.state
        if self._override == "off":
            self.state = "OFF"
            return self.state

        if not occupied:
            self.state = "OFF"
            return self.state

        if self.state in {"OFF", "STANDBY"}:
            self.state = "COOLING" if temperature >= self.upper_threshold else "STANDBY"
            return self.state

        if self.state == "COOLING" and temperature <= self.lower_threshold:
            self.state = "STANDBY"
        return self.state


class LightController:
    def __init__(self, dark_threshold: float = 300.0) -> None:
        self.dark_threshold = dark_threshold
        self.state = "OFF"
        self._override: OverrideMode = "auto"

    def set_override(self, mode: OverrideMode) -> None:
        self._override = mode

    @property
    def override_mode(self) -> OverrideMode:
        return self._override

    def set_dark_threshold(self, threshold: float) -> None:
        self.dark_threshold = threshold

    @property
    def is_on(self) -> bool:
        return self.state == "ON"

    def update(self, occupied: bool, light_level: float) -> str:
        if self._override == "on":
            self.state = "ON"
            return self.state
        if self._override == "off":
            self.state = "OFF"
            return self.state

        self.state = "ON" if occupied and light_level < self.dark_threshold else "OFF"
        return self.state


@dataclass
class RoomSnapshot:
    room_id: str
    timestamp: datetime | None
    temperature: float
    occupancy: int
    light: float
    ac_state: str
    ac_on: bool
    light_state: str
    light_on: bool


class RoomController(SensorObserver):
    def __init__(self, room_id: str) -> None:
        self.room_id = room_id
        self.ac_controller = ACController()
        self.light_controller = LightController()
        self.latest_values: Dict[str, float] = {"temperature": 0.0, "occupancy": 0.0, "light": 0.0}
        self.last_timestamp: datetime | None = None

    def on_sensor_update(self, room_id: str, sensor_type: str, value: float, timestamp: datetime) -> None:
        if room_id != self.room_id:
            return
        self.latest_values[sensor_type] = value
        self.last_timestamp = timestamp
        self.evaluate()

    def evaluate(self) -> None:
        occupied = bool(int(self.latest_values["occupancy"]))
        temperature = self.latest_values["temperature"]
        light_level = self.latest_values["light"]
        self.ac_controller.update(temperature=temperature, occupied=occupied)
        self.light_controller.update(occupied=occupied, light_level=light_level)

    def set_override(self, appliance: str, mode: OverrideMode) -> None:
        if appliance == "ac":
            self.ac_controller.set_override(mode)
        elif appliance == "light":
            self.light_controller.set_override(mode)
        else:
            raise ValueError(f"Unsupported appliance: {appliance}")
        self.evaluate()

    def snapshot(self) -> RoomSnapshot:
        return RoomSnapshot(
            room_id=self.room_id,
            timestamp=self.last_timestamp,
            temperature=round(self.latest_values["temperature"], 2),
            occupancy=int(self.latest_values["occupancy"]),
            light=round(self.latest_values["light"], 2),
            ac_state=self.ac_controller.state,
            ac_on=self.ac_controller.is_on,
            light_state=self.light_controller.state,
            light_on=self.light_controller.is_on,
        )
