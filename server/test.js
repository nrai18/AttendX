require('dotenv').config();
const { Pool } = require('pg');

async function test() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  
  await client.query(INSERT INTO \"User\" (id, email, name, birthday, \"passwordHash\", \"updatedAt\") VALUES ('test-bday-1', 'test@test.com', 'Test User', '2000-09-29T18:30:00Z', 'hash', NOW()) ON CONFLICT DO NOTHING);
  
  const res1 = await client.query(SELECT EXTRACT(DAY FROM birthday) as d1, EXTRACT(DAY FROM birthday AT TIME ZONE 'Asia/Kolkata') as d2 FROM \"User\" WHERE id='test-bday-1');
  console.log('Extraction Test:', res1.rows[0]);
  
  await client.query(DELETE FROM \"User\" WHERE id='test-bday-1');
  
  client.release();
  await pool.end();
}
test().catch(console.error);
