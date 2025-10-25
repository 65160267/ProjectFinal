const db = require('../db');

async function run() {
  const pool = db.pool;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Create or find users
    const [uA] = await conn.query("SELECT id FROM users WHERE username='__test_user_A'");
    let userAId;
    if (uA.length) userAId = uA[0].id;
    else {
      const [res] = await conn.query("INSERT INTO users (username, password_hash, display_name) VALUES ('__test_user_A', '', '__TEST A')");
      userAId = res.insertId;
    }

    const [uB] = await conn.query("SELECT id FROM users WHERE username='__test_user_B'");
    let userBId;
    if (uB.length) userBId = uB[0].id;
    else {
      const [res] = await conn.query("INSERT INTO users (username, password_hash, display_name) VALUES ('__test_user_B', '', '__TEST B')");
      userBId = res.insertId;
    }

    // Create two books
    const [b1Rows] = await conn.query("SELECT id FROM books WHERE title='__TEST_BOOK_A' AND owner_id = ?", [userAId]);
    let bookAId;
    if (b1Rows.length) bookAId = b1Rows[0].id;
    else {
      const [r] = await conn.query("INSERT INTO books (title, owner_id, thumbnail, is_available) VALUES (?, ?, ?, 1)", ['__TEST_BOOK_A', userAId, '/uploads/1760820533107-7phukk.png']);
      bookAId = r.insertId;
    }

    const [b2Rows] = await conn.query("SELECT id FROM books WHERE title='__TEST_BOOK_B' AND owner_id = ?", [userBId]);
    let bookBId;
    if (b2Rows.length) bookBId = b2Rows[0].id;
    else {
      const [r] = await conn.query("INSERT INTO books (title, owner_id, thumbnail, is_available) VALUES (?, ?, ?, 1)", ['__TEST_BOOK_B', userBId, '/uploads/1760820533107-7phukk.png']);
      bookBId = r.insertId;
    }

    // Create exchange_request
    const [erRows] = await conn.query("SELECT id FROM exchange_requests WHERE requester_id = ? AND requested_book_id = ?", [userBId, bookAId]);
    let reqId;
    if (erRows.length) reqId = erRows[0].id;
    else {
      const [r] = await conn.query("INSERT INTO exchange_requests (requester_id, book_owner_id, requested_book_id, offered_book_id, status, message) VALUES (?, ?, ?, ?, 'accepted', 'test')", [userBId, userAId, bookAId, bookBId]);
      reqId = r.insertId;
    }

  // Simulate completion: update request (avoid completed_at if column missing)
  await conn.query("UPDATE exchange_requests SET status='completed', updated_at=NOW() WHERE id=?", [reqId]);

    // Insert into exchange_history
    await conn.query("INSERT INTO exchange_history (exchange_request_id, user1_id, user2_id, book1_id, book2_id, exchange_date) VALUES (?, ?, ?, ?, ?, NOW())", [reqId, userBId, userAId, bookAId, bookBId]);

    // Swap owners
    await conn.query("UPDATE books SET owner_id = ? WHERE id = ?", [userBId, bookAId]);
    await conn.query("UPDATE books SET owner_id = ? WHERE id = ?", [userAId, bookBId]);

    // Update users exchange_count
    await conn.query("UPDATE users SET exchange_count = COALESCE(exchange_count,0) + 1 WHERE id IN (?,?)", [userAId, userBId]);

    await conn.commit();

    console.log('Test exchange completed; requestId=', reqId, 'bookA=', bookAId, 'bookB=', bookBId);

    // show history rows for userA
    const [hist] = await conn.query('SELECT * FROM exchange_history WHERE user1_id=? OR user2_id=? ORDER BY exchange_date DESC LIMIT 5', [userAId, userAId]);
    console.log('Recent history rows:', hist);

  } catch (err) {
    await conn.rollback();
    console.error('Test script error:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
