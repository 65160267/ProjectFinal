const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function run() {
  const sqlPath = path.join(__dirname, '..', 'db', 'schema_full.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('schema_full.sql not found at', sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const conn = await pool.getConnection();
  try {
    // split on semicolons that end statements
    const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const st of statements) {
      try {
        await conn.query(st);
      } catch (e) {
        console.warn('Statement failed (continuing):', e.message);
      }
    }
    console.log('Full DB init complete');
  } catch (err) {
    console.error('Full DB init failed', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();