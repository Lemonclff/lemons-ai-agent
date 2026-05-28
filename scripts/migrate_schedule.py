"""Run schedule schema migration on PostgreSQL."""
import psycopg2
import os

DB_URL = "postgresql://admin:Lemonclf0428!@localhost:5432/ai_dashboard_db"
SQL_PATH = os.path.join(os.path.dirname(__file__), '..', 'db', 'schedule_schema.sql')

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    with open(SQL_PATH, 'r') as f:
        sql = f.read()
    
    cur.execute(sql)
    conn.commit()
    
    # Verify
    cur.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_name LIKE 'schedule_%' ORDER BY table_name"
    )
    tables = [t[0] for t in cur.fetchall()]
    print(f"Tables created: {len(tables)}")
    for t in tables:
        cur.execute(f'SELECT count(*) FROM {t}')
        print(f"  {t}: {cur.fetchone()[0]} rows")
    
    conn.close()
    print("Migration OK")

if __name__ == '__main__':
    main()
