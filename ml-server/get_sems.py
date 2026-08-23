import os
import psycopg2

db_url = os.getenv('DATABASE_URL')
if not db_url:
    raise ValueError("DATABASE_URL environment variable is not set")
conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute('SELECT id, name, "startDate", "endDate" FROM "semester";')
for row in cur.fetchall():
    print(row)
cur.close()
conn.close()
