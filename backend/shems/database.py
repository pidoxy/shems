from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List

from shems.sensors import SensorObserver

POWER_RATINGS_KW: Dict[str, float] = {
    "ac": 1.50,
    "light": 0.06,
}


@dataclass
class EnergyRecord:
    room_id: str
    appliance: str
    on_duration_seconds: float
    energy_kwh: float
    period_start: datetime
    period_end: datetime


class DatabaseManager:
    def __init__(self, db_path: str | Path = "shems.db") -> None:
        self.db_path = str(db_path)
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.initialize()

    def initialize(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS sensor_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT NOT NULL,
                sensor_type TEXT NOT NULL,
                value REAL NOT NULL,
                timestamp TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS appliance_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT NOT NULL,
                appliance TEXT NOT NULL,
                state TEXT NOT NULL,
                is_on INTEGER NOT NULL,
                timestamp TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS energy_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT NOT NULL,
                appliance TEXT NOT NULL,
                on_duration_seconds REAL NOT NULL,
                energy_kwh REAL NOT NULL,
                period_start TEXT NOT NULL,
                period_end TEXT NOT NULL,
                timestamp TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_sensor_room_ts ON sensor_log (room_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_appliance_room_ts ON appliance_log (room_id, timestamp);
            CREATE INDEX IF NOT EXISTS idx_energy_room_ts ON energy_log (room_id, timestamp);
            """
        )
        self.conn.commit()

    def log_sensor_reading(self, room_id: str, sensor_type: str, value: float, timestamp: datetime) -> None:
        self.conn.execute(
            "INSERT INTO sensor_log(room_id, sensor_type, value, timestamp) VALUES (?, ?, ?, ?)",
            (room_id, sensor_type, float(value), timestamp.isoformat()),
        )
        self.conn.commit()

    def log_appliance_transition(
        self,
        room_id: str,
        appliance: str,
        state: str,
        is_on: bool,
        timestamp: datetime,
    ) -> bool:
        row = self.conn.execute(
            """
            SELECT state, is_on
            FROM appliance_log
            WHERE room_id = ? AND appliance = ?
            ORDER BY timestamp DESC, id DESC
            LIMIT 1
            """,
            (room_id, appliance),
        ).fetchone()

        if row and row["state"] == state and bool(row["is_on"]) == bool(is_on):
            return False

        self.conn.execute(
            "INSERT INTO appliance_log(room_id, appliance, state, is_on, timestamp) VALUES (?, ?, ?, ?, ?)",
            (room_id, appliance, state, int(bool(is_on)), timestamp.isoformat()),
        )
        self.conn.commit()
        return True

    def get_sensor_history(self, room_id: str, sensor_type: str, limit: int = 288) -> List[dict]:
        rows = self.conn.execute(
            """
            SELECT room_id, sensor_type, value, timestamp
            FROM sensor_log
            WHERE room_id = ? AND sensor_type = ?
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (room_id, sensor_type, limit),
        ).fetchall()
        return [dict(row) for row in reversed(rows)]

    def _energy_for_appliance(
        self,
        room_id: str,
        appliance: str,
        period_start: datetime,
        period_end: datetime,
    ) -> EnergyRecord:
        rows = self.conn.execute(
            """
            SELECT is_on, timestamp
            FROM appliance_log
            WHERE room_id = ? AND appliance = ? AND timestamp <= ?
            ORDER BY timestamp ASC, id ASC
            """,
            (room_id, appliance, period_end.isoformat()),
        ).fetchall()

        on_duration_seconds = 0.0
        on = False
        cursor = period_start

        for row in rows:
            ts = datetime.fromisoformat(row["timestamp"])
            if ts < period_start:
                on = bool(row["is_on"])
                continue
            if ts > period_end:
                break
            if on:
                on_duration_seconds += max(0.0, (ts - cursor).total_seconds())
            cursor = ts
            on = bool(row["is_on"])

        if on:
            on_duration_seconds += max(0.0, (period_end - cursor).total_seconds())

        hours = on_duration_seconds / 3600.0
        energy_kwh = hours * POWER_RATINGS_KW[appliance]
        return EnergyRecord(
            room_id=room_id,
            appliance=appliance,
            on_duration_seconds=on_duration_seconds,
            energy_kwh=energy_kwh,
            period_start=period_start,
            period_end=period_end,
        )

    def compute_energy(
        self,
        room_ids: Iterable[str],
        period_start: datetime,
        period_end: datetime,
        persist: bool = True,
    ) -> List[EnergyRecord]:
        records: List[EnergyRecord] = []
        now = datetime.now().isoformat()

        for room_id in room_ids:
            for appliance in POWER_RATINGS_KW:
                record = self._energy_for_appliance(room_id, appliance, period_start, period_end)
                records.append(record)
                if persist:
                    self.conn.execute(
                        """
                        INSERT INTO energy_log(room_id, appliance, on_duration_seconds, energy_kwh, period_start, period_end, timestamp)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            record.room_id,
                            record.appliance,
                            record.on_duration_seconds,
                            record.energy_kwh,
                            record.period_start.isoformat(),
                            record.period_end.isoformat(),
                            now,
                        ),
                    )

        if persist:
            self.conn.commit()

        return records

    def table_counts(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for table in ("sensor_log", "appliance_log", "energy_log"):
            row = self.conn.execute(f"SELECT COUNT(*) AS c FROM {table}").fetchone()
            counts[table] = int(row["c"])
        return counts

    def occupancy_counts(self, room_id: str, period_start: datetime, period_end: datetime) -> Dict[str, int]:
        row = self.conn.execute(
            """
            SELECT
                SUM(CASE WHEN value >= 1 THEN 1 ELSE 0 END) AS occupied_count,
                COUNT(*) AS total_count
            FROM sensor_log
            WHERE room_id = ?
              AND sensor_type = 'occupancy'
              AND timestamp >= ?
              AND timestamp < ?
            """,
            (room_id, period_start.isoformat(), period_end.isoformat()),
        ).fetchone()
        occupied_count = int(row["occupied_count"] or 0)
        total_count = int(row["total_count"] or 0)
        return {"occupied_count": occupied_count, "total_count": total_count}


class DataLogger(SensorObserver):
    def __init__(self, db: DatabaseManager) -> None:
        self.db = db

    def on_sensor_update(self, room_id: str, sensor_type: str, value: float, timestamp: datetime) -> None:
        self.db.log_sensor_reading(room_id, sensor_type, value, timestamp)
