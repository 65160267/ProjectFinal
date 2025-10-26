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
    
    // Check if exchange_requests table exists
    let exchanges = [];
    let totalPages = 1;
    
    try {
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
        LEFT JOIN users ou ON er.owner_id = ou.id
        ORDER BY er.created_at DESC 
        LIMIT ? OFFSET ?
      `, [limit, offset]);
      
      exchanges = exchangeData;
      
      const [totalCount] = await db.pool.query('SELECT COUNT(*) as count FROM exchange_requests');
      totalPages = Math.ceil(totalCount[0].count / limit);
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
      totalPages
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

// Tickets list (separate from admin_reports)
exports.ticketsList = async (req, res) => {
  try {
    const [tickets] = await db.pool.query('SELECT t.*, u.username as owner_username FROM tickets t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC LIMIT 200');
    res.render('admin/tickets', {
      user: {
        id: req.session.userId,
        username: req.session.username,
        isAdmin: req.session.isAdmin
      },
      tickets
    });
  } catch (err) {
    console.error('Admin tickets error:', err);
    res.status(500).render('error', { error: 'Database Error', message: err.message });
  }
};

// Ticket detail and comments
exports.ticketView = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.redirect('/admin/tickets');

    const [[ticketRows]] = await db.pool.query('SELECT t.*, u.username as owner_username FROM tickets t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = ?', [id]);
    const [comments] = await db.pool.query('SELECT tc.*, u.username FROM ticket_comments tc LEFT JOIN users u ON tc.user_id = u.id WHERE tc.ticket_id = ? ORDER BY tc.created_at ASC', [id]);

    res.render('admin/ticket_view', {
      user: { id: req.session.userId, username: req.session.username, isAdmin: req.session.isAdmin },
      ticket: ticketRows || null,
      comments
    });
  } catch (err) {
    console.error('Ticket view error:', err);
    res.status(500).render('error', { error: 'Error', message: err.message });
  }
};

// Post a comment on a ticket
exports.postTicketComment = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = (req.body.body || '').toString();
    const userId = req.session && req.session.userId ? req.session.userId : null;
    const username = req.session && req.session.username ? req.session.username : (req.body.username || 'anonymous');

    if (!id || !body) return res.status(400).json({ error: 'Invalid' });

    await db.pool.query('INSERT INTO ticket_comments (ticket_id, user_id, username, body) VALUES (?, ?, ?, ?)', [id, userId, username, body]);

    res.redirect('/admin/tickets/' + id);
  } catch (err) {
    console.error('Post ticket comment error:', err);
    res.status(500).render('error', { error: 'Error', message: err.message });
  }
};

// Close ticket
exports.closeTicket = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ticket id' });
    await db.pool.query('UPDATE tickets SET status = ? WHERE id = ?', ['closed', id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Close ticket error:', err);
    res.status(500).json({ error: err.message });
  }
};