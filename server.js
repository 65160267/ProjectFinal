const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');

const { pool } = require('./db');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server);

// (global error handlers removed during revert)

// middleware
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'keyboard cat',
  resave: false,
  saveUninitialized: true,
}));

// Ensure 'user' is available to all templates when session exists (for header/footer + notify)
app.use(async (req, res, next) => {
    try {
        const normalizeAvatar = (v) => {
            if (!v) return undefined;
            const s = String(v).trim();
            if (!s || ['avatar','null','undefined'].includes(s.toLowerCase())) return undefined;
            if (s.startsWith('http')) return s;
            if (s.startsWith('/')) return s;
            if (s.indexOf('.') === -1) return undefined;
            return '/uploads/' + s;
        };
        if (req.session && req.session.userId) {
            if (!res.locals.user) res.locals.user = {};
            res.locals.user.id = req.session.userId;
            res.locals.user.username = req.session.username || undefined;
            // First try existing session avatar
            let avatar = normalizeAvatar(req.session.avatar);
            // If missing, attempt to load from users table (only if column exists)
            if (!avatar) {
                try {
                    const [cols] = await pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='avatar'");
                    if (cols && cols.length > 0) {
                        const [[row]] = await pool.query('SELECT avatar FROM users WHERE id = ? LIMIT 1', [req.session.userId]);
                        if (row && row.avatar) {
                            avatar = normalizeAvatar(row.avatar);
                            if (avatar) req.session.avatar = avatar; // cache into session
                        }
                    }
                } catch (e) { /* ignore db avatar load errors */ }
            }
            res.locals.user.avatar = avatar || '/images/profile-placeholder.svg';
        }
        res.locals.currentPath = req.path;
    } catch (e) { /* ignore */ }
    next();
});

// Per-request user stats (items, completed exchanges, views) for templates
app.use(async (req, res, next) => {
    try {
        if (!req.session || !req.session.userId) {
            res.locals.userStats = { items: 0, exchanges: 0, views: 0 };
            return next();
        }
        const uid = req.session.userId;
        // run 3 quick subqueries in one roundtrip
        const sql = `
            SELECT
                (SELECT COUNT(*) FROM books WHERE owner_id = ?) AS items,
                (SELECT COUNT(*) FROM exchange_requests WHERE status = 'completed' AND (requester_id = ? OR book_owner_id = ?)) AS exchanges,
                (SELECT COUNT(*) FROM book_views v JOIN books b ON v.book_id = b.id WHERE b.owner_id = ?) AS views
        `;
        let items = 0, exchanges = 0, views = 0;
        try {
            const [rows] = await pool.query(sql, [uid, uid, uid, uid]);
            if (rows && rows[0]) {
                items = rows[0].items || 0;
                exchanges = rows[0].exchanges || 0;
                views = rows[0].views || 0;
            }
        } catch (e) {
            // fallback if book_views or exchange_requests not present
            try {
                const [[{ cntItems }]] = await pool.query('SELECT COUNT(*) AS cntItems FROM books WHERE owner_id = ?', [uid]);
                items = cntItems || 0;
            } catch {}
            try {
                const [[{ cntEx }]] = await pool.query("SELECT COUNT(*) AS cntEx FROM exchange_requests WHERE status = 'completed' AND (requester_id = ? OR book_owner_id = ?)", [uid, uid]);
                exchanges = cntEx || 0;
            } catch {}
            // views left as 0 if table missing
        }
        res.locals.userStats = { items, exchanges, views };
        return next();
    } catch (err) {
        res.locals.userStats = { items: 0, exchanges: 0, views: 0 };
        return next();
    }
});

// New lightweight Socket.IO namespace for messages
// This replaces the legacy chat handlers. It uses an in-memory store for quick setup.
const messagesNamespace = io.of('/messages');
const inMemoryMessages = {}; // { roomName: [{ user, text, time }] }

messagesNamespace.on('connection', (socket) => {
    socket.on('join', (room) => {
        socket.join(room);
        socket.emit('joined', { room });
    });

    socket.on('send', ({ room, user, text }) => {
        const msg = { user, text, time: new Date() };
        inMemoryMessages[room] = inMemoryMessages[room] || [];
        inMemoryMessages[room].push(msg);
        messagesNamespace.to(room).emit('message', msg);

        // Lightweight notify event for global header badge (no room join required)
        try {
            const parts = String(room || '').split('_');
            let a = null, b = null;
            if (parts.length === 3 && parts[0] === 'chat') {
                a = Number(parts[1]);
                b = Number(parts[2]);
            }
            const fromId = (user && user.id) ? Number(user.id) : null;
            let toId = null;
            if (fromId != null && a != null && b != null) {
                toId = (fromId === a) ? b : (fromId === b ? a : null);
            }
            messagesNamespace.emit('notify', {
                room,
                fromId,
                toId,
                preview: String(text || '').slice(0, 80),
                time: Date.now()
            });
        } catch (e) {
            // ignore notify errors
        }

        // Persist to DB so conversation list can be built from history
        (async () => {
            try {
                if (!pool) return;
                // ensure conversation row exists
                let convId = null;
                try {
                    const [[existing]] = await pool.query('SELECT id FROM chat_conversations WHERE room = ? LIMIT 1', [room]);
                    if (existing && existing.id) convId = existing.id; else {
                        const parts = String(room || '').split('_');
                        let a = null, b = null;
                        if (parts.length === 3 && parts[0] === 'chat') { a = parts[1]; b = parts[2]; }
                        const ins = await pool.query('INSERT INTO chat_conversations (room, user_a, user_b) VALUES (?, ?, ?)', [room, a || null, b || null]);
                        convId = ins && ins[0] && ins[0].insertId ? ins[0].insertId : null;
                    }
                } catch (e) { /* ignore */ }

                try {
                    await pool.query(
                        'INSERT INTO chat_messages (conversation_id, room, username, user_id, message) VALUES (?, ?, ?, ?, ?)',
                        [convId, room, (user && (user.username || user)) || null, (user && user.id) || null, text]
                    );
                } catch (e) { /* ignore */ }
            } catch (e) { /* ignore */ }
        })();
    });

    socket.on('getHistory', (room) => {
        socket.emit('history', inMemoryMessages[room] || []);
    });
});

// Legacy/global chat handlers (restore compatibility with older clients)
io.on('connection', (socket) => {
    socket.on('joinRoom', (room) => {
        socket.join(room);
    });

    socket.on('chatMessage', async (data) => {
        try {
            const { room, user, message } = data || {};
            // emit to room
            io.to(room).emit('chatMessage', { user: user && (user.username || user), message, time: new Date() });

            // try to persist to DB if pool is available and tables exist
            if (typeof pool !== 'undefined' && pool) {
                // ensure conversation exists
                let convId = null;
                try {
                    const [[existing]] = await pool.query('SELECT id FROM chat_conversations WHERE room = ? LIMIT 1', [room]);
                    if (existing && existing.id) convId = existing.id;
                    else {
                        // try to parse room like chat_1_2
                        const parts = String(room || '').split('_');
                        let a = null, b = null;
                        if (parts.length === 3 && parts[0] === 'chat') { a = parts[1]; b = parts[2]; }
                        const insertRes = await pool.query('INSERT INTO chat_conversations (room, user_a, user_b) VALUES (?, ?, ?)', [room, a || null, b || null]);
                        convId = insertRes && insertRes[0] && insertRes[0].insertId ? insertRes[0].insertId : null;
                    }
                } catch (e) {
                    // ignore DB conversation errors
                    console.error('chat conversation upsert error', e && e.message);
                }

                try {
                    await pool.query('INSERT INTO chat_messages (conversation_id, room, username, user_id, message) VALUES (?, ?, ?, ?, ?)', [convId, room, user && (user.username || user), user && user.id ? user.id : null, message]);
                } catch (e) {
                    console.error('chat message insert error', e && e.message);
                }
            }
        } catch (err) {
            console.error('chatMessage handler error', err && err.message);
        }
    });
});

// routes (will be created)
const indexRoutes = require('./routes/indexRoutes');
const bookRoutes = require('./routes/bookRoutes');
const authRoutes = require('./routes/authRoutes');
const exchangeRoutes = require('./routes/exchangeRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminNotify = require('./controllers/adminNotify');
const reportRoutes = require('./routes/reportRoutes');
// design preview route (temporary)
app.get('/designed', (req, res) => res.render('designed'));

// debug route
app.get('/debug', async (req, res) => {
    try {
        // ดูข้อมูลผู้ใช้
        const [users] = await pool.query('SELECT id, username FROM users');
        
        // ดูข้อมูลหนังสือ
        const [books] = await pool.query('SELECT id, title, owner_id, created_at FROM books ORDER BY created_at DESC');
        
        // สร้างการเชื่อมโยงระหว่าง user และ books
        const userBooksMap = {};
        users.forEach(user => {
            userBooksMap[user.id] = {
                user: user,
                books: books.filter(book => book.owner_id === user.id)
            };
        });
        
        // หนังสือที่ไม่มี owner
        const orphanBooks = books.filter(book => book.owner_id === null);
        
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Debug Database</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="stylesheet" href="/css/style.css" />
            <style>
                body { font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; margin:0; background:#f3f8ff; color: #1f2937; }
                .container { max-width: 1100px; margin: 0 auto; padding: 18px; }
                .hero { background: linear-gradient(135deg,#4f46e5,#06b6d4); color:#fff; padding: 20px 0; box-shadow: 0 6px 20px rgba(0,0,0,0.12); }
                .hero .container { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
                .hero-title { margin:0; font-weight:900; letter-spacing:.3px; }
                .section { margin: 18px 0; padding: 18px; background: #ffffff; border-radius: 12px; box-shadow: 0 6px 20px rgba(28,20,10,0.06); }
                .user { background: #f0f8ff; margin: 10px 0; padding: 12px; border-radius: 8px; }
                .book { background: #f9fafb; margin: 6px 0; padding: 10px; border-radius: 6px; border: 1px solid #e5e7eb; }
                .orphan { background: #fff7ed; border: 1px solid #fde68a; }
                table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 10px; overflow: hidden; }
                th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid #e5e7eb; }
                th { background: #eef2ff; font-weight: 800; color: #111827; position: sticky; top: 0; z-index: 1; }
                tr:hover { background: #fafafa; }
                .highlight { background: #fff3cd; }
                .nav { margin: 0; display:flex; gap:12px; flex-wrap:wrap; }
                .nav a { display: inline-flex; align-items:center; gap:8px; padding: 10px 14px; border-radius: 8px; text-decoration: none; font-weight: 700; background: linear-gradient(135deg,#4f46e5,#06b6d4); color: #fff; box-shadow: 0 8px 18px rgba(0,0,0,0.12); }
                .nav a:hover { filter: brightness(1.05); transform: translateY(-1px); }
                .badge { display:inline-block; padding:4px 10px; border-radius:999px; background:#e0f2fe; color:#075985; font-weight:800; font-size:12px; }
            </style>
        </head>
        <body>
            <header class="hero">
              <div class="container">
                <h1 class="hero-title">🔍 Database Debug Page</h1>
                <div class="nav">
                        <a href="/admin">← กลับหน้าหลัก</a>
                    <a href="/auth/logout">� ออกจากระบบ</a>
                                </div>
                            </div>
            </header>
            <div class="container">
                
                <div class="section">
                    <h2>📊 สรุปข้อมูล</h2>
                                        <p>
                                            <span class="badge">👥 ผู้ใช้: ${users.length}</span>
                                            <span class="badge" style="margin-left:8px;">📚 หนังสือทั้งหมด: ${books.length}</span>
                                            <span class="badge" style="margin-left:8px; background:#fff1f2; color:#b91c1c;">🚫 ไม่มีเจ้าของ: ${orphanBooks.length}</span>
                                        </p>
                                        <p><strong>Session:</strong> ${req.session.userId ? `Logged in as User ID: ${req.session.userId}` : 'Not logged in'}</p>
                </div>
                
                <div class="section">
                    <h2>📚 รายการหนังสือทั้งหมด</h2>
                    <table>
                        <tr>
                            <th>ID</th>
                            <th>ชื่อหนังสือ</th>
                            <th>Owner ID</th>
                            <th>วันที่สร้าง</th>
                            <th>สถานะ</th>
                        </tr>
                        ${books.map(book => `
                            <tr class="${book.owner_id ? '' : 'highlight'}">
                                <td>${book.id}</td>
                                <td>${book.title}</td>
                                <td>${book.owner_id || '<span style="color: red;">NULL</span>'}</td>
                                <td>${new Date(book.created_at).toLocaleString('th-TH')}</td>
                                <td>${book.owner_id ? '✅ มีเจ้าของ' : '❌ ไม่มีเจ้าของ'}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
                
                <div class="section">
                    <h2>👥 ผู้ใช้และหนังสือของพวกเขา</h2>
                    ${Object.values(userBooksMap).map(userInfo => `
                        <div class="user">
                            <h3>👤 ${userInfo.user.username} (ID: ${userInfo.user.id})</h3>
                            <p><strong>จำนวนหนังสือ:</strong> ${userInfo.books.length} เล่ม</p>
                            ${userInfo.books.length > 0 ? `
                                ${userInfo.books.map(book => `
                                    <div class="book">📖 ${book.title} <small>(ID: ${book.id})</small></div>
                                `).join('')}
                            ` : '<p style="color: #666; font-style: italic;">ไม่มีหนังสือ</p>'}
                        </div>
                    `).join('')}
                </div>
                
                ${orphanBooks.length > 0 ? `
                <div class="section orphan">
                    <h2>🚫 หนังสือที่ไม่มีเจ้าของ</h2>
                    <p>หนังสือเหล่านี้ไม่มี owner_id จึงไม่แสดงในโปรไฟล์ของใคร:</p>
                    ${orphanBooks.map(book => `
                        <div class="book">📖 <strong>${book.title}</strong> (ID: ${book.id}) - สร้างเมื่อ: ${new Date(book.created_at).toLocaleString('th-TH')}</div>
                    `).join('')}
                    
                    <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border-radius: 5px;">
                        <h4>💡 วิธีแก้ไข:</h4>
                        <ol>
                            <li>เข้าสู่ระบบ</li>
                            <li>เพิ่มหนังสือใหม่ผ่าน <a href="/books/new">หน้าเพิ่มหนังสือ</a></li>
                            <li>หนังสือใหม่จะมี owner_id อัตโนมัติ</li>
                        </ol>
                    </div>
                </div>
                ` : ''}
                
            </div>
        </body>
        </html>
        `;
        
        res.send(html);
    } catch (error) {
        res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
    }
});

// admin notification middleware - provide open reports count to templates
app.use(adminNotify);

app.use('/', indexRoutes);
app.use('/books', bookRoutes);
app.use('/auth', authRoutes);
app.use('/exchange', exchangeRoutes);
app.use('/admin', adminRoutes);
// public reports endpoint for users to submit issues
app.use('/reports', reportRoutes);

const port = process.env.PORT || 3000;

// Run lightweight migration: ensure exchange_history table exists so history feature works
async function runMigrationsAndStart() {
    try {
            // Create exchange_history table without strict foreign keys to avoid migration failure
            const createExchangeHistory = `
                CREATE TABLE IF NOT EXISTS exchange_history (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    exchange_request_id INT NOT NULL,
                    user1_id INT NOT NULL,
                    user2_id INT NOT NULL,
                    book1_id INT NOT NULL,
                    book2_id INT NULL,
                    exchange_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    rating_user1 INT NULL,
                    rating_user2 INT NULL,
                    review_user1 TEXT,
                    review_user2 TEXT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `;

        await pool.query(createExchangeHistory);
        console.log('Migrations: ensured exchange_history table exists');
        // ensure admin_reports table exists for admin panel
        const createAdminReports = `
            CREATE TABLE IF NOT EXISTS admin_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                reporter_username VARCHAR(191) DEFAULT NULL,
                title VARCHAR(255) DEFAULT NULL,
                description TEXT,
                status VARCHAR(32) DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `;
        await pool.query(createAdminReports);
        console.log('Migrations: ensured admin_reports table exists');

        // ensure core exchange_requests table exists so admin/exchanges and exchange flow can work
        try {
            const createExchangeRequests = `
                CREATE TABLE IF NOT EXISTS exchange_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    requester_id INT NOT NULL,
                    book_owner_id INT NOT NULL,
                    requested_book_id INT NOT NULL,
                    offered_book_id INT NULL,
                    message TEXT,
                    status ENUM('pending','accepted','rejected','completed','cancelled') DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `;
            await pool.query(createExchangeRequests);
            console.log('Migrations: ensured exchange_requests table exists');
        } catch (e) {
            console.error('Migration (exchange_requests) error (non-fatal):', e && e.message);
        }

        // ensure books.owner_id exists for per-user filtering on /books
        try {
            await pool.query("ALTER TABLE books ADD COLUMN IF NOT EXISTS owner_id INT NULL");
            console.log('Migrations: ensured books.owner_id exists');
        } catch (e) {
            // ignore if table doesn't exist in minimal setups
        }
        try {
            await pool.query("ALTER TABLE exchange_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL");
            console.log('Migrations: ensured exchange_requests.completed_at exists');
        } catch (e) {
            // ignore
        }
        // track views on book detail pages
        try {
            const createBookViews = `
                CREATE TABLE IF NOT EXISTS book_views (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    book_id INT NOT NULL,
                    viewer_id INT NULL,
                    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_book (book_id),
                    INDEX idx_viewer (viewer_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `;
            await pool.query(createBookViews);
            console.log('Migrations: ensured book_views table exists');
        } catch (e) {
            // ignore
        }
        // Create chat tables used by /messages namespace
        try {
            const createChatConversations = `
                CREATE TABLE IF NOT EXISTS chat_conversations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    room VARCHAR(191) NOT NULL UNIQUE,
                    user_a INT NULL,
                    user_b INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `;
            const createChatMessages = `
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    conversation_id INT NULL,
                    room VARCHAR(191) NOT NULL,
                    username VARCHAR(191) DEFAULT NULL,
                    user_id INT DEFAULT NULL,
                    message TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_room (room),
                    INDEX idx_user (user_id),
                    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `;
            await pool.query(createChatConversations);
            await pool.query(createChatMessages);
            console.log('Migrations: ensured chat tables exist');
        } catch (e) {
            console.error('Migration (chat tables) error (non-fatal):', e && e.message);
        }
    } catch (migErr) {
        console.error('Migration error (non-fatal):', migErr && migErr.message);
    }

    server.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

runMigrationsAndStart();

module.exports = { app, server, io };
