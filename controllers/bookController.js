const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();

// helper to build header user with normalized avatar
async function buildHeaderUser(req) {
  const fallback = {
    id: req.session && req.session.userId,
    username: (req.session && req.session.username) || null,
    avatar: '/images/profile-placeholder.svg'
  };
  try {
    if (!req.session || !req.session.userId) return fallback;
    const [urows] = await db.pool.query('SELECT id, username, avatar FROM users WHERE id = ? LIMIT 1', [req.session.userId]);
    const u = (urows && urows[0]) || {};
    let avatar = u.avatar || (req.session && req.session.avatar) || null;
    if (!avatar) avatar = '/images/profile-placeholder.svg';
    else if (!/^https?:\/\//i.test(avatar) && !avatar.startsWith('/')) avatar = '/uploads/' + avatar;
    return { id: u.id || fallback.id, username: u.username || fallback.username, avatar };
  } catch (e) {
    return fallback;
  }
}

exports.listBooks = async (req, res) => {
  // ปรับให้หน้า /books แสดงเฉพาะหนังสือของผู้ใช้ที่ล็อกอินเท่านั้น
  if (!req.session || !req.session.userId) return res.redirect('/auth/login');
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12; // แสดง 12 เล่มต่อหน้า
    const offset = (page - 1) * limit;

    const [[{ total }]] = await db.pool.query('SELECT COUNT(*) as total FROM books WHERE owner_id = ?', [req.session.userId]);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const [rows] = await db.pool.query('SELECT * FROM books WHERE owner_id = ? ORDER BY id DESC LIMIT ? OFFSET ?', [req.session.userId, limit, offset]);
    rows.forEach(b => {
      const thumb = (b.image || b.thumbnail || '/images/placeholder.png');
      if (thumb && typeof thumb === 'string') {
        b.thumbnail = (thumb.startsWith('/') || thumb.startsWith('http')) ? thumb : ('/uploads/' + thumb);
      } else {
        b.thumbnail = '/images/placeholder.png';
      }
      b.tags = b.tags || b.category || b.wanted || '';
    });

    const headerUser = await buildHeaderUser(req);
    res.render('books/list', {
      books: rows,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
      },
      pageTitle: 'รายการของฉัน',
      basePath: '/books',
      user: headerUser
    });
  } catch (err) {
    console.error('List books (mine) error:', err);
    res.status(500).send('DB error: ' + err.message);
  }
};

// List only books owned by the logged-in user
exports.listUserBooks = async (req, res) => {
  if (!req.session || !req.session.userId) return res.redirect('/auth/login');
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const offset = (page - 1) * limit;

    const [[{total}]] = await db.pool.query('SELECT COUNT(*) as total FROM books WHERE owner_id = ?', [req.session.userId]);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const [rows] = await db.pool.query('SELECT * FROM books WHERE owner_id = ? ORDER BY id DESC LIMIT ? OFFSET ?', [req.session.userId, limit, offset]);
    rows.forEach(b => {
      const thumb = (b.image || b.thumbnail || '/images/placeholder.png');
      if (thumb && typeof thumb === 'string') {
        b.thumbnail = (thumb.startsWith('/') || thumb.startsWith('http')) ? thumb : ('/uploads/' + thumb);
      } else {
        b.thumbnail = '/images/placeholder.png';
      }
      b.tags = b.tags || b.category || b.wanted || '';
    });

    const headerUser = await buildHeaderUser(req);
    res.render('books/list', {
      books: rows,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1
      },
      pageTitle: 'รายการของฉัน',
      basePath: '/books/mine',
      user: headerUser
    });
  } catch (err) {
    console.error('List user books error:', err);
    res.status(500).send('DB error: ' + err.message);
  }
};

exports.showCreateForm = async (req, res) => {
  try {
    const headerUser = await buildHeaderUser(req);
    res.render('books/new', { user: headerUser });
  } catch (e) {
    // fallback render if header user fails
    res.render('books/new');
  }
};

exports.createBook = async (req, res) => {
  // defensive: avoid destructuring from undefined
  const {
    title = null,
    author = null,
    description = null,
    category = null,
    condition = null,
    wanted = null,
    location = null
  } = req.body || {};
  try {
    const imageFile = req.file ? req.file.filename : null;

    // Gather possible columns and build an insert dynamically depending on what's available
    const [cols] = await db.pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='books'");
    const colSet = new Set(cols.map(c => c.COLUMN_NAME));

    // Map form fields to DB columns if they exist
    const insertCols = [];
    const insertPlaceholders = [];
    const insertValues = [];

    // Always insert title (if column exists)
    if (colSet.has('title')) { insertCols.push('title'); insertPlaceholders.push('?'); insertValues.push(title || null); }
    if (colSet.has('author')) { insertCols.push('author'); insertPlaceholders.push('?'); insertValues.push(author || null); }
    if (colSet.has('description')) { insertCols.push('description'); insertPlaceholders.push('?'); insertValues.push(description || null); }
    


    // prefer 'tags' column for wanted/category aggregation, fallback to 'category' if available
    const tagsValue = wanted || category || null;
    if (colSet.has('tags')) { insertCols.push('tags'); insertPlaceholders.push('?'); insertValues.push(tagsValue); }
    else if (colSet.has('category')) { insertCols.push('category'); insertPlaceholders.push('?'); insertValues.push(category || null); }

    if (colSet.has('condition')) { insertCols.push('condition'); insertPlaceholders.push('?'); insertValues.push(condition || null); }
    if (colSet.has('location')) { insertCols.push('location'); insertPlaceholders.push('?'); insertValues.push(location || null); }

    // save image into 'thumbnail' if exists, otherwise 'image'
    if (imageFile) {
      if (colSet.has('thumbnail')) { insertCols.push('thumbnail'); insertPlaceholders.push('?'); insertValues.push('/uploads/' + imageFile); }
      else if (colSet.has('image')) { insertCols.push('image'); insertPlaceholders.push('?'); insertValues.push('/uploads/' + imageFile); }
    }

    // Add owner_id if user is logged in
    if (req.session && req.session.userId && colSet.has('owner_id')) {
      insertCols.push('owner_id');
      insertPlaceholders.push('?');
      insertValues.push(req.session.userId);
    }

    if (insertCols.length === 0) {
      // nothing to insert? return error
      return res.status(500).send('No writable columns found in books table');
    }

  // wrap column names in backticks to avoid reserved-word collisions (e.g., `condition`)
  const safeCols = insertCols.map(c => '`' + c + '`').join(',');
  const sql = `INSERT INTO books (${safeCols}) VALUES (${insertPlaceholders.join(',')})`;
    await db.pool.query(sql, insertValues);

    // redirect to dashboard so newly posted item appears there
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Create book error', err);
    res.status(500).send('DB error: ' + err.message);
  }
};

exports.viewBook = async (req, res) => {
  const id = req.params.id;
  try {
    // ดึงข้อมูลหนังสือพร้อมข้อมูลเจ้าของ (ถ้ามี owner_id)
    const [rows] = await db.pool.query(`
      SELECT b.*, u.id as owner_id, u.username as owner_username, u.full_name as owner_full_name, u.location as owner_location, u.avatar as owner_avatar, u.is_active as owner_is_active, u.last_login as owner_last_login
      FROM books b
      LEFT JOIN users u ON b.owner_id = u.id
      WHERE b.id = ?
    `, [id]);
    
    if (!rows.length) return res.status(404).send('หนังสือที่ต้องการดูไม่พบ');
    
    const book = rows[0];

    // จัดรูปแบบข้อมูลรูปภาพ
    const thumb = (book.image || book.thumbnail || '/images/placeholder.png');
    if (thumb && typeof thumb === 'string') {
      book.thumbnail = (thumb.startsWith('/') || thumb.startsWith('http')) ? thumb : ('/uploads/' + thumb);
    } else {
      book.thumbnail = '/images/placeholder.png';
    }

    // จัดรูปแบบข้อมูลแท็กและหมวดหมู่
    book.tags = book.tags || book.category || book.wanted || 'ไม่ระบุ';
    book.category = book.category || 'ไม่ระบุหมวดหมู่';
    book.wanted = book.wanted || 'ไม่ระบุ';
    
    // จัดรูปแบบสภาพของหนังสือ
    if (book.condition) {
      switch(book.condition) {
        case 'new': book.conditionText = 'ใหม่'; break;
        case 'good': book.conditionText = 'ดี'; break;
        case 'used': book.conditionText = 'ผ่านการใช้งาน'; break;
        default: book.conditionText = book.condition;
      }
    } else {
      book.conditionText = 'ไม่ระบุ';
    }

    // จัดรูปแบบข้อมูลเจ้าของ
    book.ownerName = book.owner_full_name || book.owner_username || 'ไม่ทราบ';
    book.ownerLocation = book.owner_location || book.location || 'ไม่ระบุที่อยู่';
  book.ownerId = book.owner_id || null;
  // owner active flag: treat 0 as suspended, otherwise active
  book.ownerActive = !(book.owner_is_active === 0);
  // owner last login timestamp (if any)
  book.ownerLastLogin = book.owner_last_login || null;
  // owner avatar: normalize path if present
    if (book.owner_avatar) {
      book.ownerAvatar = (book.owner_avatar.startsWith('/') || book.owner_avatar.startsWith('http')) ? book.owner_avatar : ('/uploads/' + book.owner_avatar);
    } else {
      book.ownerAvatar = '/images/profile-placeholder.svg';
    }

    // จัดรูปแบบสถานที่แลกเปลี่ยน
    book.exchangeLocation = book.location || 'ไม่ระบุสถานที่';

    // จัดรูปแบบข้อมูลผู้แต่ง
    book.author = book.author || 'ไม่ระบุผู้แต่ง';

    // จัดรูปแบบวันที่สร้าง
    if (book.created_at) {
      book.createdDate = new Date(book.created_at).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      book.createdDate = 'ไม่ทราบ';
    }

    // จัดรูปแบบวันที่แก้ไขล่าสุด (ถ้ามี)
    if (book.updated_at) {
      book.updatedDate = new Date(book.updated_at).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // ตรวจสอบสถานะว่าง
    book.isAvailable = book.is_available !== 0;
    book.availabilityText = book.isAvailable ? 'พร้อมแลกเปลี่ยน' : 'ไม่พร้อมแลกเปลี่ยน';

    // จัดรูปแบบรายละเอียด
    book.description = book.description || 'ไม่มีรายละเอียดเพิ่มเติม';

    // ดึงหนังสือของ user ปัจจุบันเพื่อให้เลือกแลกเปลี่ยน (ถ้าล็อกอินแล้ว)
    let userBooks = [];
    if (req.session && req.session.userId) {
      try {
        const [userBookRows] = await db.pool.query(
          'SELECT id, title, author FROM books WHERE owner_id = ? AND is_available = 1 AND id != ?',
          [req.session.userId, id]
        );
        userBooks = userBookRows;
      } catch (bookErr) {
        console.error('Error fetching user books for exchange:', bookErr);
      }
    }

    // record a view for this book (best effort)
    try {
      await db.pool.query('INSERT INTO book_views (book_id, viewer_id) VALUES (?, ?)', [id, (req.session && req.session.userId) || null]);
    } catch (e) {
      // ignore if table not exists
    }

    // header user for avatar in header
    const headerUser = await buildHeaderUser(req);
    res.render('books/view', { book, userBooks, user: headerUser });
  } catch (err) {
    console.error('View book error:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการแสดงรายละเอียดหนังสือ: ' + err.message);
  }
};
