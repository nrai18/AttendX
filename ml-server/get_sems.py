import os
import psycopg2

db_url = 'postgresql://neondb_owner:npg_qb7ElGdnD0Jv@ep-wispy-rice-azhgaqup.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute('SELECT id, name, "startDate", "endDate" FROM "semester";')
for row in cur.fetchall():
    print(row)
cur.close()
conn.close()
