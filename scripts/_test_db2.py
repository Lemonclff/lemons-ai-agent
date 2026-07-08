import psycopg2

# Test connection without password (trust auth)
conn_str = "host=127.0.0.1 port=5432 dbname=ai_dashboard_db user=admin"
try:
    conn = psycopg2.connect(conn_str)
    print("SUCCESS (no password): Connected to PostgreSQL via 127.0.0.1")
    cur = conn.cursor()
    cur.execute("SELECT 1")
    print("Query works!")
    conn.close()
except Exception as e:
    print(f"FAILED (no password, 127.0.0.1): {e}")

# Test with password
conn_str2 = "host=127.0.0.1 port=5432 dbname=ai_dashboard_db user=admin password=lemon2026"
try:
    conn = psycopg2.connect(conn_str2)
    print("SUCCESS (with password): Connected to PostgreSQL via 127.0.0.1")
    conn.close()
except Exception as e:
    print(f"FAILED (with password, 127.0.0.1): {e}")

# Test with localhost
conn_str3 = "host=localhost port=5432 dbname=ai_dashboard_db user=admin"
try:
    conn = psycopg2.connect(conn_str3)
    print("SUCCESS (no password): Connected to PostgreSQL via localhost")
    conn.close()
except Exception as e:
    print(f"FAILED (no password, localhost): {e}")

# Test with DATABASE_URL format  
conn_str4 = "postgresql://admin:lemon2026@127.0.0.1:5432/ai_dashboard_db"
try:
    conn = psycopg2.connect(conn_str4)
    print("SUCCESS (DATABASE_URL format): Connected to PostgreSQL")
    conn.close()
except Exception as e:
    print(f"FAILED (DATABASE_URL format): {e}")
