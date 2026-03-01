from shems.simulation import ShemsSimulation


def test_full_day_run_produces_expected_volume():
    sim = ShemsSimulation(db_path=":memory:")
    summary = sim.run(steps=288)

    assert summary["simulated_period"]["steps"] == 288
    assert summary["database_counts"]["sensor_log"] == 288 * 4 * 3
    assert summary["database_counts"]["appliance_log"] > 0
    assert summary["totals"]["total_kwh"] > 0
    assert summary["baseline_without_shems"]["totals"]["total_kwh"] > 0
    assert summary["savings"]["percent"] >= 0


def test_settings_and_room_config_updates_apply():
    sim = ShemsSimulation(db_path=":memory:")
    updated = sim.update_settings(
        {
            "ac_lower_threshold": 23.0,
            "ac_upper_threshold": 29.0,
            "light_threshold": 250.0,
            "tariff_ngn_per_kwh": 70.0,
        }
    )
    assert updated["ac_lower_threshold"] == 23.0
    assert updated["ac_upper_threshold"] == 29.0
    assert updated["light_threshold"] == 250.0
    assert updated["tariff_ngn_per_kwh"] == 70.0

    room_cfg = sim.update_room_config(
        "living_room",
        {"name": "Family Lounge", "base_temp": 26.5, "ac_auto": False, "light_auto": True},
    )
    assert room_cfg["name"] == "Family Lounge"
    assert room_cfg["base_temp"] == 26.5
    assert room_cfg["ac_auto"] is False
    assert room_cfg["light_auto"] is True
