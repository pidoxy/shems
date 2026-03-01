from __future__ import annotations

import math
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List


class SensorObserver(ABC):
    @abstractmethod
    def on_sensor_update(self, room_id: str, sensor_type: str, value: float, timestamp: datetime) -> None:
        """Called when a sensor emits a new reading."""


class SensorSubject:
    def __init__(self) -> None:
        self._observers: List[SensorObserver] = []

    def register_observer(self, observer: SensorObserver) -> None:
        if observer not in self._observers:
            self._observers.append(observer)

    def unregister_observer(self, observer: SensorObserver) -> None:
        if observer in self._observers:
            self._observers.remove(observer)

    def notify_observers(self, room_id: str, sensor_type: str, value: float, timestamp: datetime) -> None:
        for observer in self._observers:
            observer.on_sensor_update(room_id, sensor_type, value, timestamp)


class TemperatureSensor(SensorSubject):
    def __init__(self, room_id: str, base_temperature: float, rng: random.Random | None = None) -> None:
        super().__init__()
        self.room_id = room_id
        self.base_temperature = base_temperature
        self._rng = rng or random.Random()
        self._cooling_bias = 0.0

    def read(self, timestamp: datetime, ac_active: bool = False) -> float:
        hour = timestamp.hour + (timestamp.minute / 60.0)
        # Peak around 14:00 (2 PM)
        sinusoid = math.sin((2 * math.pi * (hour - 8)) / 24)
        ambient = self.base_temperature + (5.0 * sinusoid)

        if ac_active:
            self._cooling_bias = min(6.0, self._cooling_bias + 0.35)
        else:
            self._cooling_bias = max(0.0, self._cooling_bias - 0.20)

        noise = self._rng.uniform(-0.5, 0.5)
        value = ambient - self._cooling_bias + noise
        value = max(15.0, min(45.0, value))

        self.notify_observers(self.room_id, "temperature", value, timestamp)
        return round(value, 2)


class PIRSensor(SensorSubject):
    def __init__(self, room_id: str, rng: random.Random | None = None) -> None:
        super().__init__()
        self.room_id = room_id
        self._rng = rng or random.Random()
        self._occupied = False
        self._persist_count = 0

    def _occupancy_probability(self, hour: int) -> float:
        if 0 <= hour < 6:
            return 0.10
        if 17 <= hour < 22:
            return 0.80
        return 0.20

    def read(self, timestamp: datetime) -> int:
        hour = timestamp.hour
        probability = self._occupancy_probability(hour)

        if self._occupied and self._persist_count > 0:
            self._persist_count -= 1
        else:
            self._occupied = self._rng.random() < probability
            if self._occupied:
                self._persist_count = self._rng.randint(3, 15)
            else:
                self._persist_count = 0

        value = 1 if self._occupied else 0
        self.notify_observers(self.room_id, "occupancy", float(value), timestamp)
        return value


class LDRSensor(SensorSubject):
    def __init__(self, room_id: str, rng: random.Random | None = None) -> None:
        super().__init__()
        self.room_id = room_id
        self._rng = rng or random.Random()

    def read(self, timestamp: datetime) -> int:
        hour = timestamp.hour + (timestamp.minute / 60.0)
        if hour < 6 or hour >= 18:
            base_value = 0.0
        else:
            # 6:00 -> 0, 12:00 -> 1.0, 18:00 -> 0
            daylight = math.sin(math.pi * ((hour - 6) / 12))
            base_value = max(0.0, daylight) * 1000.0

        noise = self._rng.uniform(-30.0, 30.0)
        value = int(max(0, min(1023, round(base_value + noise))))
        self.notify_observers(self.room_id, "light", float(value), timestamp)
        return value


@dataclass
class RoomSensors:
    room_id: str
    base_temperature: float
    temperature_sensor: TemperatureSensor
    pir_sensor: PIRSensor
    ldr_sensor: LDRSensor

    @classmethod
    def create(cls, room_id: str, base_temperature: float, rng_seed: int | None = None) -> "RoomSensors":
        rng = random.Random(rng_seed)
        return cls(
            room_id=room_id,
            base_temperature=base_temperature,
            temperature_sensor=TemperatureSensor(room_id, base_temperature, rng=rng),
            pir_sensor=PIRSensor(room_id, rng=rng),
            ldr_sensor=LDRSensor(room_id, rng=rng),
        )

    def register_observer(self, observer: SensorObserver) -> None:
        self.temperature_sensor.register_observer(observer)
        self.pir_sensor.register_observer(observer)
        self.ldr_sensor.register_observer(observer)

    def read_all(self, timestamp: datetime, ac_active: bool = False) -> Dict[str, float]:
        return {
            "temperature": self.temperature_sensor.read(timestamp, ac_active=ac_active),
            "occupancy": float(self.pir_sensor.read(timestamp)),
            "light": float(self.ldr_sensor.read(timestamp)),
        }
