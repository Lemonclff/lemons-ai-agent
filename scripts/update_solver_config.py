"""Update schedule solver config with all dynamic parameters."""
import psycopg2, json

DB_URL = "postgresql://admin:Lemonclf0428!@localhost:5432/ai_dashboard_db"

config = {
    "hard_constraints": {
        "one_shift_per_day": True,
        "min_coverage": True,
        "respect_leave": True,
        "home_unit_only": False,
        "night_rest_24h": {"enabled": False, "description": "夜更後必須休息≥24小時（人手充足時啟用）"},
        "max_consecutive_days": {"enabled": False, "value": 6, "description": "連續工作最多天數（0=不限制）"},
        "required_skills": {"enabled": False, "skills": [], "description": "每日必須至少一人有此技能（如急救、駕駛）"}
    },
    "soft_constraints": {
        "avoid_consecutive_nights": {"enabled": True, "weight": 100, "description": "避免連續夜更"},
        "fair_weekend_distribution": {"enabled": True, "weight": 50, "description": "公平分配週末更次"},
        "as_avoid_night": {"enabled": True, "weight": 150, "roles": ["AS"], "description": "主管避免夜更"},
        "minimize_cross_unit": {"enabled": True, "weight": 30, "description": "減少跨社調動"},
        "same_unit_continuity": {"enabled": False, "weight": 20, "description": "偏好連續同家社工作"},
        "abc_group_constraint": {
            "enabled": False, "weight": 200,
            "groups": [["A","B","C"], ["D","E"]],
            "description": "ABC組內避免全體同時放假"
        }
    },
    "optimization_goal": "balanced",
    "solver_timeout_seconds": 30
}

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute(
    "INSERT INTO schedule_config (config_key, config_json) VALUES ('default', %s) "
    "ON CONFLICT (config_key) DO UPDATE SET config_json = %s",
    (json.dumps(config, ensure_ascii=False), json.dumps(config, ensure_ascii=False))
)
conn.commit()
conn.close()

print("Config updated with all dynamic parameters:")
print(json.dumps(config, ensure_ascii=False, indent=2))
