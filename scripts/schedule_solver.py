#!/usr/bin/env python3
"""
Schedule Solver — OR-Tools CP-SAT for staff shift scheduling.

Usage:
  schedule_solver.py solve --start 2026-06-01 --end 2026-06-30
  schedule_solver.py solve --start 2026-06-01 --end 2026-06-30 --config default
"""

import sys, os, json, argparse
from datetime import date, timedelta, datetime
from collections import defaultdict

import psycopg2
from ortools.sat.python import cp_model

DB_URL = "postgresql://admin:Lemonclf0428!@localhost:5432/ai_dashboard_db"


def load_data(start_date: date, end_date: date) -> dict:
    """Load staff, shift types, coverage rules, leave, locked assignments, config."""
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Staff
    cur.execute("SELECT id, name, role, home_unit, can_work_units, skill_tags FROM schedule_staff WHERE is_active=true")
    staff = [{"id": r[0], "name": r[1], "role": r[2], "home_unit": r[3],
              "can_work_units": r[4] or [r[3]], "skill_tags": r[5] or []} for r in cur.fetchall()]

    # Shift types (exclude OFF)
    cur.execute("SELECT id, code, label, category FROM schedule_shift_types WHERE code != 'OFF'")
    shift_types = [{"id": r[0], "code": r[1], "label": r[2], "category": r[3]} for r in cur.fetchall()]

    # Units
    units = sorted(set(s["home_unit"] for s in staff))

    # Coverage rules
    cur.execute("SELECT cr.unit, st.code, cr.min_as, cr.min_rw, cr.min_total, cr.day_of_week "
                "FROM schedule_coverage_rules cr JOIN schedule_shift_types st ON cr.shift_type_id=st.id")
    coverage = {}
    for r in cur.fetchall():
        unit, shift_code, min_as, min_rw, min_total, dow = r
        key = (unit, shift_code)
        if key not in coverage:
            coverage[key] = {"min_as": 0, "min_rw": 0, "min_total": 0}
        coverage[key]["min_as"] = max(coverage[key]["min_as"], min_as or 0)
        coverage[key]["min_rw"] = max(coverage[key]["min_rw"], min_rw or 0)
        coverage[key]["min_total"] = max(coverage[key]["min_total"], min_total or 0)

    # Leave
    cur.execute("SELECT staff_id, start_date, end_date FROM schedule_leave "
                "WHERE end_date >= %s AND start_date <= %s", (start_date, end_date))
    leave = defaultdict(set)
    for r in cur.fetchall():
        sid, s, e = r[0], r[1], r[2]
        d = max(s, start_date)
        while d <= min(e, end_date):
            leave[sid].add(d)
            d += timedelta(days=1)

    # Locked assignments
    cur.execute("SELECT sa.staff_id, sa.shift_date, st.code, sa.unit "
                "FROM schedule_assignments sa JOIN schedule_shift_types st ON sa.shift_type_id=st.id "
                "WHERE sa.locked=true AND sa.shift_date >= %s AND sa.shift_date <= %s",
                (start_date, end_date))
    locked = {}
    for r in cur.fetchall():
        locked[(r[0], r[1])] = {"shift": r[2], "unit": r[3]}

    # Solver config
    cur.execute("SELECT config_json FROM schedule_config WHERE config_key='default'")
    row = cur.fetchone()
    config = row[0] if row else {}
    conn.close()

    return {
        "staff": staff, "shift_types": shift_types, "units": units,
        "coverage": coverage, "leave": leave, "locked": locked,
        "start_date": start_date, "end_date": end_date, "config": config,
    }


def solve(data: dict) -> dict:
    """Build and solve the CP-SAT model."""
    staff = data["staff"]
    shift_types = data["shift_types"]
    units = data["units"]
    coverage = data["coverage"]
    leave = data["leave"]
    locked = data["locked"]
    start = data["start_date"]
    end = data["end_date"]
    config = data.get("config", {})

    days = []
    d = start
    while d <= end:
        days.append(d)
        d += timedelta(days=1)

    S = range(len(staff))      # staff indices
    D = range(len(days))       # day indices
    T = range(len(shift_types))# shift type indices
    U = range(len(units))      # unit indices

    model = cp_model.CpModel()

    # ── Variables: X[s][d][t][u] = 1 if staff s works shift t in unit u on day d
    X = {}
    for s in S:
        for d in D:
            for t in T:
                for u in U:
                    X[(s, d, t, u)] = model.NewBoolVar(f"X_{s}_{d}_{t}_{u}")

    # Helper: is staff s working on day d?
    works = {}
    for s in S:
        for d in D:
            works[(s, d)] = model.NewBoolVar(f"works_{s}_{d}")

    # ── HARD CONSTRAINTS ──

    # C1: One shift per day max
    for s in S:
        for d in D:
            model.Add(sum(X[(s, d, t, u)] for t in T for u in U) == works[(s, d)])
            model.Add(works[(s, d)] <= 1)

    # C2: Min coverage per unit per shift type
    for d in D:
        for u in U:
            unit_code = units[u]
            day_dow = days[d].weekday()  # 0=Mon..6=Sun
            for t in T:
                shift_code = shift_types[t]["code"]
                cov = coverage.get((unit_code, shift_code), {"min_as": 0, "min_rw": 0, "min_total": 0})
                # Min total
                model.Add(sum(X[(s, d, t, u)] for s in S) >= cov["min_total"])
                # Min AS
                as_staff = [s for s in S if staff[s]["role"] == "AS"]
                model.Add(sum(X[(s, d, t, u)] for s in as_staff) >= cov["min_as"])
                # Min RW
                rw_staff = [s for s in S if staff[s]["role"] in ("RW", "PA")]
                model.Add(sum(X[(s, d, t, u)] for s in rw_staff) >= cov["min_rw"])

    # C3: Respect leave
    for s in S:
        sid = staff[s]["id"]
        for d in D:
            if days[d] in leave.get(sid, set()):
                model.Add(works[(s, d)] == 0)

    # C4: Staff can only work in their home/cross units
    for s in S:
        allowed = set(staff[s]["can_work_units"])
        for d in D:
            for t in T:
                for u in U:
                    if units[u] not in allowed:
                        model.Add(X[(s, d, t, u)] == 0)

    # C5: Night shift → rest hours (0 = disabled)
    night_rest_cfg = config.get("hard_constraints", {}).get("night_rest_24h", {})
    if isinstance(night_rest_cfg, dict):
        night_rest_enabled = night_rest_cfg.get("enabled", False)
        night_rest_hours = night_rest_cfg.get("hours", 24)
    else:
        night_rest_enabled = bool(night_rest_cfg)
        night_rest_hours = 24
    if night_rest_enabled and night_rest_hours > 0:
        rest_days = max(1, night_rest_hours // 24)
        for s in S:
            for d in D[:-rest_days]:
                for t in T:
                    if shift_types[t]["category"] == "night":
                        night_today = sum(X[(s, d, t, u)] for u in U)
                        for offset in range(1, rest_days + 1):
                            if d + offset < len(days):
                                model.Add(works[(s, d + offset)] <= 1 - night_today)

    # C6: Max consecutive days
    maxc_cfg = config.get("hard_constraints", {}).get("max_consecutive_days", {})
    if isinstance(maxc_cfg, dict):
        max_consec = maxc_cfg.get("value", 6) if maxc_cfg.get("enabled", False) else 0
    else:
        max_consec = maxc_cfg or 0
    if max_consec > 0 and max_consec < len(days):
        for s in S:
            for d in range(len(days) - max_consec):
                model.Add(sum(works[(s, d + k)] for k in range(max_consec + 1)) <= max_consec)

    # C7: Locked assignments
    for (sid, shift_date), lock_info in locked.items():
        s_idx = next((i for i in S if staff[i]["id"] == sid), None)
        d_idx = next((i for i in D if days[i] == shift_date), None)
        if s_idx is not None and d_idx is not None:
            t_idx = next((i for i in T if shift_types[i]["code"] == lock_info["shift"]), None)
            u_idx = next((i for i in U if units[i] == lock_info["unit"]), None)
            if t_idx is not None and u_idx is not None:
                model.Add(X[(s_idx, d_idx, t_idx, u_idx)] == 1)

    # C8: Required skills coverage
    req_skills_cfg = config.get("hard_constraints", {}).get("required_skills", {})
    req_skills = req_skills_cfg.get("skills", []) if isinstance(req_skills_cfg, dict) else (req_skills_cfg or [])
    if req_skills_cfg.get("enabled") and req_skills:
        for d in D:
            for u in U:
                for skill in req_skills:
                    skilled = [s for s in S if skill in staff[s].get("skill_tags", [])]
                    if skilled:
                        model.Add(sum(works[(s, d)] for s in skilled) >= 1)

    # ── SOFT CONSTRAINTS (penalties) ──
    soft = config.get("soft_constraints", {})
    penalties = []

    # S1: Avoid consecutive night shifts
    sc = soft.get("avoid_consecutive_nights", {})
    if sc.get("enabled", True):
        for s in S:
            for d in range(len(days) - 1):
                for t in T:
                    if shift_types[t]["category"] == "night":
                        n1 = sum(X[(s, d, t, u)] for u in U)
                        n2 = sum(X[(s, d + 1, t, u)] for u in U)
                        p = model.NewBoolVar(f"penalty_night_{s}_{d}")
                        model.Add(n1 + n2 <= 1 + p)
                        penalties.append(p * sc.get("weight", 100))

    # S2: Fair weekend distribution
    sc = soft.get("fair_weekend_distribution", {})
    if sc.get("enabled", True):
        weekend_days = [d for d in D if days[d].weekday() >= 5]  # Sat=5, Sun=6
        target = len(weekend_days) * len(S) // max(len(S), 1)  # target per person
        for s in S:
            actual = sum(works[(s, d)] for d in weekend_days)
            excess = model.NewIntVar(0, len(weekend_days), f"weekend_excess_{s}")
            deficit = model.NewIntVar(0, len(weekend_days), f"weekend_deficit_{s}")
            model.Add(actual - target == excess - deficit)
            penalties.append((excess + deficit) * sc.get("weight", 50))

    # S3: Certain roles avoid night shifts (configurable)
    sc = soft.get("as_avoid_night", {})
    if sc.get("enabled", True):
        avoid_roles = sc.get("roles", ["AS"])
        for s in S:
            if staff[s]["role"] in avoid_roles:
                for d in D:
                    for t in T:
                        if shift_types[t]["category"] == "night":
                            for u in U:
                                penalties.append(X[(s, d, t, u)] * sc.get("weight", 150))

    # S4: Minimize cross-unit assignments
    sc = soft.get("minimize_cross_unit", {})
    if sc.get("enabled", True):
        for s in S:
            home = staff[s]["home_unit"]
            for d in D:
                for t in T:
                    for u in U:
                        if units[u] != home:
                            penalties.append(X[(s, d, t, u)] * sc.get("weight", 30))

    # S5: Prefer same-unit continuity (avoid daily unit switches)
    sc = soft.get("same_unit_continuity", {})
    if sc.get("enabled", False):
        for s in S:
            for d in range(len(days) - 1):
                for u in U:
                    # If working in unit u today but different unit tomorrow → penalty
                    today_u = sum(X[(s, d, t, u)] for t in T)
                    tomorrow_other = sum(X[(s, d + 1, t, u2)] for t in T for u2 in U if u2 != u)
                    # Only penalize if working both days
                    p = model.NewBoolVar(f"unit_switch_{s}_{d}_{u}")
                    model.Add(today_u + tomorrow_other <= 1 + p)
                    penalties.append(p * sc.get("weight", 20))

    # S6: ABC group — avoid all members off simultaneously
    sc = soft.get("abc_group_constraint", {})
    if sc.get("enabled", False):
        groups = sc.get("groups", [])  # e.g. [["A","B","C"], ["D","E"]]
        for group in groups:
            group_staff = [s for s in S if staff[s]["home_unit"] in group]
            if len(group_staff) >= 2:
                for d in D:
                    # At most len(group)-1 can be off
                    off_count = sum(1 - works[(s, d)] for s in group_staff)
                    excess = model.NewIntVar(0, len(group_staff), f"abc_excess_{d}")
                    model.Add(off_count - (len(group_staff) - 1) <= excess)
                    penalties.append(excess * sc.get("weight", 200))

    # Total penalty
    if penalties:
        model.Minimize(sum(penalties))

    # ── SOLVE ──
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.log_search_progress = False

    status = solver.Solve(model)
    status_map = {cp_model.OPTIMAL: "OPTIMAL", cp_model.FEASIBLE: "FEASIBLE",
                  cp_model.INFEASIBLE: "INFEASIBLE", cp_model.MODEL_INVALID: "MODEL_INVALID"}

    # ── BUILD OUTPUT ──
    assignments = []
    warnings = []
    coverage_actual = defaultdict(lambda: defaultdict(int))

    for s in S:
        for d in D:
            for t in T:
                for u in U:
                    if solver.Value(X[(s, d, t, u)]) == 1:
                        assignments.append({
                            "staff_id": staff[s]["id"],
                            "staff_name": staff[s]["name"],
                            "date": days[d].isoformat(),
                            "shift_code": shift_types[t]["code"],
                            "shift_label": shift_types[t]["label"],
                            "unit": units[u],
                            "locked": False,
                        })
                        coverage_actual[units[u]][shift_types[t]["code"]] += 1

    # Check coverage gaps
    for d in D:
        for u in U:
            unit_code = units[u]
            for t in T:
                shift_code = shift_types[t]["code"]
                cov = coverage.get((unit_code, shift_code), {})
                actual = coverage_actual[unit_code][shift_code]
                if actual < cov.get("min_total", 0):
                    warnings.append(f"{unit_code}社 {days[d]} {shift_code}更人手不足 (需{cov['min_total']}人, 得{actual}人)")

    return {
        "status": status_map.get(status, "UNKNOWN"),
        "assignments": assignments,
        "stats": {
            "total_shifts": len(assignments),
            "staff_count": len(staff),
            "day_count": len(days),
            "solve_time_ms": round(solver.WallTime() * 1000),
            "objective_value": int(solver.ObjectiveValue()) if penalties else 0,
        },
        "warnings": warnings,
    }


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd")

    p = sub.add_parser("solve")
    p.add_argument("--start", required=True, help="Start date YYYY-MM-DD")
    p.add_argument("--end", required=True, help="End date YYYY-MM-DD")
    p.add_argument("--config", default="default")

    args = parser.parse_args()

    if args.cmd == "solve":
        start_date = date.fromisoformat(args.start)
        end_date = date.fromisoformat(args.end)
        data = load_data(start_date, end_date)
        result = solve(data)
        print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
