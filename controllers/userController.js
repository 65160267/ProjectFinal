const db = require('../db');

exports.profile = async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/auth/login');
  try {
    // select all columns so we don't reference columns that may not exist in every schema
    const [rows] = await db.pool.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    const raw = rows[0] || { id: req.session.userId, username: req.session.username };
    
    // compute friendly fields with fallbacks
    const user = {
      id: raw.id,
      username: raw.username,
      full_name: raw.full_name || raw.name || raw.username,
      avatar: raw.avatar || req.session.avatar || null,
      location: raw.location || ''
    };

    // ดึงข้อมูลหนังสือของผู้ใช้ — แสดงเฉพาะหนังสือที่มี owner_id ตรงกับผู้ใช้เท่านั้น
    let userBooks = [];
    try {
      const [bookRows] = await db.pool.query('SELECT * FROM books WHERE owner_id = ? ORDER BY created_at DESC', [req.session.userId]);
      
      userBooks = bookRows.map(book => {
        // จัดรูปแบบรูปภาพ
        const thumb = (book.image || book.thumbnail || '/images/placeholder.png');
        book.thumbnail = (thumb && typeof thumb === 'string') ? 
          ((thumb.startsWith('/') || thumb.startsWith('http')) ? thumb : ('/uploads/' + thumb)) : 
          '/images/placeholder.png';
        
        return book;
      });
    } catch (bookErr) {
      console.error('Error fetching user books:', bookErr);
    }
    // ดึงคำขอแลกเปลี่ยนที่เข้ามาหาผู้ใช้ (pending)
    let incomingRequests = [];
    try {
      const [reqRows] = await db.pool.query(`
        SELECT id, requester_id, requester_username, requested_book_id, requested_book_title, message, status, created_at
        FROM exchange_requests_detailed
        WHERE book_owner_id = ? AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 5
      `, [req.session.userId]);
      incomingRequests = reqRows || [];
    } catch (reqErr) {
      // ถ้าไม่มีตารางหรือ view นี้ ให้ไม่ขัดขวางหน้าโปรไฟล์
      console.log('No exchange_requests_detailed view/table or error:', reqErr && reqErr.message);
      incomingRequests = [];
    }

    res.render('user', { user, userBooks, incomingRequests });
  } catch (err) {
    console.error('User profile error', err);
    res.status(500).send('DB error: ' + err.message);
  }
};

// render edit form
exports.edit = async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/auth/login');
  try {
    const [rows] = await db.pool.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    const raw = rows[0] || { id: req.session.userId, username: req.session.username };
    const user = {
      id: raw.id,
      username: raw.username,
      full_name: raw.full_name || raw.name || raw.username,
      avatar: raw.avatar || req.session.avatar || null,
      location: raw.location || ''
    };
    res.render('user_edit', { user });
  } catch (err) {
    console.error('User edit error', err);
    res.status(500).send('DB error: ' + err.message);
  }
};

// handle profile update (basic fields, safe to non-existing columns)
exports.update = async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/auth/login');
  try {
    // read submitted fields
    const { full_name, username, location } = req.body || {};

    // find which columns actually exist in users table
    const [cols] = await db.pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users'");
    const colSet = new Set(cols.map(c => c.COLUMN_NAME));

    const updates = [];
    const values = [];
    if (typeof full_name !== 'undefined' && colSet.has('full_name')) { updates.push('`full_name` = ?'); values.push(full_name || null); }
    if (typeof username !== 'undefined' && colSet.has('username')) { updates.push('`username` = ?'); values.push(username || null); }
    if (typeof location !== 'undefined' && colSet.has('location')) { updates.push('`location` = ?'); values.push(location || null); }

    if (updates.length) {
      const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
      values.push(req.session.userId);
      await db.pool.query(sql, values);
    }

    // handle uploaded avatar file (multer puts file on req.file)
    if (req.file) {
      const avatarPath = '/uploads/' + req.file.filename;
      // update DB only if avatar column exists
      if (colSet.has('avatar')) {
        await db.pool.query('UPDATE users SET `avatar` = ? WHERE id = ?', [avatarPath, req.session.userId]);
      }
      // always update session so the UI shows the new avatar immediately
      req.session.avatar = avatarPath;
    }

    // update session username if changed
    if (username) req.session.username = username;

    res.redirect('/user');
  } catch (err) {
    console.error('User update error', err);
    res.status(500).send('DB error: ' + err.message);
  }
};

module.exports = exports;

// Public view of a user's profile by id (read-only, for visitors)
exports.viewPublic = async (req, res) => {
  const userId = req.params.id;
  try {
    const [rows] = await db.pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!rows || rows.length === 0) return res.status(404).send('ไม่พบผู้ใช้นี้');
    const raw = rows[0];
    const user = {
      id: raw.id,
      username: raw.username,
      full_name: raw.full_name || raw.name || raw.username,
      avatar: raw.avatar || '/images/profile-placeholder.svg',
      location: raw.location || ''
    };

    // fetch this user's public books (optionally filter by availability)
    const [bookRows] = await db.pool.query('SELECT * FROM books WHERE owner_id = ? ORDER BY created_at DESC', [userId]);
    const userBooks = (bookRows || []).map(book => {
      const thumb = (book.image || book.thumbnail || '/images/placeholder.png');
      book.thumbnail = (thumb && typeof thumb === 'string') ? ((thumb.startsWith('/') || thumb.startsWith('http')) ? thumb : ('/uploads/' + thumb)) : '/images/placeholder.png';
      return book;
    });

    res.render('users/view', { user, userBooks });
  } catch (err) {
    console.error('Public user view error', err);
    res.status(500).send('DB error: ' + err.message);
  }
};
