"""Update schedule config — disable max_consecutive_days for short periods."""
import psycopg2, json
conn = psycopg2.connect('postgresql://admin:Lemonclf0428!@localhost:5432/ai_dashboard_db')
cur = conn.cursor()
cur.execute("SELECT config_json FROM schedule_config WHERE config_key='default'")
config = cur.fetchone()[0]
config['hard_constraints']['max_consecutive_days'] = 0
config['hard_constraints']['night_rest_24h'] = False
cur.execute("UPDATE schedule_config SET config_json=%s WHERE config_key='default'", (json.dumps(config),))
conn.commit()
conn.close()
print("max_consecutive_days=0, night_rest_24h=False")
