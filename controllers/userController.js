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

    // ดึงข้อมูลหนังสือของผู้ใช้
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
    res.render('user', { user, userBooks });
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
