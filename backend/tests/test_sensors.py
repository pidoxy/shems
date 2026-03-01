from datetime import datetime

from shems.sensors import RoomSensors, SensorObserver


class ProbeObserver(SensorObserver):
    def __init__(self) -> None:
        self.events = []

    def on_sensor_update(self, room_id, sensor_type, value, timestamp):
        self.events.append((room_id, sensor_type, value, timestamp))


def test_temperature_curve_and_bounds():
    sensors = RoomSensors.create("room", 29.0, rng_seed=123)
    midnight = datetime(2026, 1, 1, 0, 0)
    noon = datetime(2026, 1, 1, 12, 0)
    evening = datetime(2026, 1, 1, 18, 0)

    t0 = sensors.temperature_sensor.read(midnight)
    t1 = sensors.temperature_sensor.read(noon)
    t2 = sensors.temperature_sensor.read(evening)

    assert 15.0 <= t0 <= 45.0
    assert 15.0 <= t1 <= 45.0
    assert 15.0 <= t2 <= 45.0
    assert t1 > t0


def test_ldr_curve_day_and_night():
    sensors = RoomSensors.create("room", 29.0, rng_seed=77)
    midnight = datetime(2026, 1, 1, 0, 0)
    noon = datetime(2026, 1, 1, 12, 0)
    six_pm = datetime(2026, 1, 1, 18, 0)

    n = sensors.ldr_sensor.read(midnight)
    d = sensors.ldr_sensor.read(noon)
    e = sensors.ldr_sensor.read(six_pm)

    assert 0 <= n <= 1023
    assert 0 <= d <= 1023
    assert 0 <= e <= 1023
    assert d > n


def test_observer_notifications_fire_for_read_all():
    sensors = RoomSensors.create("living_room", 29.0, rng_seed=7)
    probe = ProbeObserver()
    sensors.register_observer(probe)

    sensors.read_all(datetime(2026, 1, 1, 6, 0), ac_active=False)

    event_types = [event[1] for event in probe.events]
    assert event_types.count("temperature") == 1
    assert event_types.count("occupancy") == 1
    assert event_types.count("light") == 1
