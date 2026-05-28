"""Demo: realistic constraint config + 30-day schedule solve"""
import psycopg2, json
from datetime import date, timedelta

DB_URL = "postgresql://admin:Lemonclf0428!@localhost:5432/ai_dashboard_db"

# ═══════════════════════════════════════════════
# Step 1: Realistic config
# ═══════════════════════════════════════════════
config = {
    "hard_constraints": {
        "night_rest_24h": {"enabled": False, "description": "夜更後休息24h（人手不足時關閉）"},
        "max_consecutive_days": {"enabled": True, "value": 6, "description": "連續工作最多6日"},
        "required_skills": {"enabled": False, "skills": [], "description": "每日必須有急救牌"}
    },
    "soft_constraints": {
        "avoid_consecutive_nights": {"enabled": True, "weight": 100, "description": "避免連續夜更"},
        "fair_weekend_distribution": {"enabled": True, "weight": 50, "description": "公平分配週末"},
        "as_avoid_night": {"enabled": True, "weight": 150, "roles": ["AS"], "description": "主管避免夜更"},
        "minimize_cross_unit": {"enabled": True, "weight": 30, "description": "減少跨社調動"},
        "same_unit_continuity": {"enabled": False, "weight": 20, "description": "同社連續工作"},
        "abc_group_constraint": {
            "enabled": True, "weight": 200,
            "groups": [["A","B","C"], ["D","E"]],
            "description": "ABC組/D-E組避免全體放假"
        }
    }
}

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute("UPDATE schedule_config SET config_json=%s WHERE config_key='default'",
            (json.dumps(config, ensure_ascii=False),))
conn.commit()

# ═══════════════════════════════════════════════
# Step 2: Add sample leave
# ═══════════════════════════════════════════════
cur.execute("DELETE FROM schedule_leave")
sample_leave = [
    (1, '2026-07-10', '2026-07-12', 'annual', '陳主任年假'),
    (5, '2026-07-15', '2026-07-16', 'sick', '何姑娘病假'),
    (10, '2026-07-20', '2026-07-22', 'training', '周主任培訓'),
]
for sid, sd, ed, lt, note in sample_leave:
    cur.execute("INSERT INTO schedule_leave (staff_id,start_date,end_date,leave_type,notes) VALUES (%s,%s,%s,%s,%s)",
                (sid, sd, ed, lt, note))
conn.commit()

# ═══════════════════════════════════════════════
# Step 3: Verify setup
# ═══════════════════════════════════════════════
cur.execute("SELECT count(*) FROM schedule_staff WHERE is_active=true")
staff_count = cur.fetchone()[0]
cur.execute("SELECT unit, st.code, min_as, min_rw, min_total FROM schedule_coverage_rules cr JOIN schedule_shift_types st ON cr.shift_type_id=st.id ORDER BY unit, st.code")
coverage = cur.fetchall()
cur.execute("SELECT s.name, sl.start_date, sl.end_date, sl.leave_type FROM schedule_leave sl JOIN schedule_staff s ON sl.staff_id=s.id")
leaves = cur.fetchall()
conn.close()

print("=" * 60)
print("  智能排更 — 示範設定")
print("=" * 60)
print(f"\n📋 職員: {staff_count} 人 (5 AS + 9 RW + 1 PA)")
print(f"\n📐 人手要求:")
for c in coverage:
    print(f"  {c[0]}社 {c[1]}更: AS≥{c[2]} RW≥{c[3]} Total≥{c[4]}")
print(f"\n🏖 請假:")
for l in leaves:
    print(f"  {l[0]}: {l[1]} ~ {l[2]} ({l[3]})")

print(f"\n⚙️ 約束設定:")
print(f"  Hard: max_consecutive_days=6 (enabled)")
print(f"  Soft: avoid_consecutive_nights(100) + fair_weekend(50) + as_avoid_night(150)")
print(f"  Soft: abc_group_constraint(200) groups=[ABC,D-E]")
print(f"  Soft: minimize_cross_unit(30)")

print(f"\n🚀 Running solver for 2026-07 (31 days)...")
