const db = require('../db');

async function run() {
  const pool = db.pool;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // create ticket
    const [tRows] = await conn.query("SELECT id FROM tickets WHERE subject='__TEST_TICKET' LIMIT 1");
    let ticketId;
    if (tRows.length) ticketId = tRows[0].id;
    else {
      const [r] = await conn.query("INSERT INTO tickets (user_id, subject, body, status, priority) VALUES (?, ?, ?, ?, ?)", [null, '__TEST_TICKET', 'This is a test ticket', 'open', 'low']);
      ticketId = r.insertId;
    }

    // insert comment
    await conn.query("INSERT INTO ticket_comments (ticket_id, user_id, username, body) VALUES (?, ?, ?, ?)", [ticketId, null, '__system_test', 'This is a test comment']);

    await conn.commit();

    console.log('Created ticket', ticketId);
    const [comments] = await conn.query('SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC', [ticketId]);
    console.log('Comments:', comments);
  } catch (err) {
    await conn.rollback();
    console.error('Error:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
