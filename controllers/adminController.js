const db = require('../db');

// Middleware to check admin permission
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.isAdmin) {
    // เปลี่ยนเส้นทางไปหน้าล็อกอินแทน
    return res.redirect('/auth/login');
  }
  next();
};

// Admin Dashboard
exports.dashboard = async (req, res) => {
  try {
    // Get statistics
    const [userCount] = await db.pool.query('SELECT COUNT(*) as count FROM users');
    const [bookCount] = await db.pool.query('SELECT COUNT(*) as count FROM books');
    const [exchangeCount] = await db.pool.query('SELECT COUNT(*) as count FROM exchange_requests WHERE 1=1');
    
    // Get recent activities
    const [recentUsers] = await db.pool.query('SELECT id, username, created_at FROM users ORDER BY created_at DESC LIMIT 5');
    const [recentBooks] = await db.pool.query('SELECT id, title, author, created_at FROM books ORDER BY created_at DESC LIMIT 5');
    
    // Monthly statistics
    const [monthlyStats] = await db.pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM users 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
    `);

    const stats = {
      users: userCount[0]?.count || 0,
      books: bookCount[0]?.count || 0,
      exchanges: exchangeCount[0]?.count || 0
    };

    res.render('admin/dashboard', {
      user: { 
        id: req.session.userId, 
        username: req.session.username, 
        isAdmin: req.session.isAdmin 
      },
      stats,
      recentUsers,
      recentBooks,
      monthlyStats
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).render('error', { 
      error: 'Database Error', 
      message: err.message 
    });
  }
};

// User Management
exports.users = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    
    const [users] = await db.pool.query(`
      SELECT id, username, display_name, role, created_at, last_login, is_active 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    const [totalCount] = await db.pool.query('SELECT COUNT(*) as count FROM users');
    const totalPages = Math.ceil(totalCount[0].count / limit);

    res.render('admin/users', {
      user: { 
        id: req.session.userId, 
        username: req.session.username, 
        isAdmin: req.session.isAdmin 
      },
      users,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).render('error', { 
      error: 'Database Error', 
      message: err.message 
    });
  }
};

// Book Management
exports.books = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    
    const [books] = await db.pool.query(`
      SELECT b.*, u.username as owner_username
      FROM books b
      LEFT JOIN users u ON b.owner_id = u.id
      ORDER BY b.created_at DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    const [totalCount] = await db.pool.query('SELECT COUNT(*) as count FROM books');
    const totalPages = Math.ceil(totalCount[0].count / limit);

    res.render('admin/books', {
      user: { 
        id: req.session.userId, 
        username: req.session.username, 
        isAdmin: req.session.isAdmin 
      },
      books,
      currentPage: page,
      totalPages
    });
  } catch (err) {
    console.error('Admin books error:', err);
    res.status(500).render('error', { 
      error: 'Database Error', 
      message: err.message 
    });
  }
};

// Exchange Management
exports.exchanges = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const filterUserId = req.query.userId ? parseInt(req.query.userId) : null;
    
    // Check if exchange_requests table exists
    let exchanges = [];
    let totalPages = 1;
    
    try {
      // Build WHERE clause when filtering by a specific user (as requester or owner)
      const where = filterUserId ? 'WHERE er.requester_id = ? OR er.book_owner_id = ?' : '';
      const params = filterUserId ? [filterUserId, filterUserId, limit, offset] : [limit, offset];
      const [exchangeData] = await db.pool.query(`
        SELECT er.*, 
               rb.title as requested_book_title,
               ob.title as offered_book_title,
               ru.username as requester_username,
               ou.username as owner_username
        FROM exchange_requests er
        LEFT JOIN books rb ON er.requested_book_id = rb.id
        LEFT JOIN books ob ON er.offered_book_id = ob.id
        LEFT JOIN users ru ON er.requester_id = ru.id
        LEFT JOIN users ou ON er.book_owner_id = ou.id
        ${where}
        ORDER BY er.created_at DESC 
        LIMIT ? OFFSET ?
      `, params);

      exchanges = exchangeData;

      // Count for pagination with the same filter
      const countSql = filterUserId 
        ? 'SELECT COUNT(*) as count FROM exchange_requests er WHERE er.requester_id = ? OR er.book_owner_id = ?'
        : 'SELECT COUNT(*) as count FROM exchange_requests';
      const countParams = filterUserId ? [filterUserId, filterUserId] : [];
      const [totalCount] = await db.pool.query(countSql, countParams);
      totalPages = Math.ceil((totalCount[0]?.count || 0) / limit);
    } catch (tableErr) {
      console.log('Exchange requests table not found, showing empty data');
    }

    res.render('admin/exchanges', {
      user: { 
        id: req.session.userId, 
        username: req.session.username, 
        isAdmin: req.session.isAdmin 
      },
      exchanges,
      currentPage: page,
      totalPages,
      currentFilterUserId: filterUserId
    });
  } catch (err) {
    console.error('Admin exchanges error:', err);
    res.status(500).render('error', { 
      error: 'Database Error', 
      message: err.message 
    });
  }
};

// Delete User
exports.deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID' });
    
    // Don't allow deleting admin users
    const [user] = await db.pool.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (user[0]?.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete admin user' });
    }
    
    await db.pool.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Toggle User Status
exports.toggleUserStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID' });
    
    const [user] = await db.pool.query('SELECT is_active FROM users WHERE id = ?', [userId]);
    if (!user[0]) return res.status(404).json({ error: 'User not found' });
    
    const newStatus = user[0].is_active ? 0 : 1;
    await db.pool.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, userId]);
    
    res.json({ success: true, is_active: newStatus });
  } catch (err) {
    console.error('Toggle user status error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete Book
exports.deleteBook = async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    if (!bookId) return res.status(400).json({ error: 'Invalid book ID' });
    
    await db.pool.query('DELETE FROM books WHERE id = ?', [bookId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete book error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Settings
exports.settings = async (req, res) => {
  try {
    res.render('admin/settings', {
      user: { 
        id: req.session.userId, 
        username: req.session.username, 
        isAdmin: req.session.isAdmin 
      }
    });
  } catch (err) {
    console.error('Admin settings error:', err);
    res.status(500).render('error', { 
      error: 'Error', 
      message: err.message 
    });
  }
};

// expose middleware
exports.requireAdmin = requireAdmin;

// Reports / Error reports management
exports.reports = async (req, res) => {
  try {
    // Try to read from admin_reports table if exists
    let reports = [];
    try {
      const [rows] = await db.pool.query(`SELECT id, reporter_username, title, description, status, created_at FROM admin_reports ORDER BY created_at DESC LIMIT 200`);
      reports = rows;
    } catch (err) {
      // Table might not exist yet — show empty list
      console.log('admin_reports table missing or unreadable:', err.message);
    }

    res.render('admin/reports', {
      user: {
        id: req.session.userId,
        username: req.session.username,
        isAdmin: req.session.isAdmin
      },
      reports
    });
  } catch (err) {
    console.error('Admin reports error:', err);
    res.status(500).render('error', { error: 'Database Error', message: err.message });
  }
};

// Create a new report (can be used by admins or forwarded from users)
exports.createReport = async (req, res) => {
  try {
    const reporter = req.session && req.session.username ? req.session.username : (req.body.reporter_username || 'anonymous');
    const title = req.body.title || '(no title)';
    const description = req.body.description || '';

    try {
      await db.pool.query('INSERT INTO admin_reports (reporter_username, title, description, status, created_at) VALUES (?, ?, ?, ?, NOW())', [reporter, title, description, 'open']);
    } catch (err) {
      // If table doesn't exist, log and continue
      console.log('Could not insert report (table may be missing):', err.message);
    }

    res.redirect('/admin/reports');
  } catch (err) {
    console.error('Create report error:', err);
    res.status(500).render('error', { error: 'Error', message: err.message });
  }
};

// Resolve (close) a report
exports.resolveReport = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid report id' });

    try {
      await db.pool.query('UPDATE admin_reports SET status = ? WHERE id = ?', ['resolved', id]);
    } catch (err) {
      console.log('Could not update report (table may be missing):', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Resolve report error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Assign orphan books (owner_id IS NULL) to the admin user (first user with role='admin')
exports.assignOrphansToAdmin = async (req, res) => {
  try {
    // find an admin account
    const [admins] = await db.pool.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
    if (!admins || admins.length === 0) {
      return res.status(400).json({ error: 'No admin user found to assign to' });
    }
    const adminId = admins[0].id;

    const [result] = await db.pool.query('UPDATE books SET owner_id = ? WHERE owner_id IS NULL', [adminId]);

    res.json({ success: true, assigned: result.affectedRows, adminId });
  } catch (err) {
    console.error('Assign orphan books error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Tickets feature removed per request

// Admin: Get detail for a specific exchange request (JSON for modal)
exports.exchangeDetail = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid id' });

    // Try the detailed view first for consistent fields
    let request = null;
    try {
      const [rows] = await db.pool.query('SELECT * FROM exchange_requests_detailed WHERE id = ? LIMIT 1', [id]);
      if (rows && rows.length) request = rows[0];
    } catch (e) {
      // view may not exist; fallback to manual join
    }

    if (!request) {
      const [rows] = await db.pool.query(`
        SELECT er.*, 
               ru.username as requester_username,
               ou.username as owner_username,
               rb.title as requested_book_title, rb.thumbnail as requested_book_thumbnail, rb.image as requested_book_image,
               ob.title as offered_book_title, ob.thumbnail as offered_book_thumbnail, ob.image as offered_book_image
        FROM exchange_requests er
        LEFT JOIN users ru ON er.requester_id = ru.id
        LEFT JOIN users ou ON er.book_owner_id = ou.id
        LEFT JOIN books rb ON er.requested_book_id = rb.id
        LEFT JOIN books ob ON er.offered_book_id = ob.id
        WHERE er.id = ?
        LIMIT 1
      `, [id]);
      if (rows && rows.length) request = rows[0];
    }

    if (!request) return res.status(404).json({ success: false, error: 'Not found' });

    // Normalize thumbnails for frontend rendering
    function normalize(src) {
      if (!src) return '/images/placeholder.png';
      src = String(src).trim();
      if (/^https?:\/\//i.test(src)) return src;
      if (src.startsWith('/')) return src;
      return '/uploads/' + src;
    }
    request.requested_book_thumbnail = normalize(request.requested_book_thumbnail || request.requested_book_image);
    request.offered_book_thumbnail = normalize(request.offered_book_thumbnail || request.offered_book_image);

    // History timeline from exchange_history (if exists)
    let history = [];
    try {
      const [hrows] = await db.pool.query(`
        SELECT eh.*, 
               u1.username as user1_username, u2.username as user2_username,
               b1.title as book1_title, b2.title as book2_title
        FROM exchange_history eh
        LEFT JOIN users u1 ON eh.user1_id = u1.id
        LEFT JOIN users u2 ON eh.user2_id = u2.id
        LEFT JOIN books b1 ON eh.book1_id = b1.id
        LEFT JOIN books b2 ON eh.book2_id = b2.id
        WHERE eh.exchange_request_id = ?
        ORDER BY eh.exchange_date ASC
      `, [id]);
      history = hrows || [];
    } catch (e) {
      // table may not exist; ignore
    }

    // Build simple timeline from request fields + history
    const timeline = [];
    if (request.created_at) timeline.push({ type: 'created', label: 'ส่งคำขอ', at: request.created_at });
    if (request.status === 'accepted' && request.updated_at) timeline.push({ type: 'accepted', label: 'อนุมัติคำขอ', at: request.updated_at });
    if (request.status === 'rejected' && request.updated_at) timeline.push({ type: 'rejected', label: 'ปฏิเสธคำขอ', at: request.updated_at });
    if (request.completed_at) timeline.push({ type: 'completed', label: 'แลกเปลี่ยนสำเร็จ', at: request.completed_at });
    if (history && history.length) {
      history.forEach(h => {
        timeline.push({ type: 'history', label: 'บันทึกลงประวัติ', at: h.exchange_date });
      });
    }

    return res.json({ success: true, request, history, timeline });
  } catch (err) {
    console.error('exchangeDetail error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
};

// Admin: Full page detail render
exports.exchangeDetailPage = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.redirect('/admin/exchanges');

    // Reuse the logic from exchangeDetail
    // Try detailed view first
    let request = null;
    try {
      const [rows] = await db.pool.query('SELECT * FROM exchange_requests_detailed WHERE id = ? LIMIT 1', [id]);
      if (rows && rows.length) request = rows[0];
    } catch (e) {}

    if (!request) {
      const [rows] = await db.pool.query(`
        SELECT er.*, 
               ru.username as requester_username,
               ou.username as owner_username,
               rb.title as requested_book_title, rb.thumbnail as requested_book_thumbnail, rb.image as requested_book_image,
               ob.title as offered_book_title, ob.thumbnail as offered_book_thumbnail, ob.image as offered_book_image
        FROM exchange_requests er
        LEFT JOIN users ru ON er.requester_id = ru.id
        LEFT JOIN users ou ON er.book_owner_id = ou.id
        LEFT JOIN books rb ON er.requested_book_id = rb.id
        LEFT JOIN books ob ON er.offered_book_id = ob.id
        WHERE er.id = ?
        LIMIT 1
      `, [id]);
      if (rows && rows.length) request = rows[0];
    }

    if (!request) return res.redirect('/admin/exchanges');

    function normalize(src) {
      if (!src) return '/images/placeholder.png';
      src = String(src).trim();
      if (/^https?:\/\//i.test(src)) return src;
      if (src.startsWith('/')) return src;
      return '/uploads/' + src;
    }
    request.requested_book_thumbnail = normalize(request.requested_book_thumbnail || request.requested_book_image);
    request.offered_book_thumbnail = normalize(request.offered_book_thumbnail || request.offered_book_image);

    let history = [];
    try {
      const [hrows] = await db.pool.query(`
        SELECT eh.*, 
               u1.username as user1_username, u2.username as user2_username,
               b1.title as book1_title, b2.title as book2_title
        FROM exchange_history eh
        LEFT JOIN users u1 ON eh.user1_id = u1.id
        LEFT JOIN users u2 ON eh.user2_id = u2.id
        LEFT JOIN books b1 ON eh.book1_id = b1.id
        LEFT JOIN books b2 ON eh.book2_id = b2.id
        WHERE eh.exchange_request_id = ?
        ORDER BY eh.exchange_date ASC
      `, [id]);
      history = hrows || [];
    } catch (e) {}

    const timeline = [];
    if (request.created_at) timeline.push({ type: 'created', label: 'ส่งคำขอ', at: request.created_at });
    if (request.status === 'accepted' && request.updated_at) timeline.push({ type: 'accepted', label: 'อนุมัติคำขอ', at: request.updated_at });
    if (request.status === 'rejected' && request.updated_at) timeline.push({ type: 'rejected', label: 'ปฏิเสธคำขอ', at: request.updated_at });
    if (request.completed_at) timeline.push({ type: 'completed', label: 'แลกเปลี่ยนสำเร็จ', at: request.completed_at });
    if (history && history.length) {
      history.forEach(h => timeline.push({ type: 'history', label: 'บันทึกลงประวัติ', at: h.exchange_date }));
    }

    return res.render('admin/exchange_view', {
      user: { 
        id: req.session.userId, 
        username: req.session.username, 
        isAdmin: req.session.isAdmin 
      },
      request,
      timeline,
      history
    });
  } catch (err) {
    console.error('exchangeDetailPage error:', err);
    return res.redirect('/admin/exchanges');
  }
};