const fs = require('fs');
const path = require('path');
const db = require('../db');

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'chat_schema.sql'), 'utf8');
    // split statements by semicolon - naive but acceptable for simple DDL
    const stmts = sql.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length);
    for (const s of stmts) {
      try {
        await db.pool.query(s);
        console.log('Executed statement.');
      } catch (e) {
        console.error('Statement failed:', e && e.message);
      }
    }
    console.log('Chat schema init complete');
    process.exit(0);
  } catch (err) {
    console.error('Failed to initialize chat schema:', err && err.message);
    process.exit(1);
  }
}

run();
