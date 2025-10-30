const db = require('../db');

// แสดงรายการคำขอแลกเปลี่ยนที่ส่งมาหาฉัน
exports.getIncomingRequests = async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/auth/login');
  }

  try {
    // Fetch requests and include book image fields so the view can show uploaded covers
    const [requests] = await db.pool.query(`
      SELECT er.*, ru.username as requester_username, ru.full_name as requester_name,
        ou.username as owner_username,
        rb.title as requested_book_title, rb.author as requested_book_author, rb.condition as requested_book_condition, rb.thumbnail as requested_book_thumbnail, rb.image as requested_book_image,
        ob.title as offered_book_title, ob.author as offered_book_author, ob.condition as offered_book_condition, ob.thumbnail as offered_book_thumbnail, ob.image as offered_book_image
      FROM exchange_requests er
      LEFT JOIN users ru ON er.requester_id = ru.id
      LEFT JOIN users ou ON er.book_owner_id = ou.id
      LEFT JOIN books rb ON er.requested_book_id = rb.id
      LEFT JOIN books ob ON er.offered_book_id = ob.id
      WHERE er.book_owner_id = ?
      ORDER BY er.created_at DESC
    `, [req.session.userId]);

    // normalize thumbnail URLs to match how books are rendered elsewhere
    requests.forEach(r => {
      function normalize(src) {
        if (!src) return '/images/profile-placeholder.svg';
        src = String(src).trim();
        if (/^https?:\/\//i.test(src)) return src;
        if (src.startsWith('/')) return src;
        return '/uploads/' + src;
      }
      function conditionText(cond) {
        if (!cond) return 'ไม่ระบุ';
        switch(String(cond)) {
          case 'new': return 'ใหม่';
          case 'good': return 'ดี';
          case 'used': return 'ผ่านการใช้งาน';
          default: return cond;
        }
      }
      r.requested_book_thumbnail = normalize(r.requested_book_thumbnail || r.requested_book_image);
      r.offered_book_thumbnail = normalize(r.offered_book_thumbnail || r.offered_book_image);
      // friendly names and condition text
      r.requester_name = r.requester_name || r.requester_username || 'ไม่ระบุ';
      r.requested_book_condition_text = conditionText(r.requested_book_condition);
      r.offered_book_condition_text = conditionText(r.offered_book_condition);
    });

    res.render('exchange/incoming', { requests });
  } catch (error) {
    console.error('Error fetching incoming requests:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดคำขอแลกเปลี่ยน');
  }
};

// แสดงรายการคำขอแลกเปลี่ยนที่ฉันส่งไป
exports.getOutgoingRequests = async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/auth/login');
  }

  try {
    const [requests] = await db.pool.query(`
      SELECT er.*, ru.username as requester_username, ru.full_name as requester_name,
        ou.username as owner_username,
        rb.title as requested_book_title, rb.author as requested_book_author, rb.condition as requested_book_condition, rb.thumbnail as requested_book_thumbnail, rb.image as requested_book_image,
        ob.title as offered_book_title, ob.author as offered_book_author, ob.condition as offered_book_condition, ob.thumbnail as offered_book_thumbnail, ob.image as offered_book_image
      FROM exchange_requests er
      LEFT JOIN users ru ON er.requester_id = ru.id
      LEFT JOIN users ou ON er.book_owner_id = ou.id
      LEFT JOIN books rb ON er.requested_book_id = rb.id
      LEFT JOIN books ob ON er.offered_book_id = ob.id
      WHERE er.requester_id = ?
      ORDER BY er.created_at DESC
    `, [req.session.userId]);

    requests.forEach(r => {
      function normalize(src) {
        if (!src) return '/images/profile-placeholder.svg';
        src = String(src).trim();
        if (/^https?:\/\//i.test(src)) return src;
        if (src.startsWith('/')) return src;
        return '/uploads/' + src;
      }
      function conditionText(cond) {
        if (!cond) return 'ไม่ระบุ';
        switch(String(cond)) {
          case 'new': return 'ใหม่';
          case 'good': return 'ดี';
          case 'used': return 'ผ่านการใช้งาน';
          default: return cond;
        }
      }
      r.requested_book_thumbnail = normalize(r.requested_book_thumbnail || r.requested_book_image);
      r.offered_book_thumbnail = normalize(r.offered_book_thumbnail || r.offered_book_image);
      r.requester_name = r.requester_name || r.requester_username || 'ไม่ระบุ';
      r.requested_book_condition_text = conditionText(r.requested_book_condition);
      r.offered_book_condition_text = conditionText(r.offered_book_condition);
    });

    res.render('exchange/outgoing', { requests });
  } catch (error) {
    console.error('Error fetching outgoing requests:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดคำขอแลกเปลี่ยน');
  }
};

// ส่งคำขอแลกเปลี่ยน
exports.sendRequest = async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/auth/login');
  }

  const { bookId } = req.params;
  const { message, offeredBookId } = req.body;

  try {
    // ตรวจสอบว่าหนังสือที่ขอแลกเปลี่ยนมีอยู่จริง
    const [bookRows] = await db.pool.query(
      'SELECT * FROM books WHERE id = ? AND owner_id IS NOT NULL',
      [bookId]
    );

    if (!bookRows.length) {
      return res.status(404).send('ไม่พบหนังสือที่ต้องการแลกเปลี่ยน');
    }

    const book = bookRows[0];

    // ตรวจสอบว่าไม่ใช่หนังสือของตัวเอง
    if (book.owner_id === req.session.userId) {
      return res.status(400).send('ไม่สามารถขอแลกเปลี่ยนหนังสือของตัวเองได้');
    }

    // ตรวจสอบว่าเคยส่งคำขอสำหรับหนังสือนี้แล้วหรือไม่
    const [existingRequests] = await db.pool.query(
      'SELECT id FROM exchange_requests WHERE requester_id = ? AND requested_book_id = ? AND status IN ("pending", "accepted")',
      [req.session.userId, bookId]
    );

    if (existingRequests.length > 0) {
      return res.status(400).send('คุณได้ส่งคำขอแลกเปลี่ยนหนังสือนี้แล้ว');
    }

    // สร้างคำขอแลกเปลี่ยนใหม่
    await db.pool.query(
      'INSERT INTO exchange_requests (requester_id, book_owner_id, requested_book_id, offered_book_id, message) VALUES (?, ?, ?, ?, ?)',
      [req.session.userId, book.owner_id, bookId, offeredBookId || null, message || '']
    );

    res.redirect(`/books/${bookId}?success=request_sent`);
  } catch (error) {
    console.error('Error sending exchange request:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการส่งคำขอแลกเปลี่ยน');
  }
};

// ยืนยันการแลกเปลี่ยน (อนุมัติ)
exports.acceptRequest = async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/auth/login');
  }

  const { requestId } = req.params;

  try {
    // ตรวจสอบว่าคำขอนี้เป็นของเจ้าของหนังสือ
    const [requestRows] = await db.pool.query(
      'SELECT * FROM exchange_requests WHERE id = ? AND book_owner_id = ? AND status = "pending"',
      [requestId, req.session.userId]
    );

    if (!requestRows.length) {
      return res.status(404).send('ไม่พบคำขอแลกเปลี่ยนหรือไม่มีสิทธิ์');
    }

    const request = requestRows[0];

    // อัพเดทสถานะคำขอเป็น accepted
    await db.pool.query(
      'UPDATE exchange_requests SET status = "accepted", updated_at = NOW() WHERE id = ?',
      [requestId]
    );

    // อัพเดทสถานะหนังสือเป็นไม่พร้อมแลกเปลี่ยน
    await db.pool.query(
      'UPDATE books SET is_available = 0 WHERE id = ?',
      [request.requested_book_id]
    );

    // หากมีการเสนอแลกเปลี่ยนหนังสือ ให้อัพเดทสถานะหนังสือที่เสนอด้วย
    if (request.offered_book_id) {
      await db.pool.query(
        'UPDATE books SET is_available = 0 WHERE id = ?',
        [request.offered_book_id]
      );
    }

    res.redirect('/exchange/incoming?success=request_accepted');
  } catch (error) {
    console.error('Error accepting exchange request:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการยืนยันคำขอแลกเปลี่ยน');
  }
};

// ปฏิเสธการแลกเปลี่ยน
exports.rejectRequest = async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/auth/login');
  }

  const { requestId } = req.params;

  try {
    // ตรวจสอบว่าคำขอนี้เป็นของเจ้าของหนังสือ
    const [requestRows] = await db.pool.query(
      'SELECT * FROM exchange_requests WHERE id = ? AND book_owner_id = ? AND status = "pending"',
      [requestId, req.session.userId]
    );

    if (!requestRows.length) {
      return res.status(404).send('ไม่พบคำขอแลกเปลี่ยนหรือไม่มีสิทธิ์');
    }

    // อัพเดทสถานะคำขอเป็น rejected
    await db.pool.query(
      'UPDATE exchange_requests SET status = "rejected", updated_at = NOW() WHERE id = ?',
      [requestId]
    );

    res.redirect('/exchange/incoming?success=request_rejected');
  } catch (error) {
    console.error('Error rejecting exchange request:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการปฏิเสธคำขอแลกเปลี่ยน');
  }
};

// ยืนยันการแลกเปลี่ยนสำเร็จ (ทั้งสองฝ่ายต้องยืนยัน)
exports.completeExchange = async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/auth/login');
  }

  const { requestId } = req.params;

  try {
    // ตรวจสอบว่าเป็นเจ้าของคำขอหรือเจ้าของหนังสือ
    const [requestRows] = await db.pool.query(
      'SELECT * FROM exchange_requests WHERE id = ? AND (requester_id = ? OR book_owner_id = ?) AND status = "accepted"',
      [requestId, req.session.userId, req.session.userId]
    );

    if (!requestRows.length) {
      return res.status(404).send('ไม่พบคำขอแลกเปลี่ยนหรือไม่มีสิทธิ์');
    }

    const request = requestRows[0];

    // อัพเดทสถานะคำขอเป็น completed
    await db.pool.query(
      'UPDATE exchange_requests SET status = "completed", updated_at = NOW(), completed_at = NOW() WHERE id = ?',
      [requestId]
    );

    // เก็บประวัติการแลกเปลี่ยนลงในตาราง exchange_history
    try {
      await db.pool.query(
        `INSERT INTO exchange_history (exchange_request_id, user1_id, user2_id, book1_id, book2_id, exchange_date)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [requestId, request.requester_id, request.book_owner_id, request.requested_book_id, request.offered_book_id || null]
      );
    } catch (histErr) {
      console.error('Error inserting exchange_history:', histErr);
      // continue even if history insert fails
    }

    // โอนความเป็นเจ้าของหนังสือ (swap) ถ้ามีหนังสือที่เสนอแลก
    try {
      // ให้ผู้ขอเป็นเจ้าของหนังสือที่ขอ (requested_book)
      await db.pool.query('UPDATE books SET owner_id = ? WHERE id = ?', [request.requester_id, request.requested_book_id]);

      // ถ้ามีหนังสือที่เสนอแลก ให้เจ้าของเดิมรับหนังสือที่เสนอ
      if (request.offered_book_id) {
        await db.pool.query('UPDATE books SET owner_id = ? WHERE id = ?', [request.book_owner_id, request.offered_book_id]);
      }
    } catch (transferErr) {
      console.error('Error transferring book ownership:', transferErr);
    }

    // อัพเดทจำนวนการแลกเปลี่ยนของทั้งสองฝ่าย
    await db.pool.query(
      'UPDATE users SET exchange_count = exchange_count + 1 WHERE id IN (?, ?)',
      [request.requester_id, request.book_owner_id]
    );

    // ส่งกลับไปหน้าที่เหมาะสม
    if (req.session.userId === request.requester_id) {
      res.redirect('/exchange/outgoing?success=exchange_completed');
    } else {
      res.redirect('/exchange/incoming?success=exchange_completed');
    }
  } catch (error) {
    console.error('Error completing exchange:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการยืนยันการแลกเปลี่ยนสำเร็จ');
  }
};

// แสดงประวัติการแลกเปลี่ยนสำหรับผู้ใช้ที่ล็อกอิน
exports.getHistory = async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/auth/login');

  // helper: normalize thumbnail/url
  function normalize(src) {
    if (!src) return '/images/profile-placeholder.svg';
    src = String(src).trim();
    if (/^https?:\/\//i.test(src)) return src;
    if (src.startsWith('/')) return src;
    return '/uploads/' + src;
  }

  // fallback: synthesize history from completed exchange_requests
  async function loadFallbackHistory(userId) {
    try {
      const [reqRows] = await db.pool.query(`
   SELECT er.id as exchange_request_id,
     er.requester_id as user1_id,
     er.book_owner_id as user2_id,
     er.requested_book_id as book1_id,
     er.offered_book_id as book2_id,
     CASE WHEN er.updated_at IS NOT NULL THEN er.updated_at ELSE er.created_at END as exchange_date,
               u1.username as user1_username, u2.username as user2_username,
               b1.title as book1_title, b1.thumbnail as book1_thumbnail,
               b2.title as book2_title, b2.thumbnail as book2_thumbnail
        FROM exchange_requests er
        LEFT JOIN users u1 ON er.requester_id = u1.id
        LEFT JOIN users u2 ON er.book_owner_id = u2.id
        LEFT JOIN books b1 ON er.requested_book_id = b1.id
        LEFT JOIN books b2 ON er.offered_book_id = b2.id
        WHERE er.status = 'completed' AND (er.requester_id = ? OR er.book_owner_id = ?)
        ORDER BY exchange_date DESC
      `, [userId, userId]);

      reqRows.forEach(r => {
        r.book1_thumbnail = normalize(r.book1_thumbnail);
        r.book2_thumbnail = normalize(r.book2_thumbnail);
      });
      return reqRows;
    } catch (e) {
      console.error('Fallback history load failed:', e && e.message);
      return [];
    }
  }

  try {
    const [rows] = await db.pool.query(`
      SELECT eh.*, 
             u1.username as user1_username, u2.username as user2_username,
             b1.title as book1_title, b1.thumbnail as book1_thumbnail,
             b2.title as book2_title, b2.thumbnail as book2_thumbnail
      FROM exchange_history eh
      LEFT JOIN users u1 ON eh.user1_id = u1.id
      LEFT JOIN users u2 ON eh.user2_id = u2.id
      LEFT JOIN books b1 ON eh.book1_id = b1.id
      LEFT JOIN books b2 ON eh.book2_id = b2.id
      WHERE eh.user1_id = ? OR eh.user2_id = ?
      ORDER BY eh.exchange_date DESC
    `, [req.session.userId, req.session.userId]);

    rows.forEach(r => {
      r.book1_thumbnail = normalize(r.book1_thumbnail);
      r.book2_thumbnail = normalize(r.book2_thumbnail);
    });

    // If no rows in exchange_history, try fallback from completed requests
    if (!rows || rows.length === 0) {
      const fallback = await loadFallbackHistory(req.session.userId);
      if (fallback && fallback.length > 0) {
        return res.render('exchange/history', { history: fallback });
      }
    }

    res.render('exchange/history', { history: rows });
  } catch (err) {
    console.error('Error fetching exchange history:', err);
    // If the exchange_history table doesn't exist, attempt fallback from exchange_requests
    if (err && err.code === 'ER_NO_SUCH_TABLE') {
      const fallback = await loadFallbackHistory(req.session.userId);
      if (fallback && fallback.length > 0) {
        return res.render('exchange/history', { history: fallback });
      }
      return res.render('exchange/history', { history: [], warning: 'ตาราง `exchange_history` ยังไม่มีในฐานข้อมูล — รันไฟล์ SQL `db/exchange_system_complete.sql` เพื่อสร้างตารางประวัติการแลกเปลี่ยน' });
    }
    res.status(500).send('เกิดข้อผิดพลาดในการดึงประวัติการแลกเปลี่ยน');
  }
};

module.exports = exports;