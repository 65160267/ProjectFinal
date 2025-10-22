const db = require('../db');

// แสดงรายการคำขอแลกเปลี่ยนที่ส่งมาหาฉัน
exports.getIncomingRequests = async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/auth/login');
  }

  try {
    const [requests] = await db.pool.query(`
      SELECT * FROM exchange_requests_detailed 
      WHERE book_owner_id = ? 
      ORDER BY created_at DESC
    `, [req.session.userId]);

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
      SELECT * FROM exchange_requests_detailed 
      WHERE requester_id = ? 
      ORDER BY created_at DESC
    `, [req.session.userId]);

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
      'UPDATE exchange_requests SET status = "completed", updated_at = NOW() WHERE id = ?',
      [requestId]
    );

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

module.exports = exports;